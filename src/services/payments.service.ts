import { In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Payment } from '../entities/Payment';
import { Booking } from '../entities/Booking';
import { updateBookingPaymentStatus, updateBookingStatus, handleBookingConfirmationSideEffects } from './bookings.service';
import { sendEmail } from './notifications.service';
import { sendPaymentSuccessWhatsApp } from './whatsapp-notifications.service';

import { UserMembership } from '../entities/UserMembership';
import { MembershipPlan } from '../entities/MembershipPlan';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const repo = () => AppDataSource.getRepository(Payment);

let razor: any = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razor = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}


const activateMembershipForBooking = async (bookingId: number) => {
  try {
    const bookingRepo = AppDataSource.getRepository('Booking');
    const booking = await bookingRepo.findOneBy({ id: bookingId }) as any;
    if (booking && booking.suiteId === 0 && String(booking.eventType).startsWith('package:')) {
      const planId = Number(String(booking.eventType).split(':')[1]);
      if (planId) {
        const planRepo = AppDataSource.getRepository(MembershipPlan);
        const userMembershipRepo = AppDataSource.getRepository(UserMembership);
        const paymentRepo = AppDataSource.getRepository(Payment);
        
        const plan = await planRepo.findOneBy({ id: planId });
        if (plan) {
          // Find the successful payment for this package purchase booking
          const payment = await paymentRepo.findOne({
            where: { bookingId, status: 'success' },
            order: { createdAt: 'DESC' }
          });

          // Deactivate existing active memberships of this user
          await userMembershipRepo.update({ userId: booking.userId, status: 'active' }, { status: 'inactive' });

          const now = new Date();
          const expiry = new Date();
          expiry.setDate(now.getDate() + plan.validityDays);

          const userMembership = userMembershipRepo.create({
            userId: booking.userId,
            planId: plan.id,
            planName: plan.name,
            maxFreeBookings: plan.maxFreeBookings ?? 10,
            bookingsUsed: 0,
            eligibleSuites: plan.eligibleSuites || [],
            activationDate: now,
            expiryDate: expiry,
            status: 'active',
            paymentId: payment?.providerPaymentId || `MEM-PAY-BK-${bookingId}`,
            paymentStatus: (payment?.status === 'failed' ? 'failed' : (payment?.status === 'pending' ? 'pending' : 'success')) as 'pending' | 'success' | 'failed',
            amountPaid: payment ? Number(payment.amount) : plan.price,
          });

          await userMembershipRepo.save(userMembership);
          console.log(`Activated ${plan.name} Package for user ${booking.userId} from booking ${bookingId}`);
        }
      }
    }
  } catch (err) {
    console.warn('activateMembershipForBooking failed:', err);
  }
};

const updateFullPaymentStatus = async (bookingId: number) => {
  try {
    const bookingRepo = AppDataSource.getRepository(Booking);
    const booking = await bookingRepo.findOneBy({ id: bookingId });
    if (!booking) return;

    const paymentRepo = AppDataSource.getRepository(Payment);

    let bookingsToCheck = [booking];
    if (booking.orderId) {
      const relatedBookings = await bookingRepo.find({ where: { orderId: booking.orderId } });
      if (relatedBookings.length > 0) {
        bookingsToCheck = relatedBookings;
      }
    }

    const bookingIds = bookingsToCheck.map(b => b.id);
    const successfulPayments = await paymentRepo.find({
      where: { bookingId: In(bookingIds), status: 'success' }
    });

    const totalPaid = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRequired = bookingsToCheck.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    if (totalPaid >= totalRequired - 1 || booking.paymentMode === 'package_credit') {
      for (const b of bookingsToCheck) {
        const alreadyConfirmed = b.status === 'confirmed';
        b.fullPaymentReceived = true;
        b.status = 'confirmed';
        await bookingRepo.save(b);
        if (!alreadyConfirmed) {
          await handleBookingConfirmationSideEffects(b.id);
        }
      }
    }
  } catch (err) {
    console.warn('updateFullPaymentStatus failed:', err);
  }
};

export const listPaymentMethods = () => [
  { id: 'razorpay', name: 'Razorpay', supported: true },
  { id: 'upi', name: 'UPI', supported: true },
  { id: 'credit_card', name: 'Credit Card', supported: true },
  { id: 'debit_card', name: 'Debit Card', supported: true },
  { id: 'net_banking', name: 'Net Banking', supported: true },
  { id: 'wallet', name: 'Wallet', supported: true },
];

export const createRazorpayOrder = async (bookingId: number, amount: number, method: string) => {
  const payment = repo().create({ bookingId, amount, method, provider: 'razorpay', status: 'pending' });
  const saved = await repo().save(payment);

  // Fail loudly if Razorpay is not configured.
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment.');
  }
  if (!razor) {
    // Should not happen if env checks above are correct, but keep it safe.
    throw new Error('Razorpay client was not initialized. Check Razorpay env credentials.');
  }

  try {
    const order = await razor.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `rcpt_${saved.id}`,
    });
    saved.providerOrderId = order.id;
    await repo().save(saved);
    return { payment: saved, orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID };
  } catch (err: any) {
    console.warn('Razorpay order create failed', err);
    // Bubble up the real Razorpay error to the frontend.
    throw new Error(err?.message || 'Unable to create Razorpay order');
  }
};

export const createPaymentIntent = async (bookingId: number, amount: number, method: string) => {
  const result = await createRazorpayOrder(bookingId, amount, method);
  return result.payment;
};

export const findPaymentById = async (id: number) => repo().findOneBy({ id });

export const listPayments = async () => repo().find({ relations: ['booking', 'booking.user'], order: { createdAt: 'DESC' } });

export const listMyPayments = async (userId: number) => repo().find({
  where: { booking: { userId } },
  relations: ['booking'],
  order: { createdAt: 'DESC' },
});

export const verifyAndConfirmPayment = async (
  paymentId: number,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) => {
  const payment = await repo().findOneBy({ id: paymentId });
  if (!payment) throw new Error('Payment not found');

  // Verify Razorpay signature
  if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature) {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    if (expectedSig !== razorpaySignature) {
      payment.status = 'failed';
      await repo().save(payment);
      await updateBookingPaymentStatus(payment.bookingId, 'failed');
      throw new Error('Payment signature verification failed');
    }
  }

  payment.status = 'success';
  payment.providerPaymentId = razorpayPaymentId;
  payment.providerOrderId = razorpayOrderId;
  payment.providerSignature = razorpaySignature;
  await repo().save(payment);

  const bookingRepo = AppDataSource.getRepository('Booking');
  const primaryBooking = await bookingRepo.findOne({ where: { id: payment.bookingId } }) as any;
  
  let bookingIdsToConfirm = [payment.bookingId];
  if (primaryBooking?.orderId) {
    const relatedBookings = await bookingRepo.find({ where: { orderId: primaryBooking.orderId } }) as any[];
    if (relatedBookings.length > 0) {
      bookingIdsToConfirm = relatedBookings.map(b => b.id);
    }
  }

  for (const bId of bookingIdsToConfirm) {
    await updateBookingPaymentStatus(bId, 'success');
    await activateMembershipForBooking(bId);
    await updateFullPaymentStatus(bId);

    try {
      const booking = await bookingRepo.findOne({ where: { id: bId }, relations: ['user'] }) as any;
      if (booking?.user) {
        const fullName = booking.user?.fullName || '';
        const [firstName, ...rest] = String(fullName).split(' ');
        const lastName = rest.join(' ');
        await bookingRepo.save({
          id: booking.id,
          guestFirstName: firstName || booking.user?.fullName || undefined,
          guestLastName: lastName || undefined,
          guestEmail: booking.user?.email || undefined,
          guestPhone: booking.user?.phone || undefined,
        });
      }
    } catch (err) {
      console.warn('Guest backfill failed', err);
    }
  }

  // Send confirmation email + WhatsApp concurrently (best-effort)
  await sendPaymentSuccessNotifications(payment);

  return payment;
};

export const sendPaymentSuccessNotifications = async (payment: Payment) => {
  try {
    const bookingRepo = AppDataSource.getRepository('Booking');
    const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] }) as any;
    if (!booking) return;
    const user = booking.user;
    const email = user?.email || booking.guestEmail;
    const name = user?.fullName || `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim() || 'Guest';

    const emailPromise = email
      ? sendEmail(
          email,
          `Booking Confirmed – #VN${payment.bookingId} | VibeNests`,
          `Your booking #VN${payment.bookingId} has been confirmed. Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} received.`,
          buildConfirmationHtml({ bookingId: payment.bookingId, name, booking, amount: Number(payment.amount) }),
        )
      : Promise.resolve();

    const whatsappPromise = sendPaymentSuccessWhatsApp({
      id: payment.bookingId,
      guestPhone: booking.guestPhone ?? user?.phone,
      user: user ? { phone: user.phone, fullName: user.fullName } : null,
      amount: Number(payment.amount),
      guestFirstName: booking.guestFirstName,
      guestLastName: booking.guestLastName,
    } as any);

    await Promise.allSettled([emailPromise, whatsappPromise]);
  } catch (err) {
    console.warn('Payment success notification failed', err);
  }
};

export const verifyPayment = async (paymentId: number, result: { status: 'success' | 'failed'; providerPaymentId?: string; providerOrderId?: string; providerSignature?: string }) => {
  const payment = await repo().findOneBy({ id: paymentId });
  if (!payment) throw new Error('Payment not found');
  payment.status = result.status;
  payment.providerPaymentId = result.providerPaymentId;
  payment.providerOrderId = result.providerOrderId;
  payment.providerSignature = result.providerSignature;
  await repo().save(payment);

  const bookingRepo = AppDataSource.getRepository(Booking);
  const primaryBooking = await bookingRepo.findOne({ where: { id: payment.bookingId } });
  
  let bookingIdsToConfirm = [payment.bookingId];
  if (primaryBooking?.orderId) {
    const relatedBookings = await bookingRepo.find({ where: { orderId: primaryBooking.orderId } });
    if (relatedBookings.length > 0) {
      bookingIdsToConfirm = relatedBookings.map(b => b.id);
    }
  }

  for (const bId of bookingIdsToConfirm) {
    await updateBookingPaymentStatus(bId, result.status === 'success' ? 'success' : 'failed');
    if (result.status === 'success') {
      await activateMembershipForBooking(bId);
      await updateFullPaymentStatus(bId);
    }
  }

  if (result.status === 'success') {
    await sendPaymentSuccessNotifications(payment);
  }

  return payment;
};

function buildConfirmationHtml(opts: { bookingId: number; name: string; booking: any; amount: number }) {
  const { bookingId, name, booking, amount } = opts;
  const footerYear = new Date().getFullYear();

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
      <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
      <div>
        <div style="font-size:16px;font-weight:700;line-height:1">Payment Received</div>
        <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
      </div>
    </div>

    <div style="padding:18px 20px">
      <p style="margin:0 0 14px">Hi <strong>${name}</strong>, your payment was successful and your booking is confirmed.</p>

      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;">
        <div style="margin:0 0 8px"><strong>Booking ID:</strong> #VN${bookingId}</div>
        ${booking?.suiteName ? `<div style="margin:0 0 8px"><strong>Suite:</strong> ${booking.suiteName}</div>` : ''}
        ${booking?.date ? `<div style="margin:0 0 8px"><strong>Date:</strong> ${booking.date}</div>` : ''}
        ${booking?.timeSlot ? `<div style="margin:0 0 8px"><strong>Time:</strong> ${booking.timeSlot}${booking.endTimeSlot ? ' – ' + booking.endTimeSlot : ''}</div>` : ''}
        ${booking?.eventType ? `<div style="margin:0 0 8px"><strong>Occasion:</strong> ${booking.eventType}</div>` : ''}

        <div style="margin-top:10px;border-top:1px solid #eee;padding-top:10px;display:flex;justify-content:space-between">
          <span style="color:#666">Amount Paid</span>
          <span style="font-weight:700">₹${amount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <p style="margin:16px 0 0;color:#666;font-size:13px">For any queries, reply to this email or contact us.</p>
    </div>

    <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
      © ${footerYear} VibeNests. All rights reserved.
    </div>
  </div>`;

  return html;
}

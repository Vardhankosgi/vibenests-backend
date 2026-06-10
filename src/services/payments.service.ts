import { AppDataSource } from '../data-source';
import { Payment } from '../entities/Payment';
import { updateBookingPaymentStatus, updateBookingStatus } from './bookings.service';
import { sendEmail } from './notifications.service';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const repo = () => AppDataSource.getRepository(Payment);

let razor: any = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razor = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

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

export const listPayments = async () => repo().find({ order: { createdAt: 'DESC' } });

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

  await updateBookingPaymentStatus(payment.bookingId, 'success');

  // Confirm full booking only after full payment (pay_now).
  // For pay_at_venue, this is advance-only, so booking remains pending.
  // payment.booking may not be loaded in all contexts, so read from DB.
  const bookingForMode = await AppDataSource.getRepository('Booking').findOne({ where: { id: payment.bookingId } }) as any;
  if (bookingForMode?.paymentMode === 'pay_now') {
    await updateBookingStatus(payment.bookingId, 'confirmed');
  }

  // Ensure booking guest details exist (frontend depends on these fields).
  // If booking-level guest fields are empty, copy from linked user record.
  try {
    const bookingRepo = AppDataSource.getRepository('Booking');
    const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] }) as any;

    if (booking?.user) {
      // Always backfill from booking.user (guest/customer) because some admin/payment flows
      // may create bookings without copying guest fields.
      // This avoids accidentally showing admin details.
      const shouldBackfill = true;

      if (shouldBackfill) {
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
    }
  } catch (err) {
    console.warn('Guest backfill failed', err);
  }

  // Send confirmation email
  try {
    const bookingRepo = AppDataSource.getRepository('Booking');
    const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] }) as any;
    const user = booking?.user;
    const email = user?.email || booking?.guestEmail;
    const name = user?.fullName || `${booking?.guestFirstName ?? ''} ${booking?.guestLastName ?? ''}`.trim() || 'Guest';
    if (email) {
      await sendEmail(
        email,
        `Booking Confirmed – #VN${payment.bookingId} | VibeNests`,
        `Your booking #VN${payment.bookingId} has been confirmed. Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} received.`,
        buildConfirmationHtml({ bookingId: payment.bookingId, name, booking, amount: Number(payment.amount) }),
      );
    }
  } catch (err) {
    console.warn('Confirmation email failed', err);
  }

  return payment;

};

export const verifyPayment = async (paymentId: number, result: { status: 'success' | 'failed'; providerPaymentId?: string; providerOrderId?: string; providerSignature?: string }) => {
  const payment = await repo().findOneBy({ id: paymentId });
  if (!payment) throw new Error('Payment not found');
  payment.status = result.status;
  payment.providerPaymentId = result.providerPaymentId;
  payment.providerOrderId = result.providerOrderId;
  payment.providerSignature = result.providerSignature;
  await repo().save(payment);
  await updateBookingPaymentStatus(payment.bookingId, result.status === 'success' ? 'success' : 'failed');
  if (result.status === 'success') {
    // Confirm full booking only after full payment (pay_now).
    // For pay_at_venue, keep booking pending after advance succeeds.
    const b = await AppDataSource.getRepository('Booking').findOne({ where: { id: payment.bookingId } });
    if ((b as any)?.paymentMode === 'pay_now') {
      await updateBookingStatus(payment.bookingId, 'confirmed');
    }
  }
  try {
    const bookingRepo = AppDataSource.getRepository('Booking');
    const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] });
    const user = (booking as any)?.user;
    if (user?.email && result.status === 'success') {
      await sendEmail(user.email, 'Payment received', `Your payment for booking ${payment.bookingId} succeeded.`);
    }
  } catch (err) {
    console.warn('Notification send failed', err);
  }
  return payment;
};

function buildConfirmationHtml(opts: { bookingId: number; name: string; booking: any; amount: number }) {
  const { bookingId, name, booking, amount } = opts;
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0d14;color:#e8e8e8;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#b8972a,#e2c060);padding:28px 32px">
      <h1 style="margin:0;font-size:22px;color:#0d0d14">Booking Confirmed ✓</h1>
      <p style="margin:6px 0 0;color:#0d0d14;opacity:0.8">VibeNests Private Luxury Suites</p>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 20px">Hi <strong>${name}</strong>, your payment was successful and booking is confirmed!</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888">Booking ID</td><td style="padding:6px 0;text-align:right">#VN${bookingId}</td></tr>
        ${booking?.suiteName ? `<tr><td style="padding:6px 0;color:#888">Suite</td><td style="padding:6px 0;text-align:right">${booking.suiteName}</td></tr>` : ''}
        ${booking?.date ? `<tr><td style="padding:6px 0;color:#888">Date</td><td style="padding:6px 0;text-align:right">${booking.date}</td></tr>` : ''}
        ${booking?.timeSlot ? `<tr><td style="padding:6px 0;color:#888">Time</td><td style="padding:6px 0;text-align:right">${booking.timeSlot}${booking.endTimeSlot ? ' – ' + booking.endTimeSlot : ''}</td></tr>` : ''}
        ${booking?.eventType ? `<tr><td style="padding:6px 0;color:#888">Occasion</td><td style="padding:6px 0;text-align:right">${booking.eventType}</td></tr>` : ''}
        <tr style="border-top:1px solid #333">
          <td style="padding:10px 0 0;font-weight:700;color:#e2c060">Amount Paid</td>
          <td style="padding:10px 0 0;text-align:right;font-weight:700;color:#e2c060">₹${amount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#888">For any queries, reply to this email or contact us.</p>
    </div>
  </div>`;
}

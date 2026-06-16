"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.verifyAndConfirmPayment = exports.listMyPayments = exports.listPayments = exports.findPaymentById = exports.createPaymentIntent = exports.createRazorpayOrder = exports.listPaymentMethods = void 0;
const data_source_1 = require("../data-source");
const Payment_1 = require("../entities/Payment");
const Booking_1 = require("../entities/Booking");
const bookings_service_1 = require("./bookings.service");
const notifications_service_1 = require("./notifications.service");
const whatsapp_notifications_service_1 = require("./whatsapp-notifications.service");
const UserMembership_1 = require("../entities/UserMembership");
const MembershipPlan_1 = require("../entities/MembershipPlan");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const repo = () => data_source_1.AppDataSource.getRepository(Payment_1.Payment);
let razor = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razor = new razorpay_1.default({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}
const activateMembershipForBooking = async (bookingId) => {
    try {
        const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
        const booking = await bookingRepo.findOneBy({ id: bookingId });
        if (booking && booking.suiteId === 0 && String(booking.eventType).startsWith('package:')) {
            const planId = Number(String(booking.eventType).split(':')[1]);
            if (planId) {
                const planRepo = data_source_1.AppDataSource.getRepository(MembershipPlan_1.MembershipPlan);
                const userMembershipRepo = data_source_1.AppDataSource.getRepository(UserMembership_1.UserMembership);
                const paymentRepo = data_source_1.AppDataSource.getRepository(Payment_1.Payment);
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
                        paymentStatus: (payment?.status === 'failed' ? 'failed' : (payment?.status === 'pending' ? 'pending' : 'success')),
                        amountPaid: payment ? Number(payment.amount) : plan.price,
                    });
                    await userMembershipRepo.save(userMembership);
                    console.log(`Activated ${plan.name} Package for user ${booking.userId} from booking ${bookingId}`);
                }
            }
        }
    }
    catch (err) {
        console.warn('activateMembershipForBooking failed:', err);
    }
};
const updateFullPaymentStatus = async (bookingId) => {
    try {
        const bookingRepo = data_source_1.AppDataSource.getRepository(Booking_1.Booking);
        const booking = await bookingRepo.findOneBy({ id: bookingId });
        if (booking) {
            const paymentRepo = data_source_1.AppDataSource.getRepository(Payment_1.Payment);
            const successfulPayments = await paymentRepo.find({
                where: { bookingId, status: 'success' }
            });
            const totalPaid = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
            if (totalPaid >= Number(booking.totalAmount) - 1 || booking.paymentMode === 'package_credit') {
                booking.fullPaymentReceived = true;
                booking.status = 'confirmed';
                await bookingRepo.save(booking);
            }
        }
    }
    catch (err) {
        console.warn('updateFullPaymentStatus failed:', err);
    }
};
const listPaymentMethods = () => [
    { id: 'razorpay', name: 'Razorpay', supported: true },
    { id: 'upi', name: 'UPI', supported: true },
    { id: 'credit_card', name: 'Credit Card', supported: true },
    { id: 'debit_card', name: 'Debit Card', supported: true },
    { id: 'net_banking', name: 'Net Banking', supported: true },
    { id: 'wallet', name: 'Wallet', supported: true },
];
exports.listPaymentMethods = listPaymentMethods;
const createRazorpayOrder = async (bookingId, amount, method) => {
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
    }
    catch (err) {
        console.warn('Razorpay order create failed', err);
        // Bubble up the real Razorpay error to the frontend.
        throw new Error(err?.message || 'Unable to create Razorpay order');
    }
};
exports.createRazorpayOrder = createRazorpayOrder;
const createPaymentIntent = async (bookingId, amount, method) => {
    const result = await (0, exports.createRazorpayOrder)(bookingId, amount, method);
    return result.payment;
};
exports.createPaymentIntent = createPaymentIntent;
const findPaymentById = async (id) => repo().findOneBy({ id });
exports.findPaymentById = findPaymentById;
const listPayments = async () => repo().find({ relations: ['booking', 'booking.user'], order: { createdAt: 'DESC' } });
exports.listPayments = listPayments;
const listMyPayments = async (userId) => repo().find({
    where: { booking: { userId } },
    relations: ['booking'],
    order: { createdAt: 'DESC' },
});
exports.listMyPayments = listMyPayments;
const verifyAndConfirmPayment = async (paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    const payment = await repo().findOneBy({ id: paymentId });
    if (!payment)
        throw new Error('Payment not found');
    // Verify Razorpay signature
    if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature) {
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSig = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');
        if (expectedSig !== razorpaySignature) {
            payment.status = 'failed';
            await repo().save(payment);
            await (0, bookings_service_1.updateBookingPaymentStatus)(payment.bookingId, 'failed');
            throw new Error('Payment signature verification failed');
        }
    }
    payment.status = 'success';
    payment.providerPaymentId = razorpayPaymentId;
    payment.providerOrderId = razorpayOrderId;
    payment.providerSignature = razorpaySignature;
    await repo().save(payment);
    await (0, bookings_service_1.updateBookingPaymentStatus)(payment.bookingId, 'success');
    await activateMembershipForBooking(payment.bookingId);
    await updateFullPaymentStatus(payment.bookingId);
    // Ensure booking guest details exist (frontend depends on these fields).
    // If booking-level guest fields are empty, copy from linked user record.
    try {
        const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
        const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] });
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
    }
    catch (err) {
        console.warn('Guest backfill failed', err);
    }
    // Send confirmation email + WhatsApp concurrently (best-effort)
    try {
        const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
        const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] });
        const user = booking?.user;
        const email = user?.email || booking?.guestEmail;
        const name = user?.fullName || `${booking?.guestFirstName ?? ''} ${booking?.guestLastName ?? ''}`.trim() || 'Guest';
        const emailPromise = email
            ? (0, notifications_service_1.sendEmail)(email, `Booking Confirmed – #VN${payment.bookingId} | VibeNests`, `Your booking #VN${payment.bookingId} has been confirmed. Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} received.`, buildConfirmationHtml({ bookingId: payment.bookingId, name, booking, amount: Number(payment.amount) }))
            : Promise.resolve();
        const whatsappPromise = (0, whatsapp_notifications_service_1.sendPaymentSuccessWhatsApp)({
            id: payment.bookingId,
            guestPhone: booking?.guestPhone ?? user?.phone,
            user: user ? { phone: user.phone, fullName: user.fullName } : null,
            amount: Number(payment.amount),
            guestFirstName: booking?.guestFirstName,
            guestLastName: booking?.guestLastName,
        });
        // Send both in same time (best-effort)
        await Promise.allSettled([emailPromise, whatsappPromise]);
    }
    catch (err) {
        console.warn('Payment success notification failed', err);
    }
    return payment;
};
exports.verifyAndConfirmPayment = verifyAndConfirmPayment;
const verifyPayment = async (paymentId, result) => {
    const payment = await repo().findOneBy({ id: paymentId });
    if (!payment)
        throw new Error('Payment not found');
    payment.status = result.status;
    payment.providerPaymentId = result.providerPaymentId;
    payment.providerOrderId = result.providerOrderId;
    payment.providerSignature = result.providerSignature;
    await repo().save(payment);
    await (0, bookings_service_1.updateBookingPaymentStatus)(payment.bookingId, result.status === 'success' ? 'success' : 'failed');
    if (result.status === 'success') {
        await activateMembershipForBooking(payment.bookingId);
        await updateFullPaymentStatus(payment.bookingId);
    }
    try {
        const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
        const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] });
        const user = booking?.user;
        if (user?.email && result.status === 'success') {
            await (0, notifications_service_1.sendEmail)(user.email, 'Payment received', `Your payment for booking ${payment.bookingId} succeeded.`);
        }
    }
    catch (err) {
        console.warn('Notification send failed', err);
    }
    return payment;
};
exports.verifyPayment = verifyPayment;
function buildConfirmationHtml(opts) {
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

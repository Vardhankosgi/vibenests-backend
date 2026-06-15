"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.verifyAndConfirmPayment = exports.listMyPayments = exports.listPayments = exports.findPaymentById = exports.createPaymentIntent = exports.createRazorpayOrder = exports.listPaymentMethods = void 0;
const data_source_1 = require("../data-source");
const Payment_1 = require("../entities/Payment");
const bookings_service_1 = require("./bookings.service");
const notifications_service_1 = require("./notifications.service");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const repo = () => data_source_1.AppDataSource.getRepository(Payment_1.Payment);
let razor = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razor = new razorpay_1.default({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}
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
    // Confirm full booking only after full payment (pay_now).
    // For pay_at_venue, this is advance-only, so booking remains pending.
    // payment.booking may not be loaded in all contexts, so read from DB.
    const bookingForMode = await data_source_1.AppDataSource.getRepository('Booking').findOne({ where: { id: payment.bookingId } });
    if (bookingForMode?.paymentMode === 'pay_now') {
        await (0, bookings_service_1.updateBookingStatus)(payment.bookingId, 'confirmed');
    }
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
    // Send confirmation email
    try {
        const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
        const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] });
        const user = booking?.user;
        const email = user?.email || booking?.guestEmail;
        const name = user?.fullName || `${booking?.guestFirstName ?? ''} ${booking?.guestLastName ?? ''}`.trim() || 'Guest';
        if (email) {
            await (0, notifications_service_1.sendEmail)(email, `Booking Confirmed – #VN${payment.bookingId} | VibeNests`, `Your booking #VN${payment.bookingId} has been confirmed. Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} received.`, buildConfirmationHtml({ bookingId: payment.bookingId, name, booking, amount: Number(payment.amount) }));
        }
    }
    catch (err) {
        console.warn('Confirmation email failed', err);
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
        // Confirm full booking only after full payment (pay_now).
        // For pay_at_venue, keep booking pending after advance succeeds.
        const b = await data_source_1.AppDataSource.getRepository('Booking').findOne({ where: { id: payment.bookingId } });
        if (b?.paymentMode === 'pay_now') {
            await (0, bookings_service_1.updateBookingStatus)(payment.bookingId, 'confirmed');
        }
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

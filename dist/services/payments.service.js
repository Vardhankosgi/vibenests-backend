"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.sendPaymentSuccessNotifications = exports.verifyAndConfirmPayment = exports.verifyRazorpayPayment = exports.listMyPayments = exports.listPayments = exports.findPaymentById = exports.createPaymentIntent = exports.createRazorpayOrder = exports.listPaymentMethods = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../data-source");
const Payment_1 = require("../entities/Payment");
const Booking_1 = require("../entities/Booking");
const bookings_service_1 = require("./bookings.service");
const notifications_service_1 = require("./notifications.service");
const whatsapp_notifications_service_1 = require("./whatsapp-notifications.service");
const app_notifications_service_1 = require("./app-notifications.service");
const UserMembership_1 = require("../entities/UserMembership");
const MembershipPlan_1 = require("../entities/MembershipPlan");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const repo = () => data_source_1.AppDataSource.getRepository(Payment_1.Payment);
function getRazorClient() {
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keyId || !keySecret) {
        throw new Error('Razorpay is not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment.');
    }
    return new razorpay_1.default({ key_id: keyId, key_secret: keySecret });
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
        if (!booking)
            return;
        const paymentRepo = data_source_1.AppDataSource.getRepository(Payment_1.Payment);
        let bookingsToCheck = [booking];
        if (booking.orderId) {
            const relatedBookings = await bookingRepo.find({ where: { orderId: booking.orderId } });
            if (relatedBookings.length > 0) {
                bookingsToCheck = relatedBookings;
            }
        }
        const bookingIds = bookingsToCheck.map(b => b.id);
        const successfulPayments = await paymentRepo.find({
            where: { bookingId: (0, typeorm_1.In)(bookingIds), status: 'success' }
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
                    await (0, bookings_service_1.handleBookingConfirmationSideEffects)(b.id);
                }
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
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    console.log(`[RAZORPAY INITIATE] Key ID: "${keyId}" (len: ${keyId.length}), Key Secret len: ${keySecret.length}`);
    try {
        const client = getRazorClient();
        const order = await client.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `rcpt_${saved.id}`,
        });
        saved.providerOrderId = order.id;
        await repo().save(saved);
        return { payment: saved, orderId: order.id, keyId, devMode: false };
    }
    catch (err) {
        const errorMsg = err?.error?.description || err?.message || 'Unable to create Razorpay order';
        console.warn('[RAZORPAY WARNING] Order creation failed:', errorMsg);
        // Development fallback: if live/test credentials fail or if dev fallback enabled
        if (process.env.NODE_ENV !== 'production' || !keyId || process.env.RAZORPAY_DEV_FALLBACK === 'true') {
            console.log('[RAZORPAY DEV FALLBACK] Returning devMode order for testing...');
            const devOrderId = `order_dev_${Date.now()}_${saved.id}`;
            saved.providerOrderId = devOrderId;
            await repo().save(saved);
            return { payment: saved, orderId: devOrderId, keyId: keyId || 'rzp_test_dev_key', devMode: true };
        }
        throw new Error(`Razorpay API authentication failed: ${errorMsg}. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.`);
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
const verifyRazorpayPayment = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    const payment = await repo().findOne({ where: { providerOrderId: razorpayOrderId } });
    if (!payment)
        throw new Error('Payment record not found');
    if (!razorpayOrderId.startsWith('order_dev_')) {
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSig = crypto_1.default
            .createHmac('sha256', (process.env.RAZORPAY_KEY_SECRET || '').trim())
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
    const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
    const primaryBooking = await bookingRepo.findOne({ where: { id: payment.bookingId } });
    let bookingIdsToConfirm = [payment.bookingId];
    if (primaryBooking?.orderId) {
        const relatedBookings = await bookingRepo.find({ where: { orderId: primaryBooking.orderId } });
        if (relatedBookings.length > 0) {
            bookingIdsToConfirm = relatedBookings.map(b => b.id);
        }
    }
    for (const bId of bookingIdsToConfirm) {
        await (0, bookings_service_1.updateBookingPaymentStatus)(bId, 'success');
        await activateMembershipForBooking(bId);
        await updateFullPaymentStatus(bId);
        try {
            const booking = await bookingRepo.findOne({ where: { id: bId }, relations: ['user'] });
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
        }
        catch (err) {
            console.warn('Guest backfill failed', err);
        }
    }
    // Send confirmation email + WhatsApp + in-app notification concurrently (best-effort)
    await (0, exports.sendPaymentSuccessNotifications)(payment);
    return payment;
};
exports.verifyRazorpayPayment = verifyRazorpayPayment;
const verifyAndConfirmPayment = async (paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    const payment = await repo().findOneBy({ id: paymentId });
    if (!payment)
        throw new Error('Payment not found');
    // Verify Razorpay signature (skipped for local dev fallback orders)
    const isDevOrder = razorpayOrderId?.startsWith('order_dev_') || razorpaySignature === 'mock_signature' || razorpaySignature?.startsWith('sig_dev_');
    if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature && !isDevOrder) {
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSig = crypto_1.default
            .createHmac('sha256', (process.env.RAZORPAY_KEY_SECRET || '').trim())
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
    const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
    const primaryBooking = await bookingRepo.findOne({ where: { id: payment.bookingId } });
    let bookingIdsToConfirm = [payment.bookingId];
    if (primaryBooking?.orderId) {
        const relatedBookings = await bookingRepo.find({ where: { orderId: primaryBooking.orderId } });
        if (relatedBookings.length > 0) {
            bookingIdsToConfirm = relatedBookings.map(b => b.id);
        }
    }
    for (const bId of bookingIdsToConfirm) {
        await (0, bookings_service_1.updateBookingPaymentStatus)(bId, 'success');
        await activateMembershipForBooking(bId);
        await updateFullPaymentStatus(bId);
        try {
            const booking = await bookingRepo.findOne({ where: { id: bId }, relations: ['user'] });
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
        }
        catch (err) {
            console.warn('Guest backfill failed', err);
        }
    }
    // Send confirmation email + WhatsApp concurrently (best-effort)
    await (0, exports.sendPaymentSuccessNotifications)(payment);
    return payment;
};
exports.verifyAndConfirmPayment = verifyAndConfirmPayment;
const sendPaymentSuccessNotifications = async (payment) => {
    try {
        const bookingRepo = data_source_1.AppDataSource.getRepository('Booking');
        const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] });
        if (!booking)
            return;
        const user = booking.user;
        const email = user?.email || booking.guestEmail;
        const name = user?.fullName || `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim() || 'Guest';
        const emailPromise = email
            ? (0, notifications_service_1.sendEmail)(email, `Booking Confirmed – #VN${payment.bookingId} | VibeNests`, `Your booking #VN${payment.bookingId} has been confirmed. Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} received.`, buildConfirmationHtml({ bookingId: payment.bookingId, name, booking, amount: Number(payment.amount) }))
            : Promise.resolve();
        const whatsappPromise = (0, whatsapp_notifications_service_1.sendPaymentSuccessWhatsApp)({
            id: payment.bookingId,
            guestPhone: booking.guestPhone ?? user?.phone,
            user: user ? { phone: user.phone, fullName: user.fullName } : null,
            amount: Number(payment.amount),
            guestFirstName: booking.guestFirstName,
            guestLastName: booking.guestLastName,
        });
        const appNotifCustomer = (0, app_notifications_service_1.createAppNotification)({
            userId: booking.userId ?? user?.id ?? null,
            targetRole: 'customer',
            title: 'Booking Confirmed',
            message: `Your booking #${payment.bookingId} for ${booking.suiteName || 'Suite'} on ${booking.date || 'selected date'} is confirmed. Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} received.`,
            type: 'booking',
            referenceId: payment.bookingId,
        });
        const appNotifAdmin = (0, app_notifications_service_1.createAppNotification)({
            userId: null,
            targetRole: 'admin',
            title: 'New Confirmed Booking',
            message: `${name} paid ₹${Number(payment.amount).toLocaleString('en-IN')} and confirmed booking #${payment.bookingId}.`,
            type: 'booking',
            referenceId: payment.bookingId,
        });
        await Promise.allSettled([emailPromise, whatsappPromise, appNotifCustomer, appNotifAdmin]);
    }
    catch (err) {
        console.warn('Payment success notification failed', err);
    }
};
exports.sendPaymentSuccessNotifications = sendPaymentSuccessNotifications;
const verifyPayment = async (paymentId, result) => {
    const payment = await repo().findOneBy({ id: paymentId });
    if (!payment)
        throw new Error('Payment not found');
    payment.status = result.status;
    payment.providerPaymentId = result.providerPaymentId;
    payment.providerOrderId = result.providerOrderId;
    payment.providerSignature = result.providerSignature;
    await repo().save(payment);
    const bookingRepo = data_source_1.AppDataSource.getRepository(Booking_1.Booking);
    const primaryBooking = await bookingRepo.findOne({ where: { id: payment.bookingId } });
    let bookingIdsToConfirm = [payment.bookingId];
    if (primaryBooking?.orderId) {
        const relatedBookings = await bookingRepo.find({ where: { orderId: primaryBooking.orderId } });
        if (relatedBookings.length > 0) {
            bookingIdsToConfirm = relatedBookings.map(b => b.id);
        }
    }
    for (const bId of bookingIdsToConfirm) {
        await (0, bookings_service_1.updateBookingPaymentStatus)(bId, result.status === 'success' ? 'success' : 'failed');
        if (result.status === 'success') {
            await activateMembershipForBooking(bId);
            await updateFullPaymentStatus(bId);
        }
    }
    if (result.status === 'success') {
        await (0, exports.sendPaymentSuccessNotifications)(payment);
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

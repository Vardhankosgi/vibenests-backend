"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.listPayments = exports.findPaymentById = exports.createPaymentIntent = exports.listPaymentMethods = void 0;
const data_source_1 = require("../data-source");
const Payment_1 = require("../entities/Payment");
const bookings_service_1 = require("./bookings.service");
const notifications_service_1 = require("./notifications.service");
const repo = () => data_source_1.AppDataSource.getRepository(Payment_1.Payment);
const listPaymentMethods = () => [
    { id: 'razorpay', name: 'Razorpay', supported: true },
    { id: 'upi', name: 'UPI', supported: true },
    { id: 'credit_card', name: 'Credit Card', supported: true },
    { id: 'debit_card', name: 'Debit Card', supported: true },
    { id: 'net_banking', name: 'Net Banking', supported: true },
    { id: 'wallet', name: 'Wallet', supported: true },
];
exports.listPaymentMethods = listPaymentMethods;
const createPaymentIntent = async (bookingId, amount, method) => {
    const payment = repo().create({
        bookingId,
        amount,
        method,
        provider: 'razorpay',
        status: 'pending',
    });
    return repo().save(payment);
};
exports.createPaymentIntent = createPaymentIntent;
const findPaymentById = async (id) => repo().findOneBy({ id });
exports.findPaymentById = findPaymentById;
const listPayments = async () => repo().find({ order: { createdAt: 'DESC' } });
exports.listPayments = listPayments;
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

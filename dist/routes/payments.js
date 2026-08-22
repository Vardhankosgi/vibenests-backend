"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const payments_service_1 = require("../services/payments.service");
const router = express_1.default.Router();
router.get('/methods', (_req, res) => {
    res.json((0, payments_service_1.listPaymentMethods)());
});
// Create Razorpay order + payment record
router.post('/create-order', auth_1.authenticate, async (req, res) => {
    try {
        const { bookingId, amount, method } = req.body;
        if (!bookingId || !amount) {
            return res.status(400).json({ message: 'bookingId and amount are required' });
        }
        const result = await (0, payments_service_1.createRazorpayOrder)(Number(bookingId), Number(amount), method || 'razorpay');
        res.status(201).json({
            paymentId: result.payment.id,
            orderId: result.orderId,
            amount: result.payment.amount,
            keyId: result.keyId,
            devMode: result.devMode,
        });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
// Verify Razorpay payment signature + confirm booking
router.post('/verify-payment', auth_1.authenticate, async (req, res) => {
    try {
        const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        if (!paymentId || !razorpayOrderId || !razorpayPaymentId) {
            return res.status(400).json({ message: 'paymentId, razorpayOrderId, razorpayPaymentId are required' });
        }
        const payment = await (0, payments_service_1.verifyAndConfirmPayment)(Number(paymentId), razorpayOrderId, razorpayPaymentId, razorpaySignature || '');
        res.json({ success: true, payment });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
// Legacy initiate (kept for backward compat)
router.post('/initiate', auth_1.authenticate, async (req, res) => {
    try {
        const { bookingId, amount, method } = req.body;
        if (!bookingId || !amount || !method) {
            return res.status(400).json({ message: 'bookingId, amount, and method are required' });
        }
        const result = await (0, payments_service_1.createRazorpayOrder)(Number(bookingId), Number(amount), method);
        res.status(201).json({ paymentId: result.payment.id, orderId: result.orderId, amount: result.payment.amount });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/verify', auth_1.authenticate, async (req, res) => {
    try {
        const { paymentId, status, providerPaymentId, providerOrderId, providerSignature } = req.body;
        if (!paymentId || !status) {
            return res.status(400).json({ message: 'paymentId and status are required' });
        }
        const payment = await (0, payments_service_1.verifyPayment)(Number(paymentId), {
            status: status === 'success' ? 'success' : 'failed',
            providerPaymentId,
            providerOrderId,
            providerSignature,
        });
        res.json(payment);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const payments = await (0, payments_service_1.listMyPayments)(req.user.id);
        res.json(payments);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/all', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (_req, res) => {
    try {
        const payments = await (0, payments_service_1.listPayments)();
        res.json(payments);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;

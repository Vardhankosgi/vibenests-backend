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
router.post('/initiate', auth_1.authenticate, async (req, res) => {
    try {
        const { bookingId, amount, method } = req.body;
        if (!bookingId || !amount || !method) {
            return res.status(400).json({ message: 'bookingId, amount, and method are required' });
        }
        const payment = await (0, payments_service_1.createPaymentIntent)(Number(bookingId), Number(amount), method);
        res.status(201).json({
            paymentId: payment.id,
            amount: payment.amount,
            method: payment.method,
            provider: payment.provider,
            status: payment.status,
            note: 'Use /payments/verify to complete the payment flow in this stub.',
        });
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

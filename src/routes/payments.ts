import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { createRazorpayOrder, listPaymentMethods, verifyAndConfirmPayment, verifyPayment, listPayments, listMyPayments } from '../services/payments.service';

const router = express.Router();

router.get('/methods', (_req, res) => {
  res.json(listPaymentMethods());
});

// Create Razorpay order + payment record
router.post('/create-order', authenticate, async (req: any, res) => {
  try {
    const { bookingId, amount, method } = req.body;
    if (!bookingId || !amount) {
      return res.status(400).json({ message: 'bookingId and amount are required' });
    }
    const result = await createRazorpayOrder(Number(bookingId), Number(amount), method || 'razorpay');
    res.status(201).json({
      paymentId: result.payment.id,
      orderId: result.orderId,
      amount: result.payment.amount,
      keyId: result.keyId,
      devMode: result.devMode,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Verify Razorpay payment signature + confirm booking
router.post('/verify-payment', authenticate, async (req: any, res) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!paymentId || !razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({ message: 'paymentId, razorpayOrderId, razorpayPaymentId are required' });
    }
    const payment = await verifyAndConfirmPayment(
      Number(paymentId),
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature || '',
    );
    res.json({ success: true, payment });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Legacy initiate (kept for backward compat)
router.post('/initiate', authenticate, async (req: any, res) => {
  try {
    const { bookingId, amount, method } = req.body;
    if (!bookingId || !amount || !method) {
      return res.status(400).json({ message: 'bookingId, amount, and method are required' });
    }
    const result = await createRazorpayOrder(Number(bookingId), Number(amount), method);
    res.status(201).json({ paymentId: result.payment.id, orderId: result.orderId, amount: result.payment.amount });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/verify', authenticate, async (req: any, res) => {
  try {
    const { paymentId, status, providerPaymentId, providerOrderId, providerSignature } = req.body;
    if (!paymentId || !status) {
      return res.status(400).json({ message: 'paymentId and status are required' });
    }
    const payment = await verifyPayment(Number(paymentId), {
      status: status === 'success' ? 'success' : 'failed',
      providerPaymentId,
      providerOrderId,
      providerSignature,
    });
    res.json(payment);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/me', authenticate, async (req: any, res) => {
  try {
    const payments = await listMyPayments(req.user.id);
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/all', authenticate, requireRole('admin'), async (_req, res) => {
  try {
    const payments = await listPayments();
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

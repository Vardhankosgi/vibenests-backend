import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { createPaymentIntent, listPaymentMethods, verifyPayment, listPayments } from '../services/payments.service';

const router = express.Router();

router.get('/methods', (_req, res) => {
  res.json(listPaymentMethods());
});

router.post('/initiate', authenticate, async (req: any, res) => {
  try {
    const { bookingId, amount, method } = req.body;
    if (!bookingId || !amount || !method) {
      return res.status(400).json({ message: 'bookingId, amount, and method are required' });
    }
    const payment = await createPaymentIntent(Number(bookingId), Number(amount), method);
    res.status(201).json({
      paymentId: payment.id,
      amount: payment.amount,
      method: payment.method,
      provider: payment.provider,
      status: payment.status,
      note: 'Use /payments/verify to complete the payment flow in this stub.',
    });
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

router.get('/all', authenticate, requireRole('admin'), async (_req, res) => {
  try {
    const payments = await listPayments();
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

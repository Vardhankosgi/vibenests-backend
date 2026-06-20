import express from 'express';
import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';
import Razorpay from 'razorpay';

const router = express.Router();

function getRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// Public helper for shared admin links (no auth).
// Given bookingId/paymentId/orderId (from the shared URL), returns Razorpay checkout options.
router.post('/payments/create-order-for-link', async (req: any, res) => {
  try {
    const { bookingId, paymentId, orderId } = req.body || {};
    if (!bookingId || !paymentId || !orderId) {
      return res.status(400).json({ message: 'bookingId, paymentId, orderId are required' });
    }

    const bookingRepo = AppDataSource.getRepository(Booking);
    const paymentRepo = AppDataSource.getRepository(Payment);

    const booking = await bookingRepo.findOne({ where: { id: Number(bookingId) } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const payment = await paymentRepo.findOne({ where: { id: Number(paymentId), bookingId: Number(bookingId) } });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // Ensure this link is still pending
    if (payment.status !== 'pending' || booking.paymentStatus === 'success') {
      return res.status(409).json({ message: 'This payment link is no longer valid.' });
    }

    // Create a Razorpay order that matches our stored payment record/order intent.
    // We use the provided orderId only for correlation in the shared URL.
    // Razorpay will generate its own order id that the checkout uses.
    const receipt = `rcpt_link_${payment.id}_${Date.now()}`;

    const client = getRazorpayClient();
    const razorpayOrder = await client.orders.create({
      amount: Math.round(Number(payment.amount) * 100),
      currency: 'INR',
      receipt,
    });

    // Save/attach providerOrderId to payment so webhook/verify can correlate
    payment.providerOrderId = razorpayOrder.id;
    paymentRepo.save(payment);

    return res.status(200).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: payment.amount,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
    });
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || 'Failed to create razorpay checkout for link' });
  }
});

export default router;


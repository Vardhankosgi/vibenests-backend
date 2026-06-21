import express from 'express';
import { requireRole } from '../middleware/auth';
import { AppDataSource } from '../data-source';
import { Payment } from '../entities/Payment';
import { Booking } from '../entities/Booking';
import { sendEmail } from '../services/notifications.service';

import { createRazorpayPaymentLink } from '../services/razorpay-link.service';

const router = express.Router();

// Admin: create Razorpay payment link for an existing booking.
// This is a helper endpoint; it assumes booking is created already.
// For this task we will not finalize booking confirmation here.
router.post('/admin/razorpay-link', requireRole('admin'), async (req: any, res) => {
  try {
    const { bookingId, amount, email, phone } = req.body || {};
    if (!bookingId || !amount || !email) {
      return res.status(400).json({ message: 'bookingId, amount, email are required' });
    }

    // Ensure booking exists
    const bookingRepo = AppDataSource.getRepository(Booking);
    const booking = await bookingRepo.findOneBy({ id: Number(bookingId) });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const { paymentLinkId, paymentLink } = await createRazorpayPaymentLink({
      amount: Number(amount),
      bookingId: Number(bookingId),
      customer: {
        name: `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim(),
        email: booking.guestEmail,
        phone: booking.guestPhone,
      },
    });

    const paymentRepo = AppDataSource.getRepository(Payment);
    const payment = paymentRepo.create({
      bookingId: Number(bookingId),
      amount: Number(amount),
      method: 'razorpay',
      provider: 'razorpay',
      status: 'pending',
      providerOrderId: paymentLinkId,
      paymentLink,
    });
    const savedPayment = await paymentRepo.save(payment);

    booking.paymentMode = 'razorpay' as any;
    booking.bookedBy = 'admin' as any;
    if (!['cancelled', 'completed', 'refunded'].includes(String(booking.status))) {
      booking.status = 'pending' as any;
      booking.paymentStatus = 'pending' as any;
      booking.fullPaymentReceived = false;
    }
    await AppDataSource.getRepository(Booking).save(booking);

    // Email payment link (WhatsApp will be handled later in next iteration)
    const paymentSubject = `Pay for your booking #VN${bookingId} – VibeNests`;
    const paymentHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
          <div>
            <div style="font-size:16px;font-weight:700;line-height:1">Complete Payment</div>
            <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
          </div>
        </div>
        <div style="padding:18px 20px">
          <p style="margin:0 0 14px">Hi,</p>
          <p style="margin:0 0 14px">Your booking is created. Please complete payment to confirm your suite booking.</p>
          <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;">
            <div style="margin:0 0 10px"><strong>Amount:</strong> ₹${Number(amount).toLocaleString('en-IN')}</div>
            <a href="${paymentLink}" style="display:inline-block;background:#f59e0b;color:#111;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Pay Now</a>
          </div>
        </div>
        <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
          © ${new Date().getFullYear()} VibeNests
        </div>
      </div>
    `;

    await sendEmail(email, paymentSubject, `Pay Now - VibeNests (Booking #VN${bookingId})`, paymentHtml);

    res.status(201).json({ paymentLink, paymentLinkId, paymentId: savedPayment.id });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create payment link' });
  }
});

export default router;


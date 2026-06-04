import { AppDataSource } from '../data-source';
import { Payment } from '../entities/Payment';
import { updateBookingPaymentStatus } from './bookings.service';
import { sendEmail } from './notifications.service';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const repo = () => AppDataSource.getRepository(Payment);

let razor: any = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razor = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

export const listPaymentMethods = () => [
  { id: 'razorpay', name: 'Razorpay', supported: true },
  { id: 'upi', name: 'UPI', supported: true },
  { id: 'credit_card', name: 'Credit Card', supported: true },
  { id: 'debit_card', name: 'Debit Card', supported: true },
  { id: 'net_banking', name: 'Net Banking', supported: true },
  { id: 'wallet', name: 'Wallet', supported: true },
];

export const createPaymentIntent = async (bookingId: number, amount: number, method: string) => {
  const payment = repo().create({ bookingId, amount, method, provider: 'razorpay', status: 'pending' });
  const saved = await repo().save(payment);

  if (razor) {
    try {
      const order = await razor.orders.create({ amount: Math.round(amount * 100), currency: 'INR', receipt: `rcpt_${saved.id}` });
      saved.providerOrderId = order.id;
      await repo().save(saved);
    } catch (err) {
      console.warn('Razorpay order create failed', err);
    }
  }
  return saved;
};

export const findPaymentById = async (id: number) => repo().findOneBy({ id });

export const listPayments = async () => repo().find({ order: { createdAt: 'DESC' } });

export const verifyPayment = async (paymentId: number, result: { status: 'success' | 'failed'; providerPaymentId?: string; providerOrderId?: string; providerSignature?: string }) => {
  const payment = await repo().findOneBy({ id: paymentId });
  if (!payment) throw new Error('Payment not found');
  payment.status = result.status;
  payment.providerPaymentId = result.providerPaymentId;
  payment.providerOrderId = result.providerOrderId;
  payment.providerSignature = result.providerSignature;
  await repo().save(payment);
  await updateBookingPaymentStatus(payment.bookingId, result.status === 'success' ? 'success' : 'failed');
  try {
    const bookingRepo = AppDataSource.getRepository('Booking');
    const booking = await bookingRepo.findOne({ where: { id: payment.bookingId }, relations: ['user'] });
    const user = booking?.user as any;
    if (user?.email && result.status === 'success') {
      await sendEmail(user.email, 'Payment received', `Your payment for booking ${payment.bookingId} succeeded.`);
    }
  } catch (err) {
    console.warn('Notification send failed', err);
  }
  return payment;
};

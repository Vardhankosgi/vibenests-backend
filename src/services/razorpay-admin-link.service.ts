import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';
import { adminCreateBooking } from './bookings.service';
import { createRazorpayOrder } from './payments.service';
import { sendPaymentSuccessNotifications } from './payments.service';

const bookingRepo = () => AppDataSource.getRepository(Booking);
const paymentRepo = () => AppDataSource.getRepository(Payment);

export type AdminCreateRazorpayLinkInput = {
  suiteId: number;
  eventType: string;
  addOns?: string[];
  date: string;
  timeSlot: string;
  endTimeSlot?: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  persons?: number;
  totalAmount: number;
};


// Creates booking as pending, creates razorpay order/payment record, and returns a link to be shared.
// NOTE: actual success handling must happen via /payments/verify-payment (from client) or webhook.
export async function adminCreateRazorpayLink(input: AdminCreateRazorpayLinkInput): Promise<{ booking: Booking; paymentLink: string; payment: Payment }> {
  // 1) Create booking but do NOT confirm it yet.
  // Current adminCreateBooking confirms immediately, so we create booking by temporarily using it,
  // then we immediately mark it as pending/unpaid.
  const booking = (await adminCreateBooking({
    suiteId: input.suiteId,
    eventType: input.eventType,
    addOns: input.addOns,
    date: input.date,
    timeSlot: input.timeSlot,
    endTimeSlot: input.endTimeSlot,
    guestFirstName: input.guestFirstName,
    guestLastName: input.guestLastName,
    guestEmail: input.guestEmail,
    guestPhone: input.guestPhone,
    persons: input.persons,
    totalAmount: input.totalAmount,
  })) as Booking;


  // 2) Convert to pending payment (so suite will be considered not confirmed until payment success).
  booking.status = 'pending' as any;
  booking.paymentStatus = 'pending' as any;
  booking.fullPaymentReceived = false;
  booking.paymentMode = 'razorpay' as any;
  booking.bookedBy = 'admin' as any;

  await bookingRepo().save(booking as any);

  // 3) Create razorpay order + payment record.
  const amount = Number(input.totalAmount);
  const created = await createRazorpayOrder(booking.id, amount, 'razorpay');

  // 4) Razorpay Checkout is not a simple static URL; frontend needs to open checkout.
  // To satisfy the "copyable link" requirement, we return the backend URL that can open checkout.
  // We'll implement a frontend/admin page later; for now we return a payments-links route.
  const paymentLink = `${process.env.FRONTEND_ORIGIN || ''}/payments/razorpay-link/${created.orderId}?bookingId=${booking.id}&paymentId=${created.payment.id}`;

  // Store the payment link on the payment record (DB column)
  created.payment.paymentLink = paymentLink;
  await paymentRepo().save(created.payment);

  return { booking, paymentLink, payment: created.payment };

}

export async function sendRazorpayLinkViaNotifications(_booking: Booking, _paymentLink: string): Promise<void> {
  // This project already sends notifications on payment success.
  // For MVP, we can send email/whatsapp here, but we keep it as a placeholder.
  // Implementing email/whatsapp templates should be done once the "link open" route exists.
  return;
}


import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';
import { adminCreateBooking } from './bookings.service';
import { createRazorpayPaymentLink } from './razorpay-link.service';
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
  couponCode?: string;
  specialOfferId?: number;
  discountAmount?: number;
};


// Creates booking as pending, creates razorpay order/payment record, and returns a link to be shared.
// NOTE: actual success handling must happen via /payments/verify-payment (from client) or webhook.
export async function adminCreateRazorpayLink(input: AdminCreateRazorpayLinkInput): Promise<{ booking: Booking; paymentLink: string; payment: Payment }> {
  // 1) Create booking but do NOT confirm it yet.
  // Current adminCreateBooking confirms immediately, so we create booking by temporarily using it,
  // then we immediately mark it as pending/unpaid.
  const allBookings = await adminCreateBooking({
    suiteId: input.suiteId,
    eventType: input.eventType,
    addOns: input.addOns,
    date: input.date,
    // adminCreateBooking expects either timeSlots[] or timeSlot (single)
    timeSlots: [input.timeSlot],
    timeSlot: input.timeSlot,
    guestFirstName: input.guestFirstName,
    guestLastName: input.guestLastName,
    guestEmail: input.guestEmail,
    guestPhone: input.guestPhone,
    persons: input.persons,
    totalAmount: input.totalAmount,
    couponCode: input.couponCode,
    specialOfferId: input.specialOfferId,
    discountAmount: input.discountAmount,
  });

  const booking = (allBookings && allBookings.length ? allBookings[0] : undefined) as unknown as Booking;
  if (!booking) throw new Error('Failed to create booking for razorpay link');



  // 2) Convert to pending payment (so suite will be considered not confirmed until payment success).
  booking.status = 'pending' as any;
  booking.paymentStatus = 'pending' as any;
  booking.fullPaymentReceived = false;
  booking.paymentMode = 'razorpay' as any;
  booking.bookedBy = 'admin' as any;

  await bookingRepo().save(booking as any);

  // 3) Create Razorpay payment link + payment record.
  const amount = Number(input.totalAmount);
  const { paymentLinkId, paymentLink } = await createRazorpayPaymentLink({
    amount,
    bookingId: booking.id,
    customer: {
      name: `${input.guestFirstName} ${input.guestLastName}`.trim(),
      email: input.guestEmail,
      phone: input.guestPhone,
    },
  });

  const payment = paymentRepo().create({
    bookingId: booking.id,
    amount,
    method: 'razorpay',
    provider: 'razorpay',
    status: 'pending',
    providerOrderId: paymentLinkId,
    paymentLink,
  });
  const savedPayment = await paymentRepo().save(payment);

  return { booking, paymentLink, payment: savedPayment };

}

export async function sendRazorpayLinkViaNotifications(_booking: Booking, _paymentLink: string): Promise<void> {
  // This project already sends notifications on payment success.
  // For MVP, we can send email/whatsapp here, but we keep it as a placeholder.
  // Implementing email/whatsapp templates should be done once the "link open" route exists.
  return;
}


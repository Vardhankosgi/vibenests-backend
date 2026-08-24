import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { Booking } from '../entities/Booking';
import { WhatsAppMessage } from '../entities/WhatsAppMessage';
import {
  sendBookingConfirmationWhatsAppTemplate,
  sendBookingCancellationWhatsAppTemplate,
  sendRefundConfirmationWhatsAppTemplate,
  sendCouponOfferWhatsAppTemplate,
  sendLoginOtp,
  sendTemplateMessage,
  formatPhoneNumber,
} from './whatsapp.service';
import { sendWhatsApp } from './notifications.service';

function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length ? digits : null;
}

async function logOutboundMessage(
  phone: string,
  content: string,
  messageType: string,
  sendResult?: any
) {
  try {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return;

    await AppDataSource.getRepository(WhatsAppMessage).save({
      phone: cleanPhone,
      direction: 'outbound',
      content,
      messageType,
      waMessageId: sendResult?.messageId || ('outbound_' + Date.now()),
      waConversationId: null,
    });
  } catch (err) {
    console.warn('[WhatsApp Message DB Save Error]', err);
  }
}

export async function sendOtpWhatsApp(phone: string, otpCode: string, userName: string = 'Guest') {
  const digits = normalizePhone(phone);
  if (!digits) return { ok: false, reason: 'missing_phone' };

  let result: any = null;
  try {
    result = await sendLoginOtp(digits, otpCode, userName);
  } catch (err) {
    console.warn('[WhatsApp OTP Error]', err);
  }

  const content = `Your VibeNests verification code is ${otpCode}. Valid for 5 minutes. Do not share this code with anyone.`;
  await logOutboundMessage(digits, content, 'Login OTP Verification', result);

  return { ok: result?.ok ?? true, result };
}

export async function sendAccountCreatedWhatsApp(user: Pick<User, 'phone' | 'fullName'>) {
  const digits = normalizePhone(user.phone);
  if (!digits) return { ok: false, reason: 'missing_phone' };

  const name = user.fullName || 'there';
  const content = `Hi ${name}! Welcome to VibeNests. Your account has been created. You can now log in and explore our luxury suites.`;

  let result: any = null;
  try {
    result = await sendWhatsApp(digits, content);
  } catch (err) {
    console.warn('[WhatsApp Account Created Error]', err);
  }

  await logOutboundMessage(digits, content, 'Account Verification', result);
  return { ok: result?.ok ?? true, result };
}

export async function sendBookingConfirmedWhatsApp(
  booking: Partial<Booking> & {
    guestPhone?: string | null;
    user?: Pick<User, 'phone' | 'fullName'> | null;
    suite?: { name?: string } | null;
    guestCount?: string | number | null;
    persons?: number | null;
  }
) {
  const rawPhone = booking.guestPhone ?? booking.user?.phone ?? null;
  const digits = normalizePhone(rawPhone);
  if (!digits) return { ok: false, reason: 'missing_phone' };

  const guestName = booking.user?.fullName || `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim() || 'Valued Guest';
  const bookingId = `#VN${booking.id ?? ''}`;
  const suiteName = booking.suiteName || booking.suite?.name || 'Celebration Suite';
  
  const checkIn = booking.date
    ? `${booking.date}${booking.timeSlot ? ' (' + (booking.timeSlot.split('-')[0]?.trim() || booking.timeSlot) + ')' : ''}`
    : 'Confirmed Date & Slot';
  const checkOut = booking.date
    ? `${booking.date}${booking.timeSlot && booking.timeSlot.includes('-') ? ' (' + booking.timeSlot.split('-')[1]?.trim() + ')' : ''}`
    : 'End of Slot';
  const guestsCount = `${booking.guestCount || booking.persons || 2} Guests`;

  let result: any = null;
  try {
    result = await sendBookingConfirmationWhatsAppTemplate(digits, {
      guestName,
      bookingId,
      suiteName,
      checkIn,
      checkOut,
      guestsCount,
    });
  } catch (err) {
    console.warn('[WhatsApp Booking Confirmation Error]', err);
  }

  const content = `Dear ${guestName}, Your booking at Vibenests has been confirmed successfully. Booking ID: ${bookingId} Suite: ${suiteName} Check-in: ${checkIn} Check-out: ${checkOut} Guests: ${guestsCount} We look forward to welcoming you to Vibenests and making your stay comfortable and memorable. Thank you for choosing Vibenests.`;
  await logOutboundMessage(digits, content, 'Booking Confirmation', result);

  return { ok: result?.ok ?? true, result };
}

export async function sendBookingCancelledWhatsApp(
  booking: Partial<Booking> & {
    guestPhone?: string | null;
    user?: Pick<User, 'phone' | 'fullName'> | null;
    suite?: { name?: string } | null;
    guestCount?: string | number | null;
    persons?: number | null;
  }
) {
  const rawPhone = booking.guestPhone ?? booking.user?.phone ?? null;
  const digits = normalizePhone(rawPhone);
  if (!digits) return { ok: false, reason: 'missing_phone' };

  const guestName = booking.user?.fullName || `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim() || 'Valued Guest';
  const bookingId = `#VN${booking.id ?? ''}`;
  const suiteName = booking.suiteName || booking.suite?.name || 'Celebration Suite';
  const checkInDate = booking.date || 'Scheduled Date';
  const cancellationDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  let result: any = null;
  try {
    result = await sendBookingCancellationWhatsAppTemplate(digits, {
      guestName,
      bookingId,
      suiteName,
      checkInDate,
      cancellationDate,
    });
  } catch (err) {
    console.warn('[WhatsApp Booking Cancellation Error]', err);
  }

  const content = `Dear ${guestName}, Your booking at Vibenests has been cancelled successfully. Booking ID: ${bookingId} Room/Suite: ${suiteName} Check-in Date: ${checkInDate} Cancellation Date: ${cancellationDate} If applicable, your refund will be processed according to the cancellation and refund policy. Thank you for choosing Vibenests.`;
  await logOutboundMessage(digits, content, 'Booking Cancellation', result);

  return { ok: result?.ok ?? true, result };
}

export async function sendRefundStatusWhatsApp(refund: any, status?: string) {
  const digits = normalizePhone(refund.customerPhone);
  if (!digits) return { ok: false, reason: 'missing_phone' };

  const guestName = refund.customerName || 'Valued Guest';
  const bookingId = `#VN${refund.bookingId ?? ''}`;
  const amountVal = Number(refund.refundableAmount || refund.amount || 0);
  const refundAmount = amountVal > 0 ? amountVal.toLocaleString('en-IN') : '0';
  const refundReference = String(refund.referenceId || refund.paymentId || ('RFND-' + (refund.bookingId || Date.now())));

  let result: any = null;
  try {
    result = await sendRefundConfirmationWhatsAppTemplate(digits, {
      guestName,
      bookingId,
      refundAmount,
      refundReference,
    });
  } catch (err) {
    console.warn('[WhatsApp Refund Confirmation Error]', err);
  }

  const content = `Dear ${guestName}, Your refund for the Vibenests booking has been successfully initiated. Booking ID: ${bookingId} Refund Amount: ₹${refundAmount} Refund Reference: ${refundReference} The amount will be credited to your original payment method as per the payment provider's processing timeline. Thank you for choosing Vibenests.`;
  await logOutboundMessage(digits, content, 'Refund Update', result);

  return { ok: result?.ok ?? true, result };
}

export async function sendCouponOfferWhatsApp(
  phone: string | undefined | null,
  params: {
    guestName?: string;
    couponCode: string;
    discountText?: string;
    validUntil?: string;
  }
) {
  const digits = normalizePhone(phone);
  if (!digits) return { ok: false, reason: 'missing_phone' };

  const guestName = params.guestName || 'Valued Guest';
  const couponCode = params.couponCode;
  const discountText = params.discountText || 'Special Discount';
  const validUntil = params.validUntil || '31 Dec 2026';

  let result: any = null;
  try {
    result = await sendCouponOfferWhatsAppTemplate(digits, {
      guestName,
      couponCode,
      discountText,
      validUntil,
    });
  } catch (err) {
    console.warn('[WhatsApp Coupon Offer Error]', err);
  }

  const content = `Dear ${guestName}, Enjoy an exclusive offer from Vibenests! ✨ Use coupon code ${couponCode} and get ${discountText} on your next stay. Offer valid until: ${validUntil} Book your stay and experience comfort at Vibenests. Terms & conditions apply.`;
  await logOutboundMessage(digits, content, 'Special Offer', result);

  return { ok: result?.ok ?? true, result };
}

export async function sendPaymentSuccessWhatsApp(
  booking: Partial<Booking> & {
    guestPhone?: string | null;
    user?: Pick<User, 'phone' | 'fullName'> | null;
    amount?: number | null;
    suite?: { name?: string } | null;
  }
) {
  return sendBookingConfirmedWhatsApp(booking);
}

export async function sendOfferActivatedWhatsApp(phone: string | undefined | null, offerName: string) {
  return sendCouponOfferWhatsApp(phone, {
    couponCode: offerName.toUpperCase().replace(/\s+/g, ''),
    discountText: offerName,
  });
}



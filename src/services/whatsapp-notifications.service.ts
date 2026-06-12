import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { Booking } from '../entities/Booking';
import { WhatsAppMessage } from '../entities/WhatsAppMessage';
import { sendWhatsApp } from './notifications.service';

function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length ? digits : null;
}

async function sendAndLog(phone: string | undefined | null, message: string, direction: 'outbound' | 'inbound' = 'outbound') {
  const digits = normalizePhone(phone);
  if (!digits) return { ok: false, reason: 'missing_phone' };

  await sendWhatsApp(digits, message);

  // Best-effort DB logging for outbound messages.
  try {
    await AppDataSource.getRepository(WhatsAppMessage).save({
      phone: digits,
      direction,
      content: message,
      messageType: 'text',
      waMessageId: null,
      waConversationId: null,
    });
  } catch {
    // ignore logging failures
  }

  return { ok: true };
}

export async function sendOtpWhatsApp(phone: string, otpCode: string) {
  return sendAndLog(phone, `Your VibeNests OTP is ${otpCode}. Valid for 5 minutes. Do not share this with anyone.`);
}

export async function sendAccountCreatedWhatsApp(user: Pick<User, 'phone' | 'fullName'>) {
  const name = user.fullName || 'there';
  return sendAndLog(
    user.phone,
    `Hi ${name}! Welcome to VibeNests. Your account has been created. You can now log in and set up your password.`
  );
}

export async function sendBookingConfirmedWhatsApp(booking: Partial<Booking> & { guestPhone?: string | null; user?: Pick<User, 'phone' | 'fullName'> | null }) {
  const phone = booking.guestPhone ?? booking.user?.phone ?? null;
  const name = booking.user?.fullName ?? booking.guestFirstName ? `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim() : 'Guest';

  return sendAndLog(
    phone,
    `Hi ${name}! Your booking is confirmed. Booking ID: #VN${booking.id ?? ''}. We’re excited to host you at VibeNests.`
  );
}

export async function sendPaymentSuccessWhatsApp(booking: Partial<Booking> & { guestPhone?: string | null; user?: Pick<User, 'phone' | 'fullName'> | null; amount?: number | null }) {
  const phone = booking.guestPhone ?? booking.user?.phone ?? null;
  const name = booking.user?.fullName ?? booking.guestFirstName ? `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim() : 'Guest';
  const amount = booking.amount != null ? `₹${Number(booking.amount).toLocaleString('en-IN')}` : 'your payment';

  return sendAndLog(
    phone,
    `Hi ${name}! Payment successful. Your booking is confirmed. Amount: ${amount}. See you soon at VibeNests!`
  );
}

export async function sendOfferActivatedWhatsApp(phone: string | undefined | null, offerName: string) {
  return sendAndLog(phone, `New offer is live at VibeNests: ${offerName}. Check out the latest deals today!`);
}


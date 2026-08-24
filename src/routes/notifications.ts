import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { sendEmail, sendSms, sendWhatsApp, smtpHealthCheck } from '../services/notifications.service';
import {
  sendCelebrationBookingMarketingMessage,
  sendTemplateMessage,
  sendBookingConfirmationWhatsAppTemplate,
  sendBookingCancellationWhatsAppTemplate,
  sendRefundConfirmationWhatsAppTemplate,
  sendCouponOfferWhatsAppTemplate,
  sendLoginOtp,
} from '../services/whatsapp.service';
import { AppDataSource } from '../data-source';
import { WhatsAppMessage } from '../entities/WhatsAppMessage';
import { WhatsAppEvent } from '../entities/WhatsAppEvent';
import { Booking } from '../entities/Booking';
import { User } from '../entities/User';

const router = express.Router();

router.post('/send/email', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const { to, subject, body } = req.body;
    await sendEmail(to, subject, body);
    res.json({ message: 'Email queued (stub)' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/send/sms', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const { phone, message } = req.body;
    await sendSms(phone, message);
    res.json({ message: 'SMS queued (stub)' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/send/whatsapp', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const {
      phone,
      message,
      messageType,
      templateName,
      userName,
      bookingId,
      suiteName,
      checkIn,
      checkOut,
      guestsCount,
      checkInDate,
      cancellationDate,
      refundAmount,
      refundReference,
      couponCode,
      discountText,
      validUntil,
    } = req.body;

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    if (!cleanPhone) {
      return res.status(400).json({ message: 'Valid phone number is required' });
    }

    let result: any;
    let loggedContent = message || '';
    let resolvedType = messageType || templateName || 'General Notification';

    if (templateName === 'booking_confirmation') {
      result = await sendBookingConfirmationWhatsAppTemplate(cleanPhone, {
        guestName: userName || 'Valued Guest',
        bookingId: bookingId || '#VN-BOOKING',
        suiteName: suiteName || 'Celebration Suite',
        checkIn: checkIn || 'Confirmed Date & Slot',
        checkOut: checkOut || 'End of Slot',
        guestsCount: guestsCount || '2 Guests',
      });
      resolvedType = 'Booking Confirmation';
      loggedContent = `Dear ${userName || 'Valued Guest'}, Your booking at Vibenests has been confirmed successfully. Booking ID: ${bookingId || '#VN-BOOKING'} Suite: ${suiteName || 'Celebration Suite'} Check-in: ${checkIn || 'Confirmed Date & Slot'} Check-out: ${checkOut || 'End of Slot'} Guests: ${guestsCount || '2 Guests'} We look forward to welcoming you to Vibenests and making your stay comfortable and memorable. Thank you for choosing Vibenests.`;
    } else if (templateName === 'booking_cancellation') {
      result = await sendBookingCancellationWhatsAppTemplate(cleanPhone, {
        guestName: userName || 'Valued Guest',
        bookingId: bookingId || '#VN-BOOKING',
        suiteName: suiteName || 'Celebration Suite',
        checkInDate: checkInDate || 'Scheduled Date',
        cancellationDate: cancellationDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      });
      resolvedType = 'Booking Cancellation';
      loggedContent = `Dear ${userName || 'Valued Guest'}, Your booking at Vibenests has been cancelled successfully. Booking ID: ${bookingId || '#VN-BOOKING'} Room/Suite: ${suiteName || 'Celebration Suite'} Check-in Date: ${checkInDate || 'Scheduled Date'} Cancellation Date: ${cancellationDate || new Date().toLocaleDateString('en-GB')} If applicable, your refund will be processed according to the cancellation and refund policy. Thank you for choosing Vibenests.`;
    } else if (templateName === 'refund_confirmation') {
      result = await sendRefundConfirmationWhatsAppTemplate(cleanPhone, {
        guestName: userName || 'Valued Guest',
        bookingId: bookingId || '#VN-BOOKING',
        refundAmount: refundAmount || '0',
        refundReference: refundReference || ('RFND-' + Date.now()),
      });
      resolvedType = 'Refund Update';
      loggedContent = `Dear ${userName || 'Valued Guest'}, Your refund for the Vibenests booking has been successfully initiated. Booking ID: ${bookingId || '#VN-BOOKING'} Refund Amount: ₹${refundAmount || '0'} Refund Reference: ${refundReference || ('RFND-' + Date.now())} The amount will be credited to your original payment method as per the payment provider's processing timeline. Thank you for choosing Vibenests.`;
    } else if (templateName === 'coupon_offer') {
      result = await sendCouponOfferWhatsAppTemplate(cleanPhone, {
        guestName: userName || 'Valued Guest',
        couponCode: couponCode || 'VIBEEXCLUSIVE',
        discountText: discountText || 'Special Discount',
        validUntil: validUntil || '31 Dec 2026',
      });
      resolvedType = 'Special Offer';
      loggedContent = `Dear ${userName || 'Valued Guest'}, Enjoy an exclusive offer from Vibenests! ✨ Use coupon code ${couponCode || 'VIBEEXCLUSIVE'} and get ${discountText || 'Special Discount'} on your next stay. Offer valid until: ${validUntil || '31 Dec 2026'} Book your stay and experience comfort at Vibenests. Terms & conditions apply.`;
    } else if (templateName === 'vibenests_celebration_booking') {
      result = await sendCelebrationBookingMarketingMessage(cleanPhone, userName || 'Guest', templateName);
      resolvedType = 'Marketing Promotion';
      loggedContent = `Welcome to VibeNests, ${userName || 'Guest'}! ✨ Make your celebrations unforgettable in our private luxury suites.`;
    } else if (templateName === 'login_otp') {
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      result = await sendLoginOtp(cleanPhone, otpCode, userName || 'Guest');
      resolvedType = 'Login OTP Verification';
      loggedContent = `Your VibeNests verification code is ${otpCode}. Valid for 5 minutes. Do not share this code with anyone.`;
    } else {
      result = await sendWhatsApp(cleanPhone, message);
      loggedContent = message;
    }
    
    // Log outbound message in DB
    await AppDataSource.getRepository(WhatsAppMessage).save({
      phone: cleanPhone,
      direction: 'outbound',
      content: loggedContent,
      messageType: resolvedType,
      waMessageId: result?.messageId || ('admin_custom_' + Date.now()),
      waConversationId: null,
    });

    res.json({ message: 'WhatsApp message dispatched', result, ok: result?.ok ?? true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/whatsapp/logs', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const msgRepo = AppDataSource.getRepository(WhatsAppMessage);
    const eventRepo = AppDataSource.getRepository(WhatsAppEvent);
    const bookingRepo = AppDataSource.getRepository(Booking);
    const userRepo = AppDataSource.getRepository(User);

    // Fetch actual logs
    let messages = await msgRepo.find({
      order: { createdAt: 'DESC' },
    });

    const bookings = await bookingRepo.find({ relations: ['user'] });
    const users = await userRepo.find();

    const result = [];
    for (const msg of messages) {
      let guestName = 'Valued Guest';
      let guestEmail = '-';
      let eventName = '-';
      let suiteName = '-';
      let eventDate = '';
      let eventTime = '';

      const cleanPhone = msg.phone.replace(/\D/g, '');
      const matchPhone10 = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

      const userMatch = users.find(u => {
        if (!u.phone) return false;
        const uPhone = u.phone.replace(/\D/g, '');
        return uPhone === cleanPhone || (uPhone.length > 10 ? uPhone.slice(-10) : uPhone) === matchPhone10;
      });

      const bookingMatch = bookings.find(b => {
        const bPhone = (b.guestPhone || b.user?.phone || '').replace(/\D/g, '');
        return bPhone === cleanPhone || (bPhone.length > 10 ? bPhone.slice(-10) : bPhone) === matchPhone10;
      });

      if (userMatch) {
        guestName = userMatch.fullName || 'Valued Guest';
        guestEmail = userMatch.email || '-';
      } else if (bookingMatch) {
        guestName = `${bookingMatch.guestFirstName ?? ''} ${bookingMatch.guestLastName ?? ''}`.trim() || 'Valued Guest';
        guestEmail = bookingMatch.guestEmail || '-';
      }

      if (bookingMatch) {
        eventName = bookingMatch.eventType || 'Celebration Stay';
        suiteName = bookingMatch.suiteName || 'Celebration Suite';
        eventDate = bookingMatch.date || '';
        eventTime = bookingMatch.timeSlot || '';
      }

      const events = msg.waMessageId ? await eventRepo.find({ where: { waMessageId: msg.waMessageId } }) : [];
      const lastEvent = events[events.length - 1];
      let status: 'Read' | 'Delivered' | 'Sent' | 'Failed' | 'Pending' = 'Sent';
      if (lastEvent && lastEvent.status) {
        const rawStatus = lastEvent.status.toLowerCase();
        if (rawStatus === 'read') status = 'Read';
        else if (rawStatus === 'delivered') status = 'Delivered';
        else if (rawStatus === 'failed') status = 'Failed';
        else if (rawStatus === 'sent') status = 'Sent';
        else status = 'Pending';
      } else {
        // Outbound WhatsApp messages sent via Meta Cloud API default to Sent or Delivered
        status = msg.direction === 'outbound' ? 'Sent' : 'Read';
      }

      let inferredType = msg.messageType || '';
      const contentLower = (msg.content || '').toLowerCase();
      if (!inferredType || inferredType === 'text' || inferredType === 'Other') {
        if (contentLower.includes('otp') || contentLower.includes('verification code')) {
          inferredType = 'Login OTP Verification';
        } else if (contentLower.includes('cancelled') || contentLower.includes('cancellation')) {
          inferredType = 'Booking Cancellation';
        } else if (contentLower.includes('confirmed') || contentLower.includes('booking at vibenests has been confirmed')) {
          inferredType = 'Booking Confirmation';
        } else if (contentLower.includes('payment successful') || contentLower.includes('payment')) {
          inferredType = 'Payment Success';
        } else if (contentLower.includes('welcome') || contentLower.includes('account has been created')) {
          inferredType = 'Account Verification';
        } else if (contentLower.includes('refund')) {
          inferredType = 'Refund Update';
        } else if (contentLower.includes('coupon') || contentLower.includes('exclusive offer')) {
          inferredType = 'Special Offer';
        } else if (contentLower.includes('celebration') || contentLower.includes('vibenests_celebration_booking')) {
          inferredType = 'Marketing Promotion';
        } else if (msg.direction === 'inbound') {
          inferredType = 'Inbound Message';
        } else {
          inferredType = 'Direct Notification';
        }
      }

      result.push({
        id: msg.id,
        guestName,
        guestEmail,
        mobileNumber: msg.phone.startsWith('+') ? msg.phone : '+' + msg.phone,
        eventName,
        suiteName,
        eventDate,
        eventTime,
        messageType: inferredType,
        status,
        sentOn: msg.createdAt,
        content: msg.content,
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/health', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const result = await smtpHealthCheck();
    if (result.ok) return res.json({ message: 'smtp_ok' });
    return res.status(503).json({ message: 'smtp_unavailable', reason: result.reason ?? result.error });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { sendEmail, sendSms, sendWhatsApp, smtpHealthCheck } from '../services/notifications.service';
import { sendCelebrationBookingMarketingMessage, sendTemplateMessage } from '../services/whatsapp.service';
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
    const { phone, message, messageType, templateName, userName } = req.body;
    const cleanPhone = phone.replace(/\D/g, '');
    let result: any;

    if (templateName === 'vibenests_celebration_booking') {
      result = await sendCelebrationBookingMarketingMessage(cleanPhone, userName || 'Guest', templateName);
    } else if (templateName === 'login_otp') {
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      result = await sendTemplateMessage({
        to: cleanPhone,
        templateName: 'login_otp',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otpCode }],
          },
        ],
      });
    } else {
      result = await sendWhatsApp(cleanPhone, message);
    }
    
    // Log outbound message in DB
    await AppDataSource.getRepository(WhatsAppMessage).save({
      phone: cleanPhone,
      direction: 'outbound',
      content: message,
      messageType: messageType || templateName || 'text',
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
        } else if (contentLower.includes('confirmed') || contentLower.includes('booking id')) {
          inferredType = 'Booking Confirmation';
        } else if (contentLower.includes('payment successful') || contentLower.includes('payment')) {
          inferredType = 'Payment Success';
        } else if (contentLower.includes('welcome') || contentLower.includes('account has been created')) {
          inferredType = 'Account Verification';
        } else if (contentLower.includes('refund')) {
          inferredType = 'Refund Update';
        } else if (contentLower.includes('celebration') || contentLower.includes('vibenests_celebration_booking')) {
          inferredType = 'Marketing Broadcast';
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

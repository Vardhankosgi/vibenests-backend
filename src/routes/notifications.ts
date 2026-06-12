import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { sendEmail, sendSms, sendWhatsApp, smtpHealthCheck } from '../services/notifications.service';

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
    const { phone, message } = req.body;
    const result = await sendWhatsApp(phone, message);
    res.json({ message: 'WhatsApp sent', result });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
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

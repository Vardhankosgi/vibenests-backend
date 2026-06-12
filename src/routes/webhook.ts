import express from 'express';
import dotenv from 'dotenv';
import { AppDataSource } from '../data-source';
import { WhatsAppEvent } from '../entities/WhatsAppEvent';
import { WhatsAppMessage } from '../entities/WhatsAppMessage';
import { sendWhatsApp } from '../services/notifications.service';


dotenv.config();

const router = express.Router();

function normalizePhone(phone: string | undefined | null) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

// Meta webhook verification
router.get('/webhook/whatsapp', async (req: any, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token && expected && token === expected) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Forbidden');
});

router.post('/webhook/whatsapp', async (req: any, res) => {
  try {
    const body = req.body;

    const entries = body?.entry ?? [];

    // Persist raw webhook for audit
    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value ?? {};
        const messages = value?.messages ?? [];
        const statuses = value?.statuses ?? [];

        for (const m of messages) {
          const phone = normalizePhone(m?.from);
          const waMessageId = m?.id ?? null;

          await AppDataSource.getRepository(WhatsAppEvent).save({
            eventType: 'message',
            phone,
            direction: 'inbound',
            waMessageId,
            status: null,
            payload: body,
          });

          // Best-effort content extraction
          const text = m?.text?.body;
          await AppDataSource.getRepository(WhatsAppMessage).save({
            phone,
            direction: 'inbound',
            content: text ?? null,
            messageType: m?.type ?? null,
            waMessageId,
            waConversationId: value?.contacts?.[0]?.wa_id ?? null,
          });

          // MVP reply (support handoff)
          if (text) {
            await sendWhatsApp(
              phone,
              'Hi! Thanks for reaching out to VibeNests. A support agent will reply shortly.'
            );
          }
        }

        for (const s of statuses) {
          const phone = normalizePhone(s?.recipient_id ?? s?.id ?? undefined);
          const waMessageId = s?.id ?? null;

          await AppDataSource.getRepository(WhatsAppEvent).save({
            eventType: 'delivery',
            phone,
            direction: 'outbound',
            waMessageId,
            status: s?.status ?? null,
            payload: body,
          });
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('WhatsApp webhook error', err);
    return res.status(500).json({ message: err?.message ?? 'Webhook processing failed' });
  }
});

export default router;


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

// Razorpay webhook endpoint (payment success/failure)
// Mounted at: / (see backend-express/src/app.ts uses `app.use('/', webhookRoutes)`)
router.post('/webhook/razorpay', express.json({ type: 'application/json' }), async (req: any, res) => {
  try {
    // Razorpay sends raw payload; signature must be verified.
    // Important: express.json middleware must run before we verify.
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Razorpay webhook secret is not configured' });
    }

    const receivedSignature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!receivedSignature) {
      return res.status(400).json({ message: 'Missing x-razorpay-signature header' });
    }

    const bodyString = JSON.stringify(req.body);
    const crypto = await import('crypto');
    const expected = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    if (expected !== receivedSignature) {
      return res.status(400).json({ message: 'Razorpay webhook signature verification failed' });
    }

    const event = req.body?.event;
    // Typical payload: { event: 'payment.captured', payload: { payment: {...}, order_id, payment_id, ... } }
    const paymentId = req.body?.payload?.payment?.entity?.id || req.body?.payload?.payment?.id || req.body?.payload?.payment_id;
    const orderId = req.body?.payload?.payment?.entity?.order_id || req.body?.payload?.payment?.order_id || req.body?.payload?.order_id;

    if (!paymentId) {
      return res.status(400).json({ message: 'paymentId not found in webhook payload' });
    }

    const paymentRepo = AppDataSource.getRepository('Payment');
    const payment = await paymentRepo.findOne({
      where: {
        providerPaymentId: paymentId,
      } as any,
      relations: ['booking'],
    } as any);

    if (!payment) {
      // Fallback: sometimes stored providerOrderId matches the order id.
      const paymentFallback = await paymentRepo.findOne({ where: { providerOrderId: orderId } as any, relations: ['booking'] } as any);
      if (!paymentFallback) {
        return res.status(200).json({ ok: true, message: 'Payment record not found; ignored' });
      }
    }

    const targetPayment: any = payment || (await paymentRepo.findOne({ where: { providerOrderId: orderId } as any, relations: ['booking'] } as any));

    const { verifyPayment } = await import('../services/payments.service');

    // If payment captured/success => success; else failed.
    const isSuccess = String(event).toLowerCase().includes('captured') || String(event).toLowerCase().includes('authorized') || String(event).toLowerCase().includes('payment.success') || String(event).toLowerCase().includes('paid');

    await verifyPayment(Number(targetPayment.id), {
      status: isSuccess ? 'success' : 'failed',
      providerPaymentId: paymentId,
      providerOrderId: orderId,
      providerSignature: receivedSignature,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Razorpay webhook error', err);
    return res.status(500).json({ message: err?.message ?? 'Webhook processing failed' });
  }
});

export default router;



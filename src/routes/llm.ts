import express from 'express';
import { llmAnswer } from '../services/llm.service';

const router = express.Router();

// In-app chatbot endpoint
// POST /llm/chat
// body: { message: string, context?: { path?: string; userRole?: string; } }
router.post('/chat', async (req: any, res) => {
  try {
    const message = String(req?.body?.message ?? '').trim();
    const context = req?.body?.context ?? {};
    const history = Array.isArray(req?.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }

    const result = await llmAnswer({ message, context, history });
    return res.json({ ok: true, reply: result.reply });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message ?? 'LLM error' });
  }
});

export default router;


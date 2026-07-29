import 'dotenv/config';

type LlmInput = {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  context?: {
    path?: string;
    userRole?: string;
    lang?: string;
  };
};

type LlmOutput = {
  reply: string;
};

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function safeText(s: any): string {
  return String(s ?? '').trim();
}

function buildSystemPrompt(input: LlmInput): string {
  const path = input.context?.path ? `User is currently on path: ${input.context.path}` : 'User is not logged in or path unknown.';
  const role = input.context?.userRole ? `User role: ${input.context.userRole}` : 'User role: Guest';

  return `You are "VibeNests Assistant", a production-ready AI Assistant for VibeNests.
VibeNests is a platform that sells private luxury suites for celebrations, dates, and events.

Current Context:
${path}
${role}

Assistant Responsibilities & Rules:
1. Identify yourself as "VibeNests Assistant".
2. Tone: Friendly, professional, helpful, concise, premium/luxury, and natural.
3. Be direct. Use short answers, simple steps, and markdown lists/bold text when appropriate.
4. Navigation: Use [Text](URL) format for links.
   - For Users: [Dashboard](/user/dashboard), [Book a Suite](/user/suite-booking), [Write Review](/user/write-review).
   - For Admins: [Dashboard](/dashboard), [Bookings](/bookings), [Revenue](/revenue), [Suites](/rooms), [Settings](/settings).
   - Only suggest admin routes if "User role: admin". NEVER expose admin routes or info to normal users or guests.
   - If a Guest asks to book, tell them to [Login](/login) or [Register](/register) first.
5. Hallucination Prevention: DO NOT invent features, routes, or APIs. If you don't know, say "I’m not able to confirm that functionality in VibeNests yet."
6. Explain the suite booking flow if asked: select occasion/date/time/suite/add-ons -> proceed to payment (supports pay-now or pay-at-venue 20% advance).
7. Handle follow-up questions contextually based on chat history.`;
}

export async function llmAnswer(input: LlmInput): Promise<LlmOutput> {
  const groqApiKey = env('GROQ_API_KEY');

  const modelsToTry = [
    process.env.GROQ_MODEL,
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'llama3-groq-70b-8192-tool-use-preview',
    'llama3-groq-8b-8192-tool-use-preview'
  ].filter(Boolean) as string[];

  const systemPrompt = buildSystemPrompt(input);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(input.history || []).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message }
  ];

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  let lastErrorMsg = '';

  // Try models one by one
  for (const model of modelsToTry) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      const data: any = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const msg = data?.error?.message || `Groq request failed with ${resp.status}`;
        // If it's a model availability issue, try the next one
        if (msg.toLowerCase().includes('decommissioned') || msg.toLowerCase().includes('does not exist')) {
          lastErrorMsg = msg;
          continue;
        }
        // If it's an API Key or rate limit error, throw immediately
        throw new Error(msg);
      }

      const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
      const reply = safeText(text) || 'Thanks for reaching out to VibeNests. Could you tell me a bit more about what you need?';

      return { reply };
    } catch (e: any) {
      if (e.message.toLowerCase().includes('decommissioned') || e.message.toLowerCase().includes('does not exist')) {
        lastErrorMsg = e.message;
        continue;
      }
      throw e;
    }
  }

  throw new Error(`All fallback models failed. Last error: ${lastErrorMsg}`);
}



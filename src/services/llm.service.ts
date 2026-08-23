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
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'deepseek-r1-distill-llama-70b',
  ].filter(Boolean) as string[];

  const systemPrompt = buildSystemPrompt(input);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(input.history || []).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message }
  ];

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  let lastErrorMsg = '';

  if (groqApiKey) {
    // Try modern active models one by one
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
            temperature: 0.3,
            max_tokens: 600,
          }),
        });

        const data: any = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          const msg = data?.error?.message || `Groq request failed with ${resp.status}`;
          lastErrorMsg = msg;
          console.warn(`[GROQ MODEL FAIL] Model ${model} failed:`, msg);
          continue;
        }

        const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
        const reply = safeText(text);

        if (reply) {
          return { reply };
        }
      } catch (e: any) {
        lastErrorMsg = e.message;
        console.warn(`[GROQ FETCH ERROR] Model ${model}:`, e.message);
        continue;
      }
    }
  }

  // Graceful Luxury Assistant Fallback if LLM API is unavailable
  console.warn(`[LLM SERVICE] Fallback response triggered. Last error: ${lastErrorMsg || 'No API key'}`);
  
  const query = input.message.toLowerCase();
  let fallbackReply = "Hello! Welcome to **VibeNests Private Luxury Suites & Celebrations**.\n\nHow can I help you today? You can explore our [Celebration Suites](/rooms) or check out [My Bookings](/bookings).";

  if (query.includes('book') || query.includes('reserve') || query.includes('price') || query.includes('cost')) {
    fallbackReply = "You can easily book a private luxury suite for your birthday, anniversary, or romantic date!\n\n👉 [Explore & Book Suites](/rooms)\n\nSelect your date, time slot, and customized celebration add-ons to confirm your booking.";
  } else if (query.includes('addon') || query.includes('cake') || query.includes('decor')) {
    fallbackReply = "We offer premium celebration add-ons including custom balloon & rose decor, designer cakes, DJ sound setup, fog entry, and photography!\n\n👉 [View Add-ons](/addons)";
  } else if (query.includes('contact') || query.includes('call') || query.includes('support') || query.includes('help')) {
    fallbackReply = "Need immediate assistance? You can reach the VibeNests front desk team via WhatsApp or call us directly at support!\n\n👉 [Contact Us](/settings)";
  }

  return { reply: fallbackReply };
}



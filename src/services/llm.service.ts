import 'dotenv/config';

type LlmInput = {
  message: string;
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

function buildPrompt(input: LlmInput): string {
  const message = input.message;
  const path = input.context?.path ? `User is currently on: ${input.context.path}` : '';
  const role = input.context?.userRole ? `User role: ${input.context.userRole}` : '';

  // Keep prompts short, deterministic, and domain-scoped.
  // Booking-related answers should guide user through the UI pages you already have.
  return `You are VibeNests WhatsApp-style concierge chatbot for a website that sells private luxury suites.

${path}
${role}

Rules:
- Always be polite, friendly, and concise.
- If the user asks about booking/scheduling, explain the steps in the app (where to click / what form to fill), and what info you need from them.
- If user asks about "how to book suite", respond with step-by-step guidance.
- If user asks about payment / confirmation / advance payment, explain the payment options and what happens next.
- If user asks about offers/referrals, suggest checking offers/packages pages.
- If user asks something unrelated or you don't know details, ask a clarifying question and provide a helpful next step.

Domain facts (fallback):
- Suites can be booked via the "Suite Booking" flow.
- After selecting occasion/date/time/suite and add-ons, user proceeds to payment.
- Payment supports pay-now and pay-at-venue advance (20%) flow.

User message:
"""${message}"""

Assistant response:
Return only the final message to show to the user.`;
}

export async function llmAnswer(input: LlmInput): Promise<LlmOutput> {
  const groqApiKey = env('GROQ_API_KEY');
  // Groq chat model name. Example: "llama3-70b-8192" or "mixtral-8x7b-32768"
  const model = process.env.GROQ_MODEL || 'llama3-70b-8192';

  // Build prompt
  const prompt = buildPrompt(input);

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  const data: any = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    // Avoid leaking key or big payload
    const msg = data?.error?.message || `Groq request failed with ${resp.status}`;
    throw new Error(msg);
  }

  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    '';

  const reply = safeText(text) || 'Thanks for reaching out to VibeNests. Could you tell me a bit more about what you need?';
  return { reply };
}



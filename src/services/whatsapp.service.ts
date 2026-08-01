import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// Types & Interfaces
// ==========================================
export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  otpTemplateName: string;
  otpTemplateLanguage: string;
  verifyToken: string;
  businessAccountId?: string;
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
  video?: { link: string };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: string;
  parameters: TemplateParameter[];
}

export interface SendTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: TemplateComponent[];
}

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  status?: number;
  error?: any;
  stub?: boolean;
}

// ==========================================
// Configuration & Helpers
// ==========================================

/**
 * Retrieves Meta WhatsApp Cloud API credentials from environment variables.
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v22.0',
    otpTemplateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'login_otp',
    otpTemplateLanguage: process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'vibenests_wa_verify_token_2026',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  };
}

/**
 * Checks if Meta WhatsApp API is properly configured with required credentials.
 */
export function isWhatsAppConfigured(): boolean {
  const config = getWhatsAppConfig();
  return Boolean(config.accessToken && config.phoneNumberId);
}

/**
 * Formats a raw phone number to clean E.164 digits without leading '+'.
 * Default country code '91' is applied if a 10-digit number is provided.
 */
export function formatPhoneNumber(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;

  // Standard Indian 10-digit mobile number without country code
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }

  // Already includes country code (e.g., 919876543210 or 14155552671)
  if (cleaned.length > 10) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Masks mobile number for safe logging (e.g., "+91******1234").
 */
function maskPhoneNumber(phone: string): string {
  if (phone.length <= 4) return '****';
  const visibleTail = phone.slice(-4);
  const headLength = Math.max(0, phone.length - 4);
  return '*'.repeat(headLength) + visibleTail;
}

// ==========================================
// Meta Graph API Client
// ==========================================

/**
 * Sends a generic HTTP POST request to Meta WhatsApp Cloud API graph endpoint.
 */
async function makeApiRequest(endpoint: string, payload: any): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    console.warn('[WHATSAPP API STUB] Meta credentials not configured in process.env (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing).');
    return { ok: false, stub: true, error: 'whatsapp_credentials_not_configured' };
  }

  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorDetail = responseData?.error || {};
      console.error(`[WHATSAPP API ERROR] HTTP ${response.status}: ${errorDetail.message || 'Unknown error'} (Code: ${errorDetail.code || 'N/A'}, FBTraceId: ${errorDetail.fbtrace_id || 'N/A'})`);
      return {
        ok: false,
        status: response.status,
        error: errorDetail.message || responseData,
      };
    }

    const messageId = responseData?.messages?.[0]?.id;
    console.log(`[WHATSAPP API SUCCESS] Message dispatched to ${maskPhoneNumber(payload.to || '')} (MessageId: ${messageId || 'N/A'})`);
    return {
      ok: true,
      messageId,
      status: response.status,
    };
  } catch (err: any) {
    console.error('[WHATSAPP NETWORK ERROR] Failed to reach Meta WhatsApp API:', err?.message || err);
    return {
      ok: false,
      error: err?.message || err,
    };
  }
}

// ==========================================
// Public WhatsApp Integration Methods
// ==========================================

/**
 * Core reusable method for sending any Meta approved WhatsApp template message.
 */
export async function sendTemplateMessage(params: SendTemplateParams): Promise<WhatsAppSendResult> {
  const formattedPhone = formatPhoneNumber(params.to);
  if (!formattedPhone) {
    console.warn(`[WHATSAPP VALIDATION ERROR] Invalid or missing recipient phone number: "${params.to}"`);
    return { ok: false, error: 'invalid_phone_number' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: params.templateName,
      language: {
        code: params.languageCode || 'en',
      },
      ...(params.components && params.components.length > 0 && { components: params.components }),
    },
  };

  return makeApiRequest('messages', payload);
}

/**
 * Sends a Login OTP using the approved Meta WhatsApp OTP template.
 * Specially formatted for Login OTP delivery.
 */
export async function sendLoginOtp(phone: string, otpCode: string, userName: string = 'Guest'): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();

  // 'vibenests_notification' has 2 placeholders: {{1}} (Name) and {{2}} (Reference ID / OTP code)
  const components: TemplateComponent[] = [
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: userName,
        },
        {
          type: 'text',
          text: otpCode,
        },
      ],
    },
  ];

  // Optional: Only attach button parameters if explicitly enabled in env (for Authentication templates with URL buttons)
  if (process.env.WHATSAPP_INCLUDE_BUTTON_PARAM === 'true') {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [
        {
          type: 'text',
          text: otpCode,
        },
      ],
    });
  }

  console.log(`[WHATSAPP OTP INITIATED] Sending OTP template "${config.otpTemplateName}" to ${maskPhoneNumber(phone)}`);

  return sendTemplateMessage({
    to: phone,
    templateName: config.otpTemplateName,
    languageCode: config.otpTemplateLanguage,
    components,
  });
}

/**
 * Helper to verify Meta Webhook GET subscription handshake.
 */
export function verifyWebhook(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined
): { valid: boolean; challenge?: string } {
  const config = getWhatsAppConfig();

  if (mode === 'subscribe' && token === config.verifyToken && challenge) {
    console.log('[WHATSAPP WEBHOOK] Webhook verification successful.');
    return { valid: true, challenge };
  }

  console.warn('[WHATSAPP WEBHOOK] Webhook verification failed due to token or mode mismatch.');
  return { valid: false };
}

// ==========================================
// Default Export Object
// ==========================================
export default {
  getWhatsAppConfig,
  isWhatsAppConfigured,
  formatPhoneNumber,
  sendTemplateMessage,
  sendLoginOtp,
  verifyWebhook,
};

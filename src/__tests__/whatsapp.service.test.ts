import {
  formatPhoneNumber,
  isWhatsAppConfigured,
  getWhatsAppConfig,
  sendLoginOtp,
  sendTemplateMessage,
  verifyWebhook,
} from '../services/whatsapp.service';

describe('whatsapp.service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('formatPhoneNumber', () => {
    test('formats 10-digit Indian mobile number with 91 country code prefix', () => {
      expect(formatPhoneNumber('9876543210')).toBe('919876543210');
    });

    test('retains existing country code when digits > 10', () => {
      expect(formatPhoneNumber('919876543210')).toBe('919876543210');
      expect(formatPhoneNumber('+14155552671')).toBe('14155552671');
    });

    test('strips non-digit characters correctly', () => {
      expect(formatPhoneNumber('+91 98765-43210')).toBe('919876543210');
    });

    test('returns null for empty or invalid inputs', () => {
      expect(formatPhoneNumber('')).toBeNull();
      expect(formatPhoneNumber(null)).toBeNull();
      expect(formatPhoneNumber(undefined)).toBeNull();
    });
  });

  describe('isWhatsAppConfigured & getWhatsAppConfig', () => {
    test('returns false when credentials are missing', () => {
      delete process.env.WHATSAPP_ACCESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      expect(isWhatsAppConfigured()).toBe(false);
    });

    test('returns true when credentials are present', () => {
      process.env.WHATSAPP_ACCESS_TOKEN = 'test_token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
      expect(isWhatsAppConfigured()).toBe(true);
    });

    test('reads environment variables with fallback defaults', () => {
      process.env.WHATSAPP_ACCESS_TOKEN = 'token_abc';
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone_123';
      process.env.WHATSAPP_OTP_TEMPLATE_NAME = 'custom_otp_template';

      const config = getWhatsAppConfig();
      expect(config.accessToken).toBe('token_abc');
      expect(config.phoneNumberId).toBe('phone_123');
      expect(config.otpTemplateName).toBe('custom_otp_template');
      expect(config.apiVersion).toBe('v22.0');
    });
  });

  describe('sendTemplateMessage & Meta API requests', () => {
    test('returns stub error when credentials are not configured', async () => {
      delete process.env.WHATSAPP_ACCESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const result = await sendTemplateMessage({
        to: '9876543210',
        templateName: 'login_otp',
      });

      expect(result.ok).toBe(false);
      expect(result.stub).toBe(true);
    });

    test('sends correctly structured payload to Meta Graph API when configured', async () => {
      process.env.WHATSAPP_ACCESS_TOKEN = 'test_bearer_token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = '10987654321';
      process.env.WHATSAPP_API_VERSION = 'v22.0';
      process.env.WHATSAPP_OTP_TEMPLATE_NAME = 'login_otp';

      const mockFetchResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          messaging_product: 'whatsapp',
          contacts: [{ input: '919876543210', wa_id: '919876543210' }],
          messages: [{ id: 'wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgSQjE2OEE5MzA0NTg1M0E5ODcA' }],
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse as any);

      const result = await sendLoginOtp('9876543210', '654321');

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgSQjE2OEE5MzA0NTg1M0E5ODcA');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v22.0/10987654321/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test_bearer_token',
            'Content-Type': 'application/json',
          },
        })
      );

      const fetchCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchCallBody.to).toBe('919876543210');
      expect(fetchCallBody.template.components[0].parameters[0].text).toBe('Guest');
      expect(fetchCallBody.template.components[0].parameters[1].text).toBe('654321');
    });

    test('handles Meta API error response gracefully', async () => {
      process.env.WHATSAPP_ACCESS_TOKEN = 'test_bearer_token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = '10987654321';

      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: {
            message: 'Template does not exist',
            type: 'OAuthException',
            code: 100,
            fbtrace_id: 'AbCdEf123456',
          },
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockErrorResponse as any);

      const result = await sendLoginOtp('9876543210', '123456');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toBe('Template does not exist');
    });
  });

  describe('verifyWebhook', () => {
    test('returns valid and challenge when token matches', () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'secret_token_123';

      const res = verifyWebhook('subscribe', 'secret_token_123', 'challenge_code_999');
      expect(res.valid).toBe(true);
      expect(res.challenge).toBe('challenge_code_999');
    });

    test('returns invalid when mode or token mismatches', () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'secret_token_123';

      const res = verifyWebhook('subscribe', 'wrong_token', 'challenge_code_999');
      expect(res.valid).toBe(false);
    });
  });
});

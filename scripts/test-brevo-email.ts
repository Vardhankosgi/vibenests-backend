// @ts-ignore
import dotenv from 'dotenv';

dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'vibenestsmeetingpoint@gmail.com';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'VibeNests Celebrations';

async function testBrevo() {
  console.log('🚀 Testing Brevo HTTP API (Port 443 HTTPS)...');
  console.log(`🔑 Brevo API Key: ${BREVO_API_KEY.substring(0, 10)}...`);
  console.log(`📤 Sender: ${SENDER_NAME} <${SENDER_EMAIL}>`);

  const to = 'vibenestsmeetingpoint@gmail.com'; // send test email to yourself

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY.trim(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject: '🎉 VibeNests Brevo API Integration Test',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #111; color: #fff; border-radius: 10px;">
            <h2 style="color: #f59e0b;">✨ VibeNests Brevo Email System Working!</h2>
            <p>Your Brevo API key is working perfectly over HTTPS Port 443.</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
        `,
        textContent: 'VibeNests Brevo Email System is working successfully!',
      }),
    });

    const data = await response.json();
    console.log('📬 HTTP Status:', response.status);
    console.log('📄 Response Data:', JSON.stringify(data, null, 2));

    if (response.ok && (data as any)?.messageId) {
      console.log(`\n🎉 SUCCESS! Email delivered with Message ID: ${(data as any).messageId}`);
    } else {
      console.error(`\n❌ FAILED! Response:`, data);
    }
  } catch (err: any) {
    console.error(`\n❌ Error:`, err?.message || err);
  }
}

testBrevo();

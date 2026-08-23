import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@vibenests.local';

let transporter: nodemailer.Transporter | null = null;
if ((SMTP_HOST || SMTP_USER) && SMTP_USER && SMTP_PASS) {
  try {
    const isGmail = SMTP_HOST?.includes('gmail') || SMTP_USER?.includes('@gmail.com');

    const transportConfig: any = isGmail
      ? {
          service: 'gmail',
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        }
      : {
          host: SMTP_HOST,
          port: SMTP_PORT || 465,
          secure: (SMTP_PORT ?? 465) === 465,
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          connectionTimeout: 15000,
          socketTimeout: 20000,
          tls: {
            rejectUnauthorized: false,
          },
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        };

    transporter = nodemailer.createTransport(transportConfig);
    console.log(`[SMTP INIT] Initialized email transporter (${isGmail ? 'Gmail Service' : `${SMTP_HOST}:${SMTP_PORT}`})`);
  } catch (err) {
    console.error('[SMTP INIT ERROR] Transporter init failed:', err);
  }
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;

console.log(`[EMAIL SYSTEM INIT] Config: RESEND_API_KEY=${RESEND_API_KEY ? 'CONFIGURED (' + RESEND_API_KEY.substring(0, 6) + '...)' : 'MISSING'}, SMTP_HOST=${SMTP_HOST || 'MISSING'}, SMTP_PORT=${SMTP_PORT || 'MISSING'}, SMTP_USER=${SMTP_USER || 'MISSING'}`);

export const sendEmail = async (to: string, subject: string, body: string, html?: string) => {
  console.log(`\n================== [EMAIL DISPATCH START] ==================`);
  console.log(`📬 To: ${to}`);
  console.log(`📋 Subject: "${subject}"`);
  console.log(`⚙️ Config: RESEND_API_KEY=${RESEND_API_KEY ? 'YES' : 'NO'}, SMTP_TRANSPORTER=${transporter ? 'YES' : 'NO'}`);

  // 1. Primary: Use Resend HTTP API (Port 443 HTTPS - Never blocked on Cloud/Railway)
  if (RESEND_API_KEY) {
    console.log(`🌐 [Method 1] Attempting delivery via Resend HTTP API (Port 443)...`);
    try {
      let fromAddress = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'VibeNests <onboarding@resend.dev>';
      // Resend does not allow unverified @gmail.com as the 'from' domain. Use onboarding@resend.dev unless a custom domain is verified.
      if (fromAddress.includes('@gmail.com')) {
        fromAddress = 'VibeNests <onboarding@resend.dev>';
      }

      console.log(`🌐 [Method 1] Attempting delivery via Resend HTTP API (From: ${fromAddress})...`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          text: body,
          html: html ?? `<p>${body}</p>`,
        }),
      });

      const data: any = await res.json();
      if (res.ok && data.id) {
        console.log(`✅ [RESEND SUCCESS] Email delivered successfully! Message ID: ${data.id}`);
        console.log(`================== [EMAIL DISPATCH END] ==================\n`);
        return { ok: true, id: data.id };
      } else {
        console.error(`❌ [RESEND API REJECTED] HTTP ${res.status}:`, JSON.stringify(data, null, 2));
      }
    } catch (resendErr: any) {
      console.error(`❌ [RESEND FETCH ERROR]:`, resendErr?.message || resendErr);
    }
  } else {
    console.log(`ℹ️ [Method 1: Resend] Skipped (RESEND_API_KEY is not set in environment variables).`);
  }

  // 2. Secondary: Use Nodemailer SMTP
  if (transporter) {
    console.log(`📡 [Method 2] Attempting delivery via SMTP (${SMTP_HOST}:${SMTP_PORT})...`);
    try {
      const info = await transporter.sendMail({ from: SMTP_FROM, to, subject, text: body, html: html ?? `<p>${body}</p>` });
      console.log(`✅ [SMTP SUCCESS] Email delivered via Nodemailer! Message ID: ${info?.messageId}`);
      console.log(`================== [EMAIL DISPATCH END] ==================\n`);
      return { ok: true };
    } catch (err: any) {
      console.error(`❌ [SMTP SEND ERROR]:`, err?.message || err);
      console.error(`🔍 SMTP Error Details:`, { code: err?.code, command: err?.command, response: err?.response });
    }
  } else {
    console.log(`ℹ️ [Method 2: SMTP] Skipped (Transporter not initialized due to missing SMTP credentials).`);
  }

  const missing = [
    !RESEND_API_KEY ? 'RESEND_API_KEY' : null,
    !SMTP_HOST ? 'SMTP_HOST' : null,
    !SMTP_USER ? 'SMTP_USER' : null,
    !SMTP_PASS ? 'SMTP_PASS' : null,
  ].filter(Boolean);

  console.error(`🛑 [EMAIL FAILED] No provider succeeded. Missing variables: ${missing.join(', ')}`);
  console.log(`================== [EMAIL DISPATCH END] ==================\n`);

  return { ok: false, error: 'no_provider_succeeded' };
};

export const sendBookingConfirmationEmail = async (opts: {
  to: string;
  guestName: string;
  bookingId: number;
  suiteName: string;
  date: string;
  startTime: string;
  endTime: string;
  occasion: string;
  addOns: string[];
  totalAmount: number;
}) => {
  const addOnLine = opts.addOns.length
    ? `<div style="margin:0 0 8px"><strong>Add-ons:</strong> ${opts.addOns.join(', ')}</div>`
    : '';

  const footerYear = new Date().getFullYear();
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
      <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
      <div>
        <div style="font-size:16px;font-weight:700;line-height:1">Booking Confirmed</div>
        <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
      </div>
    </div>

    <div style="padding:18px 20px">
      <p style="margin:0 0 14px">Hi <strong>${opts.guestName}</strong>, your booking is confirmed.</p>

      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;">
        <div style="margin:0 0 8px"><strong>Booking ID:</strong> #VN${opts.bookingId}</div>
        <div style="margin:0 0 8px"><strong>Suite:</strong> ${opts.suiteName}</div>
        <div style="margin:0 0 8px"><strong>Date:</strong> ${opts.date}</div>
        <div style="margin:0 0 8px"><strong>Time:</strong> ${opts.startTime} – ${opts.endTime}</div>
        <div style="margin:0 0 8px"><strong>Occasion:</strong> ${opts.occasion}</div>
        ${addOnLine}
        <div style="margin-top:10px;border-top:1px solid #eee;padding-top:10px;display:flex;justify-content:space-between">
          <span style="color:#666">Total Paid</span>
          <span style="font-weight:700">₹${opts.totalAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <p style="margin:16px 0 0;color:#666;font-size:13px">For any queries, reply to this email or contact us.</p>
    </div>

    <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
      © ${footerYear} VibeNests. All rights reserved.
    </div>
  </div>`;

  return sendEmail(opts.to, `Booking Confirmed – #VN${opts.bookingId} | VibeNests`, `Your booking #VN${opts.bookingId} on ${opts.date} is confirmed.`, html);
};

export const sendBookingReceivedEmail = async (opts: {
  to: string;
  guestName: string;
  bookingId: number;
  suiteName: string;
  date: string;
  startTime: string;
  endTime: string;
  occasion: string;
  addOns: string[];
  totalAmount: number;
}) => {
  const addOnLine = opts.addOns.length
    ? `<div style="margin:0 0 8px"><strong>Add-ons:</strong> ${opts.addOns.join(', ')}</div>`
    : '';

  const footerYear = new Date().getFullYear();
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
      <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
      <div>
        <div style="font-size:16px;font-weight:700;line-height:1">Booking Request Received</div>
        <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
      </div>
    </div>

    <div style="padding:18px 20px">
      <p style="margin:0 0 14px">Hi <strong>${opts.guestName}</strong>, we have received your booking request.</p>

      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;">
        <div style="margin:0 0 8px"><strong>Booking ID:</strong> #VN${opts.bookingId}</div>
        <div style="margin:0 0 8px"><strong>Suite:</strong> ${opts.suiteName}</div>
        <div style="margin:0 0 8px"><strong>Date:</strong> ${opts.date}</div>
        <div style="margin:0 0 8px"><strong>Time:</strong> ${opts.startTime} – ${opts.endTime}</div>
        <div style="margin:0 0 8px"><strong>Occasion:</strong> ${opts.occasion}</div>
        ${addOnLine}
        <div style="margin-top:10px;border-top:1px solid #eee;padding-top:10px;display:flex;justify-content:space-between">
          <span style="color:#666">Total Amount</span>
          <span style="font-weight:700">₹${opts.totalAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <p style="margin:16px 0 0;color:#666;font-size:13px">You will receive another email once your payment is confirmed or when your booking is finalized. For any queries, reply to this email or contact us.</p>
    </div>

    <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
      © ${footerYear} VibeNests. All rights reserved.
    </div>
  </div>`;

  return sendEmail(opts.to, `Booking Request Received – #VN${opts.bookingId} | VibeNests`, `Your booking request #VN${opts.bookingId} on ${opts.date} has been received.`, html);
};

export const sendPasswordSetupEmail = async (opts: { to: string; guestName: string; resetToken: string }) => {
  const frontendUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
  const link = `${frontendUrl}/reset-password?token=${opts.resetToken}`;
  const footerYear = new Date().getFullYear();

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
      <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
      <div>
        <div style="font-size:16px;font-weight:700;line-height:1">Account Setup</div>
        <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
      </div>
    </div>

    <div style="padding:18px 20px">
      <p style="margin:0 0 14px">Hi <strong>${opts.guestName}</strong>, an account has been created for you at VibeNests.</p>
      <p style="margin:0 0 18px;color:#666;font-size:14px">Click the button below to set your password and activate your account.</p>

      <div style="text-align:center;margin:18px 0">
        <a href="${link}" style="display:inline-block;background:#111;color:#fff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">Set My Password</a>
      </div>

      <p style="margin:0;color:#666;font-size:13px">If the button doesn’t work, copy and paste this link into your browser:</p>
      <p style="margin:8px 0 0;word-break:break-all;color:#111;font-size:13px">${link}</p>
    </div>

    <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
      © ${footerYear} VibeNests. All rights reserved.
    </div>
  </div>`;

  return sendEmail(opts.to, 'Set up your VibeNests account', `Set your password: ${link}`, html);
};

export const sendPackageSubscriptionEmail = async (opts: {
  to: string;
  guestName: string;
  planName: string;
  price: number;
  validityDays: number;
  expiryDate: string;
  maxFreeBookings: number;
}) => {
  const footerYear = new Date().getFullYear();

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
      <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
      <div>
        <div style="font-size:16px;font-weight:700;line-height:1">Package Subscribed</div>
        <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
      </div>
    </div>

    <div style="padding:18px 20px">
      <p style="margin:0 0 14px">Hi <strong>${opts.guestName}</strong>, thank you for subscribing to VibeNests package.</p>
      <p style="margin:0 0 18px;color:#666;font-size:14px">Your membership details are as follows:</p>

      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;">
        <div style="margin:0 0 8px"><strong>Package Name:</strong> ${opts.planName}</div>
        <div style="margin:0 0 8px"><strong>Price:</strong> ₹${opts.price.toLocaleString('en-IN')}</div>
        <div style="margin:0 0 8px"><strong>Validity:</strong> ${opts.validityDays} Days</div>
        <div style="margin:0 0 8px"><strong>Expiry Date:</strong> ${opts.expiryDate}</div>
        <div style="margin:0 0 8px"><strong>Max Free Bookings:</strong> ${opts.maxFreeBookings} Bookings</div>
      </div>

      <p style="margin:16px 0 0;color:#666;font-size:13px">You can now book eligible suites using your package credits on VibeNests.</p>
    </div>

    <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
      © ${footerYear} VibeNests. All rights reserved.
    </div>
  </div>`;

  return sendEmail(
    opts.to,
    `Package Subscribed successfully – ${opts.planName} | VibeNests`,
    `Your subscription to ${opts.planName} package is active. Expiry: ${opts.expiryDate}.`,
    html
  );
};

export const sendSms = async (phone: string, message: string) => {
  // SMS provider removed; keep a console fallback. Consider integrating an SMS gateway.
  console.log(`SMS (stub) -> To: ${phone} | Message: ${message}`);
  return { ok: true };
};

function normalizePhoneToDigits(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export const sendWhatsApp = async (phone: string, message: string) => {
  const digits = normalizePhoneToDigits(phone);
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v25.0';

  // No WhatsApp config => stub fallback
  if (!accessToken || !phoneNumberId) {
    console.log(`WHATSAPP (stub) -> To: ${phone} | Message: ${message}`);
    return { ok: true, stub: true };
  }

  try {
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: digits,
      type: 'text',
      text: { body: message },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.warn('WhatsApp send failed', resp.status, data);
      return { ok: false, status: resp.status, error: data };
    }

    return { ok: true, data };
  } catch (err: any) {
    console.warn('WhatsApp send error', err);
    return { ok: false, error: err?.message ?? err };
  }
};


export const smtpHealthCheck = async () => {
  if (!transporter) return { ok: false, reason: 'no_smtp_config' };
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? err };
  }
};

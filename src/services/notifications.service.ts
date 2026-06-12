import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@vibenests.local';

let transporter: nodemailer.Transporter | null = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  } catch (err) {
    console.warn('SMTP transporter init failed', err);
  }
}

export const sendEmail = async (to: string, subject: string, body: string, html?: string) => {
  if (transporter) {
    try {
      await transporter.sendMail({ from: SMTP_FROM, to, subject, text: body, html: html ?? `<p>${body}</p>` });
      return { ok: true };
    } catch (err: any) {
      console.warn('SMTP send failed', err?.message ?? err);
      return { ok: false, error: err?.message ?? err };
    }
  }
  console.log(`EMAIL (stub) -> To: ${to} | Subject: ${subject} | Body: ${body}`);
  return { ok: true };
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
    ? `<tr><td style="padding:6px 0;color:#888">Add-ons</td><td style="padding:6px 0;text-align:right">${opts.addOns.join(', ')}</td></tr>`
    : '';
  const html = `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0d14;color:#e8e8e8;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#b8972a,#e2c060);padding:28px 32px">
      <h1 style="margin:0;font-size:22px;color:#0d0d14">Booking Confirmed ✓</h1>
      <p style="margin:6px 0 0;color:#0d0d14;opacity:0.8">VibeNests</p>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 20px">Hi <strong>${opts.guestName}</strong>, your booking has been confirmed by our team.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888">Booking ID</td><td style="padding:6px 0;text-align:right">#VN${opts.bookingId}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Suite</td><td style="padding:6px 0;text-align:right">${opts.suiteName}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Date</td><td style="padding:6px 0;text-align:right">${opts.date}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Time</td><td style="padding:6px 0;text-align:right">${opts.startTime} – ${opts.endTime}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Occasion</td><td style="padding:6px 0;text-align:right">${opts.occasion}</td></tr>
        ${addOnLine}
        <tr style="border-top:1px solid #333">
          <td style="padding:10px 0 0;font-weight:700;color:#e2c060">Total Paid</td>
          <td style="padding:10px 0 0;text-align:right;font-weight:700;color:#e2c060">₹${opts.totalAmount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#888">For any queries, reply to this email or contact us.</p>
    </div>
  </div>`;
  return sendEmail(opts.to, `Booking Confirmed – #VN${opts.bookingId} | VibeNests`, `Your booking #VN${opts.bookingId} on ${opts.date} is confirmed.`, html);
};

export const sendPasswordSetupEmail = async (opts: { to: string; guestName: string; resetToken: string }) => {
  const frontendUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
  const link = `${frontendUrl}/reset-password?token=${opts.resetToken}`;
  const html = `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0d14;color:#e8e8e8;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#b8972a,#e2c060);padding:28px 32px">
      <h1 style="margin:0;font-size:22px;color:#0d0d14">Set Up Your Account</h1>
      <p style="margin:6px 0 0;color:#0d0d14;opacity:0.8">VibeNests</p>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 16px">Hi <strong>${opts.guestName}</strong>, an account has been created for you at VibeNests.</p>
      <p style="margin:0 0 24px;color:#aaa">Click the button below to set your password and activate your account. This link expires in 24 hours.</p>
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#b8972a,#e2c060);color:#0d0d14;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none">Set My Password</a>
      <p style="margin:20px 0 0;font-size:12px;color:#666">Or copy this link: ${link}</p>
    </div>
  </div>`;
  return sendEmail(opts.to, 'Set up your VibeNests account', `Set your password: ${link}`, html);
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

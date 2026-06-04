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

export const sendEmail = async (to: string, subject: string, body: string) => {
  if (transporter) {
    try {
      await transporter.sendMail({ from: SMTP_FROM, to, subject, text: body, html: `<p>${body}</p>` });
      return { ok: true };
    } catch (err: any) {
      console.warn('SMTP send failed', err?.message ?? err);
      return { ok: false, error: err?.message ?? err };
    }
  }
  console.log(`EMAIL (stub) -> To: ${to} | Subject: ${subject} | Body: ${body}`);
  return { ok: true };
};

export const sendSms = async (phone: string, message: string) => {
  // SMS provider removed; keep a console fallback. Consider integrating an SMS gateway.
  console.log(`SMS (stub) -> To: ${phone} | Message: ${message}`);
  return { ok: true };
};

export const sendWhatsApp = async (phone: string, message: string) => {
  // WhatsApp provider removed; keep a console fallback.
  console.log(`WHATSAPP (stub) -> To: ${phone} | Message: ${message}`);
  return { ok: true };
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

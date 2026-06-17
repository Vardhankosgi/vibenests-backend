"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smtpHealthCheck = exports.sendWhatsApp = exports.sendSms = exports.sendPasswordSetupEmail = exports.sendBookingConfirmationEmail = exports.sendEmail = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const nodemailer_1 = __importDefault(require("nodemailer"));
dotenv_1.default.config();
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@vibenests.local';
let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    try {
        transporter = nodemailer_1.default.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    }
    catch (err) {
        console.warn('SMTP transporter init failed', err);
    }
}
const sendEmail = async (to, subject, body, html) => {
    if (transporter) {
        try {
            await transporter.sendMail({ from: SMTP_FROM, to, subject, text: body, html: html ?? `<p>${body}</p>` });
            return { ok: true };
        }
        catch (err) {
            console.warn('SMTP send failed', err?.message ?? err);
            return { ok: false, error: err?.message ?? err };
        }
    }
    console.log(`EMAIL (stub) -> To: ${to} | Subject: ${subject} | Body: ${body}`);
    return { ok: true };
};
exports.sendEmail = sendEmail;
const sendBookingConfirmationEmail = async (opts) => {
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
    return (0, exports.sendEmail)(opts.to, `Booking Confirmed – #VN${opts.bookingId} | VibeNests`, `Your booking #VN${opts.bookingId} on ${opts.date} is confirmed.`, html);
};
exports.sendBookingConfirmationEmail = sendBookingConfirmationEmail;
const sendPasswordSetupEmail = async (opts) => {
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
    return (0, exports.sendEmail)(opts.to, 'Set up your VibeNests account', `Set your password: ${link}`, html);
};
exports.sendPasswordSetupEmail = sendPasswordSetupEmail;
const sendSms = async (phone, message) => {
    // SMS provider removed; keep a console fallback. Consider integrating an SMS gateway.
    console.log(`SMS (stub) -> To: ${phone} | Message: ${message}`);
    return { ok: true };
};
exports.sendSms = sendSms;
function normalizePhoneToDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
}
const sendWhatsApp = async (phone, message) => {
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
    }
    catch (err) {
        console.warn('WhatsApp send error', err);
        return { ok: false, error: err?.message ?? err };
    }
};
exports.sendWhatsApp = sendWhatsApp;
const smtpHealthCheck = async () => {
    if (!transporter)
        return { ok: false, reason: 'no_smtp_config' };
    try {
        await transporter.verify();
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err?.message ?? err };
    }
};
exports.smtpHealthCheck = smtpHealthCheck;

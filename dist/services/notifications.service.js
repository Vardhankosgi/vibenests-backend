"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsApp = exports.sendSms = exports.sendEmail = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sendEmail = async (to, subject, body) => {
    // Stub: integrate real email provider (SendGrid/Mailgun) later
    console.log(`EMAIL -> To: ${to} | Subject: ${subject} | Body: ${body}`);
    return { ok: true };
};
exports.sendEmail = sendEmail;
const sendSms = async (phone, message) => {
    // Stub: integrate SMS gateway later
    console.log(`SMS -> To: ${phone} | Message: ${message}`);
    return { ok: true };
};
exports.sendSms = sendSms;
const sendWhatsApp = async (phone, message) => {
    // Stub: integrate WhatsApp API later
    console.log(`WHATSAPP -> To: ${phone} | Message: ${message}`);
    return { ok: true };
};
exports.sendWhatsApp = sendWhatsApp;

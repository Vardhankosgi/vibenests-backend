import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const SMTP_USER = process.env.SMTP_USER || 'VibeNestsmeetingpoint@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'qptwmedpcoyolokr';

console.log('Testing email credentials with:', SMTP_USER);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

transporter.sendMail({
  from: `VibeNests <${SMTP_USER}>`,
  to: SMTP_USER,
  subject: 'VibeNests SMTP Test',
  text: 'This is a test email from VibeNests backend.',
}, (err, info) => {
  if (err) {
    console.error('❌ Email Test Failed:', err);
  } else {
    console.log('✅ Email Test Successful! Message ID:', info.messageId);
  }
});

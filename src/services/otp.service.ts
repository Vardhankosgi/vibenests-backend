import { AppDataSource } from '../data-source';
import { OtpCode } from '../entities/OtpCode';
import { User } from '../entities/User';
import { sendEmail, sendSms, sendWhatsApp } from './notifications.service';

import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { createRefreshToken } from './token.service';
import dotenv from 'dotenv';

dotenv.config();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

const otpRepo = () => AppDataSource.getRepository(OtpCode);
const userRepo = () => AppDataSource.getRepository(User);

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const generateAccessToken = (user: User) => {
  const payload = { userId: user.id, role: user.role, email: user.email };
  const secret: Secret = process.env.JWT_SECRET || 'secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1d') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
};

export const sendOtp = async (phone: string) => {
  const normalised = phone.replace(/\D/g, '');
  const matchPhone = normalised.length > 10 ? normalised.slice(-10) : normalised;

  // Check user exists
  const existingUser = await userRepo().findOne({
    where: [
      { phone: matchPhone },
      { phone: normalised },
      { phone: `+${normalised}` }
    ]
  });

  if (!existingUser) {
    throw new Error('This phone number is not registered. Please sign up first.');
  }

  if (!existingUser.isActive) {
    throw new Error('Your account is not active. Please verify your account.');
  }

  // invalidate old unused OTPs for this phone
  await otpRepo().update({ phone: normalised, used: false }, { used: true });
  await otpRepo().update({ phone: matchPhone, used: false }, { used: true });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const entry = otpRepo().create({ phone: normalised, code, expiresAt, used: false });
  await otpRepo().save(entry);

  const message = `Your VibeNests OTP is ${code}. Valid for 5 minutes. Do not share this with anyone.`;

  // Prefer channel based on user record, keep backward-compatible fallback.
  if (existingUser.email && !existingUser.email.endsWith('@phone.local')) {
    const emailResult = await sendEmail(existingUser.email, 'VibeNests — Your OTP', message);
    if (!emailResult.ok) {
      throw new Error(`Failed to send OTP email: ${emailResult.error || 'Unknown SMTP error'}`);
    }
  } else {
    // If WhatsApp is configured, use it as an OTP channel.
    const waAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const waPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const whatsappConfigured = Boolean(waAccessToken && waPhoneNumberId);

    if (whatsappConfigured) {
      await sendWhatsApp(normalised, message);
    } else {
      // Fallback: SMS stub (logs to console)
      await sendSms(normalised, message);
    }
  }

  // Always return OTP in dev mode for easy testing
  const isDev = process.env.NODE_ENV !== 'production';
  return { message: 'OTP sent', ...(isDev && { otp: code }) };
};

export const verifyOtp = async (phone: string, code: string) => {
  const normalised = phone.replace(/\D/g, '');
  const matchPhone = normalised.length > 10 ? normalised.slice(-10) : normalised;

  const entry = await otpRepo().findOne({
    where: [
      { phone: matchPhone, code, used: false },
      { phone: normalised, code, used: false }
    ],
    order: { createdAt: 'DESC' },
  });

  if (!entry) throw new Error('Invalid OTP');
  if (entry.expiresAt < new Date()) {
    entry.used = true;
    await otpRepo().save(entry);
    throw new Error('OTP expired. Please request a new one.');
  }

  entry.used = true;
  await otpRepo().save(entry);

  // Find user by phone
  let user = await userRepo().findOne({
    where: [
      { phone: matchPhone },
      { phone: normalised },
      { phone: `+${normalised}` }
    ]
  });

  if (!user) {
    throw new Error('This phone number is not registered. Please sign up first.');
  }

  if (!user.isActive) throw new Error('Your account is not active. Please verify your account.');
  if (!user.isVerified) {
    user.isVerified = true;
    user = await userRepo().save(user);
  }

  const accessToken = generateAccessToken(user);
  const refreshEntity = await createRefreshToken(user.id);
  return {
    accessToken,
    refreshToken: refreshEntity.token,
    user: { 
      id: user.id, 
      fullName: user.fullName, 
      email: user.email, 
      role: user.role, 
      phone: user.phone, 
      isActive: user.isActive, 
      dateOfBirth: user.dateOfBirth ?? null,
      marriageDate: user.marriageDate ?? null
    },
  };
};

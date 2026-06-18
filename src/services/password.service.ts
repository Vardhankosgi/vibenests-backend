import dotenv from 'dotenv';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { sendEmail } from './notifications.service';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

dotenv.config();

export const createResetTokenForUser = async (email: string) => {
  const repo = AppDataSource.getRepository(User);
  const normalizedEmail = email.trim().toLowerCase();
  const user = await repo.findOneBy({ email: normalizedEmail });
  if (!user) throw new Error('User not found');

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await repo.save(user);

  const resetLink = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5174'}/reset-password?token=${rawToken}`;

  const emailHtml = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
      <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
      <div>
        <div style="font-size:16px;font-weight:700;line-height:1">Password Reset</div>
        <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
      </div>
    </div>
    <div style="padding:18px 20px">
      <p style="margin:0 0 14px">Hi <strong>${user.fullName}</strong>,</p>
      <p style="margin:0 0 18px;color:#666;font-size:14px">We received a request to reset your VibeNest password. Click the button below to choose a new password.</p>
      <div style="text-align:center;margin:18px 0">
        <a href="${resetLink}" style="display:inline-block;background:#b8972a;color:#fff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">Reset My Password</a>
      </div>
      <p style="margin:0;color:#666;font-size:13px">This link will expire in 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
      <p style="margin:16px 0 0;color:#666;font-size:13px">If the button doesn’t work, copy and paste this link into your browser:</p>
      <p style="margin:8px 0 0;word-break:break-all;color:#111;font-size:13px">${resetLink}</p>
    </div>
    <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
      © ${new Date().getFullYear()} VibeNests. All rights reserved.
    </div>
  </div>`;

  const emailResult = await sendEmail(
    email,
    'Reset Your VibeNest Password',
    `Click the link to reset your password: ${resetLink}\n\nThis link expires in 15 minutes.`,
    emailHtml
  );

  if (!emailResult.ok) {
    throw new Error(`Failed to send password reset email: ${emailResult.error || 'Unknown SMTP error'}`);
  }

  return rawToken;
};

export const changePasswordForUser = async (userId: number, currentPass: string, newPass: string) => {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOneBy({ id: userId });
  if (!user) throw new Error('User not found');

  if (!user.password) throw new Error('User does not have a password set');
  const isValid = await bcrypt.compare(currentPass, user.password);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  user.password = await bcrypt.hash(newPass, 10);
  await repo.save(user);
};

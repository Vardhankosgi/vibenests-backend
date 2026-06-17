import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { sendEmail } from './notifications.service';

dotenv.config();

const RESET_SECRET = () => process.env.JWT_PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'reset_secret';
const RESET_EXPIRES = () => process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '1h';

export const createResetTokenForUser = async (email: string) => {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOneBy({ email });
  if (!user) throw new Error('User not found');

  const token = jwt.sign({ userId: user.id }, RESET_SECRET(), { expiresIn: RESET_EXPIRES() as any });

  const resetLink = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5174'}/reset-password?token=${token}`;
  const result = await sendEmail(
    email,
    'VibeNests — Password Reset',
    `Click the link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`
  );

  if (!result?.ok) {
    throw new Error(`Failed to send reset email: ${result?.error || 'unknown error'}`);
  }

  return token;
};

export const verifyResetToken = (token: string): number => {
  try {
    const payload = jwt.verify(token, RESET_SECRET()) as any;
    return payload.userId;
  } catch {
    throw new Error('Invalid or expired reset token');
  }
};


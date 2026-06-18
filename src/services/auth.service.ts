import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createRefreshToken, revokeRefreshToken, verifyRefreshToken as verifyDbRefresh } from './token.service';
import { generateUniqueReferralCode, validateReferralCode, createReferralRelationship } from './referrals.service';

dotenv.config();

const userRepo = () => AppDataSource.getRepository(User);

export const registerUser = async (data: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth: string;
  marriageDate?: string;
  referralCode?: string;
}) => {
  const repo = userRepo();

  const normalizedEmail = data.email.trim().toLowerCase();
  const normalizedPhone = data.phone ? data.phone.replace(/\D/g, '') : undefined;

  const existsByEmail = await repo.findOneBy({ email: normalizedEmail });
  if (existsByEmail) throw new Error('Email already registered');

  if (normalizedPhone) {
    const existsByPhone = await repo.findOneBy({ phone: normalizedPhone });
    if (existsByPhone) throw new Error('Phone already registered');
  }

  // Pre-validate referral code if entered
  if (data.referralCode) {
    const validation = await validateReferralCode(data.referralCode);
    if (!validation.valid) {
      throw new Error(validation.message || 'Invalid referral code');
    }
  }

  const hash = await bcrypt.hash(data.password, 10);
  const myReferralCode = await generateUniqueReferralCode();

  const user = repo.create({
    fullName: data.fullName,
    email: normalizedEmail,
    password: hash,
    phone: normalizedPhone,
    dateOfBirth: data.dateOfBirth,
    marriageDate: data.marriageDate,
    referralCode: myReferralCode,
  });

  // Quick fix: allow email/password registration to log in without extra verification step.
  user.isVerified = true;
  user.isActive = true;

  try {
    const savedUser = await repo.save(user);

    // Save code to referral_codes table
    const refCodeRepo = AppDataSource.getRepository('ReferralCode');
    const refCode = refCodeRepo.create({ code: myReferralCode, userId: savedUser.id, isActive: true });
    await refCodeRepo.save(refCode);

    // If referred, create the relationship
    if (data.referralCode) {
      try {
        await createReferralRelationship(data.referralCode, savedUser);
      } catch (err: any) {
        console.warn('Failed to link referral relationship:', err?.message);
      }
    }

    return savedUser;
  } catch (err: any) {
    // Postgres unique violation
    if (err?.code === '23505') {
      throw new Error('Email or phone already registered');
    }
    throw err;
  }
};


const generateAccessToken = (user: User) => {
  const payload = { userId: user.id, role: user.role, email: user.email };
  const secret: Secret = process.env.JWT_SECRET || 'secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as SignOptions['expiresIn'];
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, secret, options);
};

export const loginUser = async (email: string, password: string) => {
  const repo = userRepo();
  const user = await repo.findOneBy({ email });
  if (!user) throw new Error('Invalid credentials');
  if (!user.password) throw new Error('This account uses OTP login. Please use mobile OTP.');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid credentials');
  if (!user.isVerified) throw new Error('Your account is not verified. Please verify your account.');

  const accessToken = generateAccessToken(user);
  const refreshEntity = await createRefreshToken(user.id);
  return { accessToken, refreshToken: refreshEntity.token, user };
};

export const refreshAccessToken = async (refreshToken: string) => {
  const { payload, db } = await verifyDbRefresh(refreshToken);
  // rotate: revoke old and create new
  await revokeRefreshToken(refreshToken);
  const repo = userRepo();
  const user = await repo.findOneBy({ id: (payload as any).userId });
  if (!user) throw new Error('User not found');
  const accessToken = generateAccessToken(user);
  const newRefresh = await createRefreshToken(user.id);
  return { accessToken, refreshToken: newRefresh.token };
};

export const logout = async (refreshToken: string) => {
  await revokeRefreshToken(refreshToken);
};

export const resetPasswordWithToken = async (token: string, newPassword: string) => {
  if (!token) throw new Error('Token is required');
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(newPassword)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(newPassword)) {
    throw new Error('Password must contain at least one number');
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const repo = userRepo();
  const user = await repo.findOneBy({ resetPasswordToken: hashedToken });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  const now = new Date();
  if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < now) {
    throw new Error('Reset token has expired');
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiresAt = undefined;
  user.isVerified = true;
  user.isActive = true;

  return repo.save(user);
};

export const generatePasswordResetToken = async (userId: number): Promise<string> => {
  const repo = userRepo();
  const user = await repo.findOneBy({ id: userId });
  if (!user) throw new Error('User not found');

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await repo.save(user);

  return rawToken;
};

import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createRefreshToken, revokeRefreshToken, verifyRefreshToken as verifyDbRefresh } from './token.service';

dotenv.config();

const userRepo = () => AppDataSource.getRepository(User);

export const registerUser = async (data: { 
  fullName: string; 
  email: string; 
  password: string;
  phone?: string;
  dateOfBirth: string;
  marriageDate?: string;
}) => {
  const repo = userRepo();
  const exists = await repo.findOneBy({ email: data.email });
  if (exists) throw new Error('User already exists');
  const hash = await bcrypt.hash(data.password, 10);
  const user = repo.create({ 
    fullName: data.fullName, 
    email: data.email, 
    password: hash,
    phone: data.phone,
    dateOfBirth: data.dateOfBirth,
    marriageDate: data.marriageDate,
  });
  return repo.save(user);
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
  try {
    const resetSecret = process.env.JWT_PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'secret';
    const payload = jwt.verify(token, resetSecret) as any;
    const repo = userRepo();
    const user = await repo.findOneBy({ id: payload.userId });
    if (!user) throw new Error('User not found');
    user.password = await bcrypt.hash(newPassword, 10);
    user.isVerified = true;
    user.isActive = true;
    return repo.save(user);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
};

export const generatePasswordResetToken = (userId: number): string => {
  const resetSecret = process.env.JWT_PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'secret';
  const expiresIn = (process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '24h') as SignOptions['expiresIn'];
  return jwt.sign({ userId }, resetSecret, { expiresIn });
};

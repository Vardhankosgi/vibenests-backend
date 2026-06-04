import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createRefreshToken, revokeRefreshToken, verifyRefreshToken as verifyDbRefresh } from './token.service';

dotenv.config();

const userRepo = () => AppDataSource.getRepository(User);

export const registerUser = async (data: { fullName: string; email: string; password: string }) => {
  const repo = userRepo();
  const exists = await repo.findOneBy({ email: data.email });
  if (exists) throw new Error('User already exists');
  const hash = await bcrypt.hash(data.password, 10);
  const user = repo.create({ fullName: data.fullName, email: data.email, password: hash });
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
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid credentials');

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
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    const repo = userRepo();
    const user = await repo.findOneBy({ id: payload.userId });
    if (!user) throw new Error('User not found');
    user.password = await bcrypt.hash(newPassword, 10);
    return repo.save(user);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
};

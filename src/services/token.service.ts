import { AppDataSource } from '../data-source';
import { RefreshToken } from '../entities/RefreshToken';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const repo = () => AppDataSource.getRepository(RefreshToken);

export const createRefreshToken = async (userId: number) => {
  const expiresIn = (process.env.REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  const secret: Secret = process.env.REFRESH_SECRET || process.env.JWT_SECRET || 'refresh_secret';
  const options: SignOptions = { expiresIn };
  const token = jwt.sign({ userId }, secret, options);
  const decoded = jwt.decode(token) as any;
  const exp = decoded?.exp ? new Date(decoded.exp * 1000) : undefined;

  const entity = repo().create({ token, user: { id: userId } as any, expiresAt: exp });
  return repo().save(entity);
};

export const verifyRefreshToken = async (token: string) => {
  const secret = process.env.REFRESH_SECRET || process.env.JWT_SECRET || 'refresh_secret';
  try {
    const payload = jwt.verify(token, secret) as any;
    const db = await repo().findOne({ where: { token }, relations: ['user'] });
    if (!db || db.revoked) throw new Error('Invalid refresh token');
    return { payload, db };
  } catch (err) {
    throw new Error('Invalid refresh token');
  }
};

export const revokeRefreshToken = async (token: string) => {
  const db = await repo().findOne({ where: { token } });
  if (!db) return;
  db.revoked = true;
  return repo().save(db);
};

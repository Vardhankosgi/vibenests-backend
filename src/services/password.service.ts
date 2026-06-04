import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';

dotenv.config();

export const createResetTokenForUser = async (email: string) => {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOneBy({ email });
  if (!user) throw new Error('User not found');
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
  return token;
};

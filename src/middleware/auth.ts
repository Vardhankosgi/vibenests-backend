import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface JwtPayload {
  userId: number;
  role: string;
  email: string;
}

export const authenticate = (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing authorization header' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Invalid authorization header' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;
    req.user = { id: payload.userId, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireRole = (role: string) => {
  return (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });
    if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
};

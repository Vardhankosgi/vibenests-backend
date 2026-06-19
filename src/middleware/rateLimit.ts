import { Request, Response, NextFunction } from 'express';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitInfo>();

export const rateLimiter = (windowMs: number, maxRequests: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const now = Date.now();

    let info = memoryStore.get(ip);
    if (!info || now > info.resetTime) {
      info = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    info.count++;
    memoryStore.set(ip, info);

    if (info.count > maxRequests) {
      return res.status(429).json({ message });
    }

    next();
  };
};

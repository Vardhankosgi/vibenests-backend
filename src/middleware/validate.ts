import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateBody = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err: any) {
    return res.status(400).json({ message: err.errors ?? err.message });
  }
};

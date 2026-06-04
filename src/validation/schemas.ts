import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).optional(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const bookingCreateSchema = z.object({
  suiteId: z.number().int().positive(),
  eventType: z.string().min(2).optional(),
  addOns: z.array(z.string()).optional(),
  date: z.string().min(8),
  timeSlot: z.string().min(1),
});

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
  suiteName: z.string().optional(),
  eventType: z.string().min(2).optional(),
  addOns: z.array(z.string()).optional(),
  date: z.string().min(8),
  timeSlot: z.string().min(1),
  endTimeSlot: z.string().optional(),
  persons: z.number().int().positive().optional(),
  basePrice: z.number().min(0).optional(),
  addonsTotal: z.number().min(0).optional(),
  savings: z.number().min(0).optional(),
  serviceFee: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  paymentMode: z.enum(['pay_now', 'pay_at_venue']).optional(),
  advanceAmount: z.number().min(0).optional(),
});

export const adminBookingSchema = z.object({
  suiteId: z.number().int().positive(),
  eventType: z.string().min(2),
  addOns: z.array(z.number()).optional(),
  date: z.string().min(8),
  timeSlot: z.string().min(1),
  endTimeSlot: z.string().optional(),
  guestFirstName: z.string().min(1),
  guestLastName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(6),
  totalAmount: z.number().min(0),
});

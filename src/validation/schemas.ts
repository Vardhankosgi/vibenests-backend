import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).optional(),
  password: z.string().min(6),
  dateOfBirth: z.string().min(8),
  marriageDate: z.string().optional().nullable(),
  referralCode: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const bookingCreateSchema = z.object({
  suiteId: z.number().int().nonnegative(),
  suiteName: z.string().optional(),
  eventType: z.string().min(2).optional(),
  addOns: z.array(z.string()).optional(),
  date: z.string().min(8),
  timeSlots: z.array(z.string()).min(1),
  persons: z.number().int().positive().optional(),
  basePrice: z.number().min(0).optional(),
  addonsTotal: z.number().min(0).optional(),
  savings: z.number().min(0).optional(),
  serviceFee: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  paymentMode: z.enum(['pay_now', 'pay_at_venue', 'package_credit', 'package_purchase']).optional(),
  advanceAmount: z.number().min(0).optional(),
});

export const celebrationPackageSchema = z.object({
  name: z.string().min(2),
  occasion: z.string().min(2),
  price: z.number().positive(),
  priceRangeMin: z.number().min(0).optional(),
  priceRangeMax: z.number().min(0).optional(),
  capacity: z.number().int().positive(),
  description: z.string().min(5),
  image: z.string().optional(),
  badge: z.enum(['Most Popular', 'Best for Couples', 'Great for Parties', 'Perfect Surprise']).optional(),
  amenities: z.array(z.string()).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
});

export const adminBookingSchema = z.object({
  suiteId: z.number().int().nonnegative(),
  eventType: z.string().min(2),
  addOns: z.array(z.number()).optional(),
  date: z.string().min(8),
  timeSlots: z.array(z.string()).min(1),
  guestFirstName: z.string().min(1),
  guestLastName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(6),
  persons: z.number().int().positive().optional(),
  totalAmount: z.number().min(0),
});


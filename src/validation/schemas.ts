import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  password: z.string().optional(),
  dateOfBirth: z.string().min(8, 'Date of birth is required'),
  marriageDate: z.string().optional().nullable(),
  referralCode: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const sendOtpSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
}).refine((data) => Boolean(data.phone || data.email), {
  message: 'Either phone number or email is required.',
});

export const verifyOtpSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  target: z.string().optional(),
  otp: z.string().length(4, 'OTP must be exactly 4 digits'),
}).refine((data) => Boolean(data.phone || data.email || data.target), {
  message: 'Either phone number, email, or target is required.',
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
  couponCode: z.string().optional(),
  specialOfferId: z.number().int().optional(),
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
  // Some admin flows send a single `timeSlot` (string). Others send `timeSlots` (array).
  // Accept either and normalize later.
  timeSlots: z.array(z.string()).min(1).optional(),
  timeSlot: z.string().optional(),
  guestFirstName: z.string().min(1),
  guestLastName: z.string().min(1),
  guestEmail: z.string().email().optional().or(z.literal('')),
  guestPhone: z.string().min(6),
  persons: z.number().int().positive().optional(),
  totalAmount: z.number().min(0),
  couponCode: z.string().optional(),
  specialOfferId: z.number().int().optional(),
  discountAmount: z.number().min(0).optional(),
}).refine((data) => {
  const slotsOk = Array.isArray(data.timeSlots) && data.timeSlots.length > 0;
  const slotOk = typeof data.timeSlot === 'string' && data.timeSlot.trim().length > 0;
  return slotsOk || slotOk;
}, { message: 'timeSlot/timeSlots is required' });


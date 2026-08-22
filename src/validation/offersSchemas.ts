import { z } from 'zod';

// ─── Offer ───────────────────────────────────────────────
export const offerCreateSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'flat']).default('percentage'),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minBookingAmount: z.number().positive().optional(),
  applicableTo: z.enum(['all', 'suite', 'addon', 'package']).default('suite'),
  applicableIds: z.array(z.string()).optional(),
  suiteId: z.union([z.number(), z.string().transform(Number)]).optional(),
  suiteName: z.string().optional(),
  assignedUserIds: z.array(z.union([z.number(), z.string().transform(Number)])).optional(),
  startDate: z.string(),
  endDate: z.string(),
  usageLimit: z.number().int().min(0).default(0),
  usageLimitPerUser: z.number().int().min(1).default(1),
  status: z.enum(['active', 'inactive', 'scheduled', 'expired']).default('active'),
  isFeatured: z.boolean().default(false),
});
export const offerUpdateSchema = offerCreateSchema.partial();

// ─── Coupon ───────────────────────────────────────────────
export const couponCreateSchema = z.object({
  code: z.string().min(3).max(50),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'flat']),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minBookingAmount: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  usageLimit: z.number().int().min(0).default(0),
  usageLimitPerUser: z.number().int().min(1).default(1),
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
  applicableSuiteIds: z.array(z.string()).optional(),
});
export const couponUpdateSchema = couponCreateSchema.partial();
export const couponValidateSchema = z.object({ code: z.string().min(1), bookingAmount: z.number().positive() });

// ─── RefundPolicy ─────────────────────────────────────────
const refundTierSchema = z.object({
  hoursBeforeBooking: z.number().min(0),
  refundType: z.enum(['percentage', 'flat', 'no_refund', 'full_refund']),
  refundValue: z.number().min(0),
  label: z.string().optional(),
});
export const refundPolicyCreateSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  tiers: z.array(refundTierSchema).min(1),
  allowPartialRefund: z.boolean().default(false),
  refundProcessingFee: z.boolean().default(false),
  processingFeePercent: z.number().min(0).max(100).default(0),
});
export const refundPolicyUpdateSchema = refundPolicyCreateSchema.partial();

// ─── AddOnRefundRule ──────────────────────────────────────
export const addOnRefundRuleSchema = z.object({
  addOnId: z.number().int().positive(),
  addOnName: z.string().min(1).max(100),
  refundType: z.enum(['percentage', 'flat', 'no_refund', 'full_refund']),
  refundValue: z.number().min(0),
  hoursBeforeBooking: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

// ─── TaxCharge ─────────────────────────────────────────────
export const taxChargeCreateSchema = z.object({
  name: z.string().min(2).max(100),
  taxCode: z.string().max(20).optional(),
  taxType: z.enum(['percentage', 'flat']),
  taxValue: z.number().positive(),
  applicableTo: z.enum(['all', 'suite', 'addon', 'package']).default('all'),
  applicableIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  isInclusive: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});
export const taxChargeUpdateSchema = taxChargeCreateSchema.partial();
export const taxCalculateSchema = z.object({ amount: z.number().positive() });

// ─── BookingRule ───────────────────────────────────────────
export const bookingRuleSchema = z.object({
  ruleKey: z.string().min(2).max(100),
  ruleValue: z.string(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  label: z.string().max(100).optional(),
  description: z.string().optional(),
  group: z.string().max(50).default('general'),
  isActive: z.boolean().default(true),
});

// ─── LiveCelebrationSetting ────────────────────────────────
export const liveCelebrationSettingSchema = z.object({
  settingKey: z.string().min(2).max(100),
  settingValue: z.string(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  label: z.string().max(100).optional(),
  description: z.string().optional(),
  group: z.string().max(50).default('general'),
  isActive: z.boolean().default(true),
});

// ─── OfferConfiguration ────────────────────────────────────
export const offerConfigSchema = z.object({
  configKey: z.string().min(2).max(100),
  configValue: z.string(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  label: z.string().max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

// ─── Refund Engine ─────────────────────────────────────────
export const refundInitiateSchema = z.object({
  bookingId: z.number().int().positive(),
  policyId: z.number().int().positive().optional(),
  reason: z.string().optional(),
});
export const refundProcessSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

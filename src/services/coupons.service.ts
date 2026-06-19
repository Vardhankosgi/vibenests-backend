import { CouponRepository } from '../repositories/coupon.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { Coupon, CouponStatus } from '../entities/Coupon';

const couponRepo = new CouponRepository();
const auditRepo = new AuditLogRepository();

export const createCoupon = async (data: Partial<Coupon>, userId: number, ip?: string) => {
  if (!data.code) throw new Error('Coupon code is required');
  data.code = data.code.toUpperCase().trim();
  const existing = await couponRepo.findByCode(data.code);
  if (existing) throw new Error('Coupon code already exists');
  const coupon = await couponRepo.create({ ...data, createdBy: userId });
  await auditRepo.log({ entityType: 'Coupon', entityId: coupon.id, action: 'CREATE', performedBy: userId, newData: coupon, ipAddress: ip });
  return coupon;
};

export const getCoupons = (params: { search?: string; status?: CouponStatus; page?: number; limit?: number }) =>
  couponRepo.search(params);

export const getCouponById = async (id: number) => {
  const coupon = await couponRepo.findById(id);
  if (!coupon) throw new Error('Coupon not found');
  return coupon;
};

export const updateCoupon = async (id: number, data: Partial<Coupon>, userId: number, ip?: string) => {
  const prev = await getCouponById(id);
  if (data.code) data.code = data.code.toUpperCase().trim();
  const updated = await couponRepo.update(id, data);
  await auditRepo.log({ entityType: 'Coupon', entityId: id, action: 'UPDATE', performedBy: userId, previousData: prev, newData: updated!, ipAddress: ip });
  return updated;
};

export const deleteCoupon = async (id: number, userId: number, ip?: string) => {
  await getCouponById(id);
  await couponRepo.softDelete(id);
  await auditRepo.log({ entityType: 'Coupon', entityId: id, action: 'DELETE', performedBy: userId, ipAddress: ip });
};

export const getActiveCoupons = async () => {
  const result = await couponRepo.search({ status: 'active', limit: 100 });
  const now = new Date();
  return result.data.filter((c) => !c.expiresAt || c.expiresAt > now);
};

export const validateCoupon = async (code: string, bookingAmount: number, userId: number) => {
  const coupon = await couponRepo.findByCode(code);
  if (!coupon) throw new Error('Invalid coupon code');
  if (coupon.status !== 'active') throw new Error('Coupon is not active');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new Error('Coupon has expired');
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw new Error('Coupon usage limit reached');
  if (coupon.assignedToUserId && coupon.assignedToUserId !== userId)
    throw new Error('This coupon is exclusive to another user.');
  if (coupon.minBookingAmount && bookingAmount < Number(coupon.minBookingAmount))
    throw new Error(`Minimum booking amount is ₹${coupon.minBookingAmount}`);

  let discount = coupon.discountType === 'percentage'
    ? (bookingAmount * Number(coupon.discountValue)) / 100
    : Number(coupon.discountValue);

  if (coupon.maxDiscountAmount && discount > Number(coupon.maxDiscountAmount))
    discount = Number(coupon.maxDiscountAmount);

  return { coupon, discountAmount: Math.min(discount, bookingAmount), finalAmount: bookingAmount - discount };
};

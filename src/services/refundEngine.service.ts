import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';
import { RefundCalculation } from '../entities/RefundCalculation';
import { RefundPolicy, RefundTier } from '../entities/RefundPolicy';
import { AddOnRefundRule } from '../entities/AddOnRefundRule';
import { TaxCharge } from '../entities/TaxCharge';
import { RefundCalculationRepository } from '../repositories/refundCalculation.repository';
import { RefundPolicyRepository } from '../repositories/refundPolicy.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';

const refundCalcRepo = new RefundCalculationRepository();
const policyRepo = new RefundPolicyRepository();
const auditRepo = new AuditLogRepository();

interface RefundBreakdown {
  originalAmount: number;
  hoursBeforeBooking: number;
  appliedTier: RefundTier | null;
  baseRefund: number;
  addOnRefund: number;
  taxRefund: number;
  processingFee: number;
  deductionAmount: number;
  refundableAmount: number;
  policyName: string;
}

export const calculateRefund = async (bookingId: number, policyId?: number): Promise<RefundBreakdown> => {
  const bookingRepo = AppDataSource.getRepository(Booking);
  const paymentRepo = AppDataSource.getRepository(Payment);

  const booking = await bookingRepo.findOne({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');

  const payment = await paymentRepo.findOne({ where: { bookingId, status: 'success' } });
  if (!payment) throw new Error('No successful payment found for booking');

  const policy = policyId
    ? await policyRepo.findById(policyId, ['addOnRules'])
    : await policyRepo.findDefault();
  if (!policy) throw new Error('No refund policy found');

  const bookingDate = new Date(`${booking.date}T${booking.timeSlot}`);
  const now = new Date();
  const hoursBeforeBooking = Math.max(0, (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60));

  const originalAmount = Number(payment.amount);

  // Find applicable tier (sorted desc by hours — most restrictive first)
  const sortedTiers = [...policy.tiers].sort((a, b) => b.hoursBeforeBooking - a.hoursBeforeBooking);
  const appliedTier = sortedTiers.find(t => hoursBeforeBooking >= t.hoursBeforeBooking) || null;

  let baseRefund = 0;
  if (appliedTier) {
    if (appliedTier.refundType === 'full_refund') baseRefund = originalAmount;
    else if (appliedTier.refundType === 'no_refund') baseRefund = 0;
    else if (appliedTier.refundType === 'percentage') baseRefund = (originalAmount * appliedTier.refundValue) / 100;
    else if (appliedTier.refundType === 'flat') baseRefund = appliedTier.refundValue;
  }

  // Add-on refunds
  let addOnRefund = 0;
  if (policy.addOnRules && booking.addOns?.length > 0) {
    for (const rule of policy.addOnRules) {
      if (!rule.isActive) continue;
      if (booking.addOns.includes(String(rule.addOnId))) {
        if (rule.hoursBeforeBooking === 0 || hoursBeforeBooking >= rule.hoursBeforeBooking) {
          if (rule.refundType === 'full_refund') addOnRefund += 100; // placeholder price
          else if (rule.refundType === 'flat') addOnRefund += Number(rule.refundValue);
          // For percentage, you'd need addon price — using 0 as safe default
        }
      }
    }
  }

  // Tax refund (proportional to base refund)
  const taxRepo = AppDataSource.getRepository(TaxCharge);
  const taxes = await taxRepo.find({ where: { isActive: true } });
  let taxRefund = 0;
  const taxRate = taxes.reduce((sum, t) => sum + (t.taxType === 'percentage' ? Number(t.taxValue) : 0), 0);
  if (baseRefund > 0) taxRefund = (baseRefund * taxRate) / 100;

  // Processing fee deduction
  let processingFee = 0;
  if (policy.refundProcessingFee && baseRefund > 0) {
    processingFee = (baseRefund * Number(policy.processingFeePercent)) / 100;
  }

  const refundableAmount = Math.max(0, baseRefund + addOnRefund + taxRefund - processingFee);
  const deductionAmount = originalAmount - refundableAmount;

  return {
    originalAmount,
    hoursBeforeBooking: Math.round(hoursBeforeBooking),
    appliedTier,
    baseRefund: Math.round(baseRefund * 100) / 100,
    addOnRefund: Math.round(addOnRefund * 100) / 100,
    taxRefund: Math.round(taxRefund * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    deductionAmount: Math.round(deductionAmount * 100) / 100,
    refundableAmount: Math.round(refundableAmount * 100) / 100,
    policyName: policy.name,
  };
};

export const initiateRefund = async (bookingId: number, requestedBy: number, policyId?: number, ip?: string) => {
  const breakdown = await calculateRefund(bookingId, policyId);

  const existing = await refundCalcRepo.findByBookingId(bookingId);
  if (existing && ['pending', 'approved'].includes(existing.status))
    throw new Error('A refund request is already in progress for this booking');

  const refund = await refundCalcRepo.create({
    bookingId,
    originalAmount: breakdown.originalAmount,
    refundableAmount: breakdown.refundableAmount,
    deductionAmount: breakdown.deductionAmount,
    processingFee: breakdown.processingFee,
    taxRefund: breakdown.taxRefund,
    addOnRefund: breakdown.addOnRefund,
    refundPolicyId: policyId,
    calculationBreakdown: breakdown as any,
    status: 'pending',
    requestedBy,
  });

  await auditRepo.log({ entityType: 'RefundCalculation', entityId: refund.id, action: 'CREATE', performedBy: requestedBy, newData: refund, ipAddress: ip });
  return refund;
};

export const processRefund = async (refundId: number, action: 'approve' | 'reject', adminId: number, reason?: string, ip?: string) => {
  const refund = await refundCalcRepo.findById(refundId, ['booking']);
  if (!refund) throw new Error('Refund not found');
  if (refund.status !== 'pending') throw new Error('Only pending refunds can be processed');

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const updated = await refundCalcRepo.update(refundId, {
    status: newStatus,
    processedBy: adminId,
    processedAt: new Date(),
    rejectionReason: reason,
  });

  if (action === 'approve') {
    await AppDataSource.getRepository(Booking).update(refund.bookingId, { status: 'refunded', paymentStatus: 'refunded' });
    await AppDataSource.getRepository(Payment).update({ bookingId: refund.bookingId }, { status: 'refunded' });
  }

  await auditRepo.log({
    entityType: 'RefundCalculation', entityId: refundId,
    action: action === 'approve' ? 'APPROVE' : 'REJECT',
    performedBy: adminId, note: reason, ipAddress: ip,
  });

  return updated;
};

export const getRefunds = (params: { status?: any; page?: number; limit?: number }) =>
  refundCalcRepo.search(params);

export const getRefundById = async (id: number) => {
  const refund = await refundCalcRepo.findById(id, ['booking']);
  if (!refund) throw new Error('Refund not found');
  return refund;
};

/**
 * refundEngine.service.ts
 * Automated Policy-Based Refund System for VibeNests
 *
 * Rules (server-side enforced):
 *   > 7 days before event  → 100% refund (gateway charge deducted)
 *   3 – 7 days             → 75% refund
 *   24 – 72 hours          → 50% refund
 *   < 24 hours             → 0% – auto-rejected
 */
import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';
import { User } from '../entities/User';
import { RefundCalculation, REFUND_POLICY_TIERS, GATEWAY_CHARGE_RATE } from '../entities/RefundCalculation';
import { OfferConfiguration } from '../entities/OfferConfiguration';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { sendEmail } from './notifications.service';
import { sendRefundStatusWhatsApp } from './whatsapp-notifications.service';

const auditRepo = new AuditLogRepository();

// ── Razorpay (optional – graceful fallback) ────────────────────────────────
let Razorpay: any;
try { Razorpay = require('razorpay'); } catch { /* not installed */ }

async function triggerGatewayRefund(
  refund: RefundCalculation,
  payment: Payment
): Promise<{ referenceId: string; gatewayResponse: any }> {
  if (!Razorpay || !process.env.RAZORPAY_KEY_ID) {
    return {
      referenceId: `MANUAL-${refund.id}-${Date.now()}`,
      gatewayResponse: { note: 'Gateway not configured – process manually' },
    };
  }
  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  const resp = await instance.payments.refund(payment.providerPaymentId, {
    amount: Math.round(Number(refund.refundableAmount) * 100),
    notes: { refundId: String(refund.id), bookingId: String(refund.bookingId) },
  });
  return { referenceId: resp.id, gatewayResponse: resp };
}

async function notifyRefundStatus(refund: RefundCalculation, event: string) {
  console.log(`[RefundEngine] Notify – refund #${refund.id} event: ${event}`);

  // 1. WhatsApp notification (best-effort)
  try {
    await sendRefundStatusWhatsApp(refund, event);
  } catch (err: any) {
    console.warn('[RefundEngine] WhatsApp notification failed:', err?.message ?? err);
  }

  // 2. Email notification (best-effort)
  const email = refund.customerEmail;
  if (!email) return;

  const name = refund.customerName || 'Guest';
  const amountStr = `₹${Number(refund.refundableAmount).toLocaleString('en-IN')}`;
  
  let subject = `Refund Request Update – #VN${refund.bookingId} | VibeNests`;
  let title = 'Refund Update';
  let messageHtml = '';
  let plainText = '';

  if (event === 'processing') {
    subject = `Refund Request Initiated – #VN${refund.bookingId} | VibeNests`;
    title = 'Refund Request Initiated';
    plainText = `Hi ${name}, your refund request of ${amountStr} for booking #VN${refund.bookingId} has been initiated and is under processing.`;
    messageHtml = `
      <p style="margin:0 0 14px">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 14px">Your refund request for booking <strong>#VN${refund.bookingId}</strong> has been initiated and is currently <strong>under processing</strong>.</p>
      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="margin:0 0 8px"><strong>Booking ID:</strong> #VN${refund.bookingId}</div>
        <div style="margin:0 0 8px"><strong>Refund Amount:</strong> ${amountStr}</div>
        <div style="margin:0 0 8px"><strong>Refund Tier:</strong> ${refund.policyTier || 'N/A'}</div>
        <div style="margin:0 0 8px"><strong>Status:</strong> Processing</div>
      </div>
      <p style="margin:0;color:#666;font-size:13px">We will notify you once the transaction completes and the funds are credited back to your account.</p>
    `;
  } else if (event === 'approved') {
    subject = `Refund Approved – #VN${refund.bookingId} | VibeNests`;
    title = 'Refund Request Approved';
    plainText = `Hi ${name}, your refund request for booking #VN${refund.bookingId} has been approved. Refund Amount: ${amountStr}.`;
    messageHtml = `
      <p style="margin:0 0 14px">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 14px">Your refund request for booking <strong>#VN${refund.bookingId}</strong> has been reviewed and **approved**.</p>
      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="margin:0 0 8px"><strong>Booking ID:</strong> #VN${refund.bookingId}</div>
        <div style="margin:0 0 8px"><strong>Refund Amount:</strong> ${amountStr}</div>
        <div style="margin:0 0 8px"><strong>Status:</strong> Approved</div>
      </div>
      <p style="margin:0;color:#666;font-size:13px">The payout is currently scheduled and will proceed shortly.</p>
    `;
  } else if (event === 'refunded') {
    subject = `Refund Completed – #VN${refund.bookingId} | VibeNests`;
    title = 'Refund Successfully Processed';
    plainText = `Hi ${name}, your refund of ${amountStr} for booking #VN${refund.bookingId} has been successfully processed. Ref: ${refund.referenceId || 'N/A'}.`;
    messageHtml = `
      <p style="margin:0 0 14px">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 14px">Great news! Your refund for booking <strong>#VN${refund.bookingId}</strong> has been successfully processed.</p>
      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="margin:0 0 8px"><strong>Booking ID:</strong> #VN${refund.bookingId}</div>
        <div style="margin:0 0 8px"><strong>Refunded Amount:</strong> ${amountStr}</div>
        <div style="margin:0 0 8px"><strong>Transaction Reference:</strong> <code>${refund.referenceId || 'N/A'}</code></div>
        <div style="margin:0 0 8px"><strong>Status:</strong> Refunded</div>
      </div>
      <p style="margin:0;color:#666;font-size:13px">It may take 5–7 business days for the funds to reflect in your original payment method.</p>
    `;
  } else if (event === 'rejected') {
    subject = `Refund Request Rejected – #VN${refund.bookingId} | VibeNests`;
    title = 'Refund Request Rejected';
    plainText = `Hi ${name}, your refund request for booking #VN${refund.bookingId} was not eligible. Reason: ${refund.rejectionReason || 'Cancellation policy limits.'}`;
    messageHtml = `
      <p style="margin:0 0 14px">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 14px">Your refund request for booking <strong>#VN${refund.bookingId}</strong> was not eligible under VibeNests cancellation policy.</p>
      <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="margin:0 0 8px"><strong>Booking ID:</strong> #VN${refund.bookingId}</div>
        <div style="margin:0 0 8px"><strong>Status:</strong> Not Eligible / Rejected</div>
        <div style="margin:0 0 8px;color:#c53030;"><strong>Reason:</strong> ${refund.rejectionReason || 'Cancellation policy time window limits.'}</div>
      </div>
      <p style="margin:0;color:#666;font-size:13px">If you have any questions, please feel free to reach out to our support team.</p>
    `;
  } else {
    subject = `Refund Status Update – #VN${refund.bookingId}`;
    title = 'Refund Status Update';
    plainText = `Hi ${name}, your refund request status for booking #VN${refund.bookingId} is now ${event}.`;
    messageHtml = `
      <p style="margin:0 0 14px">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 14px">Your refund request status for booking <strong>#VN${refund.bookingId}</strong> has been updated to <strong>${event}</strong>.</p>
    `;
  }

  const footerYear = new Date().getFullYear();
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
      <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
      <div>
        <div style="font-size:16px;font-weight:700;line-height:1">${title}</div>
        <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
      </div>
    </div>
    <div style="padding:18px 20px">
      ${messageHtml}
    </div>
    <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
      © ${footerYear} VibeNests. All rights reserved.
    </div>
  </div>`;

  try {
    await sendEmail(email, subject, plainText, html);
  } catch (err: any) {
    console.warn('[RefundEngine] Email notification failed:', err?.message ?? err);
  }
}

// ── Policy engine ──────────────────────────────────────────────────────────────
function computePolicyTier(hoursBeforeEvent: number, pcts: { tier100: number; tier75: number; tier50: number }) {
  const REF_TIERS = [
    {
      label: 'Full Refund (minus gateway charges)',
      minHours: 168,   // 7 days
      maxHours: Infinity,
      percentage: pcts.tier100,
      gatewayDeduction: true,
    },
    {
      label: `${pcts.tier75}% Refund`,
      minHours: 72,    // 3 days
      maxHours: 168,
      percentage: pcts.tier75,
      gatewayDeduction: false,
    },
    {
      label: `${pcts.tier50}% Refund`,
      minHours: 24,
      maxHours: 72,
      percentage: pcts.tier50,
      gatewayDeduction: false,
    },
    {
      label: 'Not Eligible – No Refund',
      minHours: 0,
      maxHours: 24,
      percentage: 0,
      gatewayDeduction: false,
    },
  ];

  for (const tier of REF_TIERS) {
    if (hoursBeforeEvent >= tier.minHours) {
      return tier;
    }
  }
  return REF_TIERS[REF_TIERS.length - 1];
}

export async function getRefundPolicyPercentages(): Promise<{ tier100: number; tier75: number; tier50: number }> {
  try {
    const configRepo = AppDataSource.getRepository(OfferConfiguration);
    const keys = ['refund_pct_tier_100', 'refund_pct_tier_75', 'refund_pct_tier_50'];
    const defaults: Record<string, string> = {
      'refund_pct_tier_100': '100',
      'refund_pct_tier_75': '75',
      'refund_pct_tier_50': '50',
    };
    const labels: Record<string, string> = {
      'refund_pct_tier_100': 'Refund % (> 7 days)',
      'refund_pct_tier_75': 'Refund % (3–7 days)',
      'refund_pct_tier_50': 'Refund % (24–72 hours)',
    };

    const configs = await configRepo.find();

    // Seed defaults if missing
    for (const key of keys) {
      const found = configs.find(c => c.configKey === key);
      if (!found) {
        const newConf = configRepo.create({
          configKey: key,
          configValue: defaults[key],
          valueType: 'number',
          label: labels[key],
          description: `Automatically applied refund percentage for VibeNests policy.`,
          isActive: true
        });
        await configRepo.save(newConf);
        configs.push(newConf);
      }
    }

    let tier100 = 100;
    let tier75 = 75;
    let tier50 = 50;

    for (const c of configs) {
      if (c.configKey === 'refund_pct_tier_100') tier100 = isNaN(Number(c.configValue)) ? 100 : Number(c.configValue);
      if (c.configKey === 'refund_pct_tier_75') tier75 = isNaN(Number(c.configValue)) ? 75 : Number(c.configValue);
      if (c.configKey === 'refund_pct_tier_50') tier50 = isNaN(Number(c.configValue)) ? 50 : Number(c.configValue);
    }

    return { tier100, tier75, tier50 };
  } catch (err) {
    console.error('[RefundEngine] Error fetching/seeding refund percentages:', err);
    return { tier100: 100, tier75: 75, tier50: 50 };
  }
}

function parseEventDateTime(dateStr: string, timeSlotStr: string): Date {
  const dateClean = (dateStr || '').trim();
  const timeClean = (timeSlotStr || '00:00').trim();

  // Extract first part of time if it's a range (e.g. "03:00 PM - 06:00 PM" or "18:00-22:00")
  const startPart = timeClean.split('-')[0].trim();

  // Parse 12-hour format (e.g. "03:00 PM" or "3:00 PM" or "03:00PM")
  const match12 = startPart.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = parseInt(match12[2]);
    const isPm = match12[3].toUpperCase() === 'PM';
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;

    const [yr, mo, dy] = dateClean.split('-').map(Number);
    return new Date(yr, mo - 1, dy, hours, minutes, 0, 0);
  }

  // Parse 24-hour format (e.g. "15:00" or "15:00:00")
  const match24 = startPart.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (match24) {
    const hours = parseInt(match24[1]);
    const minutes = parseInt(match24[2]);
    const [yr, mo, dy] = dateClean.split('-').map(Number);
    return new Date(yr, mo - 1, dy, hours, minutes, 0, 0);
  }

  // Fallback: Parse date component at midnight local time
  const [yr, mo, dy] = dateClean.split('-').map(Number);
  if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
    return new Date(yr, mo - 1, dy, 0, 0, 0, 0);
  }

  return new Date(`${dateClean}T00:00:00`);
}

// ── Calculate (preview — no DB write) ─────────────────────────────────────────
export const calculateRefund = async (bookingId: number) => {
  const bookingRepo = AppDataSource.getRepository(Booking);
  const paymentRepo = AppDataSource.getRepository(Payment);

  const booking = await bookingRepo.findOne({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');

  if (booking.paymentMode === 'package_credit') {
    return {
      bookingId,
      percentage: 0,
      tier: 'Package Booking – Not Eligible for Refund',
      isEligible: false,
      hoursBeforeEvent: 0,
      gatewayChargeAmount: 0,
      estimatedRefundAmount: 0,
      originalAmount: 0,
    };
  }

  const payment = await paymentRepo.findOne({
    where: { bookingId, status: 'success' },
    order: { createdAt: 'DESC' },
  });
  if (!payment) throw new Error('No successful payment found for this booking');

  const pcts = await getRefundPolicyPercentages();
  const eventDate = parseEventDateTime(booking.date, booking.timeSlot);
  const now = new Date();
  const hoursBeforeEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const tier = computePolicyTier(hoursBeforeEvent, pcts);

  const originalAmount = Number(payment.amount);
  const grossRefund = Math.round((originalAmount * tier.percentage) / 100 * 100) / 100;
  const gatewayChargeAmount = tier.gatewayDeduction
    ? Math.round(grossRefund * GATEWAY_CHARGE_RATE / 100 * 100) / 100
    : 0;
  const estimatedRefundAmount = Math.max(0, Math.round((grossRefund - gatewayChargeAmount) * 100) / 100);

  return {
    bookingId,
    percentage: tier.percentage,
    tier: tier.label,
    isEligible: tier.percentage > 0,
    hoursBeforeEvent: Math.round(hoursBeforeEvent * 10) / 10,
    gatewayChargeAmount,
    estimatedRefundAmount,
    originalAmount,
  };
};

// ── Initiate refund (automated) ────────────────────────────────────────────────
export const initiateRefund = async (
  bookingId: number,
  userId: number,
  refundReason?: string,
  customerMessage?: string,
  attachments?: string[],
  ip?: string
) => {
  const bookingRepo = AppDataSource.getRepository(Booking);
  const paymentRepo = AppDataSource.getRepository(Payment);
  const userRepo = AppDataSource.getRepository(User);
  const refundRepo = AppDataSource.getRepository(RefundCalculation);

  // Load booking
  const booking = await bookingRepo.findOne({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');
  if (booking.userId !== userId) throw new Error('You do not have permission to request a refund for this booking');

  // Check for duplicate
  const existing = await refundRepo.findOne({
    where: { bookingId },
    order: { createdAt: 'DESC' },
  });
  if (existing && ['pending', 'approved', 'processing'].includes(existing.status)) {
    throw new Error('A refund request is already in progress for this booking');
  }

  // Get user
  const user = await userRepo.findOne({ where: { id: userId } });

  if (booking.paymentMode === 'package_credit') {
    const refund = refundRepo.create({
      bookingId,
      userId,
      customerName: user ? `${user.fullName || ''}`.trim() || undefined : undefined,
      customerEmail: user?.email,
      customerPhone: user?.phone,
      paymentMethod: 'package_credit',
      originalAmount: 0,
      refundableAmount: 0,
      deductionAmount: 0,
      gatewayChargeAmount: 0,
      processingFee: 0,
      taxRefund: 0,
      addOnRefund: 0,
      policyTier: 'Package Booking – Not Eligible for Refund',
      selectedPercentage: 0,
      hoursBeforeEvent: 0,
      autoProcessed: true,
      autoProcessedAt: new Date(),
      status: 'rejected',
      refundReason: refundReason || undefined,
      customerMessage: customerMessage || undefined,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      requestedBy: userId,
      rejectionReason: 'Bookings made using package credits are not eligible for monetary refunds.',
      rejectedAt: new Date(),
      calculationBreakdown: {
        tier: 'Package Booking – Not Eligible for Refund',
        percentage: 0,
        originalAmount: 0,
        refundableAmount: 0,
      },
    });
    const saved = await refundRepo.save(refund);
    await auditRepo.log({
      entityType: 'RefundCalculation',
      entityId: saved.id,
      action: 'AUTO_REJECT',
      performedBy: userId,
      performedByRole: 'customer',
      newData: saved as any,
      note: `Package credit booking (Not Eligible)`,
      ipAddress: ip,
    });
    await notifyRefundStatus(saved, 'rejected');
    return saved;
  }

  // Get payment
  const payment = await paymentRepo.findOne({
    where: { bookingId, status: 'success' },
    order: { createdAt: 'DESC' },
  });
  if (!payment) {
    throw new Error('No successful payment found for this booking.');
  }

  // Compute policy
  const pcts = await getRefundPolicyPercentages();
  const eventDate = parseEventDateTime(booking.date, booking.timeSlot);
  const now = new Date();
  const hoursBeforeEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const tier = computePolicyTier(hoursBeforeEvent, pcts);

  const originalAmount = Number(payment.amount);
  const grossRefund = Math.round((originalAmount * tier.percentage) / 100 * 100) / 100;
  const gatewayChargeAmount = tier.gatewayDeduction
    ? Math.round(grossRefund * GATEWAY_CHARGE_RATE / 100 * 100) / 100
    : 0;
  const refundableAmount = Math.max(0, Math.round((grossRefund - gatewayChargeAmount) * 100) / 100);
  const deductionAmount = Math.round((originalAmount - refundableAmount) * 100) / 100;
  const isEligible = tier.percentage > 0;

  // Create refund record
  const refund = refundRepo.create({
    bookingId,
    userId,
    customerName: user ? `${user.fullName || ''}`.trim() || undefined : undefined,
    customerEmail: user?.email,
    customerPhone: user?.phone,
    paymentMethod: payment.method,
    originalAmount,
    refundableAmount,
    deductionAmount,
    gatewayChargeAmount,
    processingFee: 0,
    taxRefund: 0,
    addOnRefund: 0,
    policyTier: tier.label,
    selectedPercentage: tier.percentage,
    hoursBeforeEvent: Math.round(hoursBeforeEvent * 10) / 10,
    autoProcessed: true,
    autoProcessedAt: new Date(),
    status: isEligible ? 'processing' : 'rejected',
    refundReason: refundReason || undefined,
    customerMessage: customerMessage || undefined,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
    requestedBy: userId,
    rejectionReason: isEligible
      ? undefined
      : 'The refund request was submitted less than 24 hours before the event and does not meet the VibeNests refund eligibility policy.',
    approvedAt: isEligible ? new Date() : undefined,
    rejectedAt: isEligible ? undefined : new Date(),
    calculationBreakdown: {
      hoursBeforeEvent,
      tier: tier.label,
      percentage: tier.percentage,
      originalAmount,
      grossRefund,
      gatewayChargeAmount,
      refundableAmount,
    },
  });

  const saved = await refundRepo.save(refund);

  // Audit log
  await auditRepo.log({
    entityType: 'RefundCalculation',
    entityId: saved.id,
    action: isEligible ? 'AUTO_APPROVE' : 'AUTO_REJECT',
    performedBy: userId,
    performedByRole: 'customer',
    newData: saved as any,
    note: `Policy: ${tier.label} | ${tier.percentage}%`,
    ipAddress: ip,
  });

  // Cancel booking for eligible refunds
  if (isEligible) {
    await bookingRepo.update(bookingId, { status: 'cancelled', paymentStatus: 'refunded' });
    await paymentRepo.update({ bookingId }, { status: 'refunded' });
  }

  // Notify
  await notifyRefundStatus(saved, isEligible ? 'processing' : 'rejected');

  return saved;
};

// ── Admin manual workflow (exceptional overrides) ──────────────────────────────
export const updateStatusToReview = async (refundId: number, adminId: number, ip?: string) => {
  const refundRepo = AppDataSource.getRepository(RefundCalculation);
  const refund = await refundRepo.findOne({ where: { id: refundId } });
  if (!refund) throw new Error('Refund request not found');
  if (refund.status !== 'pending') throw new Error('Only pending requests can be moved to under review');

  const previousData = { ...refund };
  refund.status = 'under_review';
  refund.underReviewAt = new Date();
  refund.adminId = adminId;
  refund.processedBy = adminId;
  refund.processedAt = new Date();
  const updated = await refundRepo.save(refund);
  await auditRepo.log({ entityType: 'RefundCalculation', entityId: refundId, action: 'UPDATE', performedBy: adminId, performedByRole: 'admin', previousData, newData: updated as any, note: 'Moved to Under Review (manual)', ipAddress: ip });
  return updated;
};

export const approveRefund = async (refundId: number, adminId: number, selectedPercentage: number, adminNotes?: string, ip?: string) => {
  const refundRepo = AppDataSource.getRepository(RefundCalculation);
  const refund = await refundRepo.findOne({ where: { id: refundId } });
  if (!refund) throw new Error('Refund request not found');
  if (!['pending', 'under_review'].includes(refund.status)) throw new Error('Cannot approve from current status');
  if (selectedPercentage < 0 || selectedPercentage > 100) throw new Error('Percentage must be 0–100');

  const previousData = { ...refund };
  const originalAmount = Number(refund.originalAmount);
  refund.selectedPercentage = selectedPercentage;
  refund.refundableAmount = Math.round((originalAmount * selectedPercentage) / 100 * 100) / 100;
  refund.deductionAmount = Math.round((originalAmount - refund.refundableAmount) * 100) / 100;
  refund.status = 'approved';
  refund.adminId = adminId;
  refund.adminNotes = adminNotes;
  refund.approvedAt = new Date();
  refund.processedBy = adminId;
  refund.processedAt = new Date();

  const updated = await refundRepo.save(refund);
  await AppDataSource.getRepository(Booking).update(refund.bookingId, { status: 'cancelled', paymentStatus: 'refunded' });
  await AppDataSource.getRepository(Payment).update({ bookingId: refund.bookingId }, { status: 'refunded' });
  await auditRepo.log({ entityType: 'RefundCalculation', entityId: refundId, action: 'APPROVE', performedBy: adminId, performedByRole: 'admin', previousData, newData: updated as any, note: `Approved at ${selectedPercentage}%`, ipAddress: ip });
  await notifyRefundStatus(updated, 'approved');
  return updated;
};

export const rejectRefund = async (refundId: number, adminId: number, rejectionReason: string, ip?: string) => {
  if (!rejectionReason?.trim()) throw new Error('Rejection reason is mandatory');
  const refundRepo = AppDataSource.getRepository(RefundCalculation);
  const refund = await refundRepo.findOne({ where: { id: refundId } });
  if (!refund) throw new Error('Refund request not found');
  if (!['pending', 'under_review'].includes(refund.status)) throw new Error('Cannot reject from current status');

  const previousData = { ...refund };
  refund.status = 'rejected';
  refund.rejectionReason = rejectionReason;
  refund.adminId = adminId;
  refund.rejectedAt = new Date();
  refund.processedBy = adminId;
  refund.processedAt = new Date();

  const updated = await refundRepo.save(refund);
  await auditRepo.log({ entityType: 'RefundCalculation', entityId: refundId, action: 'REJECT', performedBy: adminId, performedByRole: 'admin', previousData, newData: updated as any, note: rejectionReason, ipAddress: ip });
  await notifyRefundStatus(updated, 'rejected');
  return updated;
};

export const moveToProcessing = async (refundId: number, adminId: number, ip?: string) => {
  const refundRepo = AppDataSource.getRepository(RefundCalculation);
  const refund = await refundRepo.findOne({ where: { id: refundId } });
  if (!refund) throw new Error('Refund request not found');
  if (refund.status !== 'approved') throw new Error('Only approved requests can be moved to processing');

  const previousData = { ...refund };
  refund.status = 'processing';
  refund.adminId = adminId;
  const updated = await refundRepo.save(refund);
  await auditRepo.log({ entityType: 'RefundCalculation', entityId: refundId, action: 'UPDATE', performedBy: adminId, performedByRole: 'admin', previousData, newData: updated as any, note: 'Progressed to Processing', ipAddress: ip });
  return updated;
};

export const completeRefund = async (refundId: number, adminId: number, referenceId: string, gatewayResponse?: any, ip?: string) => {
  if (!referenceId?.trim()) throw new Error('Reference/Transaction ID is required');
  const refundRepo = AppDataSource.getRepository(RefundCalculation);
  const refund = await refundRepo.findOne({ where: { id: refundId } });
  if (!refund) throw new Error('Refund request not found');
  if (refund.status !== 'processing') throw new Error('Refund must be in processing status');

  const previousData = { ...refund };
  refund.status = 'refunded';
  refund.referenceId = referenceId;
  refund.paymentGatewayResponse = gatewayResponse || null;
  refund.adminId = adminId;
  refund.completedAt = new Date();

  const updated = await refundRepo.save(refund);
  await auditRepo.log({ entityType: 'RefundCalculation', entityId: refundId, action: 'UPDATE', performedBy: adminId, performedByRole: 'admin', previousData, newData: updated as any, note: `Completed. Ref: ${referenceId}`, ipAddress: ip });
  await notifyRefundStatus(updated, 'refunded');
  return updated;
};

// ── Query helpers ──────────────────────────────────────────────────────────────
export const getRefunds = async (params: {
  status?: string;
  searchKeyword?: string;
  userId?: number;
  page?: number;
  limit?: number;
}) => {
  const refundRepo = AppDataSource.getRepository(RefundCalculation);
  const qb = refundRepo.createQueryBuilder('rc').leftJoinAndSelect('rc.booking', 'booking');

  if (params.status && params.status !== 'all') {
    qb.andWhere('rc.status = :status', { status: params.status });
  }
  if (params.userId) {
    qb.andWhere('rc.userId = :userId', { userId: params.userId });
  }
  if (params.searchKeyword?.trim()) {
    const k = `%${params.searchKeyword.trim()}%`;
    qb.andWhere(
      '(CAST(rc.id AS VARCHAR) LIKE :k OR CAST(rc.bookingId AS VARCHAR) LIKE :k OR rc.customerName ILIKE :k OR rc.customerEmail ILIKE :k)',
      { k }
    );
  }

  const page = params.page || 1;
  const limit = params.limit || 20;
  qb.orderBy('rc.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

  const [data, total] = await qb.getManyAndCount();
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getRefundById = async (id: number) => {
  const refundRepo = AppDataSource.getRepository(RefundCalculation);
  const refund = await refundRepo.findOne({ where: { id }, relations: ['booking'] });
  if (!refund) throw new Error('Refund not found');
  return refund;
};

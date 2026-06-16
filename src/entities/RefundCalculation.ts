import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Booking } from './Booking';

// ── Policy constants (single source of truth, shared with frontend) ────────────
export const GATEWAY_CHARGE_RATE = 2; // percent

export const REFUND_POLICY_TIERS = [
  {
    label: 'Full Refund (minus gateway charges)',
    minHours: 168,   // 7 days
    maxHours: Infinity,
    percentage: 100,
    gatewayDeduction: true,
  },
  {
    label: '75% Refund',
    minHours: 72,    // 3 days
    maxHours: 168,
    percentage: 75,
    gatewayDeduction: false,
  },
  {
    label: '50% Refund',
    minHours: 24,
    maxHours: 72,
    percentage: 50,
    gatewayDeduction: false,
  },
  {
    label: 'Not Eligible – No Refund',
    minHours: 0,
    maxHours: 24,
    percentage: 0,
    gatewayDeduction: false,
  },
] as const;

export type RefundStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'processing'
  | 'refunded'
  | 'rejected'
  | 'cancelled';

@Entity('refund_calculations')
export class RefundCalculation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column({ nullable: true })
  bookingId!: number;

  // ── Customer snapshot ──────────────────────────────────────────────────────
  @Column({ nullable: true })
  userId?: number;

  @Column({ length: 255, nullable: true })
  customerName?: string;

  @Column({ length: 255, nullable: true })
  customerEmail?: string;

  @Column({ length: 30, nullable: true })
  customerPhone?: string;

  @Column({ length: 100, nullable: true })
  paymentMethod?: string;

  // ── Amounts ────────────────────────────────────────────────────────────────
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  originalAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  refundableAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  deductionAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  gatewayChargeAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  processingFee!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  taxRefund!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  addOnRefund!: number;

  // ── Policy snapshot ────────────────────────────────────────────────────────
  @Column({ nullable: true })
  refundPolicyId?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  policyTier?: string;

  @Column({ type: 'int', nullable: true })
  selectedPercentage?: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  hoursBeforeEvent?: number;

  @Column('jsonb', { nullable: true })
  calculationBreakdown?: object;

  // ── Auto-processing ────────────────────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  autoProcessed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  autoProcessedAt?: Date;

  // ── Status ─────────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: RefundStatus;

  // ── User inputs (optional) ─────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 100, nullable: true })
  refundReason?: string;

  @Column('text', { nullable: true })
  customerMessage?: string;

  @Column('text', { nullable: true })
  cancellationReason?: string;

  @Column('simple-array', { nullable: true })
  attachments?: string[];

  // ── Admin actions ──────────────────────────────────────────────────────────
  @Column({ nullable: true })
  adminId?: number;

  @Column('text', { nullable: true })
  adminNotes?: string;

  @Column('text', { nullable: true })
  rejectionReason?: string;

  // ── References ─────────────────────────────────────────────────────────────
  @Column({ length: 255, nullable: true })
  referenceId?: string;

  @Column('jsonb', { nullable: true })
  paymentGatewayResponse?: object;

  // ── Workflow actors ────────────────────────────────────────────────────────
  @Column({ nullable: true })
  requestedBy?: number;

  @Column({ nullable: true })
  processedBy?: number;

  // ── Timestamps ────────────────────────────────────────────────────────────
  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  underReviewAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

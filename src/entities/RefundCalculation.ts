import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Booking } from './Booking';

export type RefundStatus = 'pending' | 'approved' | 'processed' | 'rejected' | 'cancelled';

@Entity('refund_calculations')
export class RefundCalculation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column()
  bookingId!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  originalAmount!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  refundableAmount!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  deductionAmount!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  processingFee!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxRefund!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  addOnRefund!: number;

  @Column({ nullable: true })
  refundPolicyId?: number;

  @Column('jsonb', { nullable: true })
  calculationBreakdown?: object;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: RefundStatus;

  @Column('text', { nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  requestedBy?: number;

  @Column({ nullable: true })
  processedBy?: number;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

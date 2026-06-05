import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany
} from 'typeorm';
import { AddOnRefundRule } from './AddOnRefundRule';

export type RefundBasis = 'hours_before' | 'days_before';
export type RefundType = 'percentage' | 'flat' | 'no_refund' | 'full_refund';

@Entity('refund_policies')
export class RefundPolicy {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ default: true })
  isDefault!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  // JSON array: [{ hoursBeforeBooking: 48, refundType: 'percentage', refundValue: 100 }, ...]
  @Column('jsonb', { default: '[]' })
  tiers!: RefundTier[];

  @Column({ default: false })
  allowPartialRefund!: boolean;

  @Column({ default: false })
  refundProcessingFee!: boolean;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  processingFeePercent!: number;

  @Column({ nullable: true })
  createdBy?: number;

  @OneToMany(() => AddOnRefundRule, (r) => r.refundPolicy)
  addOnRules?: AddOnRefundRule[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

export interface RefundTier {
  hoursBeforeBooking: number;
  refundType: RefundType;
  refundValue: number;
  label?: string;
}

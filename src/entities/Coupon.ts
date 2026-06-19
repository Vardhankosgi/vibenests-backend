import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn
} from 'typeorm';

export type CouponStatus = 'active' | 'inactive' | 'expired';
export type CouponDiscountType = 'percentage' | 'flat';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20 })
  discountType!: CouponDiscountType;

  @Column('decimal', { precision: 10, scale: 2 })
  discountValue!: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  maxDiscountAmount?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  minBookingAmount?: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ default: 0 })
  usageLimit!: number;

  @Column({ default: 0 })
  usedCount!: number;

  @Column({ default: 1 })
  usageLimitPerUser!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: CouponStatus;

  @Column('simple-array', { nullable: true })
  applicableSuiteIds?: string[];

  @Column({ nullable: true })
  createdBy?: number;

  @Column({ nullable: true })
  assignedToUserId?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

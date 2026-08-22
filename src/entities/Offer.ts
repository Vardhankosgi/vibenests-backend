import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  OneToMany
} from 'typeorm';
import { OfferAssignment } from './OfferAssignment';

export type DiscountType = 'percentage' | 'flat';
export type OfferStatus = 'active' | 'inactive' | 'scheduled' | 'expired';
export type OfferApplicability = 'all' | 'suite' | 'addon' | 'package';

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  title!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20 })
  discountType!: DiscountType;

  @Column('decimal', { precision: 10, scale: 2 })
  discountValue!: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  maxDiscountAmount?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  minBookingAmount?: number;

  @Column({ type: 'varchar', length: 20, default: 'all' })
  applicableTo!: OfferApplicability;

  @Column('simple-array', { nullable: true })
  applicableIds?: string[];

  @Column({ nullable: true })
  suiteId?: number;

  @Column({ nullable: true })
  suiteName?: string;

  @OneToMany(() => OfferAssignment, (assignment) => assignment.offer, { cascade: true })
  assignments?: OfferAssignment[];

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @Column({ default: 0 })
  usageLimit!: number;

  @Column({ default: 0 })
  usedCount!: number;

  @Column({ default: 1 })
  usageLimitPerUser!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: OfferStatus;

  @Column({ default: false })
  isFeatured!: boolean;

  @Column({ nullable: true })
  createdBy?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}


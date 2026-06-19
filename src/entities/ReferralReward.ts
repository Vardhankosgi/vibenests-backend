import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ReferralRelationship } from './ReferralRelationship';
import { User } from './User';
import { Coupon } from './Coupon';

@Entity('referral_rewards')
export class ReferralReward {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ReferralRelationship, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referralId' })
  referral!: ReferralRelationship;

  @Column()
  referralId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipientId' })
  recipient!: User;

  @Column()
  recipientId!: number;

  @Column({ default: 'discount_coupon' })
  rewardType!: 'discount_coupon';

  @Column('decimal', { precision: 10, scale: 2 })
  rewardValue!: number;

  @ManyToOne(() => Coupon, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'couponId' })
  coupon?: Coupon | null;

  @Column({ nullable: true })
  couponId?: number | null;

  @Column({ default: 'issued' })
  status!: 'pending' | 'issued' | 'redeemed' | 'revoked';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

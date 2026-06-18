import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ReferralRelationship } from './ReferralRelationship';

@Entity('referral_transactions')
export class ReferralTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ReferralRelationship, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referralId' })
  referral!: ReferralRelationship;

  @Column()
  referralId!: number;

  @Column()
  type!: 'registration' | 'qualifying_booking' | 'reward_issued' | 'reward_redeemed' | 'reward_revoked';

  @Column('text')
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('referral_relationships')
export class ReferralRelationship {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrerId' })
  referrer!: User;

  @Column()
  referrerId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refereeId' })
  referee!: User;

  @Column({ unique: true })
  refereeId!: number;

  @Column()
  referralCode!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'successful' | 'expired' | 'revoked';

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;
}

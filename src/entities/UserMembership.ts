import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';
import { MembershipPlan } from './MembershipPlan';

@Entity('user_memberships')
export class UserMembership {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: number;

  @ManyToOne(() => MembershipPlan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'planId' })
  plan?: MembershipPlan;

  @Column({ nullable: true })
  planId?: number;

  @Column({ length: 50 })
  planName!: string;

  @Column('int', { default: 10 })
  maxFreeBookings!: number;

  @Column('int', { default: 0 })
  bookingsUsed!: number;

  @Column('simple-array', { nullable: true })
  eligibleSuites?: string[];

  @Column({ type: 'timestamptz' })
  activationDate!: Date;

  @Column({ type: 'timestamptz' })
  expiryDate!: Date;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'expired' | 'inactive';

  @Column({ nullable: true })
  paymentId?: string;

  @Column({ default: 'success' })
  paymentStatus!: 'pending' | 'success' | 'failed';

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amountPaid!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

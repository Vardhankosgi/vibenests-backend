import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  orderId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ nullable: true })
  userId?: number;

  @Column()
  suiteId!: number;

  @Column({ nullable: true })
  suiteName?: string;

  @Column()
  eventType!: string;

  @Column('simple-array', { default: '' })
  addOns!: string[];

  @Column()
  date!: string;

  @Column()
  timeSlot!: string;

  @Column({ nullable: true })
  endTimeSlot?: string;

  @Column({ nullable: true })
  guestFirstName?: string;

  @Column({ nullable: true })
  guestLastName?: string;

  @Column({ nullable: true })
  guestEmail?: string;

  @Column({ nullable: true })
  guestPhone?: string;

  @Column({ type: 'int', default: 1 })
  persons!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  basePrice!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  addonsTotal!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  savings!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  serviceFee!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxes!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ default: 'pay_now' })
  paymentMode!: 'pay_now' | 'pay_at_venue' | 'package_credit' | 'package_purchase';

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  advanceAmount!: number;

  @Column({ default: 'pending' })
  status!: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';

  @Column({ default: 'pending' })
  paymentStatus!: 'pending' | 'success' | 'failed' | 'refunded';

  @Column({ default: false })
  fullPaymentReceived!: boolean;

  @Column({ type: 'jsonb', nullable: true, default: null })
  address!: Record<string, any> | null;

  @Column({ nullable: true })
  cancellationReason?: string;

  @Column({ nullable: true })
  couponCode?: string;

  @Column({ type: 'int', default: 0 })
  rescheduleCount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}


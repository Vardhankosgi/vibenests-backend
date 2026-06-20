import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Booking } from './Booking';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column()
  bookingId!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount!: number;

  @Column()
  method!: string;

  @Column({ default: 'razorpay' })
  provider!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'success' | 'failed' | 'refunded';

  @Column({ nullable: true })
  providerOrderId?: string;

  @Column({ nullable: true })
  providerPaymentId?: string;

  @Column({ nullable: true })
  providerSignature?: string;

  // Razorpay payment link used by admin/guest flows
  @Column({ nullable: true })
  paymentLink?: string;

  @CreateDateColumn()
  createdAt!: Date;
}


import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ nullable: true })
  userId?: number;

  @Column()
  suiteId!: number;

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

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ default: 'pending' })
  status!: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';

  @Column({ default: 'pending' })
  paymentStatus!: 'pending' | 'success' | 'failed' | 'refunded';

  @CreateDateColumn()
  createdAt!: Date;
}

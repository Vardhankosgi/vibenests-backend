import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

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

  @Column({ default: 'pending' })
  status!: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';

  @Column({ default: 'pending' })
  paymentStatus!: 'pending' | 'success' | 'failed' | 'refunded';

  @CreateDateColumn()
  createdAt!: Date;
}

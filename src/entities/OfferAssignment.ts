import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Offer } from './Offer';
import { User } from './User';
import { Booking } from './Booking';

export type OfferAssignmentStatus = 'assigned' | 'redeemed';

@Entity('offer_assignments')
export class OfferAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  offerId!: number;

  @ManyToOne(() => Offer, (offer) => offer.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offerId' })
  offer!: Offer;

  @Column()
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 20, default: 'assigned' })
  status!: OfferAssignmentStatus;

  @Column({ nullable: true })
  bookingId?: number;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking;

  @Column({ type: 'timestamptz', nullable: true })
  redeemedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

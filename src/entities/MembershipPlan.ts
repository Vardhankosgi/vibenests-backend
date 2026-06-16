import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('membership_plans')
export class MembershipPlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50, unique: true })
  name!: 'Silver' | 'Gold';

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'varchar', length: 20, default: 'yearly' })
  validityType!: 'monthly' | 'yearly' | 'custom';

  @Column('int')
  validityDays!: number;

  @Column('int', { default: 10 })
  maxFreeBookings!: number;

  @Column('simple-array', { nullable: true })
  eligibleSuites?: string[];

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  discountPercent!: number;

  @Column('simple-array', { nullable: true })
  benefits?: string[];

  @Column('text', { nullable: true })
  terms?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'inactive';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

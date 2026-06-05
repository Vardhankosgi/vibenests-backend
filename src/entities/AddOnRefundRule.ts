import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { RefundPolicy } from './RefundPolicy';

export type AddOnRefundType = 'percentage' | 'flat' | 'no_refund' | 'full_refund';

@Entity('addon_refund_rules')
export class AddOnRefundRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => RefundPolicy, (p) => p.addOnRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refundPolicyId' })
  refundPolicy!: RefundPolicy;

  @Column()
  refundPolicyId!: number;

  @Column()
  addOnId!: number;

  @Column({ length: 100 })
  addOnName!: string;

  @Column({ type: 'varchar', length: 20 })
  refundType!: AddOnRefundType;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  refundValue!: number;

  // Hours before booking when this rule applies. 0 = always
  @Column({ default: 0 })
  hoursBeforeBooking!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn
} from 'typeorm';

export type TaxType = 'percentage' | 'flat';
export type TaxApplicability = 'all' | 'suite' | 'addon' | 'package';

@Entity('tax_charges')
export class TaxCharge {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20, nullable: true })
  taxCode?: string;

  @Column({ type: 'varchar', length: 20 })
  taxType!: TaxType;

  @Column('decimal', { precision: 10, scale: 2 })
  taxValue!: number;

  @Column({ type: 'varchar', length: 20, default: 'all' })
  applicableTo!: TaxApplicability;

  @Column('simple-array', { nullable: true })
  applicableIds?: string[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isInclusive!: boolean;

  @Column({ default: 0 })
  sortOrder!: number;

  @Column({ nullable: true })
  createdBy?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

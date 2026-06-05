import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';

@Entity('offer_configurations')
export class OfferConfiguration {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, unique: true })
  configKey!: string;

  @Column('text')
  configValue!: string;

  @Column({ length: 50, default: 'string' })
  valueType!: 'string' | 'number' | 'boolean' | 'json';

  @Column({ length: 100, nullable: true })
  label?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  updatedBy?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

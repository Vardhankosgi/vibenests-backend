import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { SuiteAvailability } from './SuiteAvailability';

@Entity()
export class Suite {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column('int', { default: 1 })
  minCapacity!: number;

  @Column('int')
  capacity!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  ratePerExtraPerson!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  baseDiscount!: number;

  @Column('simple-array', { default: '' })
  amenities!: string[];

  @Column()
  themeType!: string;

  @Column('text', { default: '[]' })
  images!: string[];

  @Column({ default: '09:00' })
  slotStartTime!: string;

  @Column({ default: '21:00' })
  slotEndTime!: string;

  @Column('int', { default: 150 })
  slotDurationMins!: number;

  @Column('int', { default: 30 })
  gapBetweenSlotsMins!: number;

  @Column({ default: 'available' })
  status!: 'available' | 'booked' | 'maintenance';

  @OneToMany(() => SuiteAvailability, (availability) => availability.suite)
  availability?: SuiteAvailability[];

  @CreateDateColumn()
  createdAt!: Date;
}

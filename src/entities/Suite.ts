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

  @Column('int')
  capacity!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column('simple-array', { default: '' })
  amenities!: string[];

  @Column()
  themeType!: string;

  @Column('simple-array', { default: '' })
  images!: string[];

  @Column({ default: 'available' })
  status!: 'available' | 'booked' | 'maintenance';

  @OneToMany(() => SuiteAvailability, (availability) => availability.suite)
  availability?: SuiteAvailability[];

  @CreateDateColumn()
  createdAt!: Date;
}

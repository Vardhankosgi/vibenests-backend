import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class CelebrationPackage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  occasion!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  priceRangeMin!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  priceRangeMax!: number;

  @Column('int')
  capacity!: number;

  @Column('text')
  description!: string;

  @Column({ default: '' })
  image!: string;

  @Column({ default: 'Most Popular' })
  badge!: string;

  @Column('simple-array', { default: '' })
  amenities!: string[];

  @Column({ default: 'Active' })
  status!: 'Active' | 'Inactive';

  @Column('int', { default: 0 })
  booked!: number;

  @Column('int', { default: 0 })
  reviews!: number;

  @Column('decimal', { precision: 3, scale: 1, default: 0 })
  rating!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: number;

  @Column({ type: 'int' })
  overall!: number;

  @Column({ type: 'int', default: 0 })
  ambience!: number;

  @Column({ type: 'int', default: 0 })
  cleanliness!: number;

  @Column({ type: 'int', default: 0 })
  service!: number;

  @Column({ type: 'int', default: 0 })
  decoration!: number;

  @Column({ type: 'int', default: 0 })
  value!: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ nullable: true })
  bookingId?: number;

  @Column({ nullable: true })
  suiteId?: number;

  @CreateDateColumn()
  createdAt!: Date;
}

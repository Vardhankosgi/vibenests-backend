import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Booking } from './Booking';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  fullName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true, unique: true })
  phone?: string;

  @Column({ nullable: true })
  dateOfBirth?: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ default: 'customer' })
  role!: 'customer' | 'admin' | 'superadmin';

  @Column({ default: false })
  isVerified!: boolean;

  @Column({ default: false })
  isActive!: boolean;

  @OneToMany(() => Booking, (b) => b.user)
  bookings!: Booking[];

  @CreateDateColumn()
  createdAt!: Date;
}

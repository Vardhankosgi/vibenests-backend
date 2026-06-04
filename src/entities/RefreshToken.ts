import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  token!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}

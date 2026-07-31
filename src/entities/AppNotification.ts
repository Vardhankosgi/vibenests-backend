import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true, type: 'int' })
  userId!: number | null;

  @Column({ default: 'customer' })
  targetRole!: string; // 'customer' | 'admin' | 'all'

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ default: 'system' })
  type!: string; // 'booking' | 'payment' | 'user' | 'membership' | 'review' | 'system'

  @Column({ nullable: true, type: 'varchar' })
  referenceId!: string | null;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

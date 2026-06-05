import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';

@Entity('live_celebration_settings')
export class LiveCelebrationSetting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, unique: true })
  settingKey!: string;

  @Column('text')
  settingValue!: string;

  @Column({ length: 50, default: 'string' })
  valueType!: 'string' | 'number' | 'boolean' | 'json';

  @Column({ length: 100, nullable: true })
  label?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ length: 50, default: 'general' })
  group!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  updatedBy?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

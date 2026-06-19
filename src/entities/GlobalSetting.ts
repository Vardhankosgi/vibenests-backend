import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';

@Entity('global_settings')
export class GlobalSetting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, unique: true })
  settingKey!: string;

  @Column('text')
  settingValue!: string;

  @Column({ length: 50, default: 'string' })
  valueType!: 'string' | 'number' | 'boolean' | 'json';

  @Column({ length: 50, default: 'general' })
  group!: string;

  @Column({ default: false })
  isPublic!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50 })
  entityType!: string;

  @Column()
  entityId!: number;

  @Column({ length: 50, nullable: true })
  action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'APPROVE' | 'REJECT' | 'AUTO_APPROVE' | 'AUTO_REJECT' | 'AUTO_COMPLETE';

  @Column({ nullable: true })
  performedBy?: number;

  @Column({ length: 50, nullable: true })
  performedByRole?: string;

  @Column('jsonb', { nullable: true })
  previousData?: object;

  @Column('jsonb', { nullable: true })
  newData?: object;

  @Column('text', { nullable: true })
  note?: string;

  @Column({ length: 45, nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

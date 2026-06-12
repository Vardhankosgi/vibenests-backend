import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type WhatsAppEventType = 'message' | 'delivery';
export type WhatsAppEventDirection = 'inbound' | 'outbound';

@Entity()
export class WhatsAppEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  eventType!: WhatsAppEventType;

  @Index()
  @Column()
  phone!: string;

  @Column({ type: 'varchar' })
  direction!: WhatsAppEventDirection;

  @Column({ type: 'varchar', nullable: true })
  waMessageId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  // Raw webhook payload (for debugging)
  @Column({ type: 'jsonb' })
  payload!: any;

  @CreateDateColumn()
  createdAt!: Date;
}


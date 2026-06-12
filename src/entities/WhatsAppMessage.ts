import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type WhatsAppMessageDirection = 'outbound' | 'inbound';

@Entity()
export class WhatsAppMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  phone!: string;

  @Column({ type: 'varchar' })
  direction!: WhatsAppMessageDirection;

  // text body or template name
  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageType?: string | null;

  // Meta message id
  @Column({ type: 'varchar', nullable: true })
  waMessageId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  waConversationId?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}


import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('translations')
@Index(['entityType', 'entityId', 'fieldName', 'language'], { unique: true })
export class Translation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'entity_type', length: 100 })
  entityType!: string;

  @Column({ name: 'entity_id', length: 100 })
  entityId!: string;

  @Column({ name: 'field_name', length: 100 })
  fieldName!: string;

  @Column({ length: 10 })
  language!: string;

  @Column('text', { name: 'translated_text' })
  translatedText!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

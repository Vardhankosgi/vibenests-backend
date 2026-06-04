import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Suite } from './Suite';

@Entity()
export class SuiteAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Suite, (suite) => suite.availability, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suiteId' })
  suite!: Suite;

  @Column()
  suiteId!: number;

  @Column()
  date!: string;

  @Column()
  timeSlot!: string;

  @Column({ default: 'blocked' })
  status!: 'blocked' | 'available';

  @Column('text', { nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

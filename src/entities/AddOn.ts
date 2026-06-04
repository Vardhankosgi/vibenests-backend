import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class AddOn {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column()
  category!: string;

  @Column({ default: 'active' })
  status!: 'active' | 'inactive';

  @CreateDateColumn()
  createdAt!: Date;
}

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Booking } from './entities/Booking';
import { Suite } from './entities/Suite';
import { SuiteAvailability } from './entities/SuiteAvailability';
import { AddOn } from './entities/AddOn';
import { Payment } from './entities/Payment';
import dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: [User, Booking, Suite, SuiteAvailability, AddOn, Payment],
  migrations: [],
});

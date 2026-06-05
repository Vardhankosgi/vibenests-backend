import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Booking } from './entities/Booking';
import { Suite } from './entities/Suite';
import { SuiteAvailability } from './entities/SuiteAvailability';
import { AddOn } from './entities/AddOn';
import { Payment } from './entities/Payment';
import { RefreshToken } from './entities/RefreshToken';
import { Offer } from './entities/Offer';
import { Coupon } from './entities/Coupon';
import { RefundPolicy } from './entities/RefundPolicy';
import { AddOnRefundRule } from './entities/AddOnRefundRule';
import { LiveCelebrationSetting } from './entities/LiveCelebrationSetting';
import { TaxCharge } from './entities/TaxCharge';
import { BookingRule } from './entities/BookingRule';
import { RefundCalculation } from './entities/RefundCalculation';
import { AuditLog } from './entities/AuditLog';
import { OfferConfiguration } from './entities/OfferConfiguration';
import dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: [
    User, Booking, Suite, SuiteAvailability, AddOn, Payment, RefreshToken,
    Offer, Coupon, RefundPolicy, AddOnRefundRule, LiveCelebrationSetting,
    TaxCharge, BookingRule, RefundCalculation, AuditLog, OfferConfiguration,
  ],
  migrations: [],
});

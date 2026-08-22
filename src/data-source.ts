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
import { OfferAssignment } from './entities/OfferAssignment';
import { Coupon } from './entities/Coupon';
import { LiveCelebrationSetting } from './entities/LiveCelebrationSetting';
import { GlobalSetting } from './entities/GlobalSetting';
import { TaxCharge } from './entities/TaxCharge';
import { BookingRule } from './entities/BookingRule';
import { RefundCalculation } from './entities/RefundCalculation';
import { AuditLog } from './entities/AuditLog';
import { OfferConfiguration } from './entities/OfferConfiguration';
import { OtpCode } from './entities/OtpCode';
import { WhatsAppMessage } from './entities/WhatsAppMessage';
import { WhatsAppEvent } from './entities/WhatsAppEvent';
import { AppNotification } from './entities/AppNotification';

import { MembershipPlan } from './entities/MembershipPlan';
import { UserMembership } from './entities/UserMembership';
import { Translation } from './entities/Translation';
import { Review } from './entities/Review';
import { ReferralCode } from './entities/ReferralCode';
import { ReferralRelationship } from './entities/ReferralRelationship';
import { ReferralReward } from './entities/ReferralReward';
import { ReferralTransaction } from './entities/ReferralTransaction';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL || '';
const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbUrl,
  synchronize: true,
  logging: false,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  extra: isLocalhost ? {} : { ssl: { rejectUnauthorized: false } },
  entities: [
    User, Booking, Suite, SuiteAvailability, AddOn, Payment, RefreshToken,
    Offer, OfferAssignment, Coupon, LiveCelebrationSetting, GlobalSetting,
    TaxCharge, BookingRule, RefundCalculation, AuditLog, OfferConfiguration,
    MembershipPlan, UserMembership, Translation, Review,
    OtpCode, WhatsAppMessage, WhatsAppEvent, AppNotification,
    ReferralCode, ReferralRelationship, ReferralReward, ReferralTransaction,
  ],
  migrations: [],
});

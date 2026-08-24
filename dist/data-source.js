"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const User_1 = require("./entities/User");
const Booking_1 = require("./entities/Booking");
const Suite_1 = require("./entities/Suite");
const SuiteAvailability_1 = require("./entities/SuiteAvailability");
const AddOn_1 = require("./entities/AddOn");
const Payment_1 = require("./entities/Payment");
const RefreshToken_1 = require("./entities/RefreshToken");
const Offer_1 = require("./entities/Offer");
const OfferAssignment_1 = require("./entities/OfferAssignment");
const Coupon_1 = require("./entities/Coupon");
const LiveCelebrationSetting_1 = require("./entities/LiveCelebrationSetting");
const GlobalSetting_1 = require("./entities/GlobalSetting");
const TaxCharge_1 = require("./entities/TaxCharge");
const BookingRule_1 = require("./entities/BookingRule");
const RefundCalculation_1 = require("./entities/RefundCalculation");
const AuditLog_1 = require("./entities/AuditLog");
const OfferConfiguration_1 = require("./entities/OfferConfiguration");
const OtpCode_1 = require("./entities/OtpCode");
const WhatsAppMessage_1 = require("./entities/WhatsAppMessage");
const WhatsAppEvent_1 = require("./entities/WhatsAppEvent");
const AppNotification_1 = require("./entities/AppNotification");
const MembershipPlan_1 = require("./entities/MembershipPlan");
const UserMembership_1 = require("./entities/UserMembership");
const Translation_1 = require("./entities/Translation");
const Review_1 = require("./entities/Review");
const ReferralCode_1 = require("./entities/ReferralCode");
const ReferralRelationship_1 = require("./entities/ReferralRelationship");
const ReferralReward_1 = require("./entities/ReferralReward");
const ReferralTransaction_1 = require("./entities/ReferralTransaction");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbUrl = process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    '';
const isInternalOrLocal = !dbUrl ||
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1') ||
    dbUrl.includes('railway.internal');
console.log('Connecting to Database:', dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : '⚠️ [DATABASE_URL IS NOT FOUND IN ENVIRONMENT VARIABLES]');
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: dbUrl,
    synchronize: true,
    logging: false,
    ssl: isInternalOrLocal ? false : { rejectUnauthorized: false },
    extra: isInternalOrLocal ? {} : { ssl: { rejectUnauthorized: false } },
    entities: [
        User_1.User, Booking_1.Booking, Suite_1.Suite, SuiteAvailability_1.SuiteAvailability, AddOn_1.AddOn, Payment_1.Payment, RefreshToken_1.RefreshToken,
        Offer_1.Offer, OfferAssignment_1.OfferAssignment, Coupon_1.Coupon, LiveCelebrationSetting_1.LiveCelebrationSetting, GlobalSetting_1.GlobalSetting,
        TaxCharge_1.TaxCharge, BookingRule_1.BookingRule, RefundCalculation_1.RefundCalculation, AuditLog_1.AuditLog, OfferConfiguration_1.OfferConfiguration,
        MembershipPlan_1.MembershipPlan, UserMembership_1.UserMembership, Translation_1.Translation, Review_1.Review,
        OtpCode_1.OtpCode, WhatsAppMessage_1.WhatsAppMessage, WhatsAppEvent_1.WhatsAppEvent, AppNotification_1.AppNotification,
        ReferralCode_1.ReferralCode, ReferralRelationship_1.ReferralRelationship, ReferralReward_1.ReferralReward, ReferralTransaction_1.ReferralTransaction,
    ],
    migrations: [],
});

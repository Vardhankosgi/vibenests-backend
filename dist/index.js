"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const data_source_1 = require("./data-source");
const offerSync_cron_1 = require("./cron/offerSync.cron");
const User_1 = require("./entities/User");
const MembershipPlan_1 = require("./entities/MembershipPlan");
const bcrypt_1 = __importDefault(require("bcrypt"));
const referrals_service_1 = require("./services/referrals.service");
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
async function seedAdmin() {
    const repo = data_source_1.AppDataSource.getRepository(User_1.User);
    const exists = await repo.findOneBy({ email: 'admin@vibenests.com' });
    if (!exists) {
        const hash = await bcrypt_1.default.hash('admin@1234', 10);
        const admin = repo.create({ fullName: 'Admin', email: 'vibenestsmeetingpoint@gmail.com', phone: '9000201011', password: hash, role: 'admin', isVerified: true, isActive: true });
        await repo.save(admin);
        console.log('Admin seeded: vibenestsmeetingpoint@gmail.com / admin@1234');
    }
}
async function seedMembershipPlans() {
    const repo = data_source_1.AppDataSource.getRepository(MembershipPlan_1.MembershipPlan);
    // Seed Silver
    const silverExists = await repo.findOneBy({ name: 'Silver' });
    if (!silverExists) {
        const silver = repo.create({
            name: 'Silver',
            price: 1999,
            validityType: 'yearly',
            validityDays: 365,
            maxFreeBookings: 5,
            eligibleSuites: ['1', '2'],
            discountPercent: 0,
            benefits: [
                '5 free bookings on eligible suites',
                'Priority customer support',
                'Complimentary soft drinks during stays'
            ],
            terms: 'Membership is non-transferable and non-refundable. Valid for 1 year from activation.',
            status: 'active'
        });
        await repo.save(silver);
        console.log('Silver membership plan seeded.');
    }
    // Seed Gold
    const goldExists = await repo.findOneBy({ name: 'Gold' });
    if (!goldExists) {
        const gold = repo.create({
            name: 'Gold',
            price: 4999,
            validityType: 'yearly',
            validityDays: 365,
            maxFreeBookings: 15,
            eligibleSuites: ['1', '2', '3'],
            discountPercent: 0,
            benefits: [
                '15 free bookings on eligible suites',
                '24/7 dedicated support desk',
                '1 complimentary add-on per booking',
                'Free late check-out (up to 2 hours)'
            ],
            terms: 'Membership is non-transferable and non-refundable. Valid for 1 year from activation.',
            status: 'active'
        });
        await repo.save(gold);
        console.log('Gold membership plan seeded.');
    }
}
data_source_1.AppDataSource.initialize()
    .then(async () => {
    console.log('Database connected');
    await seedAdmin();
    await seedMembershipPlans();
    await (0, referrals_service_1.seedLegacyUsersReferralCodes)();
    (0, offerSync_cron_1.startOfferCronJobs)();
    app_1.default.listen(PORT, () => {
        console.log(`Server started on ${PORT}`);
    });
})
    .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
});

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
dotenv_1.default.config();
const PORT = process.env.PORT || 4000;
async function seedAdmin() {
    const repo = data_source_1.AppDataSource.getRepository(User_1.User);
    const exists = await repo.findOneBy({ email: 'admin@vibenests.com' });
    if (!exists) {
        const hash = await bcrypt_1.default.hash('admin1234', 10);
        const admin = repo.create({ fullName: 'Admin', email: 'admin@vibenests.com', password: hash, role: 'admin', isVerified: true, isActive: true });
        await repo.save(admin);
        console.log('Admin seeded: admin@vibenests.com / admin1234');
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
            validityDays: 365,
            discountPercent: 10,
            benefits: [
                '10% discount on all suite bookings',
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
            validityDays: 365,
            discountPercent: 20,
            benefits: [
                '20% discount on all suite bookings',
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
    (0, offerSync_cron_1.startOfferCronJobs)();
    app_1.default.listen(PORT, () => {
        console.log(`Server started on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
});

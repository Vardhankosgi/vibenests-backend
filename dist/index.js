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
const RefundCalculation_1 = require("./entities/RefundCalculation");
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
async function migrateRefundData() {
    try {
        const repo = data_source_1.AppDataSource.getRepository(RefundCalculation_1.RefundCalculation);
        const refunds = await repo.find({ relations: ['booking'] });
        console.log(`Checking ${refunds.length} refund request(s) for schema migration...`);
        let migratedCount = 0;
        for (const r of refunds) {
            let updated = false;
            if (!r.userId && r.booking) {
                r.userId = r.booking.userId;
                r.customerName = `${r.booking.guestFirstName || ''} ${r.booking.guestLastName || ''}`.trim() || 'Guest';
                r.customerEmail = r.booking.guestEmail;
                r.customerPhone = r.booking.guestPhone;
                r.bookingDate = r.booking.date;
                r.paymentMethod = r.booking.paymentMode;
                updated = true;
            }
            if (!r.customerMessage && r.cancellationReason) {
                r.customerMessage = r.cancellationReason;
                updated = true;
            }
            if (!r.refundReason) {
                r.refundReason = 'other';
                updated = true;
            }
            if (!r.adminId && r.processedBy) {
                r.adminId = r.processedBy;
                updated = true;
            }
            if (r.status === 'processed') {
                r.status = 'refunded';
                r.completedAt = r.processedAt || new Date();
                updated = true;
            }
            if (updated) {
                await repo.save(r);
                migratedCount++;
            }
        }
        if (migratedCount > 0) {
            console.log(`Migrated ${migratedCount} historical refund request(s).`);
        }
    }
    catch (err) {
        console.error('Failed to migrate legacy refund records:', err);
    }
}
data_source_1.AppDataSource.initialize()
    .then(async () => {
    console.log('Database connected');
    await seedAdmin();
    await seedMembershipPlans();
    await migrateRefundData();
    (0, offerSync_cron_1.startOfferCronJobs)();
    app_1.default.listen(PORT, () => {
        console.log(`Server started on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
});

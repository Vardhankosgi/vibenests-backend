import dotenv from 'dotenv';
import app from './app';
import { AppDataSource } from './data-source';
import { startOfferCronJobs } from './cron/offerSync.cron';
import { User } from './entities/User';
import { MembershipPlan } from './entities/MembershipPlan';
import bcrypt from 'bcrypt';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function seedAdmin() {
  const repo = AppDataSource.getRepository(User);
  const exists = await repo.findOneBy({ email: 'admin@vibenests.com' });
  if (!exists) {
    const hash = await bcrypt.hash('admin1234', 10);
    const admin = repo.create({ fullName: 'Admin', email: 'admin@vibenests.com', password: hash, role: 'admin', isVerified: true, isActive: true });
    await repo.save(admin);
    console.log('Admin seeded: admin@vibenests.com / admin1234');
  }
}

async function seedMembershipPlans() {
  const repo = AppDataSource.getRepository(MembershipPlan);
  
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

AppDataSource.initialize()
  .then(async () => {
    console.log('Database connected');
    await seedAdmin();
    await seedMembershipPlans();
    startOfferCronJobs();
    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
  });

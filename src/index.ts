import dotenv from 'dotenv';
import app from './app';
import { AppDataSource } from './data-source';
import { User } from './entities/User';
import bcrypt from 'bcrypt';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function seedAdmin() {
  const repo = AppDataSource.getRepository(User);
  const exists = await repo.findOneBy({ email: 'admin@vibenests.com' });
  if (!exists) {
    const hash = await bcrypt.hash('admin1234', 10);
    const admin = repo.create({ fullName: 'Admin', email: 'admin@vibenests.com', password: hash, role: 'admin', isVerified: true });
    await repo.save(admin);
    console.log('Admin seeded: admin@vibenests.com / admin1234');
  }
}

AppDataSource.initialize()
  .then(async () => {
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
  });

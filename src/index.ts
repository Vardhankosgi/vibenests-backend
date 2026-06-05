import dotenv from 'dotenv';
import app from './app';
import { AppDataSource } from './data-source';
import { startOfferCronJobs } from './cron/offerSync.cron';

dotenv.config();

const PORT = process.env.PORT || 4000;

AppDataSource.initialize()
  .then(() => {
    console.log('Database connected');
    startOfferCronJobs();
    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
  });

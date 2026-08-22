import dotenv from 'dotenv';
import app from './app';
import { AppDataSource } from './data-source';
import { startOfferCronJobs } from './cron/offerSync.cron';
import { seedAdminCredentials } from './services/auth.service';

dotenv.config();

const PORT = process.env.PORT || 5000;

AppDataSource.initialize()
  .then(async () => {
    console.log('Database connected & synchronized successfully');
    await seedAdminCredentials();
    startOfferCronJobs();

    function startServer() {
      const server = app.listen(PORT as number, '127.0.0.1', () => {
        console.log(`Server started on 127.0.0.1:${PORT}`);
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[WARN] Port ${PORT} is in use. This usually happens if the server is restarting or running in another terminal. Retrying in 3 seconds...`);
          setTimeout(() => {
            server.close();
            startServer();
          }, 3000);
        } else {
          console.error('Server error:', err);
          process.exit(1);
        }
      });
    }

    startServer();
  })
  .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
  });


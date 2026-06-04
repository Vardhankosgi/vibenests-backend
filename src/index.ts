import dotenv from 'dotenv';
import app from './app';
import { AppDataSource } from './data-source';

dotenv.config();

const PORT = process.env.PORT || 4000;

AppDataSource.initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
  });

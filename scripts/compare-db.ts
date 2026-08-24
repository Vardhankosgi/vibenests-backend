// @ts-ignore
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const AWS_DATABASE_URL = process.env.AWS_DATABASE_URL || '';
const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || '';

async function compareDatabases() {
  console.log('📡 Connecting to AWS RDS...');
  const awsClient = new Client({
    connectionString: AWS_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await awsClient.connect();
  console.log('✅ Connected to AWS RDS.\n');

  console.log('📡 Connecting to Railway Postgres...');
  const railwayClient = new Client({
    connectionString: RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await railwayClient.connect();
  console.log('✅ Connected to Railway Postgres.\n');

  console.log('============================================================');
  console.log('📊 AWS RDS BOOKINGS:');
  console.log('============================================================');
  const awsBookings = await awsClient.query(`SELECT id, "suiteName", date, "totalAmount", status, "createdAt" FROM "booking" ORDER BY id ASC;`);
  console.log(`Total rows in AWS RDS: ${awsBookings.rows.length}`);
  console.table(awsBookings.rows);

  console.log('\n============================================================');
  console.log('📊 RAILWAY POSTGRES BOOKINGS:');
  console.log('============================================================');
  const railwayBookings = await railwayClient.query(`SELECT id, "suiteName", date, "totalAmount", status, "createdAt" FROM "booking" ORDER BY id ASC;`);
  console.log(`Total rows in Railway: ${railwayBookings.rows.length}`);
  console.table(railwayBookings.rows);

  await awsClient.end();
  await railwayClient.end();
}

compareDatabases();

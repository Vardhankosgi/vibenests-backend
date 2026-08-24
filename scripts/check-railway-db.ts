// @ts-ignore
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || '';

async function checkDb() {
  const client = new Client({
    connectionString: RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('✅ Connected to Railway Postgres.\n');

  console.log('============================================================');
  console.log('📅 BOOKINGS ANALYSIS FROM AUGUST 1, 2026 ONWARDS:');
  console.log('============================================================');

  const augBookings = await client.query(`
    SELECT 
      id, 
      "suiteName", 
      date, 
      "timeSlot", 
      "totalAmount", 
      status, 
      "createdAt" 
    FROM "booking" 
    WHERE date >= '2026-08-01' OR "createdAt" >= '2026-08-01'
    ORDER BY date DESC;
  `);

  console.log(`📊 Total bookings from Aug 1, 2026: ${augBookings.rows.length} bookings.\n`);
  if (augBookings.rows.length > 0) {
    console.table(augBookings.rows);
  }

  console.log('\n============================================================');
  console.log('📅 ALL 25 BOOKINGS DATES IN DATABASE:');
  console.log('============================================================');

  const allBookings = await client.query(`
    SELECT 
      id, 
      "suiteName", 
      date, 
      "totalAmount", 
      status, 
      "createdAt" 
    FROM "booking" 
    ORDER BY date DESC;
  `);

  console.table(allBookings.rows);

  await client.end();
}

checkDb();


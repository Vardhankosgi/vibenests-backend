// @ts-ignore
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const AWS_DATABASE_URL = process.env.AWS_DATABASE_URL || '';
const RAILWAY_DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || '';

async function runAugustOnlyMigration() {
  console.log('🚀 Starting August 1st+ Targeted Migration from AWS RDS to Railway Postgres...\n');

  console.log(`📡 Connecting to Source (AWS RDS)...`);
  const awsClient = new Client({
    connectionString: AWS_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await awsClient.connect();
  console.log('✅ Connected to AWS RDS.\n');

  console.log(`📡 Connecting to Destination (Railway Postgres)...`);
  const isLocalOrInternal =
    RAILWAY_DATABASE_URL.includes('localhost') ||
    RAILWAY_DATABASE_URL.includes('railway.internal');

  const railwayClient = new Client({
    connectionString: RAILWAY_DATABASE_URL,
    ssl: isLocalOrInternal ? false : { rejectUnauthorized: false }
  });
  await railwayClient.connect();
  console.log('✅ Connected to Railway Postgres.\n');

  try {
    // Disable triggers / FK checks temporarily for smooth insertion
    await railwayClient.query('SET session_replication_role = replica;');

    // 1. Discover all tables in AWS RDS
    const tablesQuery = await awsClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const allTables = tablesQuery.rows.map((r: any) => r.table_name);
    console.log(`🔍 Discovered ${allTables.length} tables in AWS RDS.\n`);

    let totalMigratedRows = 0;
    const summary: Array<{ table: string; awsRows: number; railwayRows: number }> = [];

    // Prioritized order: Master configs first, then transactional data
    const prioritizedOrder = ['user', 'suite', 'add_on', 'booking', 'payment'];
    const remainingTables = allTables.filter((t: string) => !prioritizedOrder.includes(t));
    const sortedTables = [...prioritizedOrder.filter((t) => allTables.includes(t)), ...remainingTables];

    for (const table of sortedTables) {
      // Check if table exists in Railway
      const checkRailway = await railwayClient.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );`,
        [table]
      );

      if (!checkRailway.rows[0].exists) {
        console.log(`⚠️ Table "${table}" does not exist in Railway yet (skipping).`);
        continue;
      }

      // Fetch valid columns in Railway
      const destColsQuery = await railwayClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`,
        [table]
      );
      const validDestColumns = new Set(destColsQuery.rows.map((r: any) => r.column_name));

      // Build specific query for August 1+ filtering
      let fetchSql = `SELECT * FROM "${table}"`;
      if (table === 'booking') {
        // ONLY August 1, 2026 onwards
        fetchSql = `SELECT * FROM "${table}" WHERE date >= '2026-08-01' OR "createdAt" >= '2026-08-01' ORDER BY id ASC`;
      } else if (table === 'payment') {
        // ONLY payments from August 1 or linked to August bookings
        fetchSql = `SELECT * FROM "${table}" WHERE "createdAt" >= '2026-08-01' OR "bookingId" IN (SELECT id FROM "booking" WHERE date >= '2026-08-01' OR "createdAt" >= '2026-08-01') ORDER BY id ASC`;
      } else {
        fetchSql = `SELECT * FROM "${table}" ORDER BY id ASC`;
      }

      const sourceData = await awsClient.query(fetchSql);
      const rows = sourceData.rows;

      if (rows.length === 0) {
        summary.push({ table, awsRows: 0, railwayRows: 0 });
        continue;
      }

      console.log(`📦 [${table}]: Migrating ${rows.length} rows (August 1+ filter applied)...`);

      // Clear destination table
      await railwayClient.query(`TRUNCATE TABLE "${table}" CASCADE;`);

      // Insert filtered rows
      for (const row of rows) {
        const columns = Object.keys(row).filter((col) => validDestColumns.has(col));
        const values = columns.map((col) => row[col]);

        const colNames = columns.map((c) => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const insertQuery = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
        try {
          await railwayClient.query(insertQuery, values);
        } catch (err: any) {
          console.error(`  ⚠️ Row insert error in "${table}" (ID: ${row.id}):`, err?.message);
        }
      }

      // Reset sequence counter to max id
      try {
        await railwayClient.query(`
          SELECT setval(
            pg_get_serial_sequence('"${table}"', 'id'),
            COALESCE((SELECT MAX(id) FROM "${table}"), 1),
            true
          );
        `);
      } catch {
        // No serial id
      }

      // Verify count in Railway
      const countRes = await railwayClient.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countRes.rows[0].count, 10);

      summary.push({ table, awsRows: rows.length, railwayRows: count });
      console.log(`✅ [${table}]: Successfully migrated ${count} rows.`);
      totalMigratedRows += count;
    }

    // Re-enable triggers and foreign keys
    await railwayClient.query('SET session_replication_role = DEFAULT;');

    console.log(`\n============================================================`);
    console.log(`🎉 AUGUST 1+ FILTERED MIGRATION COMPLETED!`);
    console.log(`============================================================`);
    console.log(`Table Name`.padEnd(30) + `AWS Migrated`.padEnd(15) + `Railway Rows`);
    console.log(`------------------------------------------------------------`);
    for (const item of summary) {
      console.log(
        item.table.padEnd(30) +
        String(item.awsRows).padEnd(15) +
        String(item.railwayRows)
      );
    }
    console.log(`============================================================`);
    console.log(`📊 TOTAL ROWS MIGRATED: ${totalMigratedRows} rows\n`);

  } catch (error) {
    console.error('❌ Migration Error:', error);
  } finally {
    await awsClient.end();
    await railwayClient.end();
  }
}

runAugustOnlyMigration();

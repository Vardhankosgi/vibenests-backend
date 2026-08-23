// @ts-ignore
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Source (AWS RDS) and Destination (Railway Postgres) URLs
const AWS_DATABASE_URL =
  process.env.AWS_DATABASE_URL ||
  'postgresql://postgres:VibeNests2026@vibenests-database.cbmcogmu8rz5.ap-south-1.rds.amazonaws.com:5432/vibenests-db';

const RAILWAY_DATABASE_URL =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

if (!RAILWAY_DATABASE_URL) {
  console.error('❌ Error: Please provide RAILWAY_DATABASE_URL');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Starting Full Dynamic Data Migration from AWS RDS to Railway Postgres...\n');

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
    // Disable triggers / FK checks temporarily for smooth migration
    await railwayClient.query('SET session_replication_role = replica;');

    // 1. Discover all tables in AWS RDS dynamically
    const tablesQuery = await awsClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const allTables = tablesQuery.rows.map((r: any) => r.table_name);
    console.log(`🔍 Discovered ${allTables.length} tables in AWS RDS:\n${allTables.join(', ')}\n`);

    let totalMigratedRows = 0;
    const summary: Array<{ table: string; awsRows: number; railwayRows: number }> = [];

    for (const table of allTables) {
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

      // Fetch all rows from AWS RDS
      const sourceData = await awsClient.query(`SELECT * FROM "${table}"`);
      const rows = sourceData.rows;

      if (rows.length === 0) {
        summary.push({ table, awsRows: 0, railwayRows: 0 });
        continue;
      }

      console.log(`📦 [${table}]: Found ${rows.length} rows in AWS RDS. Migrating...`);

      // Clear destination table to avoid duplicates
      await railwayClient.query(`TRUNCATE TABLE "${table}" CASCADE;`);

      // Insert rows
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);

        const colNames = columns.map((c) => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const insertQuery = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
        await railwayClient.query(insertQuery, values);
      }

      // Reset auto-increment sequence if table has 'id' column
      try {
        await railwayClient.query(`
          SELECT setval(
            pg_get_serial_sequence('"${table}"', 'id'),
            COALESCE((SELECT MAX(id) FROM "${table}"), 1),
            true
          );
        `);
      } catch {
        // Sequence reset not needed for tables without serial id
      }

      // Verify row count in Railway
      const countRes = await railwayClient.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countRes.rows[0].count, 10);

      summary.push({ table, awsRows: rows.length, railwayRows: count });
      console.log(`✅ [${table}]: Successfully migrated ${count} / ${rows.length} rows.`);
      totalMigratedRows += count;
    }

    // Re-enable triggers
    await railwayClient.query('SET session_replication_role = DEFAULT;');

    console.log(`\n============================================================`);
    console.log(`🎉 DATA MIGRATION COMPLETED SUCCESSFULLY!`);
    console.log(`============================================================`);
    console.log(`Table Name`.padEnd(30) + `AWS RDS Rows`.padEnd(15) + `Railway Rows`);
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

runMigration();

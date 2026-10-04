import postgres from 'postgres';
import fs from 'node:fs';
import process from 'node:process';

const databaseUrl = process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error('Missing SUPABASE_DB_URL. Refusing to run a database migration without an explicit server-side connection string.');
  process.exitCode = 1;
} else {
  const sql = postgres(databaseUrl, { ssl: 'require' });
  const migrationPath = new URL(
    './supabase/migrations/0011_doctor_tier_corrections.sql',
    import.meta.url
  );

  try {
    const content = fs.readFileSync(migrationPath, 'utf8');
    console.log('Executing migration 0011...');
    await sql.unsafe(content);
    console.log('Migration executed successfully.');
  } catch (error) {
    console.error('Migration execution failed:', error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

import postgres from 'postgres';
import fs from 'fs';

const sql = postgres('postgresql://postgres.tsnwshezadvtmjqjlfot:vVxhc0oCoJFlBmM8@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', { ssl: 'require' });

async function run() {
  const content = fs.readFileSync('supabase/migrations/0011_doctor_tier_corrections.sql', 'utf8');
  console.log('Executing migration 0011...');
  try {
    await sql.unsafe(content);
    console.log('Migration executed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await sql.end();
  }
}

run();

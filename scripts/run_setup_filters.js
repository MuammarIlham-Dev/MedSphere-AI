import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.db' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await client.connect();
  const sql = fs.readFileSync('C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\bee194c5-3445-4fc1-bb0e-0c304bc7fb18\\scratch\\setup_filters.sql', 'utf8');
  await client.query(sql);
  console.log('Successfully created filter views');
  await client.end();
}

run().catch(console.error);

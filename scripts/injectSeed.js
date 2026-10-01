import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from .env.db
dotenv.config({ path: path.join(__dirname, '../.env.db') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || dbUrl.includes('YOUR_PASSWORD_HERE')) {
    console.error('❌ Please update your .env.db file with your actual database password!');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    // Increase statement timeout just in case it takes a while
    statement_timeout: 300000, 
});

async function injectSeed() {
    try {
        console.log('🔌 Connecting to the database...');
        await client.connect();
        console.log('✅ Connected successfully!\n');

        const seedPath = path.join(__dirname, '../supabase/seed.sql');
        console.log(`📦 Loading main seed file: ${seedPath}`);
        
        const sql = fs.readFileSync(seedPath, 'utf8');
        console.log(`⏳ Executing massive 12MB seed file (this may take a minute)...`);
        
        await client.query(sql);
        
        console.log('\n🎉 ALL SEED DATA INJECTED SUCCESSFULLY!');

    } catch (err) {
        console.error('\n❌ ERROR during injection:', err.message);
    } finally {
        await client.end();
        console.log('🔌 Connection closed.');
    }
}

injectSeed();

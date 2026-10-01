import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.db') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || dbUrl.includes('YOUR_PASSWORD_HERE')) {
    console.error('❌ Please update your .env.db file with your actual database password!');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    statement_timeout: 300000, 
});

async function injectSeed() {
    try {
        console.log('🔌 Connecting to the database...');
        await client.connect();
        console.log('✅ Connected successfully!\n');

        console.log('🧹 Clearing old dummy data (only @medsphere.test.com users)...');
        await client.query(`DELETE FROM public.doctors WHERE hospital_id IN (SELECT id FROM public.hospitals WHERE owner_id IN (SELECT id FROM auth.users WHERE email LIKE '%@medsphere.test.com'))`);
        await client.query(`DELETE FROM public.departments WHERE hospital_id IN (SELECT id FROM public.hospitals WHERE owner_id IN (SELECT id FROM auth.users WHERE email LIKE '%@medsphere.test.com'))`);
        await client.query(`DELETE FROM public.hospitals WHERE owner_id IN (SELECT id FROM auth.users WHERE email LIKE '%@medsphere.test.com')`);
        await client.query(`DELETE FROM auth.users WHERE email LIKE '%@medsphere.test.com'`);
        
        console.log('🔕 Dropping profile creation trigger temporarily...');
        await client.query(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`);

        const seedPath = path.join(__dirname, '../supabase/seed.sql');
        console.log(`📦 Loading main seed file: ${seedPath}`);
        
        let sql = fs.readFileSync(seedPath, 'utf8');
        
        console.log(`⏳ Executing massive 12MB seed file (this may take a minute)...`);
        await client.query(sql);
        
        console.log('🔔 Re-creating profile creation trigger...');
        await client.query(`
            CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        `);

        console.log('\n🎉 ALL SEED DATA INJECTED SUCCESSFULLY!');

    } catch (err) {
        console.error('\n❌ ERROR during injection:', err.message);
        
        // Try to re-enable trigger even on error just in case
        try {
            await client.query(`
                DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
                CREATE TRIGGER on_auth_user_created
                AFTER INSERT ON auth.users
                FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
            `);
        } catch (e) {}
    } finally {
        await client.end();
        console.log('🔌 Connection closed.');
    }
}

injectSeed();

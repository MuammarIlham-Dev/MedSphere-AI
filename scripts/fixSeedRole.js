import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedPath = path.join(__dirname, '../supabase/seed.sql');

console.log('Reading seed.sql...');
let content = fs.readFileSync(seedPath, 'utf8');

console.log('Replacing hospital_admin with hospital...');
// Replace exact matches for the enum
content = content.replace(/'hospital_admin'/g, "'hospital'");

console.log('Saving seed.sql...');
fs.writeFileSync(seedPath, content, 'utf8');

console.log('Done!');

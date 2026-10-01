import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedPath = path.join(__dirname, '../supabase/seed.sql');

console.log('Reading seed.sql...');
let content = fs.readFileSync(seedPath, 'utf8');

console.log('Fixing phone numbers to be perfectly unique...');
let phoneCounter = 300000000;

// Fix standard +8801 numbers
content = content.replace(/\+8801[0-9]{8}/g, () => {
    phoneCounter++;
    return `+8801${phoneCounter}`;
});

// Fix faker (999) 999-9999 numbers
content = content.replace(/\(\d{3}\)\s\d{3}-\d{4}/g, () => {
    phoneCounter++;
    return `+8801${phoneCounter}`;
});

console.log('Saving seed.sql...');
fs.writeFileSync(seedPath, content, 'utf8');

console.log('Done!');

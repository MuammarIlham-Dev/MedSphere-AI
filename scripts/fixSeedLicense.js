import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedPath = path.join(__dirname, '../supabase/seed.sql');

console.log('Reading seed.sql...');
let content = fs.readFileSync(seedPath, 'utf8');

console.log('Fixing BMDC license numbers to be unique...');
let licenseCounter = 100000;
content = content.replace(/BMDC-\d+/g, () => {
    licenseCounter++;
    return `BMDC-${licenseCounter}`;
});

console.log('Saving seed.sql...');
fs.writeFileSync(seedPath, content, 'utf8');

console.log('Done!');

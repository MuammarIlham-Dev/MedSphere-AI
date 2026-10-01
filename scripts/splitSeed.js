import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SEED_FILE = path.join(ROOT_DIR, 'supabase', 'seed.sql');

if (!fs.existsSync(SEED_FILE)) {
  console.error('seed.sql not found!');
  process.exit(1);
}

const content = fs.readFileSync(SEED_FILE, 'utf-8');
const lines = content.split('\n');

const MAX_LINES_PER_FILE = 2000; // Safe limit for browser pasting
let part = 1;
let currentBuffer = [];

for (let i = 0; i < lines.length; i++) {
  currentBuffer.push(lines[i]);
  if (currentBuffer.length >= MAX_LINES_PER_FILE || i === lines.length - 1) {
    const partPath = path.join(ROOT_DIR, 'supabase', `seed_part_${part}.sql`);
    fs.writeFileSync(partPath, currentBuffer.join('\n'));
    console.log(`Created ${partPath}`);
    part++;
    currentBuffer = [];
  }
}

console.log(`\nSuccessfully split seed.sql into ${part - 1} parts. You can now safely paste these into the SQL Editor one by one!`);

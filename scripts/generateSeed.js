import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'supabase', 'seed.sql');

// Configuration
const CITIES = ['Dhaka', 'Chittagong', 'Rajshahi', 'Sylhet', 'Khulna', 'Barisal', 'Rangpur', 'Mymensingh', 'Comilla', 'Gazipur'];
const HOSPITALS_PER_CITY_MIN = 12;
const HOSPITALS_PER_CITY_MAX = 25;
const DOCTORS_PER_HOSPITAL_MIN = 40;
const DOCTORS_PER_HOSPITAL_MAX = 120;
const BATCH_SIZE = 50;

const SPECIALTIES = [
  'Cardiology', 'Neurology', 'Dermatology', 'Orthopedics', 'Pediatrics',
  'Endocrinology & Diabetes', 'Gastroenterology', 'Pulmonology', 'Oncology',
  'Ophthalmology', 'ENT', 'Psychiatry', 'Urology', 'Nephrology', 'Rheumatology'
];

const CREDENTIALS_POOL = ['MBBS', 'FCPS', 'MD', 'FRCS', 'MS', 'MCPS', 'DGO', 'DLO'];

const BD_MALE_FIRST_NAMES = ['Arif', 'Kamrul', 'Tariq', 'Rakib', 'Sajjad', 'Mamun', 'Faisal', 'Imran', 'Hasan', 'Shafiq', 'Abdur', 'Aminul', 'Nazmul', 'Sharif', 'Jalal', 'Ashik', 'Tanvir', 'Mahmud', 'Rezaul', 'Faruk', 'Habib', 'Anisur', 'Jubayer', 'Sohail', 'Tawfiq', 'Zahid', 'Iqbal', 'Nasir', 'Shamim', 'Mehedi', 'Rashed', 'Rafi'];
const BD_FEMALE_FIRST_NAMES = ['Fatema', 'Ayesha', 'Nusrat', 'Sadia', 'Sonia', 'Nadia', 'Salma', 'Tasnim', 'Faria', 'Sumaiya', 'Tahmina', 'Shirin', 'Farhana', 'Tania', 'Afroza', 'Laila', 'Sharmeen', 'Moushumi', 'Ruma', 'Roxana', 'Samira', 'Sharmin', 'Tanzina', 'Khadija', 'Nazma', 'Zarin', 'Maliha'];
const BD_LAST_NAMES = ['Rahman', 'Islam', 'Chowdhury', 'Hossain', 'Ahmed', 'Ali', 'Uddin', 'Khan', 'Haque', 'Miah', 'Sikder', 'Sarker', 'Majumder', 'Talukder', 'Akter', 'Begum', 'Khatun', 'Hasan', 'Mia', 'Mondal'];
const BD_HOSPITAL_PREFIXES = ['Ibn Sina', 'Popular', 'Labaid', 'Square', 'Apollo', 'Evercare', 'United', 'Green Life', 'Anwer Khan Modern', 'BIRDEM', 'Enam', 'Al-Helal', 'Central', 'Comfort', 'Delta', 'Faridpur', 'Gazi', 'Holy Family', 'Islami Bank', 'Jalabad', 'Khawja Yunus Ali', 'Monno', 'Oasis', 'Padma', 'Samorita', 'Asgar Ali', 'BRB', 'Impulse', 'Kurmitola', 'Mugdha'];
const BD_HOSPITAL_TYPES = ['Diagnostic Center', 'General Hospital', 'Specialized Hospital', 'Medical College & Hospital', 'Clinic'];

// Use a fixed seed for reproducible data
faker.seed(12345);

// Ensure the directory exists
if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
}

// Clear the existing seed file
fs.writeFileSync(OUTPUT_FILE, '-- MedSphere AI Massive Seed Data\n-- Generated automatically via scripts/generateSeed.js\n\n');

function appendToFile(content) {
  fs.appendFileSync(OUTPUT_FILE, content + '\n');
}

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

console.log('Generating seed data...');

// Known bcrypt hash for 'password123'
const HASHED_PASSWORD = '$2a$10$wT.f.c..04hH4XyV9Y4D2OQ5Lg7wD6fC4t8J9e3Yk9E2M1a8l5U9.';

// Buffers for batch inserts
let usersBuffer = [];
let profilesBuffer = [];
let hospitalsBuffer = [];
let departmentsBuffer = [];
let doctorsBuffer = [];

function flushBuffers() {
  if (usersBuffer.length > 0) {
    appendToFile(`INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin) VALUES\n${usersBuffer.join(',\n')};`);
    usersBuffer = [];
  }
  if (profilesBuffer.length > 0) {
    appendToFile(`INSERT INTO public.profiles (id, role, full_name, phone, gender, avatar_url, digital_health_id, city, country, created_at, updated_at) VALUES\n${profilesBuffer.join(',\n')};`);
    profilesBuffer = [];
  }
  if (hospitalsBuffer.length > 0) {
    appendToFile(`INSERT INTO public.hospitals (id, owner_id, name, license_no, type, city, bed_capacity, verification) VALUES\n${hospitalsBuffer.join(',\n')};`);
    hospitalsBuffer = [];
  }
  if (departmentsBuffer.length > 0) {
    appendToFile(`INSERT INTO public.departments (id, hospital_id, name) VALUES\n${departmentsBuffer.join(',\n')};`);
    departmentsBuffer = [];
  }
  if (doctorsBuffer.length > 0) {
    appendToFile(`INSERT INTO public.doctors (id, profile_id, hospital_id, specialty, qualifications, experience_years, license_no, consultation_fee, bio, rating_avg, rating_count, verification) VALUES\n${doctorsBuffer.join(',\n')};`);
    doctorsBuffer = [];
  }
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1. Generate Hospitals
let totalDoctorsGenerated = 0;
let totalHospitalsGenerated = 0;

for (const city of CITIES) {
  const hospitalCount = randomRange(HOSPITALS_PER_CITY_MIN, HOSPITALS_PER_CITY_MAX);
  
  for (let h = 0; h < hospitalCount; h++) {
    totalHospitalsGenerated++;
    const hospitalId = crypto.randomUUID();
    
    // Create a dummy admin profile for the hospital owner
    const adminId = crypto.randomUUID();
    const adminEmail = `admin.hosp${totalHospitalsGenerated}@medsphere.test.com`;
    
    const adminFullName = `Admin ${randomItem(BD_MALE_FIRST_NAMES)} ${randomItem(BD_LAST_NAMES)}`;
    const adminPhone = `+8802${String(totalHospitalsGenerated).padStart(9, '0')}`;
    usersBuffer.push(`('${adminId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${adminEmail}', '${HASHED_PASSWORD}', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false)`);
    profilesBuffer.push(`('${adminId}', 'hospital', '${escapeSql(adminFullName)}', '${adminPhone}', null, null, 'H-ADM-${totalHospitalsGenerated}', '${city}', 'BD', now(), now())`);

    const hospitalName = `${randomItem(BD_HOSPITAL_PREFIXES)} ${randomItem(BD_HOSPITAL_TYPES)} ${city}`;
    const licenseNo = `LIC-HOSP-${faker.string.alphanumeric(8).toUpperCase()}`;
    
    hospitalsBuffer.push(`('${hospitalId}', '${adminId}', '${escapeSql(hospitalName)}', '${licenseNo}', 'general', '${city}', ${randomRange(50, 500)}, 'verified')`);

    // Generate Departments for this hospital
    const hospitalDepts = [...SPECIALTIES].sort(() => 0.5 - Math.random()).slice(0, randomRange(8, 14));
    for (const deptName of hospitalDepts) {
      departmentsBuffer.push(`('${crypto.randomUUID()}', '${hospitalId}', '${escapeSql(deptName)}')`);
    }

    // Generate Doctors for this hospital
    const doctorCount = randomRange(DOCTORS_PER_HOSPITAL_MIN, DOCTORS_PER_HOSPITAL_MAX);
    for (let d = 0; d < doctorCount; d++) {
      totalDoctorsGenerated++;
      
      const doctorId = crypto.randomUUID();
      const profileId = crypto.randomUUID();
      
      const gender = randomItem(['male', 'female']);
      const firstName = gender === 'male' ? randomItem(BD_MALE_FIRST_NAMES) : randomItem(BD_FEMALE_FIRST_NAMES);
      const lastName = randomItem(BD_LAST_NAMES);
      const expYears = randomRange(3, 35);
      
      let title = 'Dr.';
      if (expYears > 25) {
        title = 'Prof. Dr.';
      } else if (expYears > 15) {
        title = 'Assoc. Prof. Dr.';
      } else if (expYears > 8) {
        title = 'Asst. Prof. Dr.';
      }

      const fullName = `${title} ${firstName} ${lastName}`;
      const email = `doc${totalDoctorsGenerated}.${firstName.toLowerCase()}@medsphere.test.com`;
      const phone = `+8801${String(totalDoctorsGenerated).padStart(9, '0')}`;
      const digitalHealthId = `DH-DOC-${faker.string.alphanumeric(10).toUpperCase()}`;
      // Use different avatar formats based on gender
      const avatarUrl = gender === 'male' ? '/avatars/doctor_male.jpg' : '/avatars/doctor_female.jpg';

      // auth.users
      usersBuffer.push(`('${profileId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${email}', '${HASHED_PASSWORD}', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false)`);
      
      // public.profiles
      profilesBuffer.push(`('${profileId}', 'doctor', '${escapeSql(fullName)}', '${phone}', '${gender}', '${avatarUrl}', '${digitalHealthId}', '${city}', 'BD', now(), now())`);

      // public.doctors
      const specialty = randomItem(hospitalDepts);
      
      // Qualifications
      const numCreds = randomRange(2, 4);
      const selectedCreds = [...CREDENTIALS_POOL].sort(() => 0.5 - Math.random()).slice(0, numCreds);
      const qualificationsArray = `{${selectedCreds.map(c => `"${c}"`).join(',')}}`;
      
      const docLicense = `BMDC-${String(totalDoctorsGenerated).padStart(6, '0')}`;
      const consultationFee = randomItem([500, 600, 800, 1000, 1200, 1500]);
      const bio = faker.lorem.words(25);
      const ratingAvg = (Math.random() * (5 - 3.5) + 3.5).toFixed(1);
      const ratingCount = randomRange(10, 500);

      doctorsBuffer.push(`('${doctorId}', '${profileId}', '${hospitalId}', '${escapeSql(specialty)}', '${qualificationsArray}', ${expYears}, '${docLicense}', ${consultationFee}, '${escapeSql(bio)}', ${ratingAvg}, ${ratingCount}, 'verified')`);

      // Flush periodically to manage memory
      if (usersBuffer.length >= BATCH_SIZE) {
        flushBuffers();
      }
    }
  }
}

// Final flush
flushBuffers();

console.log(`Successfully generated seed data for ${totalHospitalsGenerated} hospitals and ${totalDoctorsGenerated} doctors!`);
console.log(`Saved to ${OUTPUT_FILE}`);

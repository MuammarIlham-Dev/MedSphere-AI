// ============================================================================
// MedSphere AI — Popular Diagnostic Centre Ltd. (Rajshahi) Doctor Registry
// Source: MedSphere_AI_Popular_Diagnostic_Rajshahi_Doctor_Registry.pdf
// Crawled/researched: 13 Aug 2026 | Registry V1 — 76 profiles
// ============================================================================

export interface Doctor {
  id: string;
  number: string;
  name: string;
  designation: 'Prof.' | 'Assoc. Prof.' | 'Asst. Prof.' | 'Dr.';
  avatar_url?: string;
  specialty: string;
  department: DepartmentKey;
  qualifications: string;
  experienceYears: number | null;
  hospital: string;
  address: string;
  phone: string;
}

export type DepartmentKey =
  | 'Cardiology'
  | 'Dermatology'
  | 'Endocrinology & Diabetes'
  | 'Gastroenterology & Hepatology'
  | 'Gynecology & Obstetrics'
  | 'Hematology'
  | 'Nephrology'
  | 'Neurology & Neuromedicine'
  | 'Neurosurgery'
  | 'Oncology'
  | 'Orthopedics'
  | 'Otolaryngology (ENT)'
  | 'Pediatrics & Neonatology'
  | 'Physical Medicine'
  | 'Respiratory Medicine'
  | 'Surgery'
  | 'Urology';

export const DEPARTMENT_COLORS: Record<DepartmentKey, { bg: string; text: string; dot: string }> = {
  'Cardiology':                     { bg: 'bg-rose-50 dark:bg-rose-950',     text: 'text-rose-700 dark:text-rose-300',     dot: 'bg-rose-500' },
  'Dermatology':                    { bg: 'bg-purple-50 dark:bg-purple-950',  text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  'Endocrinology & Diabetes':       { bg: 'bg-green-50 dark:bg-green-950',    text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500' },
  'Gastroenterology & Hepatology':  { bg: 'bg-amber-50 dark:bg-amber-950',    text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500' },
  'Gynecology & Obstetrics':        { bg: 'bg-pink-50 dark:bg-pink-950',      text: 'text-pink-700 dark:text-pink-300',     dot: 'bg-pink-500' },
  'Hematology':                     { bg: 'bg-red-50 dark:bg-red-950',        text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500' },
  'Nephrology':                     { bg: 'bg-cyan-50 dark:bg-cyan-950',      text: 'text-cyan-700 dark:text-cyan-300',     dot: 'bg-cyan-500' },
  'Neurology & Neuromedicine':      { bg: 'bg-violet-50 dark:bg-violet-950',  text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  'Neurosurgery':                   { bg: 'bg-indigo-50 dark:bg-indigo-950',  text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  'Oncology':                       { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950',text: 'text-fuchsia-700 dark:text-fuchsia-300',dot: 'bg-fuchsia-500' },
  'Orthopedics':                    { bg: 'bg-orange-50 dark:bg-orange-950',  text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  'Otolaryngology (ENT)':           { bg: 'bg-teal-50 dark:bg-teal-950',      text: 'text-teal-700 dark:text-teal-300',     dot: 'bg-teal-500' },
  'Pediatrics & Neonatology':       { bg: 'bg-sky-50 dark:bg-sky-950',        text: 'text-sky-700 dark:text-sky-300',       dot: 'bg-sky-500' },
  'Physical Medicine':              { bg: 'bg-lime-50 dark:bg-lime-950',      text: 'text-lime-700 dark:text-lime-300',     dot: 'bg-lime-500' },
  'Respiratory Medicine':           { bg: 'bg-blue-50 dark:bg-blue-950',      text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500' },
  'Surgery':                        { bg: 'bg-slate-100 dark:bg-slate-800',   text: 'text-slate-700 dark:text-slate-300',   dot: 'bg-slate-500' },
  'Urology':                        { bg: 'bg-emerald-50 dark:bg-emerald-950',text: 'text-emerald-700 dark:text-emerald-300',dot: 'bg-emerald-500' },
};

export const HOSPITAL_INFO = {
  name: 'Popular Diagnostic Centre Ltd.',
  branch: 'Rajshahi',
  address: 'House #474, Chowdhury Tower, Laxmipur, Rajshahi, Bangladesh',
  phone: '+8809666787811',
  totalDoctors: 76,
  totalDepartments: 17,
  type: 'Diagnostic & Specialty Centre',
};

export const DEPARTMENTS: DepartmentKey[] = [
  'Cardiology',
  'Dermatology',
  'Endocrinology & Diabetes',
  'Gastroenterology & Hepatology',
  'Gynecology & Obstetrics',
  'Hematology',
  'Nephrology',
  'Neurology & Neuromedicine',
  'Neurosurgery',
  'Oncology',
  'Orthopedics',
  'Otolaryngology (ENT)',
  'Pediatrics & Neonatology',
  'Physical Medicine',
  'Respiratory Medicine',
  'Surgery',
  'Urology',
];

const H = HOSPITAL_INFO.address;
const P = HOSPITAL_INFO.phone;
const HN = 'Popular Diagnostic Centre Ltd. | Rajshahi';

export const DOCTORS: Doctor[] = [
  // ── CARDIOLOGY (5) ────────────────────────────────────────────────────────
  { id: 'd001', number: '001', name: 'Md. Rais Uddin Mondol',        designation: 'Assoc. Prof.', specialty: 'Cardiologist',                department: 'Cardiology',                   qualifications: 'MBBS; FCPS (Medicine); MD (Cardiology)',                                                                                   experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd002', number: '002', name: 'Molla Md. Iftekhar Hossain',   designation: 'Asst. Prof.',  specialty: 'Cardiologist',                department: 'Cardiology',                   qualifications: 'MBBS (DMC); MD (Cardiology)',                                                                                              experienceYears: 17, hospital: HN, address: H, phone: P },
  { id: 'd003', number: '003', name: 'Md. Saiful Islam',             designation: 'Dr.',          specialty: 'Cardiologist',                department: 'Cardiology',                   qualifications: 'MBBS; BCS (Health); MD (Cardiology)',                                                                                      experienceYears: 16, hospital: HN, address: H, phone: P },
  { id: 'd004', number: '004', name: 'Rajesh Kumar Ghosh',           designation: 'Dr.',          specialty: 'Cardiologist',                department: 'Cardiology',                   qualifications: 'MBBS; BCS (Health); MD (Cardiology)',                                                                                      experienceYears: 18, hospital: HN, address: H, phone: P },
  { id: 'd005', number: '005', name: 'Rakibul Hasan Rashed',         designation: 'Dr.',          specialty: 'Cardiologist',                department: 'Cardiology',                   qualifications: 'MBBS; BCS (Health); MD (Cardiology)',                                                                                      experienceYears: 20, hospital: HN, address: H, phone: P },

  // ── DERMATOLOGY (1) ───────────────────────────────────────────────────────
  { id: 'd006', number: '006', name: 'Md. Moazzem Hossain',          designation: 'Prof.',        specialty: 'Dermatologist',               department: 'Dermatology',                  qualifications: 'MBBS; DDV (DU); Fellow (WHO); FRSH (UK)',                                                                                  experienceYears: 26, hospital: HN, address: H, phone: P },

  // ── ENDOCRINOLOGY & DIABETES (3) ─────────────────────────────────────────
  { id: 'd007', number: '007', name: 'Md. Motiur Rahman',            designation: 'Dr.',          specialty: 'Endocrine Medicine / Diabetes',department: 'Endocrinology & Diabetes',     qualifications: 'MBBS (Raj); FCPS (Medicine); DEM (BIRDEM)',                                                                               experienceYears: null, hospital: HN, address: H, phone: P },
  { id: 'd008', number: '008', name: 'D. A. Rashid',                 designation: 'Assoc. Prof.', specialty: 'Endocrinologist',             department: 'Endocrinology & Diabetes',     qualifications: 'MBBS; MCPS; MD (Endocrinology)',                                                                                           experienceYears: 28, hospital: HN, address: H, phone: P },
  { id: 'd009', number: '009', name: 'Md. Masud Un Nabi',            designation: 'Asst. Prof.',  specialty: 'Endocrinologist',             department: 'Endocrinology & Diabetes',     qualifications: 'MBBS; BCS (Health); MD (Endocrinology)',                                                                                   experienceYears: 22, hospital: HN, address: H, phone: P },

  // ── GASTROENTEROLOGY & HEPATOLOGY (7) ────────────────────────────────────
  { id: 'd010', number: '010', name: 'Md. Abdul Mumit Sarkar',       designation: 'Asst. Prof.',  specialty: 'Gastroenterologist',          department: 'Gastroenterology & Hepatology',qualifications: 'MBBS; BCS (Health); MD (Gastroenterology); CCD (BIRDEM)',                                                                   experienceYears: 24, hospital: HN, address: H, phone: P },
  { id: 'd011', number: '011', name: 'Md. Khalequzzaman Sarker',     designation: 'Asst. Prof.',  specialty: 'Gastroenterologist',          department: 'Gastroenterology & Hepatology',qualifications: 'MBBS; BCS (Health); FCPS; MD (Gastroenterology); MRCP (UK); MACP (USA); MACG (USA); PhD',                                  experienceYears: 23, hospital: HN, address: H, phone: P },
  { id: 'd012', number: '012', name: 'Md. Mahafuzzaman',             designation: 'Asst. Prof.',  specialty: 'Gastroenterologist',          department: 'Gastroenterology & Hepatology',qualifications: 'MBBS; MD (Gastroenterology)',                                                                                              experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd013', number: '013', name: 'Md. Shafiqul Islam',           designation: 'Asst. Prof.',  specialty: 'Gastroenterologist',          department: 'Gastroenterology & Hepatology',qualifications: 'MBBS; MD (Gastroenterology)',                                                                                              experienceYears: 24, hospital: HN, address: H, phone: P },
  { id: 'd014', number: '014', name: 'Md. Mobussirul Ferdous',       designation: 'Dr.',          specialty: 'Gastroenterologist',          department: 'Gastroenterology & Hepatology',qualifications: 'MBBS; BCS; MD; MACP',                                                                                                      experienceYears: 10, hospital: HN, address: H, phone: P },
  { id: 'd028', number: '028', name: 'Mohd. Harun Or Rashid',        designation: 'Assoc. Prof.', specialty: 'Hepatologist',                department: 'Gastroenterology & Hepatology',qualifications: 'MBBS; MCPS (Medicine); MD (Hepatology); PhD; FACP (USA)',                                                                    experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd029', number: '029', name: 'Md. Rofiqul Islam',            designation: 'Asst. Prof.',  specialty: 'Hepatologist',                department: 'Gastroenterology & Hepatology',qualifications: 'MBBS; BCS (Health); MD (Hepatology)',                                                                                      experienceYears: 22, hospital: HN, address: H, phone: P },
  { id: 'd030', number: '030', name: 'Abdullah Al Mukit',            designation: 'Dr.',          specialty: 'Hepatologist',                department: 'Gastroenterology & Hepatology',qualifications: 'MBBS (DMC); BCS (Health); MD (Hepatology); MACP (USA); MRCPS (Glasg)',                                                       experienceYears: 17, hospital: HN, address: H, phone: P },

  // ── GYNECOLOGY & OBSTETRICS (10) ─────────────────────────────────────────
  { id: 'd016', number: '016', name: 'Salma Arjumand Banu',          designation: 'Asst. Prof.',  specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; DGO; MCPS (OBGYN)',                                                                                                  experienceYears: 22, hospital: HN, address: H, phone: P },
  { id: 'd017', number: '017', name: 'Farzana Naznin Ripa',          designation: 'Dr.',          specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; FCPS (OBGYN)',                                                                                                       experienceYears: 17, hospital: HN, address: H, phone: P },
  { id: 'd018', number: '018', name: 'Monowara Begum',               designation: 'Dr.',          specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; DGO; FCPS (OBGYN); FIGO',                                                                                           experienceYears: 26, hospital: HN, address: H, phone: P },
  { id: 'd019', number: '019', name: 'Mst. Marzina Khatun Mukti',    designation: 'Dr.',          specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; BCS (Health); FCPS (Gynae & Obs)',                                                                                   experienceYears: 19, hospital: HN, address: H, phone: P },
  { id: 'd020', number: '020', name: 'Nishat Anam Borna',            designation: 'Dr.',          specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; BCS (Health); MCPS; FCPS (OBGYN)',                                                                                   experienceYears: 14, hospital: HN, address: H, phone: P },
  { id: 'd021', number: '021', name: 'Rakhi Debi',                   designation: 'Dr.',          specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS (DMC); FCPS (OBGYN)',                                                                                                 experienceYears: 18, hospital: HN, address: H, phone: P },
  { id: 'd022', number: '022', name: 'Somerose Pervin Rinku',        designation: 'Dr.',          specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS (RMC); BCS (Health); DGO (BSMMU); FCPS (OBGYN)',                                                                     experienceYears: 19, hospital: HN, address: H, phone: P },
  { id: 'd023', number: '023', name: 'Hasina Akhter',                designation: 'Prof.',        specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; FCPS (OBGYN)',                                                                                                       experienceYears: 32, hospital: HN, address: H, phone: P },
  { id: 'd024', number: '024', name: 'Shahela Jesmin Shilpi',        designation: 'Prof.',        specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; DGO; MCPS; FCPS (OBGYN)',                                                                                           experienceYears: 31, hospital: HN, address: H, phone: P },
  { id: 'd025', number: '025', name: 'Shipra Chaudhury',             designation: 'Prof.',        specialty: 'Gynecologist & Obstetrician', department: 'Gynecology & Obstetrics',      qualifications: 'MBBS; FCPS (OBGYN)',                                                                                                       experienceYears: 33, hospital: HN, address: H, phone: P },

  // ── HEMATOLOGY (2) ────────────────────────────────────────────────────────
  { id: 'd026', number: '026', name: 'Morsed Zaman Miah',            designation: 'Asst. Prof.',  specialty: 'Hematologist',                department: 'Hematology',                   qualifications: 'MBBS (RMC); MCPS (Pathology); FCPS (Hematology)',                                                                         experienceYears: 23, hospital: HN, address: H, phone: P },
  { id: 'd027', number: '027', name: 'Md. Maruf Al Hasan',           designation: 'Dr.',          specialty: 'Hematologist',                department: 'Hematology',                   qualifications: 'MBBS (RMC); BCS (Health); FCPS (Hematology); CCD (BIRDEM); MACP (USA)',                                                    experienceYears: 17, hospital: HN, address: H, phone: P },

  // ── NEPHROLOGY (2) ────────────────────────────────────────────────────────
  { id: 'd032', number: '032', name: 'Md. Siddiqur Rahman Sohel',    designation: 'Asst. Prof.',  specialty: 'Nephrologist',                department: 'Nephrology',                   qualifications: 'MBBS; BCS (Health); MD (Nephrology)',                                                                                      experienceYears: 23, hospital: HN, address: H, phone: P },
  { id: 'd033', number: '033', name: 'A.K.M. Monoarul Islam',        designation: 'Prof.',        specialty: 'Nephrologist',                department: 'Nephrology',                   qualifications: 'MBBS; DCM; MD (Nephrology); FACP (USA)',                                                                                   experienceYears: 30, hospital: HN, address: H, phone: P },

  // ── NEUROLOGY & NEUROMEDICINE (8) ─────────────────────────────────────────
  { id: 'd034', number: '034', name: 'Md. Pervez Amin',              designation: 'Assoc. Prof.', specialty: 'Neurologist',                 department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; MD (Neurology)',                                                                                                     experienceYears: 27, hospital: HN, address: H, phone: P },
  { id: 'd035', number: '035', name: 'Mukul Kumar Sarkar',           designation: 'Asst. Prof.',  specialty: 'Neurologist',                 department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; BCS (Health); MD (Neurology)',                                                                                       experienceYears: 24, hospital: HN, address: H, phone: P },
  { id: 'd036', number: '036', name: 'Md. Kafil Uddin',              designation: 'Prof.',        specialty: 'Neurologist',                 department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; MCPS (Medicine); MD (Neurology)',                                                                                    experienceYears: 31, hospital: HN, address: H, phone: P },
  { id: 'd037', number: '037', name: 'Md. Munzur Elahi',             designation: 'Asst. Prof.',  specialty: 'Neuromedicine Specialist',    department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; MD (Neurology)',                                                                                                     experienceYears: 27, hospital: HN, address: H, phone: P },
  { id: 'd038', number: '038', name: 'ABM Mahbubul Haque Limon',     designation: 'Dr.',          specialty: 'Neuromedicine Specialist',    department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; BCS (Health); MD (Neuromedicine)',                                                                                   experienceYears: 16, hospital: HN, address: H, phone: P },
  { id: 'd039', number: '039', name: 'M. Ahmed Ali',                 designation: 'Dr.',          specialty: 'Neuromedicine Specialist',    department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; MD (Neuromedicine)',                                                                                                 experienceYears: 29, hospital: HN, address: H, phone: P },
  { id: 'd040', number: '040', name: 'Muhtarima Tabassum Nipu',      designation: 'Dr.',          specialty: 'Neuromedicine Specialist',    department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; BCS (Health); MD (Neuromedicine)',                                                                                   experienceYears: 18, hospital: HN, address: H, phone: P },
  { id: 'd041', number: '041', name: 'Pijush Kumar Kundu',           designation: 'Prof.',        specialty: 'Neuromedicine Specialist',    department: 'Neurology & Neuromedicine',    qualifications: 'MBBS; MD (Neuromedicine)',                                                                                                 experienceYears: 28, hospital: HN, address: H, phone: P },

  // ── NEUROSURGERY (3) ──────────────────────────────────────────────────────
  { id: 'd042', number: '042', name: 'Md. A.F.M. Momtazul Haque',    designation: 'Assoc. Prof.', specialty: 'Neurosurgeon',                department: 'Neurosurgery',                 qualifications: 'MBBS (DMC); MS (Neurosurgery); BCS (Health)',                                                                              experienceYears: 24, hospital: HN, address: H, phone: P },
  { id: 'd043', number: '043', name: 'Md. Monzurul Haque',           designation: 'Asst. Prof.',  specialty: 'Neurosurgeon',                department: 'Neurosurgery',                 qualifications: 'MBBS; BCS (Health); FCPS (Neurosurgery); MS (Neurosurgery)',                                                              experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd044', number: '044', name: 'Sheikh Muhammad Ekramullah',    designation: 'Prof.',        specialty: 'Neurosurgeon',                department: 'Neurosurgery',                 qualifications: 'MBBS; PhD (Neurosurgery)',                                                                                                  experienceYears: 28, hospital: HN, address: H, phone: P },

  // ── ONCOLOGY (2) ──────────────────────────────────────────────────────────
  { id: 'd045', number: '045', name: 'Julekha Khatun',               designation: 'Dr.',          specialty: 'Oncologist',                  department: 'Oncology',                     qualifications: 'MBBS; FCPS (Radiotherapy)',                                                                                                 experienceYears: 19, hospital: HN, address: H, phone: P },
  { id: 'd046', number: '046', name: 'Mousumi Marjiara',              designation: 'Dr.',          specialty: 'Oncologist',                  department: 'Oncology',                     qualifications: 'MBBS (DMC); BCS (Health); MD (Oncology)',                                                                                  experienceYears: 28, hospital: HN, address: H, phone: P },

  // ── ORTHOPEDICS (5) ───────────────────────────────────────────────────────
  { id: 'd047', number: '047', name: 'Md. Monwar Tariq Sabu',        designation: 'Asst. Prof.',  specialty: 'Orthopedic Surgeon',          department: 'Orthopedics',                  qualifications: 'MBBS; BCS (Health); D-ORTHO; MS (ORTHO)',                                                                                 experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd048', number: '048', name: 'Subrata Kumar Pramanik',       designation: 'Asst. Prof.',  specialty: 'Orthopedic Surgeon',          department: 'Orthopedics',                  qualifications: 'MBBS; MS (Ortho Surgery)',                                                                                                 experienceYears: 23, hospital: HN, address: H, phone: P },
  { id: 'd049', number: '049', name: 'Md. Habibul Hasan',            designation: 'Dr.',          specialty: 'Orthopedic Surgeon',          department: 'Orthopedics',                  qualifications: 'MBBS; BCS (Health); MCPS (Surgery); FCPS (Ortho Surgery)',                                                                experienceYears: 22, hospital: HN, address: H, phone: P },
  { id: 'd050', number: '050', name: 'Md. Qumruzzaman Parvez',       designation: 'Dr.',          specialty: 'Orthopedic Surgeon',          department: 'Orthopedics',                  qualifications: 'MBBS; BCS (Health); MS (ORTHO)',                                                                                           experienceYears: 20, hospital: HN, address: H, phone: P },
  { id: 'd051', number: '051', name: 'Debashish Roy',                designation: 'Asst. Prof.',  specialty: 'Orthopedist',                 department: 'Orthopedics',                  qualifications: 'MBBS; D-ORTHO; MS (ORTHO)',                                                                                                experienceYears: 24, hospital: HN, address: H, phone: P },

  // ── OTOLARYNGOLOGY / ENT (6) ─────────────────────────────────────────────
  { id: 'd052', number: '052', name: 'Subrata Ghosh',                designation: 'Assoc. Prof.', specialty: 'ENT Specialist',              department: 'Otolaryngology (ENT)',          qualifications: 'MBBS; BCS (Health); FCPS (ENT)',                                                                                           experienceYears: 26, hospital: HN, address: H, phone: P },
  { id: 'd053', number: '053', name: 'Ashik Iqbal',                  designation: 'Asst. Prof.',  specialty: 'ENT Specialist',              department: 'Otolaryngology (ENT)',          qualifications: 'MBBS (Dhaka); BCS (Health); FCPS (ENT)',                                                                                   experienceYears: 24, hospital: HN, address: H, phone: P },
  { id: 'd054', number: '054', name: 'Md. Abdullah Al-Zobair',       designation: 'Asst. Prof.',  specialty: 'ENT Specialist',              department: 'Otolaryngology (ENT)',          qualifications: 'MBBS; FCPS (ENT)',                                                                                                         experienceYears: 22, hospital: HN, address: H, phone: P },
  { id: 'd055', number: '055', name: 'AAM Nafiz',                    designation: 'Dr.',          specialty: 'ENT Specialist',              department: 'Otolaryngology (ENT)',          qualifications: 'MBBS; BCS (Health); FCPS (ENT); MS (ENT)',                                                                                 experienceYears: 16, hospital: HN, address: H, phone: P },
  { id: 'd056', number: '056', name: 'Milon Kumar Chowdhury',        designation: 'Dr.',          specialty: 'ENT Specialist',              department: 'Otolaryngology (ENT)',          qualifications: 'MBBS; FCPS (ENT)',                                                                                                         experienceYears: 18, hospital: HN, address: H, phone: P },
  { id: 'd057', number: '057', name: 'Muhammad Mahmudul Haque Anik', designation: 'Dr.',          specialty: 'ENT Specialist',              department: 'Otolaryngology (ENT)',          qualifications: 'MBBS; BCS (Health); FCPS (ENT)',                                                                                           experienceYears: 20, hospital: HN, address: H, phone: P },

  // ── PEDIATRICS & NEONATOLOGY (5) ─────────────────────────────────────────
  { id: 'd058', number: '058', name: 'Md. Nowshad Ali',              designation: 'Dr.',          specialty: 'Pediatric Surgeon',           department: 'Pediatrics & Neonatology',     qualifications: 'MBBS; FCPS (Surgery); MS (Pediatric Surgery)',                                                                            experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd059', number: '059', name: 'Khan Ishrat Jahan',            designation: 'Asst. Prof.',  specialty: 'Pediatrician & Neonatologist',department: 'Pediatrics & Neonatology',     qualifications: 'MBBS; MD (CHILD)',                                                                                                         experienceYears: 22, hospital: HN, address: H, phone: P },
  { id: 'd060', number: '060', name: 'Md. Manirul Haque Tarafdar',   designation: 'Dr.',          specialty: 'Pediatrician & Neonatologist',department: 'Pediatrics & Neonatology',     qualifications: 'MBBS; BCS (Health); MD (CHILD)',                                                                                           experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd061', number: '061', name: 'Md. Belal Uddin',              designation: 'Prof.',        specialty: 'Pediatrician & Neonatologist',department: 'Pediatrics & Neonatology',     qualifications: 'MBBS; DCH (BSMMU); FCPS (Pediatrics)',                                                                                    experienceYears: 29, hospital: HN, address: H, phone: P },
  { id: 'd062', number: '062', name: 'Md. Sanaul Haque',             designation: 'Prof.',        specialty: 'Pediatrician & Neonatologist',department: 'Pediatrics & Neonatology',     qualifications: 'MBBS; FCPS (CHILD)',                                                                                                       experienceYears: 30, hospital: HN, address: H, phone: P },

  // ── PHYSICAL MEDICINE (2) ─────────────────────────────────────────────────
  { id: 'd063', number: '063', name: 'Md. Abdus Sabur',              designation: 'Dr.',          specialty: 'Physical Medicine Specialist', department: 'Physical Medicine',            qualifications: 'MBBS; BCS (Health); FCPS (Physical Medicine)',                                                                             experienceYears: 18, hospital: HN, address: H, phone: P },
  { id: 'd064', number: '064', name: 'Suzon Al Hasan',               designation: 'Prof.',        specialty: 'Physical Medicine Specialist', department: 'Physical Medicine',            qualifications: 'MBBS; FCPS (Physical Medicine)',                                                                                           experienceYears: 28, hospital: HN, address: H, phone: P },

  // ── RESPIRATORY MEDICINE (6) ──────────────────────────────────────────────
  { id: 'd065', number: '065', name: 'Md. Masudur Rahman',           designation: 'Asst. Prof.',  specialty: 'Respiratory Specialist',      department: 'Respiratory Medicine',         qualifications: 'MBBS; BCS (Health); MD (Chest Diseases)',                                                                                  experienceYears: 26, hospital: HN, address: H, phone: P },
  { id: 'd066', number: '066', name: 'Rezaul Islam',                 designation: 'Asst. Prof.',  specialty: 'Respiratory Specialist',      department: 'Respiratory Medicine',         qualifications: 'MBBS (DMC); FCPS (Medicine); MD (CHEST)',                                                                                  experienceYears: 24, hospital: HN, address: H, phone: P },
  { id: 'd067', number: '067', name: 'Chitta Ranjan Paul',           designation: 'Dr.',          specialty: 'Respiratory Specialist',      department: 'Respiratory Medicine',         qualifications: 'MBBS; BCS (Health); MD (Chest Diseases); MACP (USA)',                                                                     experienceYears: 8,  hospital: HN, address: H, phone: P },
  { id: 'd068', number: '068', name: 'Mohammad Zannatul Rayhan',     designation: 'Dr.',          specialty: 'Respiratory Specialist',      department: 'Respiratory Medicine',         qualifications: 'MBBS; MD (CHEST)',                                                                                                         experienceYears: 19, hospital: HN, address: H, phone: P },
  { id: 'd069', number: '069', name: 'Shish Mohammad Sarkar',        designation: 'Dr.',          specialty: 'Respiratory Specialist',      department: 'Respiratory Medicine',         qualifications: 'MBBS; BCS (Health); FCPS (Medicine); MD (Chest Diseases)',                                                                experienceYears: 25, hospital: HN, address: H, phone: P },
  { id: 'd070', number: '070', name: 'Samir Majumder',               designation: 'Prof.',        specialty: 'Respiratory Specialist',      department: 'Respiratory Medicine',         qualifications: 'MBBS; MD (CHEST)',                                                                                                         experienceYears: 29, hospital: HN, address: H, phone: P },

  // ── SURGERY (2) ───────────────────────────────────────────────────────────
  { id: 'd071', number: '071', name: 'Md. Ariful Alam Suman',        designation: 'Assoc. Prof.', specialty: 'Surgeon',                     department: 'Surgery',                      qualifications: 'MBBS; FCPS (Surgery); MS (Colorectal Surgery)',                                                                            experienceYears: 26, hospital: HN, address: H, phone: P },
  { id: 'd072', number: '072', name: 'Rupsha Nure Laila',            designation: 'Asst. Prof.',  specialty: 'Surgeon',                     department: 'Surgery',                      qualifications: 'MBBS; FCPS (Surgery); MS (Surgery)',                                                                                       experienceYears: 16, hospital: HN, address: H, phone: P },

  // ── UROLOGY (4) ───────────────────────────────────────────────────────────
  { id: 'd073', number: '073', name: 'Md. Mashiur Arefin Rubel',     designation: 'Asst. Prof.',  specialty: 'Urologist',                   department: 'Urology',                      qualifications: 'MBBS; MS (Urology); FCPS (Surgery); MRCS (Edin, UK)',                                                                     experienceYears: 20, hospital: HN, address: H, phone: P },
  { id: 'd074', number: '074', name: 'Md. Tafiqul Islam Taufiq',     designation: 'Asst. Prof.',  specialty: 'Urologist',                   department: 'Urology',                      qualifications: 'MBBS; BCS (Health); FCPS (Surgery); MS (Urology)',                                                                         experienceYears: 23, hospital: HN, address: H, phone: P },
  { id: 'd075', number: '075', name: 'S.M. Golam Moula',             designation: 'Dr.',          specialty: 'Urologist',                   department: 'Urology',                      qualifications: 'MBBS; BCS (Health); FCPS (Surgery); MS (Urology)',                                                                         experienceYears: 19, hospital: HN, address: H, phone: P },
  { id: 'd076', number: '076', name: 'Md. Abul Kashem Sarker',       designation: 'Prof.',        specialty: 'Urologist',                   department: 'Urology',                      qualifications: 'MBBS; MS (Urology); PhD (Urology)',                                                                                        experienceYears: 32, hospital: HN, address: H, phone: P },
];

/** Returns uppercase initials (max 2 chars) from a doctor's full name */
export function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

/** Count doctors per department */
export function getDepartmentCounts(): Record<DepartmentKey, number> {
  const counts = {} as Record<DepartmentKey, number>;
  for (const d of DEPARTMENTS) counts[d] = 0;
  for (const doc of DOCTORS) {
    const prev = counts[doc.department];
    counts[doc.department] = prev + 1;
  }
  return counts;
}

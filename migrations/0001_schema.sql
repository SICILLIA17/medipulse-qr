-- MediPulse QR - D1 Schema Migration

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  qr_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  blood_type TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  organ_donor INTEGER DEFAULT 0,
  dnr_status INTEGER DEFAULT 0,
  emergency_summary TEXT,
  avatar_url TEXT,
  primary_physician TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  type TEXT,
  date TEXT,
  author TEXT,
  content TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  date TEXT,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  heart_rate INTEGER,
  weight_kg REAL,
  temperature REAL,
  oxygen_sat INTEGER,
  blood_glucose REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS allergies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  allergen TEXT,
  reaction TEXT,
  severity TEXT,
  diagnosed TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  name TEXT,
  dose TEXT,
  frequency TEXT,
  route TEXT,
  prescriber TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',
  indication TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medication_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id TEXT NOT NULL,
  date TEXT,
  change_desc TEXT,
  reason TEXT,
  changed_by TEXT,
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  action TEXT,
  user TEXT,
  details TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scanned_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  scan_date TEXT,
  scanned_by TEXT,
  location TEXT,
  records TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

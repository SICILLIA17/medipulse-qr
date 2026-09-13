-- MediPulse QR Relational Database Schema
-- Uses SQLite 3 (node:sqlite)

CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    qr_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob TEXT NOT NULL,
    gender TEXT NOT NULL,
    blood_type TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    organ_donor INTEGER DEFAULT 0,
    dnr_status INTEGER DEFAULT 0,
    emergency_summary TEXT,
    avatar_url TEXT,
    primary_physician TEXT,
    insurance_provider TEXT,
    insurance_policy_no TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS allergies (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    allergen TEXT NOT NULL,
    reaction TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Mild', 'Moderate', 'Severe', 'Life-Threatening')),
    category TEXT DEFAULT 'Drug', -- Drug, Food, Environmental, Biological, Material
    verification_status TEXT DEFAULT 'Confirmed', -- Confirmed, Suspected, Patient-Reported
    diagnosed_date TEXT,
    notes TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    generic_name TEXT,
    dosage TEXT NOT NULL,
    form TEXT NOT NULL, -- Tablet, Capsule, Inhaler, Injection, Liquid
    frequency TEXT NOT NULL, -- e.g. "Twice daily with meals"
    time_of_day TEXT, -- "Morning, Evening"
    purpose TEXT, -- Indication e.g. "Blood Pressure Control"
    prescribing_doctor TEXT,
    start_date TEXT,
    end_date TEXT,
    is_active INTEGER DEFAULT 1,
    discontinued_reason TEXT,
    discontinued_date TEXT,
    discontinued_by TEXT,
    pill_color_shape TEXT, -- e.g. "White oval scored"
    special_instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Medication Dosage Titration / Change History
CREATE TABLE IF NOT EXISTS medication_titrations (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    previous_dosage TEXT NOT NULL,
    new_dosage TEXT NOT NULL,
    previous_frequency TEXT,
    new_frequency TEXT,
    reason TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    condition_name TEXT NOT NULL,
    icd10_code TEXT,
    category TEXT, -- Cardiovascular, Endocrine, Respiratory, Surgical, etc.
    diagnosed_date TEXT,
    status TEXT NOT NULL CHECK(status IN ('Active', 'Managed', 'Resolved', 'In Remission')),
    treating_facility TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clinical_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL, -- Attending Physician, ER Nurse, Cardiologist, etc.
    facility TEXT NOT NULL,
    visit_type TEXT NOT NULL, -- ER Triage, Follow-up, Routine Ward Round, Specialist Consult
    assessment TEXT NOT NULL,
    plan TEXT NOT NULL,
    subjective_notes TEXT,
    objective_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vitals_logs (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    blood_pressure TEXT, -- e.g. "124/82 mmHg"
    heart_rate INTEGER, -- bpm
    spo2 INTEGER, -- percentage
    temperature REAL, -- Celsius
    respiratory_rate INTEGER,
    blood_glucose INTEGER, -- mg/dL
    recorded_by TEXT,
    notes TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_reports (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    test_name TEXT NOT NULL,
    category TEXT NOT NULL, -- Hematology, Metabolic Panel, Cardiac Biomarkers, etc.
    test_date TEXT NOT NULL,
    result_value TEXT NOT NULL,
    reference_range TEXT,
    flag TEXT DEFAULT 'Normal' CHECK(flag IN ('Normal', 'High', 'Low', 'Critical')),
    ordering_doctor TEXT,
    facility TEXT,
    summary_interpretation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT NOT NULL,
    alt_phone TEXT,
    is_primary INTEGER DEFAULT 0,
    can_make_medical_decisions INTEGER DEFAULT 0,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_audits (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scanner_role TEXT DEFAULT 'Emergency Responder / Clinician',
    user_agent TEXT,
    location_approx TEXT DEFAULT 'Bedside / Emergency Bay',
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Scanned and Transcribed Medical Documents
CREATE TABLE IF NOT EXISTS scanned_documents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    document_type TEXT NOT NULL, -- Prescription, Lab Report, Discharge Summary, Clinical Note
    file_name TEXT,
    image_url TEXT,
    raw_transcription TEXT,
    extracted_entities_json TEXT, -- JSON structure of extracted clinical findings
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patients_qr ON patients(qr_code);
CREATE INDEX IF NOT EXISTS idx_meds_patient ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_titrations_med ON medication_titrations(medication_id);
CREATE INDEX IF NOT EXISTS idx_docs_patient ON scanned_documents(patient_id);

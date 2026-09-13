// MediPulse QR Database Controller
// Uses native node:sqlite DatabaseSync in Node 24

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SEED_PATIENTS } from './seed-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'medipulse.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Initialize tables and run migrations
export function initDatabase() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);

  // Run incremental column migrations for existing SQLite databases
  try {
    db.exec(`ALTER TABLE medications ADD COLUMN discontinued_reason TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE medications ADD COLUMN discontinued_date TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE medications ADD COLUMN discontinued_by TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE allergies ADD COLUMN category TEXT DEFAULT 'Drug';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE allergies ADD COLUMN verification_status TEXT DEFAULT 'Confirmed';`);
  } catch (e) {}

  const patientCountStmt = db.prepare('SELECT COUNT(*) as count FROM patients');
  const result = patientCountStmt.get();

  if (!result || result.count === 0) {
    console.log('[DB] Database is empty. Seeding initial patient profiles...');
    seedDatabase();
  } else {
    console.log(`[DB] Database initialized with ${result.count} patients.`);
  }
}

// Seed the database with 5 clinical profiles
export function seedDatabase() {
  // Clear existing
  db.exec(`
    DELETE FROM scanned_documents;
    DELETE FROM medication_titrations;
    DELETE FROM scan_audits;
    DELETE FROM emergency_contacts;
    DELETE FROM lab_reports;
    DELETE FROM vitals_logs;
    DELETE FROM clinical_notes;
    DELETE FROM medical_history;
    DELETE FROM medications;
    DELETE FROM allergies;
    DELETE FROM patients;
  `);

  const insertPatient = db.prepare(`
    INSERT INTO patients (
      id, qr_code, first_name, last_name, dob, gender, blood_type,
      phone, email, address, organ_donor, dnr_status, emergency_summary,
      avatar_url, primary_physician, insurance_provider, insurance_policy_no
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAllergy = db.prepare(`
    INSERT INTO allergies (id, patient_id, allergen, reaction, severity, category, verification_status, diagnosed_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMedication = db.prepare(`
    INSERT INTO medications (
      id, patient_id, drug_name, generic_name, dosage, form, frequency,
      time_of_day, purpose, prescribing_doctor, start_date, end_date,
      is_active, discontinued_reason, discontinued_date, discontinued_by,
      pill_color_shape, special_instructions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTitration = db.prepare(`
    INSERT INTO medication_titrations (
      id, medication_id, patient_id, previous_dosage, new_dosage,
      previous_frequency, new_frequency, reason, changed_by, changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO medical_history (
      id, patient_id, condition_name, icd10_code, category,
      diagnosed_date, status, treating_facility, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertClinicalNote = db.prepare(`
    INSERT INTO clinical_notes (
      id, patient_id, author_name, author_role, facility,
      visit_type, assessment, plan, subjective_notes, objective_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVitals = db.prepare(`
    INSERT INTO vitals_logs (
      id, patient_id, recorded_at, blood_pressure, heart_rate,
      spo2, temperature, respiratory_rate, blood_glucose, recorded_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLab = db.prepare(`
    INSERT INTO lab_reports (
      id, patient_id, test_name, category, test_date, result_value,
      reference_range, flag, ordering_doctor, facility, summary_interpretation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertContact = db.prepare(`
    INSERT INTO emergency_contacts (
      id, patient_id, name, relationship, phone, alt_phone,
      is_primary, can_make_medical_decisions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of SEED_PATIENTS) {
    insertPatient.run(
      p.id, p.qr_code, p.first_name, p.last_name, p.dob, p.gender, p.blood_type,
      p.phone, p.email, p.address, p.organ_donor, p.dnr_status, p.emergency_summary,
      p.avatar_url, p.primary_physician, p.insurance_provider, p.insurance_policy_no
    );

    for (const a of p.allergies || []) {
      insertAllergy.run(
        a.id, p.id, a.allergen, a.reaction, a.severity,
        a.category || 'Drug', a.verification_status || 'Confirmed',
        a.diagnosed_date, a.notes || ''
      );
    }

    for (const m of p.medications || []) {
      insertMedication.run(
        m.id, p.id, m.drug_name, m.generic_name || '', m.dosage, m.form, m.frequency,
        m.time_of_day || '', m.purpose || '', m.prescribing_doctor || '',
        m.start_date || '', m.end_date || null, m.is_active ?? 1,
        m.discontinued_reason || null, m.discontinued_date || null, m.discontinued_by || null,
        m.pill_color_shape || '', m.special_instructions || ''
      );

      for (const t of m.titrations || []) {
        insertTitration.run(
          t.id, m.id, p.id, t.previous_dosage, t.new_dosage,
          t.previous_frequency || '', t.new_frequency || '',
          t.reason, t.changed_by, t.changed_at
        );
      }
    }

    for (const h of p.medical_history || []) {
      insertHistory.run(
        h.id, p.id, h.condition_name, h.icd10_code || '', h.category || 'General',
        h.diagnosed_date || '', h.status, h.treating_facility || '', h.notes || ''
      );
    }

    for (const cn of p.clinical_notes || []) {
      insertClinicalNote.run(
        cn.id, p.id, cn.author_name, cn.author_role, cn.facility,
        cn.visit_type, cn.assessment, cn.plan, cn.subjective_notes || '', cn.objective_notes || ''
      );
    }

    for (const v of p.vitals || []) {
      insertVitals.run(
        v.id, p.id, v.recorded_at, v.blood_pressure || '', v.heart_rate || null,
        v.spo2 || null, v.temperature || null, v.respiratory_rate || null,
        v.blood_glucose || null, v.recorded_by || '', v.notes || ''
      );
    }

    for (const l of p.lab_reports || []) {
      insertLab.run(
        l.id, p.id, l.test_name, l.category, l.test_date, l.result_value,
        l.reference_range || '', l.flag || 'Normal', l.ordering_doctor || '',
        l.facility || '', l.summary_interpretation || ''
      );
    }

    for (const c of p.emergency_contacts || []) {
      insertContact.run(
        c.id, p.id, c.name, c.relationship, c.phone, c.alt_phone || null,
        c.is_primary ? 1 : 0, c.can_make_medical_decisions ? 1 : 0
      );
    }
  }

  console.log('[DB] Seeded 5 patient profiles with longitudinal trends and titrations successfully.');
}

// Read queries
export function getAllPatients(search = '', bloodType = '') {
  let query = `
    SELECT p.*,
      (SELECT COUNT(*) FROM medications WHERE patient_id = p.id AND is_active = 1) as active_meds_count,
      (SELECT COUNT(*) FROM medications WHERE patient_id = p.id AND is_active = 0) as old_meds_count,
      (SELECT COUNT(*) FROM allergies WHERE patient_id = p.id) as allergies_count,
      (SELECT COUNT(*) FROM allergies WHERE patient_id = p.id AND severity = 'Life-Threatening') as severe_allergies_count
    FROM patients p
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.qr_code LIKE ? OR p.id LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (bloodType) {
    query += ` AND p.blood_type = ?`;
    params.push(bloodType);
  }

  query += ` ORDER BY p.last_name ASC`;
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

export function getPatientByIdOrCode(idOrCode) {
  const patientStmt = db.prepare(`
    SELECT * FROM patients WHERE id = ? OR qr_code = ?
  `);
  const patient = patientStmt.get(idOrCode, idOrCode);
  if (!patient) return null;

  const allergiesStmt = db.prepare(`
    SELECT * FROM allergies WHERE patient_id = ? 
    ORDER BY CASE severity WHEN 'Life-Threatening' THEN 1 WHEN 'Severe' THEN 2 WHEN 'Moderate' THEN 3 ELSE 4 END
  `);
  
  const medicationsStmt = db.prepare(`
    SELECT * FROM medications WHERE patient_id = ? 
    ORDER BY is_active DESC, drug_name ASC
  `);

  const titrationsStmt = db.prepare(`
    SELECT * FROM medication_titrations WHERE medication_id = ? 
    ORDER BY changed_at DESC
  `);

  const historyStmt = db.prepare(`SELECT * FROM medical_history WHERE patient_id = ? ORDER BY diagnosed_date DESC`);
  const notesStmt = db.prepare(`SELECT * FROM clinical_notes WHERE patient_id = ? ORDER BY created_at DESC`);
  const vitalsStmt = db.prepare(`SELECT * FROM vitals_logs WHERE patient_id = ? ORDER BY recorded_at DESC`);
  const labsStmt = db.prepare(`SELECT * FROM lab_reports WHERE patient_id = ? ORDER BY test_date DESC`);
  const contactsStmt = db.prepare(`SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY is_primary DESC`);
  const scansStmt = db.prepare(`SELECT * FROM scan_audits WHERE patient_id = ? ORDER BY scanned_at DESC LIMIT 10`);
  const docsStmt = db.prepare(`SELECT * FROM scanned_documents WHERE patient_id = ? ORDER BY scanned_at DESC`);

  const rawMeds = medicationsStmt.all(patient.id);
  const medications = rawMeds.map(m => ({
    ...m,
    titrations: titrationsStmt.all(m.id)
  }));

  return {
    ...patient,
    allergies: allergiesStmt.all(patient.id),
    medications,
    medical_history: historyStmt.all(patient.id),
    clinical_notes: notesStmt.all(patient.id),
    vitals: vitalsStmt.all(patient.id),
    lab_reports: labsStmt.all(patient.id),
    emergency_contacts: contactsStmt.all(patient.id),
    recent_scans: scansStmt.all(patient.id),
    scanned_documents: docsStmt.all(patient.id)
  };
}

// -------------------------------------------------------------
// MEDICATION TITRATION & LIFECYCLE
// -------------------------------------------------------------

export function titrateMedication(medId, { new_dosage, new_frequency, reason, changed_by }) {
  const med = db.prepare(`SELECT * FROM medications WHERE id = ?`).get(medId);
  if (!med) throw new Error('Medication not found');

  const titrationId = 'tit-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Record titration history
  const titrateStmt = db.prepare(`
    INSERT INTO medication_titrations (
      id, medication_id, patient_id, previous_dosage, new_dosage,
      previous_frequency, new_frequency, reason, changed_by, changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  titrateStmt.run(
    titrationId, med.id, med.patient_id, med.dosage, new_dosage,
    med.frequency, new_frequency || med.frequency,
    reason || 'Clinical dosage adjustment', changed_by || 'Attending Physician', now
  );

  // Update medication table
  const updateStmt = db.prepare(`
    UPDATE medications 
    SET dosage = ?, frequency = COALESCE(?, frequency), is_active = 1
    WHERE id = ?
  `);
  updateStmt.run(new_dosage, new_frequency || null, medId);

  return db.prepare(`SELECT * FROM medications WHERE id = ?`).get(medId);
}

export function discontinueMedication(medId, { reason, discontinued_by }) {
  const now = new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(`
    UPDATE medications 
    SET is_active = 0, discontinued_reason = ?, discontinued_date = ?, discontinued_by = ?
    WHERE id = ?
  `);
  stmt.run(reason || 'Discontinued by physician', now, discontinued_by || 'Attending Physician', medId);
  return db.prepare(`SELECT * FROM medications WHERE id = ?`).get(medId);
}

export function reactivateMedication(medId, { dosage, frequency, reason, changed_by }) {
  const med = db.prepare(`SELECT * FROM medications WHERE id = ?`).get(medId);
  if (!med) throw new Error('Medication not found');

  const now = new Date().toISOString().slice(0, 10);
  const nowFull = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // If dosage is updated during reactivation, log titration
  if (dosage && dosage !== med.dosage) {
    const titrationId = 'tit-' + crypto.randomUUID().slice(0, 8);
    db.prepare(`
      INSERT INTO medication_titrations (
        id, medication_id, patient_id, previous_dosage, new_dosage,
        previous_frequency, new_frequency, reason, changed_by, changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      titrationId, med.id, med.patient_id, med.dosage, dosage,
      med.frequency, frequency || med.frequency,
      reason || 'Reactivated medication with dosage titration', changed_by || 'Attending Physician', nowFull
    );
  }

  const stmt = db.prepare(`
    UPDATE medications 
    SET is_active = 1, start_date = ?, discontinued_reason = NULL, discontinued_date = NULL, discontinued_by = NULL,
        dosage = COALESCE(?, dosage), frequency = COALESCE(?, frequency)
    WHERE id = ?
  `);
  stmt.run(now, dosage || null, frequency || null, medId);

  return db.prepare(`SELECT * FROM medications WHERE id = ?`).get(medId);
}

export function getMedicationTitrationHistory(medId) {
  const stmt = db.prepare(`SELECT * FROM medication_titrations WHERE medication_id = ? ORDER BY changed_at DESC`);
  return stmt.all(medId);
}

// -------------------------------------------------------------
// ALLERGY MANAGEMENT
// -------------------------------------------------------------

export function addAllergy(patientId, { allergen, reaction, severity, category, verification_status, notes }) {
  const id = 'alg-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(`
    INSERT INTO allergies (id, patient_id, allergen, reaction, severity, category, verification_status, diagnosed_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, patientId, allergen, reaction || 'Adverse reaction', severity || 'Moderate',
    category || 'Drug', verification_status || 'Confirmed', now, notes || ''
  );
  return db.prepare(`SELECT * FROM allergies WHERE id = ?`).get(id);
}

// -------------------------------------------------------------
// SCANNED DOCUMENTS & BATCH ENTITY COMMITMENT
// -------------------------------------------------------------

export function saveScannedDocument(patientId, { document_type, file_name, image_url, raw_transcription, extracted_entities }) {
  const id = 'doc-' + crypto.randomUUID().slice(0, 8);
  const stmt = db.prepare(`
    INSERT INTO scanned_documents (id, patient_id, document_type, file_name, image_url, raw_transcription, extracted_entities_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, patientId, document_type || 'Prescription', file_name || 'scanned_record.jpg',
    image_url || '', raw_transcription || '', JSON.stringify(extracted_entities || {})
  );
  return db.prepare(`SELECT * FROM scanned_documents WHERE id = ?`).get(id);
}

export function commitExtractedEntities(patientId, { medications = [], allergies = [], vitals = [], conditions = [], labs = [], notes = null, document_metadata = null }) {
  const committedResults = {
    medications: [],
    allergies: [],
    vitals: [],
    conditions: [],
    labs: [],
    notes: null
  };

  // 1. Commit Medications
  const insertMed = db.prepare(`
    INSERT INTO medications (
      id, patient_id, drug_name, generic_name, dosage, form, frequency,
      time_of_day, purpose, prescribing_doctor, start_date, is_active,
      pill_color_shape, special_instructions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 1, ?, ?)
  `);

  for (const m of medications) {
    if (!m.drug_name || !m.dosage) continue;
    const medId = 'med-' + crypto.randomUUID().slice(0, 8);
    insertMed.run(
      medId, patientId, m.drug_name, m.generic_name || '', m.dosage, m.form || 'Tablet',
      m.frequency || 'Daily', m.time_of_day || 'Morning', m.purpose || 'Transcribed from scanned record',
      m.prescribing_doctor || 'Scanned Prescription Provider', m.pill_color_shape || '', m.special_instructions || ''
    );
    committedResults.medications.push(db.prepare(`SELECT * FROM medications WHERE id = ?`).get(medId));
  }

  // 2. Commit Allergies
  for (const a of allergies) {
    if (!a.allergen) continue;
    const alg = addAllergy(patientId, a);
    committedResults.allergies.push(alg);
  }

  // 3. Commit Vitals
  for (const v of vitals) {
    const vit = addVitalsLog(patientId, v);
    committedResults.vitals.push(vit);
  }

  // 4. Commit Medical Conditions
  const insertHist = db.prepare(`
    INSERT INTO medical_history (
      id, patient_id, condition_name, icd10_code, category,
      diagnosed_date, status, treating_facility, notes
    ) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?)
  `);

  for (const h of conditions) {
    if (!h.condition_name) continue;
    const hid = 'his-' + crypto.randomUUID().slice(0, 8);
    insertHist.run(
      hid, patientId, h.condition_name, h.icd10_code || '', h.category || 'General',
      h.status || 'Active', h.treating_facility || 'Scanned Clinical Record', h.notes || 'Transcribed from medical scan'
    );
    committedResults.conditions.push(db.prepare(`SELECT * FROM medical_history WHERE id = ?`).get(hid));
  }

  // 5. Commit Labs
  const insertLab = db.prepare(`
    INSERT INTO lab_reports (
      id, patient_id, test_name, category, test_date, result_value,
      reference_range, flag, ordering_doctor, facility, summary_interpretation
    ) VALUES (?, ?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?)
  `);

  for (const l of labs) {
    if (!l.test_name || !l.result_value) continue;
    const lid = 'lab-' + crypto.randomUUID().slice(0, 8);
    insertLab.run(
      lid, patientId, l.test_name, l.category || 'Diagnostic Panel',
      l.result_value, l.reference_range || '', l.flag || 'Normal',
      l.ordering_doctor || 'Scanned Lab Provider', l.facility || 'Clinical Lab', l.summary_interpretation || ''
    );
    committedResults.labs.push(db.prepare(`SELECT * FROM lab_reports WHERE id = ?`).get(lid));
  }

  // 6. Save Scanned Document Record if metadata is supplied
  if (document_metadata) {
    saveScannedDocument(patientId, {
      document_type: document_metadata.document_type || 'Prescription Scan',
      file_name: document_metadata.file_name,
      image_url: document_metadata.image_url,
      raw_transcription: document_metadata.raw_transcription,
      extracted_entities: {
        medications: committedResults.medications,
        allergies: committedResults.allergies,
        vitals: committedResults.vitals,
        conditions: committedResults.conditions,
        labs: committedResults.labs
      }
    });
  }

  return committedResults;
}

// -------------------------------------------------------------
// PATIENT TREND DATA AGGREGATION
// -------------------------------------------------------------

export function getPatientTrends(patientId) {
  const vitalsStmt = db.prepare(`
    SELECT id, recorded_at, blood_pressure, heart_rate, spo2, temperature, blood_glucose, recorded_by
    FROM vitals_logs 
    WHERE patient_id = ? 
    ORDER BY recorded_at ASC
  `);
  const rawVitals = vitalsStmt.all(patientId);

  // Parse BP systolic/diastolic
  const vitalsTimeline = rawVitals.map(v => {
    let systolic = null;
    let diastolic = null;
    if (v.blood_pressure) {
      const match = v.blood_pressure.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        systolic = parseInt(match[1]);
        diastolic = parseInt(match[2]);
      }
    }
    return {
      id: v.id,
      date: v.recorded_at,
      systolic,
      diastolic,
      heartRate: v.heart_rate,
      spo2: v.spo2,
      temperature: v.temperature,
      bloodGlucose: v.blood_glucose,
      recordedBy: v.recorded_by
    };
  });

  const labsStmt = db.prepare(`
    SELECT id, test_name, category, test_date, result_value, flag, reference_range
    FROM lab_reports 
    WHERE patient_id = ? 
    ORDER BY test_date ASC
  `);
  const rawLabs = labsStmt.all(patientId);

  return {
    patientId,
    vitalsTimeline,
    labsTimeline: rawLabs
  };
}

// -------------------------------------------------------------
// STANDARD CLINICAL WRITE HELPERS
// -------------------------------------------------------------

export function addClinicalNote(patientId, { author_name, author_role, facility, visit_type, assessment, plan, subjective_notes, objective_notes }) {
  const id = 'cn-' + crypto.randomUUID().slice(0, 8);
  const stmt = db.prepare(`
    INSERT INTO clinical_notes (id, patient_id, author_name, author_role, facility, visit_type, assessment, plan, subjective_notes, objective_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, patientId, author_name || 'Dr. Attending', author_role || 'Physician',
    facility || 'Emergency Care Center', visit_type || 'Bedside Follow-up',
    assessment, plan, subjective_notes || '', objective_notes || ''
  );

  return db.prepare(`SELECT * FROM clinical_notes WHERE id = ?`).get(id);
}

export function addVitalsLog(patientId, { blood_pressure, heart_rate, spo2, temperature, respiratory_rate, blood_glucose, recorded_by, notes }) {
  const id = 'vit-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const stmt = db.prepare(`
    INSERT INTO vitals_logs (id, patient_id, recorded_at, blood_pressure, heart_rate, spo2, temperature, respiratory_rate, blood_glucose, recorded_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, patientId, now, blood_pressure || '', heart_rate ? parseInt(heart_rate) : null,
    spo2 ? parseInt(spo2) : null, temperature ? parseFloat(temperature) : null,
    respiratory_rate ? parseInt(respiratory_rate) : null,
    blood_glucose ? parseInt(blood_glucose) : null,
    recorded_by || 'Staff Nurse', notes || ''
  );

  return db.prepare(`SELECT * FROM vitals_logs WHERE id = ?`).get(id);
}

export function addMedication(patientId, { drug_name, generic_name, dosage, form, frequency, time_of_day, purpose, prescribing_doctor, pill_color_shape, special_instructions }) {
  const id = 'med-' + crypto.randomUUID().slice(0, 8);
  const stmt = db.prepare(`
    INSERT INTO medications (id, patient_id, drug_name, generic_name, dosage, form, frequency, time_of_day, purpose, prescribing_doctor, start_date, is_active, pill_color_shape, special_instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 1, ?, ?)
  `);
  stmt.run(
    id, patientId, drug_name, generic_name || '', dosage, form || 'Tablet',
    frequency || 'Daily', time_of_day || 'Morning', purpose || '',
    prescribing_doctor || 'Attending Physician', pill_color_shape || '', special_instructions || ''
  );

  return db.prepare(`SELECT * FROM medications WHERE id = ?`).get(id);
}

export function toggleMedication(medId, isActive) {
  if (!isActive) {
    return discontinueMedication(medId, { reason: 'Deactivated by user' });
  } else {
    return reactivateMedication(medId, { reason: 'Reactivated by user' });
  }
}

export function recordScanAudit(patientId, scanner_role = 'First Responder / Triage', user_agent = '', location_approx = 'Bedside / Field Scan') {
  const id = 'scn-' + crypto.randomUUID().slice(0, 8);
  const stmt = db.prepare(`
    INSERT INTO scan_audits (id, patient_id, scanner_role, user_agent, location_approx)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, patientId, scanner_role, user_agent, location_approx);
  return db.prepare(`SELECT * FROM scan_audits WHERE id = ?`).get(id);
}

export function getSystemStats() {
  const patientCount = db.prepare(`SELECT COUNT(*) as count FROM patients`).get().count;
  const medsCount = db.prepare(`SELECT COUNT(*) as count FROM medications WHERE is_active = 1`).get().count;
  const oldMedsCount = db.prepare(`SELECT COUNT(*) as count FROM medications WHERE is_active = 0`).get().count;
  const titrationsCount = db.prepare(`SELECT COUNT(*) as count FROM medication_titrations`).get().count;
  const notesCount = db.prepare(`SELECT COUNT(*) as count FROM clinical_notes`).get().count;
  const scansCount = db.prepare(`SELECT COUNT(*) as count FROM scan_audits`).get().count;
  const allergiesCount = db.prepare(`SELECT COUNT(*) as count FROM allergies WHERE severity = 'Life-Threatening'`).get().count;
  const docsCount = db.prepare(`SELECT COUNT(*) as count FROM scanned_documents`).get().count;

  return {
    patientCount,
    medsCount,
    oldMedsCount,
    titrationsCount,
    notesCount,
    scansCount,
    severeAllergiesCount: allergiesCount,
    docsCount
  };
}

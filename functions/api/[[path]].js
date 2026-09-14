// Cloudflare Pages Serverless Edge API Handler � D1 Persistent SQLite Storage
// Automatically handles all /api/* routes with Cloudflare D1 persistent edge database

import { SEED_PATIENTS } from '../data/seed-data.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function uid(prefix = 'id') {
  return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

const DDL_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS patients ( id TEXT PRIMARY KEY, qr_code TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, dob TEXT NOT NULL, gender TEXT NOT NULL, blood_type TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, organ_donor INTEGER DEFAULT 0, dnr_status INTEGER DEFAULT 0, emergency_summary TEXT, avatar_url TEXT, primary_physician TEXT, insurance_provider TEXT, insurance_policy_no TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP )",
  "CREATE TABLE IF NOT EXISTS allergies ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, allergen TEXT NOT NULL, reaction TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('Mild', 'Moderate', 'Severe', 'Life-Threatening')), category TEXT DEFAULT 'Drug', verification_status TEXT DEFAULT 'Confirmed', diagnosed_date TEXT, notes TEXT, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS medications ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, drug_name TEXT NOT NULL, generic_name TEXT, dosage TEXT NOT NULL, form TEXT NOT NULL, frequency TEXT NOT NULL, time_of_day TEXT, purpose TEXT, prescribing_doctor TEXT, start_date TEXT, end_date TEXT, is_active INTEGER DEFAULT 1, discontinued_reason TEXT, discontinued_date TEXT, discontinued_by TEXT, pill_color_shape TEXT, special_instructions TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS medication_titrations ( id TEXT PRIMARY KEY, medication_id TEXT NOT NULL, patient_id TEXT NOT NULL, previous_dosage TEXT NOT NULL, new_dosage TEXT NOT NULL, previous_frequency TEXT, new_frequency TEXT, reason TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(medication_id) REFERENCES medications(id) ON DELETE CASCADE, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS medical_history ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, condition_name TEXT NOT NULL, icd10_code TEXT, category TEXT, diagnosed_date TEXT, status TEXT NOT NULL CHECK(status IN ('Active', 'Managed', 'Resolved', 'In Remission')), treating_facility TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS clinical_notes ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, author_name TEXT NOT NULL, author_role TEXT NOT NULL, facility TEXT NOT NULL, visit_type TEXT NOT NULL, assessment TEXT NOT NULL, plan TEXT NOT NULL, subjective_notes TEXT, objective_notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS vitals_logs ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP, blood_pressure TEXT, heart_rate INTEGER, spo2 INTEGER, temperature REAL, respiratory_rate INTEGER, blood_glucose INTEGER, recorded_by TEXT, notes TEXT, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS lab_reports ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, test_name TEXT NOT NULL, category TEXT NOT NULL, test_date TEXT NOT NULL, result_value TEXT NOT NULL, reference_range TEXT, flag TEXT DEFAULT 'Normal' CHECK(flag IN ('Normal', 'High', 'Low', 'Critical')), ordering_doctor TEXT, facility TEXT, summary_interpretation TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS emergency_contacts ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, name TEXT NOT NULL, relationship TEXT NOT NULL, phone TEXT NOT NULL, alt_phone TEXT, is_primary INTEGER DEFAULT 0, can_make_medical_decisions INTEGER DEFAULT 0, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS scan_audits ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP, scanner_role TEXT DEFAULT 'Emergency Responder / Clinician', user_agent TEXT, location_approx TEXT DEFAULT 'Bedside / Emergency Bay', FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE TABLE IF NOT EXISTS scanned_documents ( id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, document_type TEXT NOT NULL, file_name TEXT, image_url TEXT, raw_transcription TEXT, extracted_entities_json TEXT, scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE )",
  "CREATE INDEX IF NOT EXISTS idx_patients_qr ON patients(qr_code)",
  "CREATE INDEX IF NOT EXISTS idx_meds_patient ON medications(patient_id)",
  "CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id)",
  "CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON clinical_notes(patient_id)",
  "CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals_logs(patient_id)",
  "CREATE INDEX IF NOT EXISTS idx_titrations_med ON medication_titrations(medication_id)",
  "CREATE INDEX IF NOT EXISTS idx_docs_patient ON scanned_documents(patient_id)"
];

async function initDB(DB) {
  await DB.batch(DDL_STATEMENTS.map(sql => DB.prepare(sql)));
}

async function seedD1Database(DB) {
  const clearStmts = [
    'DELETE FROM scanned_documents',
    'DELETE FROM medication_titrations',
    'DELETE FROM scan_audits',
    'DELETE FROM emergency_contacts',
    'DELETE FROM lab_reports',
    'DELETE FROM vitals_logs',
    'DELETE FROM clinical_notes',
    'DELETE FROM medical_history',
    'DELETE FROM medications',
    'DELETE FROM allergies',
    'DELETE FROM patients'
  ];
  await DB.batch(clearStmts.map(s => DB.prepare(s)));

  const stmts = [];

  for (const p of SEED_PATIENTS) {
    stmts.push(DB.prepare(
      `INSERT INTO patients (
        id, qr_code, first_name, last_name, dob, gender, blood_type,
        phone, email, address, organ_donor, dnr_status, emergency_summary,
        avatar_url, primary_physician, insurance_provider, insurance_policy_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      p.id, p.qr_code, p.first_name, p.last_name, p.dob, p.gender, p.blood_type,
      p.phone || null, p.email || null, p.address || null, p.organ_donor ?? 0, p.dnr_status ?? 0,
      p.emergency_summary || '', p.avatar_url || '', p.primary_physician || '',
      p.insurance_provider || '', p.insurance_policy_no || ''
    ));

    for (const a of (p.allergies || [])) {
      stmts.push(DB.prepare(
        `INSERT INTO allergies (id, patient_id, allergen, reaction, severity, category, verification_status, diagnosed_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        a.id || uid('alg'), p.id, a.allergen, a.reaction || '', a.severity || 'Moderate',
        a.category || 'Drug', a.verification_status || 'Confirmed',
        a.diagnosed_date || null, a.notes || ''
      ));
    }

    for (const m of (p.medications || [])) {
      stmts.push(DB.prepare(
        `INSERT INTO medications (
          id, patient_id, drug_name, generic_name, dosage, form, frequency,
          time_of_day, purpose, prescribing_doctor, start_date, end_date,
          is_active, discontinued_reason, discontinued_date, discontinued_by,
          pill_color_shape, special_instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        m.id || uid('med'), p.id, m.drug_name, m.generic_name || '', m.dosage, m.form || 'Tablet', m.frequency || 'Once daily',
        m.time_of_day || '', m.purpose || '', m.prescribing_doctor || '',
        m.start_date || '', m.end_date || null, m.is_active ?? 1,
        m.discontinued_reason || null, m.discontinued_date || null, m.discontinued_by || null,
        m.pill_color_shape || '', m.special_instructions || ''
      ));

      for (const t of (m.titrations || [])) {
        stmts.push(DB.prepare(
          `INSERT INTO medication_titrations (
            id, medication_id, patient_id, previous_dosage, new_dosage,
            previous_frequency, new_frequency, reason, changed_by, changed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          t.id || uid('tit'), m.id, p.id, t.previous_dosage, t.new_dosage,
          t.previous_frequency || '', t.new_frequency || '',
          t.reason || '', t.changed_by || '', t.changed_at || new Date().toISOString()
        ));
      }
    }

    for (const h of (p.medical_history || [])) {
      stmts.push(DB.prepare(
        `INSERT INTO medical_history (
          id, patient_id, condition_name, icd10_code, category,
          diagnosed_date, status, treating_facility, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        h.id || uid('his'), p.id, h.condition_name, h.icd10_code || '', h.category || 'General',
        h.diagnosed_date || '', h.status || 'Active', h.treating_facility || '', h.notes || ''
      ));
    }

    for (const cn of (p.clinical_notes || [])) {
      stmts.push(DB.prepare(
        `INSERT INTO clinical_notes (
          id, patient_id, author_name, author_role, facility,
          visit_type, assessment, plan, subjective_notes, objective_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        cn.id || uid('cn'), p.id, cn.author_name || '', cn.author_role || '', cn.facility || '',
        cn.visit_type || '', cn.assessment || '', cn.plan || '', cn.subjective_notes || '', cn.objective_notes || ''
      ));
    }

    for (const v of (p.vitals || [])) {
      stmts.push(DB.prepare(
        `INSERT INTO vitals_logs (
          id, patient_id, recorded_at, blood_pressure, heart_rate,
          spo2, temperature, respiratory_rate, blood_glucose, recorded_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        v.id || uid('vit'), p.id, v.recorded_at || '', v.blood_pressure || '', v.heart_rate ?? null,
        v.spo2 ?? null, v.temperature ?? null, v.respiratory_rate ?? null,
        v.blood_glucose ?? null, v.recorded_by || '', v.notes || ''
      ));
    }

    for (const l of (p.lab_reports || [])) {
      stmts.push(DB.prepare(
        `INSERT INTO lab_reports (
          id, patient_id, test_name, category, test_date, result_value,
          reference_range, flag, ordering_doctor, facility, summary_interpretation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        l.id || uid('lab'), p.id, l.test_name, l.category || '', l.test_date || '', l.result_value,
        l.reference_range || '', l.flag || 'Normal', l.ordering_doctor || '',
        l.facility || '', l.summary_interpretation || ''
      ));
    }

    for (const c of (p.emergency_contacts || [])) {
      stmts.push(DB.prepare(
        `INSERT INTO emergency_contacts (
          id, patient_id, name, relationship, phone, alt_phone,
          is_primary, can_make_medical_decisions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        c.id || uid('cnt'), p.id, c.name, c.relationship, c.phone, c.alt_phone || null,
        c.is_primary ? 1 : 0, c.can_make_medical_decisions ? 1 : 0
      ));
    }
  }

  for (let i = 0; i < stmts.length; i += 75) {
    await DB.batch(stmts.slice(i, i + 75));
  }
}

async function ensureSeeded(DB) {
  await initDB(DB);
  const row = await DB.prepare('SELECT COUNT(*) as count FROM patients').first();
  if (!row || row.count === 0) {
    await seedD1Database(DB);
  }
}

async function getPatientByIdOrCode(DB, idOrCode) {
  const target = decodeURIComponent(idOrCode);
  const patient = await DB.prepare(
    `SELECT * FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`
  ).bind(target, target).first();

  if (!patient) return null;

  const [
    allergiesRes,
    medsRes,
    titrationsRes,
    historyRes,
    notesRes,
    vitalsRes,
    labsRes,
    contactsRes,
    scansRes,
    docsRes
  ] = await Promise.all([
    DB.prepare(`SELECT * FROM allergies WHERE patient_id = ? ORDER BY CASE severity WHEN 'Life-Threatening' THEN 1 WHEN 'Severe' THEN 2 WHEN 'Moderate' THEN 3 ELSE 4 END`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM medications WHERE patient_id = ? ORDER BY is_active DESC, drug_name ASC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM medication_titrations WHERE patient_id = ? ORDER BY changed_at DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM medical_history WHERE patient_id = ? ORDER BY diagnosed_date DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM clinical_notes WHERE patient_id = ? ORDER BY created_at DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM vitals_logs WHERE patient_id = ? ORDER BY recorded_at DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM lab_reports WHERE patient_id = ? ORDER BY test_date DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY is_primary DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM scan_audits WHERE patient_id = ? ORDER BY scanned_at DESC LIMIT 10`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM scanned_documents WHERE patient_id = ? ORDER BY scanned_at DESC`).bind(patient.id).all()
  ]);

  const titrationsByMed = {};
  for (const t of (titrationsRes.results || [])) {
    if (!titrationsByMed[t.medication_id]) titrationsByMed[t.medication_id] = [];
    titrationsByMed[t.medication_id].push(t);
  }

  const medications = (medsRes.results || []).map(m => ({
    ...m,
    titrations: titrationsByMed[m.id] || []
  }));

  return {
    ...patient,
    allergies: allergiesRes.results || [],
    medications,
    medical_history: historyRes.results || [],
    clinical_notes: notesRes.results || [],
    vitals: vitalsRes.results || [],
    lab_reports: labsRes.results || [],
    emergency_contacts: contactsRes.results || [],
    recent_scans: scansRes.results || [],
    scanned_documents: docsRes.results || []
  };
}

export async function onRequest(context) {
  const { request, params, env } = context;
  const DB = env.DB;
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = params.path || [];
  const fullPath = '/api/' + (Array.isArray(pathParts) ? pathParts.join('/') : pathParts);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (!DB) {
    return jsonResponse({
      error: 'D1 database binding not detected. Ensure binding DB is attached to Pages project.'
    }, 503);
  }

  try {
    await ensureSeeded(DB);

    // GET /api/health
    if (fullPath === '/api/health' && method === 'GET') {
      const row = await DB.prepare('SELECT COUNT(*) as count FROM patients').first();
      return jsonResponse({
        status: 'ok',
        provider: 'Cloudflare Pages + D1 Persistent SQLite',
        database: 'medipulse-db',
        patientsCount: row ? row.count : 0,
        time: new Date().toISOString()
      });
    }

    // GET /api/stats
    if (fullPath === '/api/stats' && method === 'GET') {
      const [patientsRes, activeMedsRes, oldMedsRes, titrationsRes, notesRes, severeAllergiesRes] = await Promise.all([
        DB.prepare('SELECT COUNT(*) as count FROM patients').first(),
        DB.prepare('SELECT COUNT(*) as count FROM medications WHERE is_active = 1').first(),
        DB.prepare('SELECT COUNT(*) as count FROM medications WHERE is_active = 0').first(),
        DB.prepare('SELECT COUNT(*) as count FROM medication_titrations').first(),
        DB.prepare('SELECT COUNT(*) as count FROM clinical_notes').first(),
        DB.prepare("SELECT COUNT(*) as count FROM allergies WHERE severity IN ('Life-Threatening', 'Severe')").first()
      ]);

      return jsonResponse({
        patientCount: patientsRes?.count ?? 0,
        medsCount: activeMedsRes?.count ?? 0,
        oldMedsCount: oldMedsRes?.count ?? 0,
        titrationsCount: titrationsRes?.count ?? 0,
        notesCount: notesRes?.count ?? 0,
        severeAllergiesCount: severeAllergiesRes?.count ?? 0
      });
    }

    // POST /api/reset-demo
    if (fullPath === '/api/reset-demo' && method === 'POST') {
      await seedD1Database(DB);
      return jsonResponse({ success: true, message: 'Reset D1 database with 5 clinical profiles' });
    }

    // GET /api/patients
    if (fullPath === '/api/patients' && method === 'GET') {
      const search = (url.searchParams.get('search') || '').trim();
      const bloodType = url.searchParams.get('bloodType') || '';

      let query = `
        SELECT p.*,
          (SELECT COUNT(*) FROM medications WHERE patient_id = p.id AND is_active = 1) as active_meds_count,
          (SELECT COUNT(*) FROM medications WHERE patient_id = p.id AND is_active = 0) as old_meds_count,
          (SELECT COUNT(*) FROM allergies WHERE patient_id = p.id) as allergies_count,
          (SELECT COUNT(*) FROM allergies WHERE patient_id = p.id AND severity = 'Life-Threatening') as severe_allergies_count
        FROM patients p
        WHERE 1=1
      `;
      const bindings = [];

      if (search) {
        query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.qr_code LIKE ? OR p.id LIKE ?)`;
        const s = `%${search}%`;
        bindings.push(s, s, s, s);
      }

      if (bloodType) {
        query += ` AND p.blood_type = ?`;
        bindings.push(bloodType);
      }

      query += ` ORDER BY p.last_name ASC`;
      const { results } = await DB.prepare(query).bind(...bindings).all();
      return jsonResponse({ patients: results || [] });
    }

    // GET /api/patients/:id/trends
    const trendsMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/trends$/);
    if (trendsMatch && method === 'GET') {
      const idOrCode = decodeURIComponent(trendsMatch[1]);
      const p = await DB.prepare(`SELECT id FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`).bind(idOrCode, idOrCode).first();
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);

      const [vitalsRes, labsRes] = await Promise.all([
        DB.prepare(`SELECT id, recorded_at, blood_pressure, heart_rate, spo2, temperature, blood_glucose, recorded_by FROM vitals_logs WHERE patient_id = ? ORDER BY recorded_at ASC`).bind(p.id).all(),
        DB.prepare(`SELECT id, test_name, category, test_date, result_value, flag, reference_range FROM lab_reports WHERE patient_id = ? ORDER BY test_date ASC`).bind(p.id).all()
      ]);

      const vitalsTimeline = (vitalsRes.results || []).map(v => {
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

      return jsonResponse({
        success: true,
        trends: {
          patientId: p.id,
          vitalsTimeline,
          labsTimeline: labsRes.results || []
        }
      });
    }

    // POST /api/patients/:id/notes
    const noteMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/notes$/);
    if (noteMatch && method === 'POST') {
      const idOrCode = decodeURIComponent(noteMatch[1]);
      const p = await DB.prepare(`SELECT id FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`).bind(idOrCode, idOrCode).first();
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);

      const body = await request.json();
      if (!body.assessment || !body.plan) {
        return jsonResponse({ error: 'Assessment and Plan are required fields' }, 400);
      }

      const note = {
        id: uid('cn'),
        patient_id: p.id,
        author_name: body.author_name || body.provider_name || 'Dr. Sarah Jenkins, MD',
        author_role: body.author_role || body.provider_role || 'Attending Physician',
        facility: body.facility || 'Springfield Memorial Hospital',
        visit_type: body.visit_type || body.encounter_type || 'Follow-up Consultation',
        assessment: body.assessment,
        plan: body.plan,
        subjective_notes: body.subjective_notes || '',
        objective_notes: body.objective_notes || '',
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };

      await DB.prepare(`
        INSERT INTO clinical_notes (id, patient_id, author_name, author_role, facility, visit_type, assessment, plan, subjective_notes, objective_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        note.id, note.patient_id, note.author_name, note.author_role, note.facility,
        note.visit_type, note.assessment, note.plan, note.subjective_notes, note.objective_notes, note.created_at
      ).run();

      return jsonResponse({ success: true, note }, 201);
    }

    // POST /api/patients/:id/vitals
    const vitalsMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/vitals$/);
    if (vitalsMatch && method === 'POST') {
      const idOrCode = decodeURIComponent(vitalsMatch[1]);
      const p = await DB.prepare(`SELECT id FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`).bind(idOrCode, idOrCode).first();
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);

      const body = await request.json();
      const log = {
        id: uid('vit'),
        patient_id: p.id,
        recorded_at: body.recorded_at || new Date().toISOString().replace('T', ' ').slice(0, 19),
        blood_pressure: body.blood_pressure || (body.bp_systolic && body.bp_diastolic ? `${body.bp_systolic}/${body.bp_diastolic} mmHg` : ''),
        heart_rate: body.heart_rate ? parseInt(body.heart_rate) : null,
        spo2: body.spo2 ? parseInt(body.spo2) : null,
        temperature: body.temperature ? parseFloat(body.temperature) : null,
        respiratory_rate: body.respiratory_rate ? parseInt(body.respiratory_rate) : null,
        blood_glucose: body.blood_glucose ? parseInt(body.blood_glucose) : null,
        recorded_by: body.recorded_by || 'Nurse Staff, RN',
        notes: body.notes || ''
      };

      await DB.prepare(`
        INSERT INTO vitals_logs (id, patient_id, recorded_at, blood_pressure, heart_rate, spo2, temperature, respiratory_rate, blood_glucose, recorded_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        log.id, log.patient_id, log.recorded_at, log.blood_pressure, log.heart_rate,
        log.spo2, log.temperature, log.respiratory_rate, log.blood_glucose, log.recorded_by, log.notes
      ).run();

      return jsonResponse({ success: true, vitals: log }, 201);
    }

    // POST /api/patients/:id/allergies
    const allergyMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/allergies$/);
    if (allergyMatch && method === 'POST') {
      const idOrCode = decodeURIComponent(allergyMatch[1]);
      const p = await DB.prepare(`SELECT id FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`).bind(idOrCode, idOrCode).first();
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);

      const body = await request.json();
      if (!body.allergen) {
        return jsonResponse({ error: 'Allergen name is required' }, 400);
      }

      const allergy = {
        id: uid('alg'),
        patient_id: p.id,
        allergen: body.allergen,
        reaction: body.reaction || 'Allergic reaction',
        severity: body.severity || 'Moderate',
        category: body.category || 'Drug',
        verification_status: body.verification_status || 'Confirmed',
        diagnosed_date: body.diagnosed_date || new Date().toISOString().slice(0, 10),
        notes: body.notes || ''
      };

      await DB.prepare(`
        INSERT INTO allergies (id, patient_id, allergen, reaction, severity, category, verification_status, diagnosed_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        allergy.id, allergy.patient_id, allergy.allergen, allergy.reaction, allergy.severity,
        allergy.category, allergy.verification_status, allergy.diagnosed_date, allergy.notes
      ).run();

      return jsonResponse({ success: true, allergy }, 201);
    }

    // POST /api/patients/:id/medications
    const medMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/medications$/);
    if (medMatch && method === 'POST') {
      const idOrCode = decodeURIComponent(medMatch[1]);
      const p = await DB.prepare(`SELECT id FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`).bind(idOrCode, idOrCode).first();
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);

      const body = await request.json();
      if (!body.drug_name || !body.dosage) {
        return jsonResponse({ error: 'Drug name and dosage are required' }, 400);
      }

      const med = {
        id: uid('med'),
        patient_id: p.id,
        drug_name: body.drug_name,
        generic_name: body.generic_name || '',
        dosage: body.dosage,
        form: body.form || 'Tablet',
        frequency: body.frequency || 'Once daily',
        time_of_day: body.time_of_day || 'Morning',
        purpose: body.purpose || '',
        prescribing_doctor: body.prescribing_doctor || 'Dr. Sarah Jenkins, MD',
        start_date: body.start_date || new Date().toISOString().slice(0, 10),
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: body.pill_color_shape || '',
        special_instructions: body.special_instructions || '',
        titrations: []
      };

      await DB.prepare(`
        INSERT INTO medications (
          id, patient_id, drug_name, generic_name, dosage, form, frequency,
          time_of_day, purpose, prescribing_doctor, start_date, end_date,
          is_active, pill_color_shape, special_instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        med.id, med.patient_id, med.drug_name, med.generic_name, med.dosage, med.form, med.frequency,
        med.time_of_day, med.purpose, med.prescribing_doctor, med.start_date, med.end_date,
        med.is_active, med.pill_color_shape, med.special_instructions
      ).run();

      return jsonResponse({ success: true, medication: med }, 201);
    }

    // POST /api/medications/:id/titrate
    const titrateMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/titrate$/);
    if (titrateMatch && method === 'POST') {
      const medId = decodeURIComponent(titrateMatch[1]);
      const body = await request.json();
      if (!body.new_dosage) {
        return jsonResponse({ error: 'New dosage is required' }, 400);
      }

      const med = await DB.prepare(`SELECT * FROM medications WHERE id = ?`).bind(medId).first();
      if (!med) return jsonResponse({ error: 'Medication not found' }, 404);

      const titrationId = uid('tit');
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      await DB.batch([
        DB.prepare(`
          INSERT INTO medication_titrations (
            id, medication_id, patient_id, previous_dosage, new_dosage,
            previous_frequency, new_frequency, reason, changed_by, changed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          titrationId, med.id, med.patient_id, med.dosage, body.new_dosage,
          med.frequency || '', body.new_frequency || med.frequency,
          body.reason || 'Dosage adjusted', body.changed_by || 'Attending Physician', now
        ),
        DB.prepare(`
          UPDATE medications
          SET dosage = ?, frequency = COALESCE(?, frequency)
          WHERE id = ?
        `).bind(body.new_dosage, body.new_frequency || null, med.id)
      ]);

      const updated = await DB.prepare(`SELECT * FROM medications WHERE id = ?`).bind(med.id).first();
      return jsonResponse({ success: true, medication: updated }, 200);
    }

    // POST /api/medications/:id/discontinue
    const discMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/discontinue$/);
    if (discMatch && method === 'POST') {
      const medId = decodeURIComponent(discMatch[1]);
      const body = await request.json().catch(() => ({}));
      const reason = body.reason || 'Discontinued by clinician';
      const discontinuedBy = body.discontinued_by || 'Dr. Sarah Jenkins, MD';
      const today = new Date().toISOString().slice(0, 10);

      await DB.prepare(`
        UPDATE medications
        SET is_active = 0, discontinued_reason = ?, discontinued_date = ?, discontinued_by = ?
        WHERE id = ?
      `).bind(reason, today, discontinuedBy, medId).run();

      const updated = await DB.prepare(`SELECT * FROM medications WHERE id = ?`).bind(medId).first();
      return jsonResponse({ success: true, medication: updated }, 200);
    }

    // POST /api/medications/:id/reactivate
    const reactMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/reactivate$/);
    if (reactMatch && method === 'POST') {
      const medId = decodeURIComponent(reactMatch[1]);
      const body = await request.json().catch(() => ({}));

      await DB.prepare(`
        UPDATE medications
        SET is_active = 1, discontinued_reason = NULL, discontinued_date = NULL, discontinued_by = NULL
        WHERE id = ?
      `).bind(medId).run();

      const updated = await DB.prepare(`SELECT * FROM medications WHERE id = ?`).bind(medId).first();
      return jsonResponse({ success: true, medication: updated }, 200);
    }

    // GET /api/medications/:id/history
    const medHistMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/history$/);
    if (medHistMatch && method === 'GET') {
      const medId = decodeURIComponent(medHistMatch[1]);
      const { results } = await DB.prepare(
        `SELECT * FROM medication_titrations WHERE medication_id = ? ORDER BY changed_at DESC`
      ).bind(medId).all();

      return jsonResponse({ success: true, history: results || [] }, 200);
    }

    // PATCH /api/medications/:id/status
    const patchStatusMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/status$/);
    if (patchStatusMatch && method === 'PATCH') {
      const medId = decodeURIComponent(patchStatusMatch[1]);
      const body = await request.json();
      const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;

      await DB.prepare(`UPDATE medications SET is_active = ? WHERE id = ?`).bind(isActive, medId).run();
      const updated = await DB.prepare(`SELECT * FROM medications WHERE id = ?`).bind(medId).first();
      return jsonResponse({ success: true, medication: updated }, 200);
    }

    // POST /api/patients/:id/audit-scan
    const auditMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/audit-scan$/);
    if (auditMatch && method === 'POST') {
      const idOrCode = decodeURIComponent(auditMatch[1]);
      const p = await DB.prepare(`SELECT id FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`).bind(idOrCode, idOrCode).first();
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);

      const body = await request.json().catch(() => ({}));
      const userAgent = request.headers.get('user-agent') || 'Unknown Device';

      await DB.prepare(`
        INSERT INTO scan_audits (id, patient_id, scanned_at, scanner_role, user_agent, location_approx)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        uid('scn'), p.id,
        new Date().toISOString().replace('T', ' ').slice(0, 19),
        body.scanner_role || 'Field Clinician',
        userAgent.slice(0, 120),
        body.location_approx || 'Hospital Bedside'
      ).run();

      return jsonResponse({ success: true }, 200);
    }

    // POST /api/patients/:id/commit-scanned-records
    const commitMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/commit-scanned-records$/);
    if (commitMatch && method === 'POST') {
      const idOrCode = decodeURIComponent(commitMatch[1]);
      const p = await DB.prepare(`SELECT id FROM patients WHERE id = ? OR qr_code = ? COLLATE NOCASE LIMIT 1`).bind(idOrCode, idOrCode).first();
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);

      const body = await request.json();
      const stmts = [];
      let medicationsCount = 0;
      let allergiesCount = 0;
      let vitalsCount = 0;
      let conditionsCount = 0;
      let labsCount = 0;

      for (const m of (body.medications || [])) {
        stmts.push(DB.prepare(`
          INSERT INTO medications (
            id, patient_id, drug_name, dosage, frequency, form, route, is_active, start_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, date('now'))
        `).bind(
          uid('med'), p.id, m.drug_name, m.dosage, m.frequency || 'Daily',
          m.form || 'Tablet', m.route || 'Oral'
        ));
        medicationsCount++;
      }

      for (const a of (body.allergies || [])) {
        stmts.push(DB.prepare(`
          INSERT INTO allergies (
            id, patient_id, allergen, reaction, severity, category, verification_status, diagnosed_date
          ) VALUES (?, ?, ?, ?, ?, ?, 'Confirmed', date('now'))
        `).bind(
          uid('alg'), p.id, a.allergen, a.reaction || 'Allergic reaction',
          a.severity || 'Moderate', a.category || 'Drug'
        ));
        allergiesCount++;
      }

      for (const v of (body.vitals || [])) {
        stmts.push(DB.prepare(`
          INSERT INTO vitals_logs (
            id, patient_id, recorded_at, blood_pressure, heart_rate, spo2, temperature, blood_glucose, recorded_by
          ) VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, 'OCR Scanner Intake')
        `).bind(
          uid('vit'), p.id, v.blood_pressure || null, v.heart_rate || null,
          v.spo2 || null, v.temperature || null, v.blood_glucose || null
        ));
        vitalsCount++;
      }

      for (const c of (body.conditions || [])) {
        stmts.push(DB.prepare(`
          INSERT INTO medical_history (
            id, patient_id, condition_name, icd10_code, category, diagnosed_date, status, treating_facility, notes
          ) VALUES (?, ?, ?, ?, ?, date('now'), 'Active', 'Scanned Clinical Record', 'Transcribed from medical scan')
        `).bind(
          uid('his'), p.id, c.condition_name, c.icd10_code || '', c.category || 'General'
        ));
        conditionsCount++;
      }

      for (const l of (body.labs || [])) {
        stmts.push(DB.prepare(`
          INSERT INTO lab_reports (
            id, patient_id, test_name, category, test_date, result_value, reference_range, flag, ordering_doctor, facility
          ) VALUES (?, ?, ?, ?, date('now'), ?, ?, ?, 'Scanned Lab Provider', 'Clinical Lab')
        `).bind(
          uid('lab'), p.id, l.test_name, l.category || 'Diagnostic Panel',
          l.result_value, l.reference_range || '', l.flag || 'Normal'
        ));
        labsCount++;
      }

      if (stmts.length > 0) {
        await DB.batch(stmts);
      }

      return jsonResponse({
        success: true,
        committed: {
          medicationsCount,
          allergiesCount,
          vitalsCount,
          conditionsCount,
          labsCount
        }
      }, 201);
    }

    // GET /api/patients/:idOrCode (Individual patient profile)
    const patientMatch = fullPath.match(/^\/api\/patients\/([^/]+)$/);
    if (patientMatch && method === 'GET') {
      const idOrCode = patientMatch[1];
      const patient = await getPatientByIdOrCode(DB, idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      return jsonResponse({ patient }, 200);
    }

    return jsonResponse({ error: 'Endpoint not found', path: fullPath }, 404);
  } catch (err) {
    console.error('D1 handler error:', err);
    return jsonResponse({ error: err.message, stack: err.stack }, 500);
  }
}

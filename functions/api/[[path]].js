// Cloudflare Pages Serverless Edge API Handler — D1 Persistent Storage
// Handles all /api/* routes. Uses Cloudflare D1 SQLite at the edge.

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


async function initDB(DB) {
  await DB.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY, qr_code TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      dob TEXT, gender TEXT, blood_type TEXT, phone TEXT, email TEXT, address TEXT,
      organ_donor INTEGER DEFAULT 0, dnr_status INTEGER DEFAULT 0,
      emergency_summary TEXT, avatar_url TEXT, primary_physician TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, patient_id TEXT NOT NULL,
      type TEXT, date TEXT, author TEXT, content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL,
      date TEXT, bp_systolic INTEGER, bp_diastolic INTEGER, heart_rate INTEGER,
      weight_kg REAL, temperature REAL, oxygen_sat INTEGER, blood_glucose REAL, notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL,
      allergen TEXT, reaction TEXT, severity TEXT, diagnosed TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY, patient_id TEXT NOT NULL,
      name TEXT, dose TEXT, frequency TEXT, route TEXT, prescriber TEXT,
      start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active', indication TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS medication_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, medication_id TEXT NOT NULL,
      date TEXT, change_desc TEXT, reason TEXT, changed_by TEXT,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')), action TEXT, user TEXT, details TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS scanned_records (
      id TEXT PRIMARY KEY, patient_id TEXT NOT NULL,
      scan_date TEXT, scanned_by TEXT, location TEXT, records TEXT,
      status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);
}
async function ensureSeeded(DB) {
  await initDB(DB);
  const row = await DB.prepare('SELECT COUNT(*) as count FROM patients').first();
  if (row.count > 0) return;

  const stmts = [];
  for (const p of SEED_PATIENTS) {
    stmts.push(DB.prepare(
      `INSERT OR IGNORE INTO patients
        (id,qr_code,first_name,last_name,dob,gender,blood_type,phone,email,
         address,organ_donor,dnr_status,emergency_summary,avatar_url,primary_physician)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(p.id,p.qr_code,p.first_name,p.last_name,p.dob,p.gender,p.blood_type,
           p.phone,p.email,p.address,p.organ_donor??0,p.dnr_status??0,
           p.emergency_summary,p.avatar_url,p.primary_physician));

    for (const n of (p.notes||[])) {
      stmts.push(DB.prepare(
        `INSERT OR IGNORE INTO notes (id,patient_id,type,date,author,content) VALUES (?,?,?,?,?,?)`
      ).bind(n.id||uid('note'),p.id,n.type,n.date,n.author,n.content));
    }
    for (const v of (p.vitals||[])) {
      stmts.push(DB.prepare(
        `INSERT INTO vitals (patient_id,date,bp_systolic,bp_diastolic,heart_rate,weight_kg,temperature,oxygen_sat,blood_glucose,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(p.id,v.date,v.bp_systolic||null,v.bp_diastolic||null,v.heart_rate||null,v.weight_kg||null,v.temperature||null,v.oxygen_sat||null,v.blood_glucose||null,v.notes||null));
    }
    for (const a of (p.allergies||[])) {
      stmts.push(DB.prepare(
        `INSERT INTO allergies (patient_id,allergen,reaction,severity,diagnosed) VALUES (?,?,?,?,?)`
      ).bind(p.id,a.allergen,a.reaction,a.severity,a.diagnosed));
    }
    for (const m of (p.medications||[])) {
      const mid = m.id||uid('med');
      stmts.push(DB.prepare(
        `INSERT OR IGNORE INTO medications (id,patient_id,name,dose,frequency,route,prescriber,start_date,end_date,status,indication) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(mid,p.id,m.name||m.drug_name,m.dose||m.dosage,m.frequency,m.route,m.prescriber||m.prescribing_doctor,m.start_date,m.end_date??null,m.status||(m.is_active?'active':'inactive'),m.indication||null));
      for (const h of (m.history||m.titrations||[])) {
        stmts.push(DB.prepare(
          `INSERT INTO medication_history (medication_id,date,change_desc,reason,changed_by) VALUES (?,?,?,?,?)`
        ).bind(mid,h.date,h.change||h.new_dosage,h.reason,h.by||h.changed_by));
      }
    }
    for (const al of (p.audit_log||[])) {
      stmts.push(DB.prepare(
        `INSERT INTO audit_log (patient_id,timestamp,action,user,details) VALUES (?,?,?,?,?)`
      ).bind(p.id,al.timestamp,al.action,al.user,al.details));
    }
  }
  for (let i = 0; i < stmts.length; i += 100) {
    await DB.batch(stmts.slice(i, i+100));
  }
}

async function getPatient(DB, idOrCode) {
  const t = decodeURIComponent(idOrCode);
  const patient = await DB.prepare(
    `SELECT * FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`
  ).bind(t,t).first();
  if (!patient) return null;
  const [notes, vitals, allergies, meds, audit] = await Promise.all([
    DB.prepare(`SELECT * FROM notes WHERE patient_id=? ORDER BY date DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM vitals WHERE patient_id=? ORDER BY date DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM allergies WHERE patient_id=?`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM medications WHERE patient_id=? ORDER BY start_date DESC`).bind(patient.id).all(),
    DB.prepare(`SELECT * FROM audit_log WHERE patient_id=? ORDER BY timestamp DESC LIMIT 50`).bind(patient.id).all(),
  ]);
  const medsWithHistory = await Promise.all((meds.results||[]).map(async m => {
    const h = await DB.prepare(`SELECT * FROM medication_history WHERE medication_id=? ORDER BY date DESC`).bind(m.id).all();
    return {...m, history: h.results||[]};
  }));
  return {...patient, notes:notes.results||[], vitals:vitals.results||[], allergies:allergies.results||[], medications:medsWithHistory, audit_log:audit.results||[]};
}

export async function onRequest(context) {
  const { request, params, env } = context;
  const DB = env.DB;
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = params.path || [];
  const fullPath = '/api/' + (Array.isArray(pathParts) ? pathParts.join('/') : pathParts);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (!DB) {
    return jsonResponse({ error: 'D1 database not bound. Configure DB binding in Cloudflare Pages settings.' }, 503);
  }

  try {
    await ensureSeeded(DB);

    if (fullPath === '/api/health' && method === 'GET') {
      const row = await DB.prepare('SELECT COUNT(*) as count FROM patients').first();
      return jsonResponse({ status: 'ok', provider: 'Cloudflare Pages + D1', patients: row.count, time: new Date().toISOString() });
    }

    if (fullPath === '/api/reset-demo' && method === 'POST') {
      await DB.batch([
        DB.prepare('DELETE FROM medication_history'),
        DB.prepare('DELETE FROM audit_log'),
        DB.prepare('DELETE FROM scanned_records'),
        DB.prepare('DELETE FROM notes'),
        DB.prepare('DELETE FROM vitals'),
        DB.prepare('DELETE FROM allergies'),
        DB.prepare('DELETE FROM medications'),
        DB.prepare('DELETE FROM patients'),
      ]);
      await ensureSeeded(DB);
      return jsonResponse({ success: true, message: 'Reset to seed data' });
    }

    if (fullPath === '/api/stats' && method === 'GET') {
      const [p,am,tm,n,sa] = await Promise.all([
        DB.prepare('SELECT COUNT(*) as c FROM patients').first(),
        DB.prepare("SELECT COUNT(*) as c FROM medications WHERE status='active'").first(),
        DB.prepare('SELECT COUNT(*) as c FROM medications').first(),
        DB.prepare('SELECT COUNT(*) as c FROM notes').first(),
        DB.prepare("SELECT COUNT(*) as c FROM allergies WHERE severity IN ('Life-threatening','Severe','Serious')").first(),
      ]);
      return jsonResponse({ patientCount:p.c, medsCount:am.c, oldMedsCount:tm.c-am.c, notesCount:n.c, severeAllergiesCount:sa.c });
    }

    if (fullPath === '/api/patients' && method === 'GET') {
      const search = (url.searchParams.get('search')||'').trim();
      const blood = url.searchParams.get('bloodType')||'';
      let q = `SELECT p.*, (SELECT COUNT(*) FROM medications m WHERE m.patient_id=p.id AND m.status='active') as active_meds_count, (SELECT COUNT(*) FROM allergies a WHERE a.patient_id=p.id) as allergies_count FROM patients p`;
      const b = [];
      const cond = [];
      if (blood) { cond.push('p.blood_type=?'); b.push(blood); }
      if (search) { cond.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.qr_code LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)'); const s=`%${search}%`; b.push(s,s,s,s,s); }
      if (cond.length) q += ' WHERE '+cond.join(' AND ');
      q += ' ORDER BY p.last_name, p.first_name';
      const { results } = await DB.prepare(q).bind(...b).all();
      return jsonResponse({ patients: results||[] });
    }

    const patientGet = fullPath.match(/^\/api\/patients\/([^/]+)$/);
    if (patientGet && method === 'GET') {
      const p = await getPatient(DB, patientGet[1]);
      if (!p) return jsonResponse({ error: 'Patient not found' }, 404);
      return jsonResponse({ patient: p });
    }

    const trendsM = fullPath.match(/^\/api\/patients\/([^/]+)\/trends$/);
    if (trendsM && method === 'GET') {
      const t = decodeURIComponent(trendsM[1]);
      const pat = await DB.prepare(`SELECT id FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`).bind(t,t).first();
      if (!pat) return jsonResponse({ error: 'Patient not found' }, 404);
      const v = await DB.prepare(`SELECT * FROM vitals WHERE patient_id=? ORDER BY date DESC`).bind(pat.id).all();
      return jsonResponse({ success:true, trends:{ patientId:pat.id, vitalsTimeline:v.results||[] } });
    }

    const noteM = fullPath.match(/^\/api\/patients\/([^/]+)\/notes$/);
    if (noteM && method === 'POST') {
      const t = decodeURIComponent(noteM[1]);
      const pat = await DB.prepare(`SELECT id FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`).bind(t,t).first();
      if (!pat) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      if (!body.content && !body.assessment) return jsonResponse({ error: 'content is required' }, 400);
      const note = { id:uid('note'), patient_id:pat.id, type:body.type||body.encounter_type||'Progress Note', date:new Date().toISOString().slice(0,10), author:body.author||body.provider_name||'Clinical Staff', content:body.content||body.assessment||'' };
      await DB.prepare(`INSERT INTO notes (id,patient_id,type,date,author,content) VALUES (?,?,?,?,?,?)`).bind(note.id,note.patient_id,note.type,note.date,note.author,note.content).run();
      return jsonResponse({ success:true, note }, 201);
    }

    const vitalsM = fullPath.match(/^\/api\/patients\/([^/]+)\/vitals$/);
    if (vitalsM && method === 'POST') {
      const t = decodeURIComponent(vitalsM[1]);
      const pat = await DB.prepare(`SELECT id FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`).bind(t,t).first();
      if (!pat) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      let sys=null,dia=null;
      if (body.blood_pressure) { const m=String(body.blood_pressure).match(/(\d+)\s*\/\s*(\d+)/); if(m){sys=parseInt(m[1]);dia=parseInt(m[2]);} }
      if (body.bp_systolic) sys=parseInt(body.bp_systolic);
      if (body.bp_diastolic) dia=parseInt(body.bp_diastolic);
      const r = await DB.prepare(`INSERT INTO vitals (patient_id,date,bp_systolic,bp_diastolic,heart_rate,weight_kg,temperature,oxygen_sat,blood_glucose,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(pat.id,body.date||new Date().toISOString().slice(0,10),sys,dia,body.heart_rate?parseInt(body.heart_rate):null,body.weight_kg?parseFloat(body.weight_kg):null,body.temperature?parseFloat(body.temperature):null,body.spo2||body.oxygen_sat?parseInt(body.spo2||body.oxygen_sat):null,body.blood_glucose?parseFloat(body.blood_glucose):null,body.notes||null).run();
      return jsonResponse({ success:true, id:r.meta.last_row_id }, 201);
    }

    const allergyM = fullPath.match(/^\/api\/patients\/([^/]+)\/allergies$/);
    if (allergyM && method === 'POST') {
      const t = decodeURIComponent(allergyM[1]);
      const pat = await DB.prepare(`SELECT id FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`).bind(t,t).first();
      if (!pat) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      if (!body.allergen) return jsonResponse({ error: 'allergen is required' }, 400);
      const r = await DB.prepare(`INSERT INTO allergies (patient_id,allergen,reaction,severity,diagnosed) VALUES (?,?,?,?,?)`).bind(pat.id,body.allergen,body.reaction||'Allergic reaction',body.severity||'Moderate',body.diagnosed||body.diagnosed_date||new Date().toISOString().slice(0,10)).run();
      return jsonResponse({ success:true, id:r.meta.last_row_id }, 201);
    }

    const addMedM = fullPath.match(/^\/api\/patients\/([^/]+)\/medications$/);
    if (addMedM && method === 'POST') {
      const t = decodeURIComponent(addMedM[1]);
      const pat = await DB.prepare(`SELECT id FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`).bind(t,t).first();
      if (!pat) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      if (!body.name && !body.drug_name) return jsonResponse({ error: 'name is required' }, 400);
      const mid = body.id||uid('med');
      await DB.prepare(`INSERT INTO medications (id,patient_id,name,dose,frequency,route,prescriber,start_date,status,indication) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(mid,pat.id,body.name||body.drug_name,body.dose||body.dosage||null,body.frequency||'Once daily',body.route||'Oral',body.prescriber||body.prescribing_doctor||'Attending Physician',body.start_date||new Date().toISOString().slice(0,10),body.status||'active',body.indication||null).run();
      return jsonResponse({ success:true, id:mid }, 201);
    }

    const medHistM = fullPath.match(/^\/api\/medications\/([^/]+)\/history$/);
    if (medHistM && method === 'GET') {
      const { results } = await DB.prepare(`SELECT * FROM medication_history WHERE medication_id=? ORDER BY date DESC`).bind(medHistM[1]).all();
      return jsonResponse({ success:true, history:results||[] });
    }

    const patchStatM = fullPath.match(/^\/api\/medications\/([^/]+)\/status$/);
    if (patchStatM && method === 'PATCH') {
      const body = await request.json();
      const s = (body.is_active || body.status === 'active') ? 'active' : 'inactive';
      await DB.prepare(`UPDATE medications SET status=?, end_date=? WHERE id=?`).bind(s, s==='inactive'?new Date().toISOString().slice(0,10):null, patchStatM[1]).run();
      return jsonResponse({ success:true, status:s });
    }

    const titrateM = fullPath.match(/^\/api\/medications\/([^/]+)\/titrate$/);
    if (titrateM && method === 'POST') {
      const body = await request.json();
      if (!body.new_dosage) return jsonResponse({ error: 'new_dosage required' }, 400);
      const med = await DB.prepare(`SELECT * FROM medications WHERE id=?`).bind(titrateM[1]).first();
      if (!med) return jsonResponse({ error: 'Medication not found' }, 404);
      await DB.batch([
        DB.prepare(`INSERT INTO medication_history (medication_id,date,change_desc,reason,changed_by) VALUES (?,?,?,?,?)`).bind(med.id,new Date().toISOString().slice(0,10),`${med.dose} → ${body.new_dosage}`,body.reason||'Adjusted',body.changed_by||'Clinician'),
        DB.prepare(`UPDATE medications SET dose=? WHERE id=?`).bind(body.new_dosage, med.id)
      ]);
      return jsonResponse({ success:true });
    }

    const discM = fullPath.match(/^\/api\/medications\/([^/]+)\/discontinue$/);
    if (discM && method === 'POST') {
      await DB.prepare(`UPDATE medications SET status='inactive', end_date=? WHERE id=?`).bind(new Date().toISOString().slice(0,10), discM[1]).run();
      return jsonResponse({ success:true });
    }

    const reactM = fullPath.match(/^\/api\/medications\/([^/]+)\/reactivate$/);
    if (reactM && method === 'POST') {
      await DB.prepare(`UPDATE medications SET status='active', end_date=NULL WHERE id=?`).bind(reactM[1]).run();
      return jsonResponse({ success:true });
    }

    const auditM = fullPath.match(/^\/api\/patients\/([^/]+)\/audit-scan$/);
    if (auditM && method === 'POST') {
      const t = decodeURIComponent(auditM[1]);
      const pat = await DB.prepare(`SELECT id FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`).bind(t,t).first();
      if (!pat) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json().catch(()=>({}));
      await DB.prepare(`INSERT INTO audit_log (patient_id,timestamp,action,user,details) VALUES (?,?,?,?,?)`).bind(pat.id,new Date().toISOString(),'scan',body.scanner_role||'Field Clinician',body.location_approx||'Hospital').run();
      return jsonResponse({ success:true });
    }

    const commitM = fullPath.match(/^\/api\/patients\/([^/]+)\/commit-scanned-records$/);
    if (commitM && method === 'POST') {
      const t = decodeURIComponent(commitM[1]);
      const pat = await DB.prepare(`SELECT id FROM patients WHERE id=? OR qr_code=? COLLATE NOCASE LIMIT 1`).bind(t,t).first();
      if (!pat) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      const stmts = [];
      let mc=0,ac=0,vc=0;
      for (const m of (body.medications||[])) { stmts.push(DB.prepare(`INSERT INTO medications (id,patient_id,name,dose,frequency,route,start_date,status) VALUES (?,?,?,?,?,?,?,?)`).bind(uid('med'),pat.id,m.drug_name||m.name,m.dosage||m.dose,m.frequency||'Daily',m.route||'Oral',new Date().toISOString().slice(0,10),'active')); mc++; }
      for (const a of (body.allergies||[])) { stmts.push(DB.prepare(`INSERT INTO allergies (patient_id,allergen,reaction,severity) VALUES (?,?,?,?)`).bind(pat.id,a.allergen,a.reaction||'Allergic reaction',a.severity||'Moderate')); ac++; }
      for (const v of (body.vitals||[])) { stmts.push(DB.prepare(`INSERT INTO vitals (patient_id,date,bp_systolic,bp_diastolic,heart_rate,temperature,oxygen_sat,blood_glucose) VALUES (?,?,?,?,?,?,?,?)`).bind(pat.id,new Date().toISOString().slice(0,10),v.bp_systolic||null,v.bp_diastolic||null,v.heart_rate||null,v.temperature||null,v.spo2||v.oxygen_sat||null,v.blood_glucose||null)); vc++; }
      if (stmts.length) await DB.batch(stmts);
      return jsonResponse({ success:true, committed:{ medicationsCount:mc, allergiesCount:ac, vitalsCount:vc } }, 201);
    }

    return jsonResponse({ error: 'Endpoint not found', path: fullPath }, 404);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
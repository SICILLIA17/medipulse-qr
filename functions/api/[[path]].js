// Cloudflare Pages Serverless Edge API Handler
// Automatically handles all /api/* routes when hosted on Cloudflare Pages

import { SEED_PATIENTS } from '../data/seed-data.js';

// In-memory edge cache clone for Cloudflare execution
let edgePatients = JSON.parse(JSON.stringify(SEED_PATIENTS));

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function findPatient(idOrCode) {
  if (!idOrCode) return null;
  const target = decodeURIComponent(idOrCode).toLowerCase();
  return edgePatients.find(p =>
    (p.id && p.id.toLowerCase() === target) ||
    (p.qr_code && p.qr_code.toLowerCase() === target)
  );
}

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = params.path || [];
  const fullPath = '/api/' + (Array.isArray(pathParts) ? pathParts.join('/') : pathParts);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    // -------------------------------------------------------------
    // GET /api/health
    // -------------------------------------------------------------
    if (fullPath === '/api/health' && method === 'GET') {
      return jsonResponse({
        status: 'ok',
        provider: 'Cloudflare Pages Edge',
        time: new Date().toISOString()
      });
    }

    // -------------------------------------------------------------
    // GET /api/stats
    // -------------------------------------------------------------
    if (fullPath === '/api/stats' && method === 'GET') {
      let medsCount = 0;
      let oldMedsCount = 0;
      let titrationsCount = 0;
      let notesCount = 0;
      let severeAllergiesCount = 0;

      edgePatients.forEach(p => {
        (p.medications || []).forEach(m => {
          if (m.is_active) medsCount++;
          else oldMedsCount++;
          titrationsCount += (m.titrations || []).length;
        });
        (p.allergies || []).forEach(a => {
          if (a.severity === 'Life-Threatening' || a.severity === 'Severe') {
            severeAllergiesCount++;
          }
        });
        notesCount += (p.clinical_notes || []).length;
      });

      return jsonResponse({
        patientCount: edgePatients.length,
        medsCount,
        oldMedsCount,
        titrationsCount,
        notesCount,
        severeAllergiesCount
      });
    }

    // -------------------------------------------------------------
    // POST /api/reset-demo
    // -------------------------------------------------------------
    if (fullPath === '/api/reset-demo' && method === 'POST') {
      edgePatients = JSON.parse(JSON.stringify(SEED_PATIENTS));
      return jsonResponse({ success: true, message: 'Reset edge demo data' });
    }

    // -------------------------------------------------------------
    // GET /api/patients
    // -------------------------------------------------------------
    if (fullPath === '/api/patients' && method === 'GET') {
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const blood = url.searchParams.get('bloodType') || '';
      let list = edgePatients.map(p => ({
        ...p,
        active_meds_count: (p.medications || []).filter(m => m.is_active).length,
        allergies_count: (p.allergies || []).length
      }));

      if (blood) {
        list = list.filter(p => p.blood_type === blood);
      }
      if (search) {
        list = list.filter(p =>
          (p.first_name && p.first_name.toLowerCase().includes(search)) ||
          (p.last_name && p.last_name.toLowerCase().includes(search)) ||
          (p.qr_code && p.qr_code.toLowerCase().includes(search)) ||
          (p.phone && p.phone.toLowerCase().includes(search)) ||
          (p.email && p.email.toLowerCase().includes(search))
        );
      }
      return jsonResponse({ patients: list });
    }

    // -------------------------------------------------------------
    // GET /api/patients/:id/trends
    // -------------------------------------------------------------
    const trendsMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/trends$/);
    if (trendsMatch && method === 'GET') {
      const idOrCode = trendsMatch[1];
      const patient = findPatient(idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);

      const vitalsTimeline = (patient.vitals || []).map(v => {
        let systolic = null;
        let diastolic = null;
        if (v.blood_pressure) {
          const m = v.blood_pressure.match(/(\d+)\s*\/\s*(\d+)/);
          if (m) {
            systolic = parseInt(m[1]);
            diastolic = parseInt(m[2]);
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
          patientId: patient.id,
          vitalsTimeline,
          labsTimeline: patient.lab_reports || []
        }
      });
    }

    // -------------------------------------------------------------
    // POST /api/patients/:id/notes
    // -------------------------------------------------------------
    const noteMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/notes$/);
    if (noteMatch && method === 'POST') {
      const idOrCode = noteMatch[1];
      const patient = findPatient(idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      if (!body.assessment || !body.plan) {
        return jsonResponse({ error: 'Assessment and Plan are required fields' }, 400);
      }
      const note = {
        id: 'note-' + Math.random().toString(36).slice(2, 9),
        encounter_type: body.encounter_type || 'Follow-up Consultation',
        assessment: body.assessment,
        plan: body.plan,
        provider_name: body.provider_name || 'Dr. Sarah Jenkins, MD',
        provider_role: body.provider_role || 'Attending Physician',
        created_at: new Date().toISOString()
      };
      patient.clinical_notes = patient.clinical_notes || [];
      patient.clinical_notes.unshift(note);
      return jsonResponse({ success: true, note }, 201);
    }

    // -------------------------------------------------------------
    // POST /api/patients/:id/vitals
    // -------------------------------------------------------------
    const vitalsMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/vitals$/);
    if (vitalsMatch && method === 'POST') {
      const idOrCode = vitalsMatch[1];
      const patient = findPatient(idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      const vitalsLog = {
        id: 'vit-' + Math.random().toString(36).slice(2, 9),
        blood_pressure: body.blood_pressure || null,
        heart_rate: body.heart_rate ? parseInt(body.heart_rate) : null,
        spo2: body.spo2 ? parseInt(body.spo2) : null,
        temperature: body.temperature ? parseFloat(body.temperature) : null,
        blood_glucose: body.blood_glucose ? parseInt(body.blood_glucose) : null,
        recorded_at: new Date().toISOString(),
        recorded_by: body.recorded_by || 'Clinical Staff'
      };
      patient.vitals = patient.vitals || [];
      patient.vitals.unshift(vitalsLog);
      return jsonResponse({ success: true, vitals: vitalsLog }, 201);
    }

    // -------------------------------------------------------------
    // POST /api/patients/:id/allergies
    // -------------------------------------------------------------
    const allergyMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/allergies$/);
    if (allergyMatch && method === 'POST') {
      const idOrCode = allergyMatch[1];
      const patient = findPatient(idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      if (!body.allergen) {
        return jsonResponse({ error: 'Allergen name is required' }, 400);
      }
      const allergy = {
        id: 'alg-' + Math.random().toString(36).slice(2, 9),
        allergen: body.allergen,
        reaction: body.reaction || 'Unspecified allergic reaction',
        severity: body.severity || 'Moderate',
        category: body.category || 'Drug',
        verification_status: body.verification_status || 'Confirmed',
        diagnosed_date: body.diagnosed_date || new Date().toISOString().slice(0, 10),
        notes: body.notes || ''
      };
      patient.allergies = patient.allergies || [];
      patient.allergies.unshift(allergy);
      return jsonResponse({ success: true, allergy }, 201);
    }

    // -------------------------------------------------------------
    // POST /api/patients/:id/medications
    // -------------------------------------------------------------
    const addMedMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/medications$/);
    if (addMedMatch && method === 'POST') {
      const idOrCode = addMedMatch[1];
      const patient = findPatient(idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json();
      if (!body.drug_name || !body.dosage) {
        return jsonResponse({ error: 'Drug name and dosage are required' }, 400);
      }
      const med = {
        id: 'med-' + Math.random().toString(36).slice(2, 9),
        drug_name: body.drug_name,
        dosage: body.dosage,
        frequency: body.frequency || 'Once daily',
        route: body.route || 'Oral',
        form: body.form || 'Tablet',
        appearance: body.appearance || '',
        prescribing_doctor: body.prescribing_doctor || 'Dr. Sarah Jenkins, MD',
        start_date: body.start_date || new Date().toISOString().slice(0, 10),
        is_active: 1,
        titrations: []
      };
      patient.medications = patient.medications || [];
      patient.medications.unshift(med);
      return jsonResponse({ success: true, medication: med }, 201);
    }

    // -------------------------------------------------------------
    // POST /api/patients/:id/audit-scan
    // -------------------------------------------------------------
    const auditMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/audit-scan$/);
    if (auditMatch && method === 'POST') {
      const idOrCode = auditMatch[1];
      const patient = findPatient(idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      const body = await request.json().catch(() => ({}));
      const userAgent = request.headers.get('user-agent') || 'Unknown Device';
      const scan = {
        id: 'scn-' + Math.random().toString(36).slice(2, 9),
        scanned_at: new Date().toISOString(),
        scanner_role: body.scanner_role || 'Field Clinician',
        scanner_device: userAgent.slice(0, 100),
        location_approx: body.location_approx || 'Hospital Bedside'
      };
      patient.recent_scans = patient.recent_scans || [];
      patient.recent_scans.unshift(scan);
      return jsonResponse({ success: true, scan }, 200);
    }

    // -------------------------------------------------------------
    // GET /api/patients/:idOrCode
    // -------------------------------------------------------------
    const patientMatch = fullPath.match(/^\/api\/patients\/([^/]+)$/);
    if (patientMatch && method === 'GET') {
      const idOrCode = patientMatch[1];
      const patient = findPatient(idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      return jsonResponse({ patient });
    }

    // -------------------------------------------------------------
    // POST /api/medications/:id/titrate
    // -------------------------------------------------------------
    const titrateMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/titrate$/);
    if (titrateMatch && method === 'POST') {
      const medId = titrateMatch[1];
      const body = await request.json();
      if (!body.new_dosage) {
        return jsonResponse({ error: 'New dosage is required' }, 400);
      }
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          med.titrations = med.titrations || [];
          med.titrations.unshift({
            id: 'tit-' + Math.random().toString(36).slice(2, 9),
            previous_dosage: med.dosage,
            new_dosage: body.new_dosage,
            reason: body.reason || 'Dosage adjusted',
            changed_by: body.changed_by || 'Attending Physician',
            changed_at: new Date().toISOString()
          });
          med.dosage = body.new_dosage;
          if (body.new_frequency) med.frequency = body.new_frequency;
          return jsonResponse({ success: true, medication: med });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // -------------------------------------------------------------
    // GET /api/medications/:id/history
    // -------------------------------------------------------------
    const medHistoryMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/history$/);
    if (medHistoryMatch && method === 'GET') {
      const medId = medHistoryMatch[1];
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          return jsonResponse({ success: true, history: med.titrations || [] });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // -------------------------------------------------------------
    // POST /api/medications/:id/discontinue
    // -------------------------------------------------------------
    const discMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/discontinue$/);
    if (discMatch && method === 'POST') {
      const medId = discMatch[1];
      const body = await request.json();
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          med.is_active = 0;
          med.discontinued_reason = body.reason || 'Discontinued by clinician';
          med.discontinued_date = new Date().toISOString().slice(0, 10);
          med.discontinued_by = body.discontinued_by || 'Dr. Sarah Jenkins, MD';
          return jsonResponse({ success: true, medication: med });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // -------------------------------------------------------------
    // POST /api/medications/:id/reactivate
    // -------------------------------------------------------------
    const reactMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/reactivate$/);
    if (reactMatch && method === 'POST') {
      const medId = reactMatch[1];
      const body = await request.json().catch(() => ({}));
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          med.is_active = 1;
          med.discontinued_reason = null;
          med.start_date = new Date().toISOString().slice(0, 10);
          if (body.dosage) med.dosage = body.dosage;
          return jsonResponse({ success: true, medication: med });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // -------------------------------------------------------------
    // PATCH /api/medications/:id/status
    // -------------------------------------------------------------
    const patchStatusMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/status$/);
    if (patchStatusMatch && method === 'PATCH') {
      const medId = patchStatusMatch[1];
      const body = await request.json();
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          med.is_active = body.is_active ? 1 : 0;
          return jsonResponse({ success: true, medication: med });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // -------------------------------------------------------------
    // POST /api/patients/:id/commit-scanned-records
    // -------------------------------------------------------------
    const commitMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/commit-scanned-records$/);
    if (commitMatch && method === 'POST') {
      const patientId = commitMatch[1];
      const body = await request.json();
      const p = findPatient(patientId);
      if (p) {
        let medicationsCount = 0;
        let allergiesCount = 0;
        let vitalsCount = 0;
        let conditionsCount = 0;
        let labsCount = 0;

        p.medications = p.medications || [];
        (body.medications || []).forEach(m => {
          p.medications.push({
            id: 'med-' + Math.random().toString(36).slice(2, 9),
            drug_name: m.drug_name,
            dosage: m.dosage,
            frequency: m.frequency || 'Daily',
            form: m.form || 'Tablet',
            route: m.route || 'Oral',
            is_active: 1,
            start_date: new Date().toISOString().slice(0, 10),
            titrations: []
          });
          medicationsCount++;
        });

        p.allergies = p.allergies || [];
        (body.allergies || []).forEach(a => {
          p.allergies.push({
            id: 'alg-' + Math.random().toString(36).slice(2, 9),
            allergen: a.allergen,
            reaction: a.reaction || 'Allergic reaction',
            severity: a.severity || 'Moderate',
            category: a.category || 'Drug',
            verification_status: 'Confirmed',
            diagnosed_date: new Date().toISOString().slice(0, 10)
          });
          allergiesCount++;
        });

        p.vitals = p.vitals || [];
        (body.vitals || []).forEach(v => {
          p.vitals.unshift({
            id: 'vit-' + Math.random().toString(36).slice(2, 9),
            blood_pressure: v.blood_pressure || null,
            heart_rate: v.heart_rate || null,
            spo2: v.spo2 || null,
            temperature: v.temperature || null,
            blood_glucose: v.blood_glucose || null,
            recorded_at: new Date().toISOString(),
            recorded_by: 'OCR Scanner Intake'
          });
          vitalsCount++;
        });

        p.chronic_conditions = p.chronic_conditions || [];
        (body.conditions || []).forEach(c => {
          p.chronic_conditions.push({
            id: 'cnd-' + Math.random().toString(36).slice(2, 9),
            condition_name: c.condition_name,
            icd10_code: c.icd10_code || 'Unspecified',
            category: c.category || 'General',
            status: 'Active',
            diagnosed_date: new Date().toISOString().slice(0, 10)
          });
          conditionsCount++;
        });

        p.lab_reports = p.lab_reports || [];
        (body.labs || []).forEach(l => {
          p.lab_reports.unshift({
            id: 'lab-' + Math.random().toString(36).slice(2, 9),
            test_name: l.test_name,
            result_value: l.result_value,
            reference_range: l.reference_range || 'Normal',
            flag: l.flag || 'Normal',
            specimen_date: new Date().toISOString().slice(0, 10)
          });
          labsCount++;
        });

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
      return jsonResponse({ error: 'Patient not found' }, 404);
    }

    // Default fallback
    return jsonResponse({ error: 'Endpoint not found', path: fullPath }, 404);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// Cloudflare Pages Serverless Edge API Handler
// Automatically handles all /api/* routes when hosted on Cloudflare Pages

import { SEED_PATIENTS } from '../../server/seed-data.js';

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
    // GET /api/health
    if (fullPath === '/api/health' && method === 'GET') {
      return jsonResponse({ status: 'ok', provider: 'Cloudflare Pages Edge', time: new Date().toISOString() });
    }

    // GET /api/stats
    if (fullPath === '/api/stats' && method === 'GET') {
      let medsCount = 0;
      let oldMedsCount = 0;
      let titrationsCount = 0;
      let notesCount = 0;
      edgePatients.forEach(p => {
        (p.medications || []).forEach(m => {
          if (m.is_active) medsCount++;
          else oldMedsCount++;
          titrationsCount += (m.titrations || []).length;
        });
        notesCount += (p.clinical_notes || []).length;
      });

      return jsonResponse({
        patientCount: edgePatients.length,
        medsCount,
        oldMedsCount,
        titrationsCount,
        notesCount,
        severeAllergiesCount: 2
      });
    }

    // POST /api/reset-demo
    if (fullPath === '/api/reset-demo' && method === 'POST') {
      edgePatients = JSON.parse(JSON.stringify(SEED_PATIENTS));
      return jsonResponse({ success: true, message: 'Reset edge demo data' });
    }

    // GET /api/patients
    if (fullPath === '/api/patients' && method === 'GET') {
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const blood = url.searchParams.get('bloodType') || '';
      let list = edgePatients.map(p => ({
        ...p,
        active_meds_count: (p.medications || []).filter(m => m.is_active).length,
        allergies_count: (p.allergies || []).length
      }));

      if (blood) list = list.filter(p => p.blood_type === blood);
      if (search) {
        list = list.filter(p =>
          p.first_name.toLowerCase().includes(search) ||
          p.last_name.toLowerCase().includes(search) ||
          p.qr_code.toLowerCase().includes(search)
        );
      }
      return jsonResponse({ patients: list });
    }

    // GET /api/patients/:id/trends
    if (pathParts.length === 2 && pathParts[0] === 'patients' && pathParts[1].endsWith('/trends')) {
      // Handled below
    }
    const trendsMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/trends$/);
    if (trendsMatch && method === 'GET') {
      const idOrCode = trendsMatch[1];
      const patient = edgePatients.find(p => p.id === idOrCode || p.qr_code === idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);

      const vitalsTimeline = (patient.vitals || []).map(v => {
        let systolic = null;
        let diastolic = null;
        if (v.blood_pressure) {
          const m = v.blood_pressure.match(/(\d+)\s*\/\s*(\d+)/);
          if (m) { systolic = parseInt(m[1]); diastolic = parseInt(m[2]); }
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

    // GET /api/patients/:idOrCode
    const patientMatch = fullPath.match(/^\/api\/patients\/([^/]+)$/);
    if (patientMatch && method === 'GET') {
      const idOrCode = patientMatch[1];
      const patient = edgePatients.find(p => p.id === idOrCode || p.qr_code === idOrCode);
      if (!patient) return jsonResponse({ error: 'Patient not found' }, 404);
      return jsonResponse({ patient });
    }

    // POST /api/medications/:id/titrate
    const titrateMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/titrate$/);
    if (titrateMatch && method === 'POST') {
      const medId = titrateMatch[1];
      const body = await request.json();
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          med.titrations = med.titrations || [];
          med.titrations.unshift({
            id: 'tit-' + Math.random().toString(36).slice(2, 9),
            previous_dosage: med.dosage,
            new_dosage: body.new_dosage,
            reason: body.reason,
            changed_by: body.changed_by,
            changed_at: new Date().toISOString()
          });
          med.dosage = body.new_dosage;
          if (body.new_frequency) med.frequency = body.new_frequency;
          return jsonResponse({ success: true, medication: med });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // POST /api/medications/:id/discontinue
    const discMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/discontinue$/);
    if (discMatch && method === 'POST') {
      const medId = discMatch[1];
      const body = await request.json();
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          med.is_active = 0;
          med.discontinued_reason = body.reason;
          med.discontinued_date = new Date().toISOString().slice(0, 10);
          med.discontinued_by = body.discontinued_by;
          return jsonResponse({ success: true, medication: med });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // POST /api/medications/:id/reactivate
    const reactMatch = fullPath.match(/^\/api\/medications\/([^/]+)\/reactivate$/);
    if (reactMatch && method === 'POST') {
      const medId = reactMatch[1];
      for (const p of edgePatients) {
        const med = (p.medications || []).find(m => m.id === medId);
        if (med) {
          med.is_active = 1;
          med.discontinued_reason = null;
          med.start_date = new Date().toISOString().slice(0, 10);
          return jsonResponse({ success: true, medication: med });
        }
      }
      return jsonResponse({ error: 'Medication not found' }, 404);
    }

    // POST /api/patients/:id/commit-scanned-records
    const commitMatch = fullPath.match(/^\/api\/patients\/([^/]+)\/commit-scanned-records$/);
    if (commitMatch && method === 'POST') {
      const patientId = commitMatch[1];
      const body = await request.json();
      const p = edgePatients.find(x => x.id === patientId);
      if (p) {
        (body.medications || []).forEach(m => {
          p.medications.push({ ...m, id: 'med-' + Math.random().toString(36).slice(2, 9), is_active: 1 });
        });
        (body.allergies || []).forEach(a => {
          p.allergies.push({ ...a, id: 'alg-' + Math.random().toString(36).slice(2, 9) });
        });
        (body.vitals || []).forEach(v => {
          p.vitals.unshift({ ...v, id: 'vit-' + Math.random().toString(36).slice(2, 9), recorded_at: new Date().toISOString() });
        });
        return jsonResponse({ success: true });
      }
      return jsonResponse({ error: 'Patient not found' }, 404);
    }

    // Default fallback
    return jsonResponse({ error: 'Endpoint not found', path: fullPath }, 404);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

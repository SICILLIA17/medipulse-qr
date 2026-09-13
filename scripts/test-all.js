// MediPulse QR Comprehensive End-to-End Automated Test Suite
// Verifies REST APIs, Database, Clinical Entity Parser, Titrations, Trends, and Static Assets

import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';

// Load clinical-parser.js in browser-like sandbox
const parserCode = fs.readFileSync(new URL('../public/js/clinical-parser.js', import.meta.url), 'utf8');
const sandbox = { globalThis: {} };
sandbox.window = sandbox.globalThis;
vm.createContext(sandbox);
vm.runInContext(parserCode, sandbox);
const { ClinicalParser, SAMPLE_MEDICAL_DOCUMENTS } = sandbox.globalThis;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch(e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING EXPANDED MEDIPULSE QR TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Health Check
  const healthRes = await request({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  assert(healthRes.statusCode === 200 && healthRes.body.status === 'ok', 'GET /api/health returns 200 OK');

  // 2. Stats Check
  const statsRes = await request({ hostname: 'localhost', port: 3000, path: '/api/stats', method: 'GET' });
  assert(statsRes.statusCode === 200 && statsRes.body.patientCount === 5, 'GET /api/stats confirms 5 seeded patients');
  assert(statsRes.body.titrationsCount >= 2, 'Titrations count populated in stats');

  // 3. Deep Patient Lookup (Eleanor Vance)
  const p1Res = await request({ hostname: 'localhost', port: 3000, path: '/api/patients/MED-EV-8091', method: 'GET' });
  assert(p1Res.statusCode === 200, 'GET /api/patients/MED-EV-8091 returns 200');
  const ev = p1Res.body.patient;
  assert(ev.blood_type === 'A+', 'Eleanor Vance has blood type A+');
  assert(ev.medications.some(m => m.drug_name.includes('Metformin')), 'Eleanor Vance has Metformin in active pill regimen');
  const metformin = ev.medications.find(m => m.drug_name.includes('Metformin'));
  assert(metformin && metformin.titrations && metformin.titrations.length >= 1, 'Metformin includes historical titration records');

  // 4. Trend Analysis API
  const trendsRes = await request({ hostname: 'localhost', port: 3000, path: `/api/patients/${ev.id}/trends`, method: 'GET' });
  assert(trendsRes.statusCode === 200 && trendsRes.body.success === true, 'GET /api/patients/:id/trends returns 200');
  assert(trendsRes.body.trends.vitalsTimeline.length >= 3, 'Patient trends include multi-point longitudinal vitals');

  // 5. Medication Dosage Titration Workflow
  const titrateRes = await request(
    { hostname: 'localhost', port: 3000, path: `/api/medications/${metformin.id}/titrate`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { new_dosage: '850 mg', new_frequency: 'Twice daily with meals', reason: 'Dose adjustment for renal function review', changed_by: 'Dr. Sarah Jenkins, MD' }
  );
  assert(titrateRes.statusCode === 200 && titrateRes.body.medication.dosage === '850 mg', 'POST /api/medications/:id/titrate updates dosage');

  // 6. Medication Titration History Retrieval
  const historyRes = await request({ hostname: 'localhost', port: 3000, path: `/api/medications/${metformin.id}/history`, method: 'GET' });
  assert(historyRes.statusCode === 200 && historyRes.body.history.length >= 2, 'GET /api/medications/:id/history returns titration audit log');

  // 7. Medication Discontinuation with Reason
  const lisinopril = ev.medications.find(m => m.drug_name.includes('Lisinopril'));
  const discontinueRes = await request(
    { hostname: 'localhost', port: 3000, path: `/api/medications/${lisinopril.id}/discontinue`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { reason: 'Cough reported; switched to ARB class', discontinued_by: 'Dr. Sarah Jenkins, MD' }
  );
  assert(discontinueRes.statusCode === 200 && discontinueRes.body.medication.is_active === 0, 'POST /api/medications/:id/discontinue archives medication');

  // 8. Medication Reactivation
  const reactivateRes = await request(
    { hostname: 'localhost', port: 3000, path: `/api/medications/${lisinopril.id}/reactivate`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { dosage: '10 mg', reason: 'Re-trial at lower dosage' }
  );
  assert(reactivateRes.statusCode === 200 && reactivateRes.body.medication.is_active === 1, 'POST /api/medications/:id/reactivate restores medication into active status');

  // 9. Add Allergy with Category
  const allergyRes = await request(
    { hostname: 'localhost', port: 3000, path: `/api/patients/${ev.id}/allergies`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { allergen: 'Latex Rubber', reaction: 'Contact dermatitis and hives', severity: 'Moderate', category: 'Material', notes: 'Use synthetic gloves' }
  );
  assert(allergyRes.statusCode === 201 && allergyRes.body.allergy.allergen === 'Latex Rubber', 'POST /api/patients/:id/allergies adds categorized allergy');

  // 10. Clinical NLP Parser Test
  const parser = new ClinicalParser();
  const sampleDoc = SAMPLE_MEDICAL_DOCUMENTS[0];
  const parsed = parser.parseText(sampleDoc.rawText);
  assert(parsed.medications.length >= 2, 'ClinicalParser extracts medications from raw prescription text');
  assert(parsed.allergies.length >= 1, 'ClinicalParser extracts allergies with severity');
  assert(parsed.vitals.length >= 1, 'ClinicalParser extracts blood pressure and heart rate');

  // 11. Batch Commit Scanned Records
  const commitRes = await request(
    { hostname: 'localhost', port: 3000, path: `/api/patients/${ev.id}/commit-scanned-records`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      medications: [{ drug_name: 'Amlodipine', dosage: '5 mg', form: 'Tablet', frequency: 'Daily' }],
      allergies: [{ allergen: 'Erythromycin', reaction: 'Nausea', severity: 'Mild', category: 'Drug' }],
      vitals: [{ blood_pressure: '122/78 mmHg', heart_rate: 68, spo2: 99, temperature: 36.7, blood_glucose: 105 }],
      conditions: [{ condition_name: 'Hyperlipidemia', icd10_code: 'E78.5', category: 'Cardiovascular' }],
      labs: [{ test_name: 'Cholesterol Total', result_value: '172 mg/dL', reference_range: '< 200', flag: 'Normal' }],
      document_metadata: { document_type: 'Prescription Slip', file_name: 'rx_test.jpg', raw_transcription: sampleDoc.rawText }
    }
  );
  assert(commitRes.statusCode === 201 && commitRes.body.success === true, 'POST /api/patients/:id/commit-scanned-records batch commits records to SQLite');

  // 12. Static Assets Verification
  const parserJsRes = await request({ hostname: 'localhost', port: 3000, path: '/js/clinical-parser.js', method: 'GET' });
  assert(parserJsRes.statusCode === 200 && parserJsRes.body.includes('ClinicalParser'), 'GET /js/clinical-parser.js delivers parser engine');

  const chartsJsRes = await request({ hostname: 'localhost', port: 3000, path: '/js/charts.js', method: 'GET' });
  assert(chartsJsRes.statusCode === 200 && chartsJsRes.body.includes('ClinicalCharts'), 'GET /js/charts.js delivers chart visualizer');

  console.log('----------------------------------------------------');
  console.log(`EXPANDED TEST RUN FINISHED: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

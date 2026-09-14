// MediPulse QR Comprehensive End-to-End Automated Test Suite
// Verifies REST APIs, Database, Clinical Entity Parser, Titrations, Trends, and Static Assets

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT) : 3889;

// Load clinical-parser.js in browser-like sandbox
const parserCode = fs.readFileSync(new URL('../public/js/clinical-parser.js', import.meta.url), 'utf8');
const sandbox = { globalThis: {} };
sandbox.window = sandbox.globalThis;
vm.createContext(sandbox);
vm.runInContext(parserCode, sandbox);
const { ClinicalParser, SAMPLE_MEDICAL_DOCUMENTS } = sandbox.globalThis;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: TEST_PORT, ...options }, (res) => {
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

async function waitForServer(retries = 30, delayMs = 200) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request({ path: '/api/health', method: 'GET' });
      if (res.statusCode === 200) return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

async function runTests() {
  console.log('--- STARTING EXPANDED MEDIPULSE QR TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  // Start test server process
  const serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'ignore'
  });

  const isReady = await waitForServer();
  if (!isReady) {
    console.error(`Failed to connect to test server on port ${TEST_PORT}`);
    serverProcess.kill();
    process.exit(1);
  }

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const healthRes = await request({ path: '/api/health', method: 'GET' });
    assert(healthRes.statusCode === 200 && healthRes.body.status === 'ok', 'GET /api/health returns 200 OK');

    // 2. Stats Check
    const statsRes = await request({ path: '/api/stats', method: 'GET' });
    assert(statsRes.statusCode === 200 && statsRes.body.patientCount === 5, 'GET /api/stats confirms 5 seeded patients');
    assert(statsRes.body.titrationsCount >= 2, 'Titrations count populated in stats');

    // 3. Deep Patient Lookup (Eleanor Vance)
    const p1Res = await request({ path: '/api/patients/MED-EV-8091', method: 'GET' });
    assert(p1Res.statusCode === 200, 'GET /api/patients/MED-EV-8091 returns 200');
    const ev = p1Res.body.patient;
    assert(ev.blood_type === 'A+', 'Eleanor Vance has blood type A+');
    assert(ev.medications.some(m => m.drug_name.includes('Metformin')), 'Eleanor Vance has Metformin in active pill regimen');
    const metformin = ev.medications.find(m => m.drug_name.includes('Metformin'));
    assert(metformin && metformin.titrations && metformin.titrations.length >= 1, 'Metformin includes historical titration records');

    // 4. Trend Analysis API
    const trendsRes = await request({ path: `/api/patients/${ev.id}/trends`, method: 'GET' });
    assert(trendsRes.statusCode === 200 && trendsRes.body.success === true, 'GET /api/patients/:id/trends returns 200');
    assert(trendsRes.body.trends.vitalsTimeline.length >= 3, 'Patient trends include multi-point longitudinal vitals');

    // 5. Medication Dosage Titration Workflow
    const titrateRes = await request(
      { path: `/api/medications/${metformin.id}/titrate`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { new_dosage: '850 mg', new_frequency: 'Twice daily with meals', reason: 'Dose adjustment for renal function review', changed_by: 'Dr. Sarah Jenkins, MD' }
    );
    assert(titrateRes.statusCode === 200 && titrateRes.body.medication.dosage === '850 mg', 'POST /api/medications/:id/titrate updates dosage');

    // 6. Medication Titration History Retrieval
    const historyRes = await request({ path: `/api/medications/${metformin.id}/history`, method: 'GET' });
    assert(historyRes.statusCode === 200 && historyRes.body.history.length >= 2, 'GET /api/medications/:id/history returns titration audit log');

    // 7. Medication Discontinuation with Reason
    const lisinopril = ev.medications.find(m => m.drug_name.includes('Lisinopril'));
    const discontinueRes = await request(
      { path: `/api/medications/${lisinopril.id}/discontinue`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { reason: 'Cough reported; switched to ARB class', discontinued_by: 'Dr. Sarah Jenkins, MD' }
    );
    assert(discontinueRes.statusCode === 200 && discontinueRes.body.medication.is_active === 0, 'POST /api/medications/:id/discontinue archives medication');

    // 8. Medication Reactivation
    const reactivateRes = await request(
      { path: `/api/medications/${lisinopril.id}/reactivate`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { dosage: '10 mg', reason: 'Re-trial at lower dosage' }
    );
    assert(reactivateRes.statusCode === 200 && reactivateRes.body.medication.is_active === 1, 'POST /api/medications/:id/reactivate restores medication into active status');

    // 9. Add Allergy with Category
    const allergyRes = await request(
      { path: `/api/patients/${ev.id}/allergies`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
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
      { path: `/api/patients/${ev.id}/commit-scanned-records`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
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
    const parserJsRes = await request({ path: '/js/clinical-parser.js', method: 'GET' });
    assert(parserJsRes.statusCode === 200 && parserJsRes.body.includes('ClinicalParser'), 'GET /js/clinical-parser.js delivers parser engine');

    const chartsJsRes = await request({ path: '/js/charts.js', method: 'GET' });
    assert(chartsJsRes.statusCode === 200 && chartsJsRes.body.includes('ClinicalCharts'), 'GET /js/charts.js delivers chart visualizer');

    // 13. Enhanced OCR & Bulleted NLP Parsing Test
    const noisyOcrText = `
    PRESCRIPTION DISCHARGE SUMMARY
    MEDICATIONS:
    - Amlodipine 10 mg tablet Once daily in morning
    * Losartan Potassium 50mg tab Twice daily
    • Atorvastatin 20mg tab at bedtime
    1. Metformin 500mg with meals

    ALLERGIES:
    - Codeine (severe nausea)
    * Penicillin: anaphylaxis

    VITALS:
    BP: 130/85 mmHg
    Pulse: 74 bpm
    SpO2: 98%
    Temp: 37.0 C
    Blood Sugar: 118 mg/dL
    `;
    const noisyParsed = parser.parseText(noisyOcrText);
    assert(noisyParsed.medications.length >= 4, 'Enhanced parser accurately extracts bulleted and numbered medications');
    assert(noisyParsed.allergies.length >= 2, 'Enhanced parser extracts multiline section-based allergies');
    assert(noisyParsed.vitals.length >= 1 && noisyParsed.vitals[0].blood_pressure.includes('130/85'), 'Enhanced parser extracts vitals from section blocks');

    // 14. Transcribe AI Fallback Route
    const aiTestRes = await request({ path: '/api/transcribe-ai', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { test: true });
    assert(aiTestRes.statusCode === 200 && aiTestRes.body.fallbackToClient === true, 'POST /api/transcribe-ai returns clean fallback in local dev');

    // 15. Verify scanVerificationModal in index.html
    const indexRes = await request({ path: '/index.html', method: 'GET' });
    assert(indexRes.statusCode === 200 && indexRes.body.includes('scanVerificationModal') && indexRes.body.includes('verifySummaryView'), 'Index delivers scan verification popup with Yes/No confirmation & manual form');

    // 16. Comprehensive Lab Biomarkers Extraction (HbA1c / H1bac, RBC, WBC, Platelets, Creatinine)
    const labReportText = `
    PATHOLOGY & BIOCHEMISTRY REPORT
    Patient: Eleanor Vance
    COMPLETE BLOOD COUNT:
    RBC Count: 4.85 mil/uL (Ref: 4.2 - 5.4)
    WBC Count: 7.2 x10^3/uL (Ref: 4.0 - 11.0)
    Hemoglobin: 13.8 g/dL (Ref: 12.0 - 16.0)
    Platelet Count: 240 x10^3/uL (Ref: 150 - 450)

    BIOCHEMISTRY:
    H1bac: 6.8 % (Ref: < 5.7) High
    Serum Creatinine: 1.1 mg/dL (Ref: 0.6 - 1.2)
    TSH: 2.4 uIU/mL (Ref: 0.4 - 4.0)
    Fasting Blood Sugar: 128 mg/dL (Ref: 70 - 99) High
    `;
    const labParsed = parser.parseText(labReportText);
    assert(labParsed.labs.length >= 6, 'ClinicalParser extracts all comprehensive lab panels & diagnostic tests');
    const rbcFound = labParsed.labs.find(l => /rbc/i.test(l.test_name));
    assert(rbcFound && rbcFound.result_value.includes('4.85'), 'Parser accurately identifies RBC Count with value');
    const hba1cFound = labParsed.labs.find(l => /hba1c|h1bac/i.test(l.test_name));
    assert(hba1cFound && hba1cFound.result_value.includes('6.8'), 'Parser extracts HbA1c/H1bac glycemic marker');

    // 17. Verify PDF.js and PDF Upload Support in index.html
    assert(indexRes.body.includes('pdf.min.js'), 'index.html includes PDF.js library for lossless digital PDF parsing');
    assert(indexRes.body.includes('docPdfUploadInput') && indexRes.body.includes('Upload PDF'), 'index.html provides direct Upload PDF button');
    assert(indexRes.body.includes('manualLabsContainer'), 'index.html provides dynamic manual labs editing section');

    // 18. Verify Dummy Documents are NOT pre-loaded in the modal
    assert(!indexRes.body.includes('app.loadSampleDocument(\'doc-rx-1\')'), 'Dummy sample document buttons removed from transcription modal');

    console.log('----------------------------------------------------');
    console.log(`EXPANDED TEST RUN FINISHED: ${passed} PASSED, ${failed} FAILED`);
  } finally {
    serverProcess.kill();
  }

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


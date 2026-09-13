// MediPulse QR Server
// High-performance native HTTP server with static file serving and REST API

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initDatabase,
  seedDatabase,
  getAllPatients,
  getPatientByIdOrCode,
  addClinicalNote,
  addVitalsLog,
  addMedication,
  toggleMedication,
  titrateMedication,
  discontinueMedication,
  reactivateMedication,
  getMedicationTitrationHistory,
  addAllergy,
  commitExtractedEntities,
  getPatientTrends,
  recordScanAudit,
  getSystemStats
} from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// Initialize DB schema & seeds
initDatabase();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB max for image payloads
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // -------------------------------------------------------------
    // API ROUTES
    // -------------------------------------------------------------
    if (pathname.startsWith('/api/')) {
      // Health check
      if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'ok', time: new Date().toISOString() });
      }

      // System Stats
      if (pathname === '/api/stats' && req.method === 'GET') {
        const stats = getSystemStats();
        return sendJson(res, 200, stats);
      }

      // Reset Demo Database
      if (pathname === '/api/reset-demo' && req.method === 'POST') {
        seedDatabase();
        return sendJson(res, 200, { success: true, message: 'Database reset to clean demo state' });
      }

      // Patients list: GET /api/patients?search=...&bloodType=...
      if (pathname === '/api/patients' && req.method === 'GET') {
        const search = url.searchParams.get('search') || '';
        const bloodType = url.searchParams.get('bloodType') || '';
        const patients = getAllPatients(search, bloodType);
        return sendJson(res, 200, { patients });
      }

      // Single patient by ID or QR code: GET /api/patients/:idOrCode
      const patientMatch = pathname.match(/^\/api\/patients\/([^/]+)$/);
      if (patientMatch && req.method === 'GET') {
        const idOrCode = decodeURIComponent(patientMatch[1]);
        const patient = getPatientByIdOrCode(idOrCode);
        if (!patient) {
          return sendJson(res, 404, { error: 'Patient not found' });
        }
        return sendJson(res, 200, { patient });
      }

      // Patient Trends: GET /api/patients/:id/trends
      const trendsMatch = pathname.match(/^\/api\/patients\/([^/]+)\/trends$/);
      if (trendsMatch && req.method === 'GET') {
        const patientId = decodeURIComponent(trendsMatch[1]);
        const trends = getPatientTrends(patientId);
        return sendJson(res, 200, { success: true, trends });
      }

      // Add Clinical Follow-up Note: POST /api/patients/:id/notes
      const noteMatch = pathname.match(/^\/api\/patients\/([^/]+)\/notes$/);
      if (noteMatch && req.method === 'POST') {
        const patientId = decodeURIComponent(noteMatch[1]);
        const body = await parseJsonBody(req);
        if (!body.assessment || !body.plan) {
          return sendJson(res, 400, { error: 'Assessment and Plan are required fields' });
        }
        const note = addClinicalNote(patientId, body);
        return sendJson(res, 201, { success: true, note });
      }

      // Add Vitals Log: POST /api/patients/:id/vitals
      const vitalsMatch = pathname.match(/^\/api\/patients\/([^/]+)\/vitals$/);
      if (vitalsMatch && req.method === 'POST') {
        const patientId = decodeURIComponent(vitalsMatch[1]);
        const body = await parseJsonBody(req);
        const log = addVitalsLog(patientId, body);
        return sendJson(res, 201, { success: true, vitals: log });
      }

      // Add Allergy: POST /api/patients/:id/allergies
      const allergyMatch = pathname.match(/^\/api\/patients\/([^/]+)\/allergies$/);
      if (allergyMatch && req.method === 'POST') {
        const patientId = decodeURIComponent(allergyMatch[1]);
        const body = await parseJsonBody(req);
        if (!body.allergen) {
          return sendJson(res, 400, { error: 'Allergen name is required' });
        }
        const allergy = addAllergy(patientId, body);
        return sendJson(res, 201, { success: true, allergy });
      }

      // Add Medication: POST /api/patients/:id/medications
      const medMatch = pathname.match(/^\/api\/patients\/([^/]+)\/medications$/);
      if (medMatch && req.method === 'POST') {
        const patientId = decodeURIComponent(medMatch[1]);
        const body = await parseJsonBody(req);
        if (!body.drug_name || !body.dosage) {
          return sendJson(res, 400, { error: 'Drug name and dosage are required' });
        }
        const med = addMedication(patientId, body);
        return sendJson(res, 201, { success: true, medication: med });
      }

      // Titrate Medication: POST /api/medications/:id/titrate
      const titrateMatch = pathname.match(/^\/api\/medications\/([^/]+)\/titrate$/);
      if (titrateMatch && req.method === 'POST') {
        const medId = decodeURIComponent(titrateMatch[1]);
        const body = await parseJsonBody(req);
        if (!body.new_dosage) {
          return sendJson(res, 400, { error: 'New dosage is required' });
        }
        const updated = titrateMedication(medId, body);
        return sendJson(res, 200, { success: true, medication: updated });
      }

      // Discontinue Medication: POST /api/medications/:id/discontinue
      const discontinueMatch = pathname.match(/^\/api\/medications\/([^/]+)\/discontinue$/);
      if (discontinueMatch && req.method === 'POST') {
        const medId = decodeURIComponent(discontinueMatch[1]);
        const body = await parseJsonBody(req);
        const updated = discontinueMedication(medId, body);
        return sendJson(res, 200, { success: true, medication: updated });
      }

      // Reactivate Medication: POST /api/medications/:id/reactivate
      const reactivateMatch = pathname.match(/^\/api\/medications\/([^/]+)\/reactivate$/);
      if (reactivateMatch && req.method === 'POST') {
        const medId = decodeURIComponent(reactivateMatch[1]);
        const body = await parseJsonBody(req);
        const updated = reactivateMedication(medId, body);
        return sendJson(res, 200, { success: true, medication: updated });
      }

      // Get Medication Titration History: GET /api/medications/:id/history
      const medHistoryMatch = pathname.match(/^\/api\/medications\/([^/]+)\/history$/);
      if (medHistoryMatch && req.method === 'GET') {
        const medId = decodeURIComponent(medHistoryMatch[1]);
        const history = getMedicationTitrationHistory(medId);
        return sendJson(res, 200, { success: true, history });
      }

      // Batch Commit Scanned Records: POST /api/patients/:id/commit-scanned-records
      const commitMatch = pathname.match(/^\/api\/patients\/([^/]+)\/commit-scanned-records$/);
      if (commitMatch && req.method === 'POST') {
        const patientId = decodeURIComponent(commitMatch[1]);
        const body = await parseJsonBody(req);
        const result = commitExtractedEntities(patientId, body);
        return sendJson(res, 201, { success: true, committed: result });
      }

      // Toggle Medication Status (Legacy backward compat): PATCH /api/medications/:id/status
      const toggleMedMatch = pathname.match(/^\/api\/medications\/([^/]+)\/status$/);
      if (toggleMedMatch && req.method === 'PATCH') {
        const medId = decodeURIComponent(toggleMedMatch[1]);
        const body = await parseJsonBody(req);
        const updated = toggleMedication(medId, body.is_active);
        return sendJson(res, 200, { success: true, medication: updated });
      }

      // Scan Audit: POST /api/patients/:id/audit-scan
      const auditMatch = pathname.match(/^\/api\/patients\/([^/]+)\/audit-scan$/);
      if (auditMatch && req.method === 'POST') {
        const patientId = decodeURIComponent(auditMatch[1]);
        const body = await parseJsonBody(req);
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const audit = recordScanAudit(
          patientId,
          body.scanner_role || 'Bedside Clinician / Mobile Scanner',
          userAgent,
          body.location_approx || 'Field Scan'
        );
        return sendJson(res, 201, { success: true, audit });
      }

      return sendJson(res, 404, { error: 'Endpoint not found' });
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING
    // -------------------------------------------------------------
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') {
      safePath = '/index.html';
    }

    // Client-side routing redirects to index.html if route looks like a subpage
    if (
      safePath.startsWith('/patient/') ||
      safePath.startsWith('/scan') ||
      safePath.startsWith('/badge/') ||
      safePath.startsWith('/trends') ||
      safePath.startsWith('/ideas')
    ) {
      safePath = '/index.html';
    }

    let filePath = path.join(PUBLIC_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('500 Internal Server Error');
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
        });
        res.end(content);
      });
    });

  } catch (err) {
    console.error('Unhandled request error:', err);
    sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`[MediPulse QR] Healthcare portal active on http://localhost:${PORT}`);
});

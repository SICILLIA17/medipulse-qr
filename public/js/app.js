// MediPulse QR Application Controller
// Handles UI state, REST API calls, QR generation/scanning, OCR document transcription, trends, and clinical workflows

class MediPulseApp {
  constructor() {
    this.currentPatient = null;
    this.patientsList = [];
    this.currentTab = 'medications';
    this.currentMedFilter = 'all';
    this.currentMedsSegment = 'active'; // 'active' or 'historical'
    this.currentAllergyCategory = '';
    this.currentTrendRange = 'all';
    this.patientTrendsData = null;
    this.scanner = null;
    this.cameraFacing = 'environment';
    this.activeDirectoryBlood = '';
    
    this.clinicalParser = new ClinicalParser();
    this.extractedEntitiesDraft = null;
    this.currentDocImageData = null;
    this.docCameraStream = null;
    this.docCameraFacing = 'environment';
  }

  async init() {
    console.log('[MediPulse] Initializing healthcare portal...');
    await this.fetchPatientsDirectory();

    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code') || urlParams.get('id');
    const pathMatch = window.location.pathname.match(/\/patient\/([^/]+)/);

    let initialCode = 'MED-EV-8091'; // Eleanor Vance default
    if (codeParam) {
      initialCode = codeParam;
    } else if (pathMatch && pathMatch[1]) {
      initialCode = pathMatch[1];
    }

    await this.loadPatient(initialCode);

    // Initialize camera scanner instance
    const video = document.getElementById('scannerVideo');
    if (video && window.CameraQRScanner) {
      this.scanner = new CameraQRScanner(video, null, {
        onScanSuccess: (decoded) => this.onQrScanDetected(decoded),
        onError: (err) => {
          console.warn('[Scanner] Camera notification:', err.message);
          const pill = document.getElementById('cameraStatusPill');
          if (pill) {
            pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Camera standby (Upload image or use code)`;
          }
        }
      });
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  playScanBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-slate-900 text-white border-teal-500' : 'bg-rose-900 text-white border-rose-500';
    const iconName = type === 'success' ? 'check-circle-2' : 'alert-circle';

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate-in slide-in-from-bottom-3 duration-200 pointer-events-auto ${bgClass}`;
    toast.innerHTML = `
      <i data-lucide="${iconName}" class="w-4 h-4 ${type === 'success' ? 'text-teal-400' : 'text-rose-300'}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async fetchPatientsDirectory() {
    try {
      const res = await fetch('/api/patients');
      const data = await res.json();
      this.patientsList = data.patients || [];
      this.renderDirectory();
    } catch (err) {
      console.error('Failed to load patients directory:', err);
    }
  }

  async loadPatient(idOrCode, fromScan = false) {
    this.showLoading(true);
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(idOrCode)}`);
      if (!res.ok) {
        throw new Error(`Patient "${idOrCode}" not found.`);
      }
      const data = await res.json();
      this.currentPatient = data.patient;

      // Update dropdown selector
      const select = document.getElementById('quickPatientSelect');
      if (select) {
        select.value = this.currentPatient.qr_code;
      }

      // Record scan audit if this was triggered by scanning
      if (fromScan) {
        fetch(`/api/patients/${this.currentPatient.id}/audit-scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scanner_role: 'Emergency Clinician / Field Paramedic',
            location_approx: 'Hospital Bedside Bay'
          })
        }).catch(e => console.warn('Audit error:', e));
      }

      await this.fetchPatientTrends();
      this.renderPatientProfile();
      this.showPatientView();

      if (fromScan) {
        this.showToast(`Scanned: Verified records for ${this.currentPatient.first_name} ${this.currentPatient.last_name}`, 'success');
      }
    } catch (err) {
      console.error(err);
      this.showToast(err.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async fetchPatientTrends() {
    if (!this.currentPatient) return;
    try {
      const res = await fetch(`/api/patients/${this.currentPatient.id}/trends`);
      if (res.ok) {
        const data = await res.json();
        this.patientTrendsData = data.trends;
      }
    } catch (e) {
      console.warn('Could not fetch patient trends:', e);
    }
  }

  renderPatientProfile() {
    const p = this.currentPatient;
    if (!p) return;

    // 1. Render Emergency Triage Banner
    this.renderEmergencyBanner(p);

    // 2. Render Demographics & Identity
    document.getElementById('patientFullName').textContent = `${p.first_name} ${p.last_name}`;
    document.getElementById('patientQrText').textContent = p.qr_code;
    document.getElementById('patientAvatar').src = p.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400';
    document.getElementById('patientDob').textContent = p.dob;
    document.getElementById('patientAge').textContent = this.calculateAge(p.dob);
    document.getElementById('patientGender').textContent = p.gender;
    document.getElementById('patientAddress').textContent = p.address || 'Address unlisted';
    document.getElementById('patientDoctor').textContent = p.primary_physician || 'None Assigned';
    document.getElementById('patientInsurance').textContent = `${p.insurance_provider || 'Self-pay'} (${p.insurance_policy_no || 'N/A'})`;
    
    const primaryContact = p.emergency_contacts && p.emergency_contacts.find(c => c.is_primary) || (p.emergency_contacts && p.emergency_contacts[0]);
    if (primaryContact) {
      document.getElementById('patientContactSummary').textContent = `${primaryContact.name} (${primaryContact.relationship}): ${primaryContact.phone}`;
    } else {
      document.getElementById('patientContactSummary').textContent = 'No contact on file';
    }

    const lastScan = p.recent_scans && p.recent_scans[0];
    document.getElementById('patientLastScan').textContent = lastScan ? `${lastScan.scanned_at} (${lastScan.scanner_role})` : 'First scan today';

    // 3. Update Counts in Tabs
    const activeMeds = (p.medications || []).filter(m => m.is_active);
    const oldMeds = (p.medications || []).filter(m => !m.is_active);
    document.getElementById('badgeMedsCount').textContent = activeMeds.length;
    document.getElementById('countActiveMeds').textContent = activeMeds.length;
    document.getElementById('countOldMeds').textContent = oldMeds.length;
    document.getElementById('badgeAllergiesCount').textContent = (p.allergies || []).length;
    document.getElementById('badgeHistoryCount').textContent = (p.medical_history || []).length;
    document.getElementById('badgeNotesCount').textContent = (p.clinical_notes || []).length;
    document.getElementById('badgeDocsCount').textContent = (p.scanned_documents || []).length;

    // 4. Render All Tab Contents
    this.renderMedications();
    this.renderTrends();
    this.renderAllergyTracker();
    this.renderMedicalHistory();
    this.renderVitalsAndLabs();
    this.renderClinicalNotes();
    this.renderScannedDocs();
    this.renderWristbandAndCard();

    if (window.lucide) lucide.createIcons();
  }

  renderEmergencyBanner(p) {
    const banner = document.getElementById('emergencyTriageBanner');
    const severeAllergies = (p.allergies || []).filter(a => a.severity === 'Life-Threatening' || a.severity === 'Severe');
    const isCritical = severeAllergies.length > 0 || p.dnr_status === 1 || p.emergency_summary.toUpperCase().includes('BLEEDING') || p.emergency_summary.toUpperCase().includes('WARFARIN');

    banner.className = isCritical
      ? 'rounded-2xl p-5 sm:p-6 shadow-md border-2 bg-gradient-to-br from-rose-50 via-red-50/70 to-rose-100/50 border-rose-300 text-rose-950'
      : 'rounded-2xl p-5 sm:p-6 shadow-sm border bg-gradient-to-br from-teal-50/80 to-emerald-50/50 border-teal-200 text-slate-800';

    const primaryContact = p.emergency_contacts && p.emergency_contacts.find(c => c.is_primary) || (p.emergency_contacts && p.emergency_contacts[0]);

    banner.innerHTML = `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div class="space-y-2 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isCritical ? 'bg-rose-600 text-white shadow-sm' : 'bg-teal-700 text-white'}">
              <i data-lucide="${isCritical ? 'alert-octagon' : 'shield-check'}" class="w-3.5 h-3.5"></i>
              ${isCritical ? 'CRITICAL EMERGENCY ALERT' : 'EMERGENCY TRIAGE SUMMARY'}
            </span>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-white border border-slate-300 text-slate-900 shadow-sm">
              BLOOD GROUP: <strong class="ml-1 text-rose-600">${p.blood_type}</strong>
            </span>
            ${p.dnr_status === 1 ? `
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-slate-900 text-white shadow-sm">
                <i data-lucide="file-x-2" class="w-3.5 h-3.5 mr-1 text-rose-400"></i> DNR (DO NOT RESUSCITATE) ON FILE
              </span>
            ` : `
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Full Code
              </span>
            `}
            ${p.organ_donor === 1 ? `
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <i data-lucide="heart" class="w-3 h-3 mr-1 text-purple-600"></i> Organ Donor
              </span>
            ` : ''}
          </div>

          <p class="text-sm font-bold ${isCritical ? 'text-rose-900' : 'text-slate-800'} leading-relaxed">
            ${p.emergency_summary}
          </p>

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <span class="text-xs font-bold ${isCritical ? 'text-rose-800' : 'text-slate-600'}">Allergies:</span>
            ${(p.allergies || []).length === 0 ? '<span class="text-xs text-slate-500">No known drug allergies (NKDA)</span>' : ''}
            ${(p.allergies || []).map(a => `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                a.severity === 'Life-Threatening' 
                  ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/50' 
                  : a.severity === 'Severe' 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                  : 'bg-white text-slate-700 border border-slate-200'
              }">
                <i data-lucide="alert-triangle" class="w-3 h-3 ${a.severity === 'Life-Threatening' ? 'text-white' : 'text-amber-600'}"></i>
                ${a.allergen} (${a.severity})
              </span>
            `).join('')}
          </div>
        </div>

        ${primaryContact ? `
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t lg:border-t-0 lg:border-l ${isCritical ? 'border-rose-200' : 'border-teal-200'} pt-3 lg:pt-0 lg:pl-5">
            <div class="text-xs">
              <span class="block text-slate-500 font-medium">Primary Emergency Contact</span>
              <strong class="text-slate-900 text-sm font-bold block">${primaryContact.name} (${primaryContact.relationship})</strong>
              <span class="font-mono text-slate-600">${primaryContact.phone}</span>
            </div>
            <a href="tel:${primaryContact.phone.replace(/[^0-9+]/g, '')}" class="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition hover:scale-105 active:scale-95">
              <i data-lucide="phone-call" class="w-4 h-4"></i>
              <span>One-Tap Call</span>
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }

  // -------------------------------------------------------------
  // MEDICATIONS: ACTIVE VS HISTORICAL & DOSAGE TITRATION
  // -------------------------------------------------------------
  setMedsSegment(segment) {
    this.currentMedsSegment = segment;
    const btnActive = document.getElementById('segBtn-active');
    const btnHist = document.getElementById('segBtn-historical');
    if (segment === 'active') {
      btnActive.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-white text-teal-800 shadow-sm transition';
      btnHist.className = 'px-4 py-2 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition';
    } else {
      btnHist.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm transition';
      btnActive.className = 'px-4 py-2 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition';
    }
    this.renderMedications();
    if (window.lucide) lucide.createIcons();
  }

  renderMedications() {
    const list = document.getElementById('medicationsList');
    if (!list || !this.currentPatient) return;

    let meds = this.currentPatient.medications || [];

    // Filter by Active vs Historical
    if (this.currentMedsSegment === 'active') {
      meds = meds.filter(m => m.is_active);
    } else {
      meds = meds.filter(m => !m.is_active);
    }

    // Secondary Schedule Filter
    if (this.currentMedFilter === 'morning') {
      meds = meds.filter(m => (m.time_of_day || '').toLowerCase().includes('morning') || (m.frequency || '').toLowerCase().includes('morning'));
    } else if (this.currentMedFilter === 'evening') {
      meds = meds.filter(m => (m.time_of_day || '').toLowerCase().includes('evening') || (m.time_of_day || '').toLowerCase().includes('bedtime') || (m.time_of_day || '').toLowerCase().includes('night'));
    } else if (this.currentMedFilter === 'prn') {
      meds = meds.filter(m => (m.frequency || '').toUpperCase().includes('PRN') || (m.frequency || '').toLowerCase().includes('as needed'));
    }

    if (meds.length === 0) {
      list.innerHTML = `
        <div class="col-span-2 text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
          <i data-lucide="pill" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
          <p class="text-sm font-semibold text-slate-600">No ${this.currentMedsSegment === 'active' ? 'active' : 'historical'} medications found in this category.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = meds.map(m => {
      const isWarfarin = m.drug_name.toLowerCase().includes('warfarin') || m.drug_name.toLowerCase().includes('epipen') || m.drug_name.toLowerCase().includes('insulin');
      const titrations = m.titrations || [];

      return `
        <div class="bg-white rounded-2xl p-5 border ${m.is_active ? (isWarfarin ? 'border-amber-300 ring-1 ring-amber-300 shadow-sm' : 'border-slate-200 shadow-sm') : 'border-slate-200 bg-slate-50/70 opacity-80'} flex flex-col justify-between transition hover:shadow-md">
          
          <div>
            <!-- Header: Drug Name, Dosage & Active Badge -->
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-extrabold text-slate-900">${m.drug_name}</h3>
                  ${isWarfarin ? '<span class="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-amber-100 text-amber-800 border border-amber-200">High Alert</span>' : ''}
                  ${!m.is_active ? '<span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-200 text-slate-700">Discontinued</span>' : ''}
                </div>
                ${m.generic_name ? `<p class="text-xs text-slate-500 font-medium">Generic: ${m.generic_name}</p>` : ''}
              </div>
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black font-mono ${m.is_active ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-slate-200 text-slate-600'}">
                ${m.dosage}
              </span>
            </div>

            <!-- Schedule & Details -->
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 my-3 text-xs">
              <div class="flex items-center gap-1.5 text-slate-700 font-semibold">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-teal-600"></i>
                <span>Schedule: ${m.frequency}</span>
              </div>
              ${m.time_of_day ? `
                <div class="flex items-center gap-1.5 text-slate-500">
                  <i data-lucide="sun" class="w-3.5 h-3.5 text-amber-500"></i>
                  <span>Timing: <strong class="text-slate-700 font-medium">${m.time_of_day}</strong></span>
                </div>
              ` : ''}
              ${m.purpose ? `
                <div class="flex items-center gap-1.5 text-slate-500">
                  <i data-lucide="target" class="w-3.5 h-3.5 text-indigo-500"></i>
                  <span>Indication: <strong class="text-slate-700 font-medium">${m.purpose}</strong></span>
                </div>
              ` : ''}
            </div>

            <!-- Discontinuation Reason (if old med) -->
            ${!m.is_active && m.discontinued_reason ? `
              <div class="bg-rose-50 border border-rose-200 rounded-xl p-3 my-2 text-xs text-rose-900">
                <strong class="font-bold flex items-center gap-1 text-rose-700 mb-0.5">
                  <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Discontinued on ${m.discontinued_date || 'N/A'}:
                </strong>
                <p class="text-[11px] leading-relaxed">${m.discontinued_reason}</p>
                <span class="text-[10px] text-rose-600 block mt-1">Authorized by: ${m.discontinued_by || 'Attending Physician'}</span>
              </div>
            ` : ''}

            <!-- Instructions & Appearance -->
            <div class="space-y-1 text-xs text-slate-600">
              ${m.pill_color_shape ? `
                <p class="flex items-center gap-1.5">
                  <span class="pill-avatar bg-amber-50 text-slate-700 text-[10px]">PILL</span>
                  <span>${m.pill_color_shape}</span>
                </p>
              ` : ''}
              ${m.special_instructions ? `
                <p class="text-slate-500 text-[11px] bg-yellow-50/60 p-2 rounded-lg border border-yellow-100 text-yellow-900 mt-2 font-medium">
                  <strong>Instructions:</strong> ${m.special_instructions}
                </p>
              ` : ''}
            </div>

            <!-- Titration History Log (Expandable) -->
            ${titrations.length > 0 ? `
              <div class="mt-3 pt-2 border-t border-slate-100">
                <details class="text-xs group">
                  <summary class="cursor-pointer font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 text-[11px]">
                    <i data-lucide="history" class="w-3 h-3"></i>
                    <span>View Dosage Titration History (${titrations.length} adjustments)</span>
                  </summary>
                  <div class="mt-2 space-y-1.5 pl-2 border-l-2 border-teal-200 text-[11px]">
                    ${titrations.map(t => `
                      <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div class="flex items-center justify-between text-slate-700 font-bold">
                          <span>${t.previous_dosage} ➔ <strong class="text-teal-700 font-mono">${t.new_dosage}</strong></span>
                          <span class="font-mono text-[10px] text-slate-400">${t.changed_at.slice(0, 10)}</span>
                        </div>
                        <p class="text-slate-500 text-[10px] mt-0.5">${t.reason}</p>
                        <span class="text-[9px] text-slate-400 block">By: ${t.changed_by}</span>
                      </div>
                    `).join('')}
                  </div>
                </details>
              </div>
            ` : ''}
          </div>

          <!-- Footer Actions: Titrate, Discontinue, or Reactivate -->
          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
            <span class="text-slate-400 truncate text-[11px]">MD: ${m.prescribing_doctor || 'Staff Physician'}</span>
            
            <div class="flex items-center gap-1.5">
              ${m.is_active ? `
                <!-- Change Dosage Button -->
                <button onclick="app.openTitrationModal('${m.id}')" class="font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-xs">
                  <i data-lucide="sliders" class="w-3 h-3"></i> Change Dosage
                </button>
                <!-- Discontinue Button -->
                <button onclick="app.discontinueMedicationPrompt('${m.id}')" class="font-semibold text-slate-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition text-xs">
                  Discontinue
                </button>
              ` : `
                <!-- Reactivate Button -->
                <button onclick="app.reactivateMedicationPrompt('${m.id}')" class="font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1 rounded-lg transition flex items-center gap-1 text-xs">
                  <i data-lucide="rotate-cw" class="w-3 h-3"></i> Reactivate Pill
                </button>
              `}
            </div>
          </div>

        </div>
      `;
    }).join('');
  }

  filterMeds(category) {
    this.currentMedFilter = category;
    ['all', 'morning', 'evening', 'prn'].forEach(c => {
      const btn = document.getElementById(`medFilter-${c}`);
      if (!btn) return;
      if (c === category) {
        btn.className = 'px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-600 text-white';
      } else {
        btn.className = 'px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    });
    this.renderMedications();
    if (window.lucide) lucide.createIcons();
  }

  openTitrationModal(medId) {
    const med = (this.currentPatient.medications || []).find(m => m.id === medId);
    if (!med) return;

    document.getElementById('titrateMedId').value = med.id;
    document.getElementById('titrateDrugName').textContent = med.drug_name;
    document.getElementById('titrateCurrentDosage').textContent = med.dosage;
    document.getElementById('titrateNewDosage').value = med.dosage;
    document.getElementById('titrateNewFrequency').value = med.frequency || '';
    document.getElementById('titrateReason').value = '';
    
    document.getElementById('titrationModal').classList.remove('hidden');
  }

  closeTitrationModal() {
    document.getElementById('titrationModal').classList.add('hidden');
  }

  async submitTitration(event) {
    event.preventDefault();
    const medId = document.getElementById('titrateMedId').value;
    const newDosage = document.getElementById('titrateNewDosage').value.trim();
    const newFrequency = document.getElementById('titrateNewFrequency').value.trim();
    const reason = document.getElementById('titrateReason').value.trim();
    const changedBy = document.getElementById('titrateChangedBy').value.trim();

    try {
      const res = await fetch(`/api/medications/${medId}/titrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_dosage: newDosage,
          new_frequency: newFrequency,
          reason: reason,
          changed_by: changedBy
        })
      });

      if (!res.ok) throw new Error('Titration request failed');
      this.closeTitrationModal();
      this.showToast(`Titrated dosage to ${newDosage}`, 'success');
      await this.loadPatient(this.currentPatient.id);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async discontinueMedicationPrompt(medId) {
    const med = (this.currentPatient.medications || []).find(m => m.id === medId);
    if (!med) return;

    const reason = prompt(`Reason for discontinuing ${med.drug_name} (${med.dosage}):`, 'Therapeutic goal reached / dose optimized');
    if (!reason) return;

    try {
      const res = await fetch(`/api/medications/${medId}/discontinue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason,
          discontinued_by: 'Dr. Sarah Jenkins, MD'
        })
      });

      if (!res.ok) throw new Error('Failed to discontinue medication');
      this.showToast(`Discontinued ${med.drug_name}`, 'success');
      await this.loadPatient(this.currentPatient.id);
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  async reactivateMedicationPrompt(medId) {
    const med = (this.currentPatient.medications || []).find(m => m.id === medId);
    if (!med) return;

    if (!confirm(`Reactivate ${med.drug_name} (${med.dosage}) into active therapy?`)) return;

    try {
      const res = await fetch(`/api/medications/${medId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dosage: med.dosage,
          frequency: med.frequency,
          reason: 'Reactivated by clinician'
        })
      });

      if (!res.ok) throw new Error('Failed to reactivate medication');
      this.showToast(`Reactivated ${med.drug_name}`, 'success');
      await this.loadPatient(this.currentPatient.id);
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // TREND ANALYSIS & CHARTS
  // -------------------------------------------------------------
  filterTrendRange(range) {
    this.currentTrendRange = range;
    ['all', '90d', '30d'].forEach(r => {
      const btn = document.getElementById(`trendRange-${r}`);
      if (btn) {
        if (r === range) {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-500 text-white';
        } else {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/20 text-slate-200';
        }
      }
    });
    this.renderTrends();
  }

  renderTrends() {
    if (!this.patientTrendsData || !window.ClinicalCharts) return;

    let vitals = this.patientTrendsData.vitalsTimeline || [];

    // Filter by date range if selected
    if (this.currentTrendRange === '30d') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      vitals = vitals.filter(v => new Date(v.date) >= cutoff);
    } else if (this.currentTrendRange === '90d') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      vitals = vitals.filter(v => new Date(v.date) >= cutoff);
    }

    // 1. Blood Pressure Chart
    ClinicalCharts.renderBloodPressureChart('chartContainer-bp', vitals);

    // 2. Heart Rate Chart
    const hrPoints = vitals.map(v => ({ date: v.date.slice(0, 10), value: v.heartRate }));
    ClinicalCharts.renderSingleMetricChart('chartContainer-hr', hrPoints, {
      label: 'Heart Rate',
      unit: 'BPM',
      color: '#e11d48',
      targetMin: 60,
      targetMax: 100
    });

    // 3. Blood Glucose Chart
    const glucosePoints = vitals.map(v => ({ date: v.date.slice(0, 10), value: v.bloodGlucose }));
    ClinicalCharts.renderSingleMetricChart('chartContainer-glucose', glucosePoints, {
      label: 'Blood Glucose',
      unit: 'mg/dL',
      color: '#0891b2',
      targetMin: 70,
      targetMax: 130
    });

    // 4. SpO2 Chart
    const spo2Points = vitals.map(v => ({ date: v.date.slice(0, 10), value: v.spo2 }));
    ClinicalCharts.renderSingleMetricChart('chartContainer-spo2', spo2Points, {
      label: 'Oxygen Saturation (SpO2)',
      unit: '%',
      color: '#0d9488',
      targetMin: 95,
      targetMax: 100
    });

    // 5. Temperature Chart
    const tempPoints = vitals.map(v => ({ date: v.date.slice(0, 10), value: v.temperature }));
    ClinicalCharts.renderSingleMetricChart('chartContainer-temp', tempPoints, {
      label: 'Body Temperature',
      unit: '°C',
      color: '#d97706',
      targetMin: 36.5,
      targetMax: 37.5
    });

    // 6. Biomarker Trajectories (HbA1c, INR, eGFR)
    const bioContainer = document.getElementById('biomarkerTimelineList');
    if (bioContainer) {
      const labs = this.patientTrendsData.labsTimeline || [];
      const hba1cLabs = labs.filter(l => l.test_name.toLowerCase().includes('a1c'));
      const inrLabs = labs.filter(l => l.test_name.toLowerCase().includes('inr'));
      const egfrLabs = labs.filter(l => l.test_name.toLowerCase().includes('egfr') || l.test_name.toLowerCase().includes('creatinine'));

      bioContainer.innerHTML = `
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span class="text-xs font-bold text-slate-700 block">HbA1c Glycemic Trajectory</span>
          ${hba1cLabs.length > 0 ? `
            <div class="mt-2 space-y-1">
              ${hba1cLabs.map(l => `
                <div class="flex items-center justify-between text-xs">
                  <span class="font-mono text-slate-500">${l.test_date}</span>
                  <strong class="font-black ${l.flag === 'High' ? 'text-amber-700' : 'text-emerald-700'}">${l.result_value}</strong>
                </div>
              `).join('')}
            </div>
            <span class="text-[10px] text-teal-700 block mt-2">Target: < 7.0%</span>
          ` : '<span class="text-xs text-slate-400 mt-2 block">No HbA1c panels on file</span>'}
        </div>

        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span class="text-xs font-bold text-slate-700 block">Coagulation INR Window</span>
          ${inrLabs.length > 0 ? `
            <div class="mt-2 space-y-1">
              ${inrLabs.map(l => `
                <div class="flex items-center justify-between text-xs">
                  <span class="font-mono text-slate-500">${l.test_date}</span>
                  <strong class="font-black text-slate-900">${l.result_value}</strong>
                </div>
              `).join('')}
            </div>
            <span class="text-[10px] text-teal-700 block mt-2">Therapeutic Window: 2.0 - 3.0</span>
          ` : '<span class="text-xs text-slate-400 mt-2 block">Not on therapeutic INR monitoring</span>'}
        </div>

        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span class="text-xs font-bold text-slate-700 block">Renal Function eGFR</span>
          ${egfrLabs.length > 0 ? `
            <div class="mt-2 space-y-1">
              ${egfrLabs.map(l => `
                <div class="flex items-center justify-between text-xs">
                  <span class="font-mono text-slate-500">${l.test_date}</span>
                  <strong class="font-black ${l.flag === 'High' ? 'text-amber-700' : 'text-teal-800'}">${l.result_value}</strong>
                </div>
              `).join('')}
            </div>
            <span class="text-[10px] text-slate-500 block mt-2">Normal Range: > 60 mL/min</span>
          ` : '<span class="text-xs text-slate-400 mt-2 block">No renal panels on file</span>'}
        </div>
      `;
    }
  }

  // -------------------------------------------------------------
  // ALLERGY TRACKER & RISK MATRIX
  // -------------------------------------------------------------
  filterAllergiesCategory(cat) {
    this.currentAllergyCategory = cat;
    ['', 'Drug', 'Food', 'Environmental', 'Material'].forEach(c => {
      const id = c ? `algCat-${c}` : 'algCat-all';
      const btn = document.getElementById(id);
      if (btn) {
        if (c === cat) {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 text-white';
        } else {
          btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200';
        }
      }
    });
    this.renderAllergyTracker();
  }

  renderAllergyTracker() {
    const list = document.getElementById('allergiesDetailList');
    if (!list || !this.currentPatient) return;

    const allergies = this.currentPatient.allergies || [];

    // Matrix counts
    const countLife = allergies.filter(a => a.severity === 'Life-Threatening').length;
    const countSevere = allergies.filter(a => a.severity === 'Severe').length;
    const countMod = allergies.filter(a => a.severity === 'Moderate').length;
    const countMild = allergies.filter(a => a.severity === 'Mild').length;

    document.getElementById('matrixCountLife').textContent = countLife;
    document.getElementById('matrixCountSevere').textContent = countSevere;
    document.getElementById('matrixCountModerate').textContent = countMod;
    document.getElementById('matrixCountMild').textContent = countMild;

    let filtered = allergies;
    if (this.currentAllergyCategory) {
      filtered = filtered.filter(a => (a.category || '').toLowerCase() === this.currentAllergyCategory.toLowerCase());
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="col-span-2 py-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">No allergies recorded in this category.</div>`;
      return;
    }

    list.innerHTML = filtered.map(a => {
      const isLife = a.severity === 'Life-Threatening';
      return `
        <div class="bg-white rounded-2xl p-5 border ${isLife ? 'border-rose-300 ring-2 ring-rose-200 shadow-md' : 'border-slate-200 shadow-sm'} flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-base font-extrabold text-slate-900">${a.allergen}</h4>
                  <span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-600 border border-slate-200">${a.category || 'Drug'}</span>
                </div>
                <span class="text-xs text-slate-400 font-mono">Status: ${a.verification_status || 'Confirmed'} • Diagnosed: ${a.diagnosed_date || 'Historical'}</span>
              </div>
              <span class="px-2.5 py-1 text-xs font-black uppercase rounded-lg ${
                isLife ? 'bg-rose-600 text-white shadow-sm' :
                a.severity === 'Severe' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                a.severity === 'Moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
              }">${a.severity}</span>
            </div>

            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 my-2">
              <strong class="text-slate-800 block font-bold">Clinical Manifestation:</strong>
              <p class="text-slate-600 leading-relaxed">${a.reaction}</p>
            </div>

            ${a.notes ? `<p class="text-xs text-slate-500 italic mt-1">Precautions: ${a.notes}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  openAllergyModal() {
    document.getElementById('allergyModal').classList.remove('hidden');
  }

  closeAllergyModal() {
    document.getElementById('allergyModal').classList.add('hidden');
  }

  async submitNewAllergy(event) {
    event.preventDefault();
    if (!this.currentPatient) return;

    const payload = {
      allergen: document.getElementById('algName').value.trim(),
      severity: document.getElementById('algSeverity').value,
      category: document.getElementById('algCategory').value,
      reaction: document.getElementById('algReaction').value.trim(),
      notes: document.getElementById('algNotes').value.trim()
    };

    try {
      const res = await fetch(`/api/patients/${this.currentPatient.id}/allergies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to record allergy');

      this.closeAllergyModal();
      this.showToast(`Recorded allergy to ${payload.allergen}`, 'success');
      await this.loadPatient(this.currentPatient.id);
      this.switchTab('allergies');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // DOCUMENT OCR SCANNING & CLINICAL ENTITY EXTRACTION
  // -------------------------------------------------------------
  openTranscriptionModal() {
    document.getElementById('transcriptionModal').classList.remove('hidden');
    if (!this.extractedEntitiesDraft) {
      this.loadSampleDocument('doc-rx-1');
    }
  }

  closeTranscriptionModal() {
    this.stopDocumentCamera();
    document.getElementById('transcriptionModal').classList.add('hidden');
  }

  async startDocumentCamera(facing = this.docCameraFacing) {
    this.docCameraFacing = facing;
    const container = document.getElementById('docPreviewContainer');
    if (!container) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showToast('Camera not supported in this browser. Please use Upload.', 'error');
      return;
    }

    this.stopDocumentCamera();

    container.innerHTML = `
      <div class="relative w-full h-[240px] rounded-xl overflow-hidden bg-black flex items-center justify-center">
        <video id="docCameraVideo" playsinline autoplay muted class="w-full h-full object-cover"></video>
        <!-- Overlay Guide Box -->
        <div class="absolute inset-3 border-2 border-dashed border-emerald-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-2 shadow-sm">
          <span class="text-[10px] font-mono font-bold text-emerald-300 bg-black/70 px-2 py-0.5 rounded self-start">
            Align prescription or document inside frame
          </span>
        </div>
        <!-- Camera Toolbar -->
        <div class="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-2">
          <button type="button" onclick="app.captureDocumentFromCamera()" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center gap-1.5 transition active:scale-95">
            <i data-lucide="camera" class="w-4 h-4"></i> Snap Document
          </button>
          <button type="button" onclick="app.switchDocumentCamera()" title="Switch Front/Back" class="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl border border-slate-700 shadow flex items-center justify-center transition">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="app.stopDocumentCamera()" title="Cancel" class="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold shadow transition">
            Cancel
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.docCameraFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.docCameraStream = stream;
      const video = document.getElementById('docCameraVideo');
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (err) {
      console.warn('Document camera access error:', err);
      this.stopDocumentCamera();
      this.showToast('Camera access declined or unavailable.', 'error');
    }
  }

  switchDocumentCamera() {
    this.docCameraFacing = this.docCameraFacing === 'environment' ? 'user' : 'environment';
    this.startDocumentCamera(this.docCameraFacing);
  }

  stopDocumentCamera() {
    if (this.docCameraStream) {
      this.docCameraStream.getTracks().forEach(t => t.stop());
      this.docCameraStream = null;
    }
    const container = document.getElementById('docPreviewContainer');
    const video = document.getElementById('docCameraVideo');
    if (video) {
      video.srcObject = null;
      if (container && !this.currentDocImageData) {
        container.innerHTML = `
          <div id="docPlaceholder" class="space-y-2 text-slate-400 p-4">
            <i data-lucide="file-text" class="w-10 h-10 mx-auto opacity-50"></i>
            <p class="text-xs font-medium">Click <strong>Open Camera</strong> to scan a physical document, or upload any prescription or lab report image.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  captureDocumentFromCamera() {
    const video = document.getElementById('docCameraVideo');
    if (!video || !this.docCameraStream) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    this.playScanBeep();
    this.stopDocumentCamera();
    this.processDocumentImage(imgData);
  }

  async handleDocumentFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.processDocumentImage(e.target.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async processDocumentImage(imgData) {
    this.currentDocImageData = imgData;

    const preview = document.getElementById('docPreviewContainer');
    if (preview) {
      preview.innerHTML = `
        <div class="relative w-full h-[240px] flex items-center justify-center">
          <img src="${imgData}" class="max-h-[220px] rounded-xl object-contain mx-auto shadow-md" alt="Document Upload">
          <div class="absolute top-2 right-2 flex gap-1.5">
            <button type="button" onclick="app.startDocumentCamera()" class="px-2 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow">
              <i data-lucide="camera" class="w-3.5 h-3.5 text-emerald-400"></i> Retake
            </button>
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }

    const progressContainer = document.getElementById('ocrProgressContainer');
    const progressBar = document.getElementById('ocrProgressBar');
    const progressPercent = document.getElementById('ocrProgressPercent');
    const statusText = document.getElementById('ocrStatusText');

    if (progressContainer) {
      progressContainer.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '20%';
      if (progressPercent) progressPercent.textContent = '20%';
      if (statusText) statusText.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5 animate-spin text-teal-600"></i> Connecting to Cloudflare Workers AI Vision...`;
      if (window.lucide) lucide.createIcons();
    }

    // 1. Try Cloudflare Workers AI Edge Multimodal Vision Model first
    try {
      const aiRes = await fetch('/api/transcribe-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imgData })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData.success && aiData.text && aiData.text.trim().length > 5) {
          if (progressContainer) progressContainer.classList.add('hidden');
          document.getElementById('rawTranscriptionText').value = aiData.text.trim();
          this.reparseTranscriptionText();
          this.showToast('Transcribed with Cloudflare Workers AI at the edge!', 'success');
          return;
        }
      }
    } catch (aiErr) {
      console.warn('Workers AI call failed, falling back to local OCR:', aiErr);
    }

    // 2. Graceful Fallback: Client-side OCR via Tesseract.js
    if (statusText) {
      statusText.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-teal-600"></i> Running in-browser OCR engine...`;
      if (window.lucide) lucide.createIcons();
    }

    if (window.Tesseract) {
      try {
        const worker = await Tesseract.createWorker('eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text' && m.progress !== undefined) {
              const pct = Math.min(99, Math.round(m.progress * 100));
              if (progressBar) progressBar.style.width = `${pct}%`;
              if (progressPercent) progressPercent.textContent = `${pct}%`;
              if (statusText) statusText.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5 text-teal-600"></i> Recognizing text... ${pct}%`;
            }
          }
        });

        const result = await worker.recognize(imgData);
        await worker.terminate();

        const extractedText = (result && result.data && result.data.text) ? result.data.text.trim() : '';

        if (progressContainer) {
          progressContainer.classList.add('hidden');
        }

        if (extractedText.length > 5) {
          document.getElementById('rawTranscriptionText').value = extractedText;
          this.reparseTranscriptionText();
          this.showToast('Document transcribed successfully!', 'success');
          return;
        }
      } catch (ocrErr) {
        console.warn('Tesseract OCR error:', ocrErr);
      }
    }

    if (progressContainer) {
      progressContainer.classList.add('hidden');
    }

    this.showToast('Image captured! You can review or edit the text box directly.', 'success');
  }

  loadSampleDocument(docId) {
    const sample = (window.SAMPLE_MEDICAL_DOCUMENTS || []).find(d => d.id === docId);
    if (!sample) return;

    document.getElementById('rawTranscriptionText').value = sample.rawText;
    
    // Render visual document placeholder
    const preview = document.getElementById('docPreviewContainer');
    if (preview) {
      preview.innerHTML = `
        <div class="bg-white text-slate-800 rounded-xl p-4 border border-slate-200 text-left w-full shadow-inner space-y-2">
          <div class="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <strong class="font-bold text-xs text-slate-900 block">${sample.title}</strong>
              <span class="text-[10px] text-slate-500">${sample.author} • ${sample.date}</span>
            </div>
            <span class="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-teal-100 text-teal-800">${sample.category}</span>
          </div>
          <p class="text-[11px] text-slate-600 leading-relaxed font-mono whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-h-[140px] overflow-y-auto">${sample.rawText}</p>
        </div>
      `;
    }

    this.reparseTranscriptionText();
    this.showToast(`Loaded sample document: ${sample.title}`, 'success');
  }

  reparseTranscriptionText() {
    const text = document.getElementById('rawTranscriptionText').value;
    const parsed = this.clinicalParser.parseText(text);
    this.extractedEntitiesDraft = parsed;
    this.renderExtractedEntities(parsed);
  }

  renderExtractedEntities(parsed) {
    const container = document.getElementById('extractedEntitiesContainer');
    const badge = document.getElementById('extractedCountBadge');
    if (!container) return;

    const totalRecords = (parsed.medications.length) + (parsed.allergies.length) + (parsed.vitals.length) + (parsed.conditions.length) + (parsed.labs.length);
    badge.textContent = `${totalRecords} Records Detected`;

    if (totalRecords === 0) {
      container.innerHTML = `<div class="text-center py-16 text-xs text-slate-400">No medical entities detected in this text. Try adjusting the transcription.</div>`;
      return;
    }

    let html = '';

    // 1. Detected Medications
    if (parsed.medications.length > 0) {
      html += `
        <div class="space-y-2">
          <span class="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
            <i data-lucide="pill" class="w-3.5 h-3.5"></i> Detected Medications (${parsed.medications.length})
          </span>
          ${parsed.medications.map((m, idx) => `
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs flex items-start justify-between gap-2">
              <label class="flex items-start gap-2 cursor-pointer flex-1">
                <input type="checkbox" checked class="entity-check-med mt-1 rounded text-teal-600 focus:ring-teal-500" data-idx="${idx}">
                <div>
                  <strong class="text-slate-900 font-extrabold text-sm">${m.drug_name}</strong>
                  <span class="font-mono text-teal-700 font-bold ml-1">${m.dosage}</span>
                  <p class="text-slate-500 text-[11px] mt-0.5">${m.frequency} • ${m.special_instructions}</p>
                </div>
              </label>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 2. Detected Allergies
    if (parsed.allergies.length > 0) {
      html += `
        <div class="space-y-2 pt-2 border-t border-slate-200">
          <span class="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
            <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i> Detected Allergies (${parsed.allergies.length})
          </span>
          ${parsed.allergies.map((a, idx) => `
            <div class="bg-white p-3 rounded-xl border border-rose-200 shadow-sm text-xs flex items-start justify-between gap-2">
              <label class="flex items-start gap-2 cursor-pointer flex-1">
                <input type="checkbox" checked class="entity-check-alg mt-1 rounded text-rose-600 focus:ring-rose-500" data-idx="${idx}">
                <div>
                  <strong class="text-slate-900 font-extrabold">${a.allergen}</strong>
                  <span class="px-2 py-0.5 text-[10px] font-black uppercase rounded ${a.severity === 'Life-Threatening' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'} ml-1">${a.severity}</span>
                  <p class="text-slate-500 text-[11px] mt-0.5">${a.reaction}</p>
                </div>
              </label>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 3. Detected Vitals
    if (parsed.vitals.length > 0) {
      html += `
        <div class="space-y-2 pt-2 border-t border-slate-200">
          <span class="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
            <i data-lucide="activity" class="w-3.5 h-3.5"></i> Detected Bedside Vitals
          </span>
          ${parsed.vitals.map((v, idx) => `
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
              <label class="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked class="entity-check-vit mt-1 rounded text-teal-600 focus:ring-teal-500" data-idx="${idx}">
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-slate-700">
                  ${v.blood_pressure ? `<span>BP: <strong>${v.blood_pressure}</strong></span>` : ''}
                  ${v.heart_rate ? `<span>HR: <strong>${v.heart_rate} bpm</strong></span>` : ''}
                  ${v.spo2 ? `<span>SpO2: <strong>${v.spo2} %</strong></span>` : ''}
                  ${v.temperature ? `<span>Temp: <strong>${v.temperature} °C</strong></span>` : ''}
                  ${v.blood_glucose ? `<span>Glucose: <strong>${v.blood_glucose} mg/dL</strong></span>` : ''}
                </div>
              </label>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 4. Detected Diagnoses / Conditions
    if (parsed.conditions.length > 0) {
      html += `
        <div class="space-y-2 pt-2 border-t border-slate-200">
          <span class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
            <i data-lucide="clipboard-list" class="w-3.5 h-3.5"></i> Detected Diagnoses (${parsed.conditions.length})
          </span>
          ${parsed.conditions.map((c, idx) => `
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
              <label class="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked class="entity-check-cond mt-1 rounded text-teal-600 focus:ring-teal-500" data-idx="${idx}">
                <div>
                  <strong class="text-slate-900">${c.condition_name}</strong>
                  <span class="font-mono text-[10px] text-slate-500 ml-1">(${c.icd10_code})</span>
                </div>
              </label>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 5. Detected Labs
    if (parsed.labs.length > 0) {
      html += `
        <div class="space-y-2 pt-2 border-t border-slate-200">
          <span class="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-1">
            <i data-lucide="flask-conical" class="w-3.5 h-3.5"></i> Detected Lab Panels (${parsed.labs.length})
          </span>
          ${parsed.labs.map((l, idx) => `
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer flex-1">
                <input type="checkbox" checked class="entity-check-lab rounded text-teal-600 focus:ring-teal-500" data-idx="${idx}">
                <strong class="text-slate-900">${l.test_name}:</strong>
                <span class="font-mono font-bold text-slate-800">${l.result_value}</span>
              </label>
              <span class="px-2 py-0.5 text-[10px] font-bold rounded ${l.flag === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${l.flag}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  async commitSelectedExtractedRecords() {
    if (!this.extractedEntitiesDraft || !this.currentPatient) return;

    // Gather selected checkboxes
    const selectedMeds = [];
    document.querySelectorAll('.entity-check-med:checked').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      if (this.extractedEntitiesDraft.medications[idx]) {
        selectedMeds.push(this.extractedEntitiesDraft.medications[idx]);
      }
    });

    const selectedAllergies = [];
    document.querySelectorAll('.entity-check-alg:checked').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      if (this.extractedEntitiesDraft.allergies[idx]) {
        selectedAllergies.push(this.extractedEntitiesDraft.allergies[idx]);
      }
    });

    const selectedVitals = [];
    document.querySelectorAll('.entity-check-vit:checked').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      if (this.extractedEntitiesDraft.vitals[idx]) {
        selectedVitals.push(this.extractedEntitiesDraft.vitals[idx]);
      }
    });

    const selectedConditions = [];
    document.querySelectorAll('.entity-check-cond:checked').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      if (this.extractedEntitiesDraft.conditions[idx]) {
        selectedConditions.push(this.extractedEntitiesDraft.conditions[idx]);
      }
    });

    const selectedLabs = [];
    document.querySelectorAll('.entity-check-lab:checked').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      if (this.extractedEntitiesDraft.labs[idx]) {
        selectedLabs.push(this.extractedEntitiesDraft.labs[idx]);
      }
    });

    const payload = {
      medications: selectedMeds,
      allergies: selectedAllergies,
      vitals: selectedVitals,
      conditions: selectedConditions,
      labs: selectedLabs,
      document_metadata: {
        document_type: 'Prescription / Clinical Scan',
        file_name: 'scanned_prescription_' + Date.now() + '.jpg',
        image_url: this.currentDocImageData || '',
        raw_transcription: document.getElementById('rawTranscriptionText').value
      }
    };

    try {
      this.showToast('Committing extracted records to SQLite...', 'success');
      const res = await fetch(`/api/patients/${this.currentPatient.id}/commit-scanned-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Commit failed');
      const data = await res.json();

      this.closeTranscriptionModal();
      this.showToast(`Successfully added ${selectedMeds.length} meds, ${selectedAllergies.length} allergies, and ${selectedVitals.length} vitals to patient record!`, 'success');
      
      await this.loadPatient(this.currentPatient.id);
      this.switchTab('medications');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // SCANNED DOCUMENTS TAB
  // -------------------------------------------------------------
  renderScannedDocs() {
    const list = document.getElementById('scannedDocsList');
    if (!list || !this.currentPatient) return;

    const docs = this.currentPatient.scanned_documents || [];
    if (docs.length === 0) {
      list.innerHTML = `
        <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
          <i data-lucide="file-scan" class="w-10 h-10 mx-auto opacity-40"></i>
          <p class="text-sm font-semibold text-slate-700">No scanned documents archived yet.</p>
          <p class="text-xs text-slate-400">Click "Scan New Document" above to photograph or upload a prescription slip, discharge summary, or lab report.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = docs.map(d => `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
              <i data-lucide="file-text" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-sm text-slate-900">${d.document_type}</h4>
              <p class="text-xs text-slate-500 font-mono">${d.file_name} • Scanned: ${d.scanned_at}</p>
            </div>
          </div>
          <span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800">Transcribed & Committed</span>
        </div>
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-mono text-slate-700 max-h-32 overflow-y-auto whitespace-pre-line">
          ${d.raw_transcription}
        </div>
      </div>
    `).join('');
  }

  // -------------------------------------------------------------
  // TAB & VIEW SWITCHING
  // -------------------------------------------------------------
  switchTab(tabId) {
    this.currentTab = tabId;
    ['medications', 'trends', 'allergies', 'history', 'vitals', 'notes', 'scannedDocs', 'wristband'].forEach(t => {
      const btn = document.getElementById(`tabBtn-${t}`);
      const content = document.getElementById(`tabContent-${t}`);
      if (btn && content) {
        if (t === tabId) {
          btn.className = 'tab-btn active inline-flex items-center gap-2 py-3 px-3.5 border-b-2 font-semibold text-sm border-teal-600 text-teal-700 whitespace-nowrap';
          content.classList.remove('hidden');
        } else {
          btn.className = 'tab-btn inline-flex items-center gap-2 py-3 px-3.5 border-b-2 font-semibold text-sm border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap';
          content.classList.add('hidden');
        }
      }
    });

    if (tabId === 'trends') {
      this.renderTrends();
    } else if (tabId === 'allergies') {
      this.renderAllergyTracker();
    } else if (tabId === 'wristband') {
      this.renderWristbandAndCard();
    } else if (tabId === 'scannedDocs') {
      this.renderScannedDocs();
    }

    if (window.lucide) lucide.createIcons();
  }

  showPatientView() {
    document.getElementById('patientView').classList.remove('hidden');
    document.getElementById('directoryView').classList.add('hidden');
    document.getElementById('ideasView').classList.add('hidden');
  }

  showDirectoryView() {
    document.getElementById('patientView').classList.add('hidden');
    document.getElementById('directoryView').classList.remove('hidden');
    document.getElementById('ideasView').classList.add('hidden');
    this.renderDirectory();
  }

  showIdeasView() {
    document.getElementById('patientView').classList.add('hidden');
    document.getElementById('directoryView').classList.add('hidden');
    document.getElementById('ideasView').classList.remove('hidden');
  }

  // -------------------------------------------------------------
  // MEDICAL HISTORY, VITALS, CLINICAL NOTES & WRISTBAND
  // -------------------------------------------------------------
  renderMedicalHistory() {
    const list = document.getElementById('medicalHistoryList');
    if (!list) return;

    const history = this.currentPatient.medical_history || [];
    if (history.length === 0) {
      list.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-400">No medical history recorded.</div>`;
      return;
    }

    list.innerHTML = history.map(h => `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">${h.icd10_code || 'ICD-10'}</span>
            <h3 class="text-base font-extrabold text-slate-900">${h.condition_name}</h3>
            <span class="px-2 py-0.5 text-xs font-bold rounded-full ${
              h.status === 'Active' ? 'bg-rose-100 text-rose-800' :
              h.status === 'Managed' ? 'bg-teal-100 text-teal-800' :
              h.status === 'Resolved' ? 'bg-slate-100 text-slate-600' : 'bg-purple-100 text-purple-800'
            }">${h.status}</span>
          </div>
          <p class="text-xs text-slate-500">Category: <strong class="text-slate-700 font-medium">${h.category}</strong> • Treating Facility: <span class="text-slate-700">${h.treating_facility || 'General Hospital'}</span></p>
          ${h.notes ? `<p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">${h.notes}</p>` : ''}
        </div>
        <div class="text-right text-xs text-slate-400 whitespace-nowrap">
          <span>Diagnosed</span>
          <strong class="block text-slate-700 font-semibold font-mono">${h.diagnosed_date || 'N/A'}</strong>
        </div>
      </div>
    `).join('');
  }

  renderVitalsAndLabs() {
    const grid = document.getElementById('vitalsCardGrid');
    const tableBody = document.getElementById('vitalsTableBody');
    const labsList = document.getElementById('labReportsList');
    if (!grid) return;

    const vitals = this.currentPatient.vitals || [];
    const latestVital = vitals[0] || {};

    const bp = latestVital.blood_pressure || '--';
    const hr = latestVital.heart_rate || '--';
    const spo2 = latestVital.spo2 || '--';
    const temp = latestVital.temperature || '--';
    const glucose = latestVital.blood_glucose || '--';

    grid.innerHTML = `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <span class="text-xs text-slate-400 font-semibold block">Blood Pressure</span>
        <div class="text-xl font-extrabold text-slate-900 mt-1 font-mono">${bp}</div>
        <span class="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full inline-block mt-2">Normotensive</span>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <span class="text-xs text-slate-400 font-semibold block">Heart Rate</span>
        <div class="text-xl font-extrabold text-slate-900 mt-1 font-mono">${hr} <span class="text-xs font-medium text-slate-400">BPM</span></div>
        <span class="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full inline-block mt-2">Sinus Rhythm</span>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <span class="text-xs text-slate-400 font-semibold block">Oxygen (SpO2)</span>
        <div class="text-xl font-extrabold text-slate-900 mt-1 font-mono">${spo2} <span class="text-xs font-medium text-slate-400">%</span></div>
        <span class="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full inline-block mt-2">Room Air</span>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <span class="text-xs text-slate-400 font-semibold block">Temperature</span>
        <div class="text-xl font-extrabold text-slate-900 mt-1 font-mono">${temp} <span class="text-xs font-medium text-slate-400">°C</span></div>
        <span class="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full inline-block mt-2">Afebrile</span>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <span class="text-xs text-slate-400 font-semibold block">Blood Glucose</span>
        <div class="text-xl font-extrabold text-slate-900 mt-1 font-mono">${glucose} <span class="text-xs font-medium text-slate-400">mg/dL</span></div>
        <span class="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full inline-block mt-2">Target Range</span>
      </div>
    `;

    if (tableBody) {
      if (vitals.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-slate-400">No vitals logs recorded yet.</td></tr>`;
      } else {
        tableBody.innerHTML = vitals.map(v => `
          <tr class="hover:bg-slate-50/80">
            <td class="py-2.5 px-3 font-mono text-slate-500">${v.recorded_at}</td>
            <td class="py-2.5 px-3 font-semibold text-slate-800 font-mono">${v.blood_pressure || '--'}</td>
            <td class="py-2.5 px-3 font-mono">${v.heart_rate ? v.heart_rate + ' bpm' : '--'}</td>
            <td class="py-2.5 px-3 font-mono">${v.spo2 ? v.spo2 + ' %' : '--'}</td>
            <td class="py-2.5 px-3 font-mono">${v.temperature ? v.temperature + ' °C' : '--'}</td>
            <td class="py-2.5 px-3 font-mono">${v.blood_glucose ? v.blood_glucose + ' mg/dL' : '--'}</td>
            <td class="py-2.5 px-3 text-slate-600">${v.recorded_by || 'Staff'}</td>
          </tr>
        `).join('');
      }
    }

    const labs = this.currentPatient.lab_reports || [];
    if (labsList) {
      if (labs.length === 0) {
        labsList.innerHTML = `<div class="text-sm text-slate-400 py-4 text-center">No diagnostic labs recorded.</div>`;
      } else {
        labsList.innerHTML = labs.map(l => `
          <div class="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h4 class="font-extrabold text-sm text-slate-900">${l.test_name}</h4>
                <span class="px-2 py-0.5 text-[11px] font-black uppercase rounded ${
                  l.flag === 'Critical' ? 'bg-rose-600 text-white shadow-sm' :
                  l.flag === 'High' ? 'bg-amber-100 text-amber-800' :
                  l.flag === 'Low' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                }">${l.flag}</span>
              </div>
              <p class="text-xs text-slate-500">Category: ${l.category} • Ref Range: <span class="font-mono text-slate-700">${l.reference_range}</span></p>
              ${l.summary_interpretation ? `<p class="text-xs text-slate-700 font-medium pt-1">${l.summary_interpretation}</p>` : ''}
            </div>
            <div class="text-right whitespace-nowrap">
              <span class="text-lg font-mono font-black text-slate-900">${l.result_value}</span>
              <span class="block text-[11px] text-slate-400 font-mono">${l.test_date}</span>
            </div>
          </div>
        `).join('');
      }
    }
  }

  renderClinicalNotes() {
    const list = document.getElementById('clinicalNotesList');
    if (!list) return;

    const notes = this.currentPatient.clinical_notes || [];
    if (notes.length === 0) {
      list.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-400">No clinical follow-up notes logged yet.</div>`;
      return;
    }

    list.innerHTML = notes.map(n => `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <i data-lucide="stethoscope" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-sm text-slate-900">${n.author_name}</h4>
              <p class="text-xs text-slate-500">${n.author_role} • <span class="text-teal-700 font-medium">${n.facility}</span></p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700">${n.visit_type}</span>
            <span class="text-xs text-slate-400 font-mono">${n.created_at}</span>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <strong class="text-slate-900 block font-bold text-xs uppercase tracking-wider text-teal-800">Clinical Assessment:</strong>
            <p class="text-slate-700 leading-relaxed whitespace-pre-line">${n.assessment}</p>
          </div>
          <div class="space-y-1 bg-teal-50/40 p-3 rounded-xl border border-teal-100">
            <strong class="text-slate-900 block font-bold text-xs uppercase tracking-wider text-teal-800">Follow-up Plan & Orders:</strong>
            <p class="text-slate-700 leading-relaxed whitespace-pre-line">${n.plan}</p>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderWristbandAndCard() {
    const p = this.currentPatient;
    if (!p) return;

    const patientUrl = `${window.location.origin}/patient/${p.qr_code}`;

    if (window.MediPulseQR) {
      const wbContainer = document.getElementById('wristbandQrContainer');
      if (wbContainer) {
        wbContainer.innerHTML = MediPulseQR.renderSVG(patientUrl, { size: 100, margin: 2 });
      }
      const cardContainer = document.getElementById('cardQrContainer');
      if (cardContainer) {
        cardContainer.innerHTML = MediPulseQR.renderSVG(patientUrl, { size: 82, margin: 2 });
      }
    }

    document.getElementById('wbPatientName').textContent = `${p.first_name} ${p.last_name}`;
    document.getElementById('wbBloodType').textContent = `BLOOD: ${p.blood_type}`;
    document.getElementById('wbDob').textContent = p.dob;
    document.getElementById('wbMrn').textContent = p.id.toUpperCase();
    
    const wbDnr = document.getElementById('wbDnr');
    if (wbDnr) {
      if (p.dnr_status === 1) wbDnr.classList.remove('hidden');
      else wbDnr.classList.add('hidden');
    }

    const severeAlg = (p.allergies || []).filter(a => a.severity === 'Life-Threatening' || a.severity === 'Severe');
    const wbAllergyWarning = document.getElementById('wbAllergyWarning');
    const wbAllergyText = document.getElementById('wbAllergyText');
    if (severeAlg.length > 0) {
      wbAllergyWarning.classList.remove('hidden');
      wbAllergyText.textContent = severeAlg.map(a => a.allergen).join(', ');
    } else {
      wbAllergyWarning.classList.add('hidden');
    }

    document.getElementById('cardPatientName').textContent = `${p.first_name} ${p.last_name}`;
    document.getElementById('cardDob').textContent = p.dob;
    document.getElementById('cardBlood').textContent = p.blood_type;
    document.getElementById('cardAllergies').textContent = severeAlg.length > 0 ? severeAlg.map(a => a.allergen).join(', ') : 'None Reported';
    
    const primaryContact = p.emergency_contacts && p.emergency_contacts[0];
    document.getElementById('cardContact').textContent = primaryContact ? `${primaryContact.name} (${primaryContact.phone})` : 'None on file';
  }

  downloadQrCode() {
    const p = this.currentPatient;
    if (!p) return;

    const patientUrl = `${window.location.origin}/patient/${p.qr_code}`;
    const canvas = document.createElement('canvas');
    MediPulseQR.renderCanvas(canvas, patientUrl, { size: 512, margin: 4 });

    const link = document.createElement('a');
    link.download = `MediPulse-QR-${p.qr_code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.showToast('High-resolution QR code downloaded', 'success');
  }

  // -------------------------------------------------------------
  // DIRECTORY
  // -------------------------------------------------------------
  renderDirectory() {
    const list = document.getElementById('directoryList');
    if (!list) return;

    let filtered = this.patientsList;
    if (this.activeDirectoryBlood) {
      filtered = filtered.filter(p => p.blood_type === this.activeDirectoryBlood);
    }

    const searchVal = (document.getElementById('directorySearchInput')?.value || '').toLowerCase().trim();
    if (searchVal) {
      filtered = filtered.filter(p =>
        p.first_name.toLowerCase().includes(searchVal) ||
        p.last_name.toLowerCase().includes(searchVal) ||
        p.qr_code.toLowerCase().includes(searchVal) ||
        p.emergency_summary.toLowerCase().includes(searchVal)
      );
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="col-span-3 text-center py-10 bg-white rounded-2xl border border-slate-200 text-slate-400">No matching patient records found.</div>`;
      return;
    }

    list.innerHTML = filtered.map(p => `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <img src="${p.avatar_url}" alt="${p.first_name}" class="w-12 h-12 rounded-xl object-cover border border-slate-200">
              <div>
                <h3 class="font-extrabold text-base text-slate-900">${p.first_name} ${p.last_name}</h3>
                <span class="font-mono text-xs text-slate-400 font-semibold">${p.qr_code}</span>
              </div>
            </div>
            <span class="px-2.5 py-1 text-xs font-black rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              ${p.blood_type}
            </span>
          </div>

          <p class="text-xs text-slate-600 line-clamp-2 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            ${p.emergency_summary}
          </p>

          <div class="flex items-center gap-3 text-xs text-slate-500 pt-1">
            <span><strong>${p.active_meds_count || 0}</strong> Active Pills</span>
            <span>•</span>
            <span><strong>${p.allergies_count || 0}</strong> Allergies</span>
            ${p.dnr_status === 1 ? '<span class="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[10px] font-bold">DNR</span>' : ''}
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <button onclick="app.loadPatient('${p.id}')" class="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl transition">
            View Medical Profile
          </button>
          <button onclick="app.openDirectQr('${p.qr_code}')" class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition" title="Show QR Code">
            <i data-lucide="qr-code" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  }

  searchPatients(val) {
    this.renderDirectory();
  }

  filterDirectoryBlood(blood) {
    this.activeDirectoryBlood = blood;
    document.querySelectorAll('.blood-filter-btn').forEach(btn => {
      if (btn.dataset.blood === blood) {
        btn.className = 'blood-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-600 text-white';
      } else {
        btn.className = 'blood-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    });
    this.renderDirectory();
  }

  openDirectQr(qrCode) {
    this.loadPatient(qrCode);
    this.switchTab('wristband');
  }

  // -------------------------------------------------------------
  // QR CAMERA SCANNER
  // -------------------------------------------------------------
  openScannerModal() {
    const modal = document.getElementById('scannerModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (this.scanner) {
      this.scanner.startCamera(this.cameraFacing);
    }
  }

  closeScannerModal() {
    const modal = document.getElementById('scannerModal');
    if (!modal) return;
    modal.classList.add('hidden');
    if (this.scanner) {
      this.scanner.stopCamera();
    }
  }

  toggleCameraMode() {
    this.cameraFacing = this.cameraFacing === 'environment' ? 'user' : 'environment';
    if (this.scanner) {
      this.scanner.startCamera(this.cameraFacing);
    }
  }

  async handleQrFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      this.showToast('Analyzing QR image...', 'success');
      const result = await this.scanner.scanImageFile(file);
      this.onQrScanDetected(result);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  submitManualCode() {
    const input = document.getElementById('manualCodeInput');
    const code = input ? input.value.trim() : '';
    if (!code) return;
    this.onQrScanDetected(code);
  }

  quickLoadCode(code) {
    this.onQrScanDetected(code);
  }

  onQrScanDetected(code) {
    this.playScanBeep();
    this.closeScannerModal();

    let cleanCode = code;
    try {
      if (code.startsWith('http://') || code.startsWith('https://')) {
        const u = new URL(code);
        const match = u.pathname.match(/\/patient\/([^/]+)/);
        if (match) cleanCode = match[1];
        else cleanCode = u.searchParams.get('code') || cleanCode;
      }
    } catch (e) {}

    this.loadPatient(cleanCode, true);
  }

  // -------------------------------------------------------------
  // CLINICAL FOLLOW-UP, VITALS, AND PILL MODALS
  // -------------------------------------------------------------
  openFollowUpModal() {
    document.getElementById('followUpModal').classList.remove('hidden');
  }

  closeFollowUpModal() {
    document.getElementById('followUpModal').classList.add('hidden');
  }

  async submitFollowUpNote(event) {
    event.preventDefault();
    if (!this.currentPatient) return;

    const payload = {
      author_name: document.getElementById('noteAuthorName').value,
      author_role: document.getElementById('noteAuthorRole').value,
      facility: document.getElementById('noteFacility').value,
      visit_type: document.getElementById('noteVisitType').value,
      assessment: document.getElementById('noteAssessment').value,
      plan: document.getElementById('notePlan').value
    };

    try {
      const res = await fetch(`/api/patients/${this.currentPatient.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save clinical note');
      
      this.closeFollowUpModal();
      this.showToast('Clinical follow-up note saved to SQLite', 'success');
      await this.loadPatient(this.currentPatient.id);
      this.switchTab('notes');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openVitalsModal() {
    document.getElementById('vitalsModal').classList.remove('hidden');
  }

  closeVitalsModal() {
    document.getElementById('vitalsModal').classList.add('hidden');
  }

  async submitVitalsLog(event) {
    event.preventDefault();
    if (!this.currentPatient) return;

    const payload = {
      blood_pressure: document.getElementById('vitBp').value,
      heart_rate: document.getElementById('vitHr').value,
      spo2: document.getElementById('vitSpo2').value,
      temperature: document.getElementById('vitTemp').value,
      blood_glucose: document.getElementById('vitGlucose').value,
      recorded_by: document.getElementById('vitObserver').value
    };

    try {
      const res = await fetch(`/api/patients/${this.currentPatient.id}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save vitals');

      this.closeVitalsModal();
      this.showToast('Bedside vitals recorded', 'success');
      await this.loadPatient(this.currentPatient.id);
      this.switchTab('vitals');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openMedicationModal() {
    document.getElementById('medicationModal').classList.remove('hidden');
  }

  closeMedicationModal() {
    document.getElementById('medicationModal').classList.add('hidden');
  }

  async submitNewMedication(event) {
    event.preventDefault();
    if (!this.currentPatient) return;

    const payload = {
      drug_name: document.getElementById('medName').value,
      dosage: document.getElementById('medDosage').value,
      form: document.getElementById('medForm').value,
      frequency: document.getElementById('medFrequency').value,
      purpose: document.getElementById('medPurpose').value,
      pill_color_shape: document.getElementById('medAppearance').value,
      prescribing_doctor: document.getElementById('medDoctor').value
    };

    try {
      const res = await fetch(`/api/patients/${this.currentPatient.id}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to add medication');

      this.closeMedicationModal();
      this.showToast(`Prescribed ${payload.drug_name} ${payload.dosage}`, 'success');
      await this.loadPatient(this.currentPatient.id);
      this.switchTab('medications');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async resetDemoData() {
    if (!confirm('Reset all patients, vitals, and notes back to initial demo state?')) return;
    try {
      const res = await fetch('/api/reset-demo', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset');
      this.showToast('Database reset to clean demo state', 'success');
      await this.fetchPatientsDirectory();
      await this.loadPatient(this.currentPatient ? this.currentPatient.id : 'pat-8091');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  showLoading(isLoading) {
    const loader = document.getElementById('loadingIndicator');
    const content = document.getElementById('patientView');
    if (isLoading) {
      loader?.classList.remove('hidden');
      content?.classList.add('opacity-50');
    } else {
      loader?.classList.add('hidden');
      content?.classList.remove('opacity-50');
    }
  }

  calculateAge(dobString) {
    if (!dobString) return '--';
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
}

// Instantiate and expose globally
const app = new MediPulseApp();
window.app = app;
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

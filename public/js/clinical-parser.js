// MediPulse Clinical Entity Parser & Medical NLP Engine
// Extracts structured medications, allergies, vitals, conditions, and labs from raw transcribed text

(function(root) {
  class ClinicalParser {
    constructor() {
      // Common medical frequencies & abbreviations
      this.frequencyMap = {
        'qd': 'Once daily',
        'q.d.': 'Once daily',
        'daily': 'Once daily',
        'once daily': 'Once daily',
        'bid': 'Twice daily',
        'b.i.d.': 'Twice daily',
        'twice daily': 'Twice daily',
        'tid': 'Three times daily',
        't.i.d.': 'Three times daily',
        'three times daily': 'Three times daily',
        'qid': 'Four times daily',
        'q.i.d.': 'Four times daily',
        'qhs': 'At bedtime',
        'q.h.s.': 'At bedtime',
        'at bedtime': 'At bedtime',
        'prn': 'As needed (PRN)',
        'p.r.n.': 'As needed (PRN)',
        'as needed': 'As needed (PRN)',
        'q4h': 'Every 4 hours',
        'q6h': 'Every 6 hours',
        'q8h': 'Every 8 hours',
        'q12h': 'Every 12 hours'
      };

      // Known drug database for entity recognition
      this.knownDrugs = [
        'metformin', 'lisinopril', 'atorvastatin', 'aspirin', 'warfarin',
        'metoprolol', 'furosemide', 'lasix', 'epipen', 'epinephrine',
        'albuterol', 'cetirizine', 'fingolimod', 'gilenya', 'levothyroxine',
        'synthroid', 'baclofen', 'insulin lispro', 'humalog', 'insulin glargine',
        'lantus', 'baqsimi', 'glucagon', 'amlodipine', 'omeprazole',
        'losartan', 'gabapentin', 'hydrochlorothiazide', 'amoxicillin',
        'azithromycin', 'prednisone', 'ibuprofen', 'acetaminophen',
        'pantoprazole', 'escitalopram', 'sertraline', 'clopidogrel',
        'apixaban', 'rivaroxaban', 'carvedilol', 'spironolactone', 'glipizide',
        'sitagliptin', 'empagliflozin', 'semaglutide', 'tramadol', 'morphine',
        'oxycodone', 'montelukast', 'fluticasone', 'loratadine', 'ciprofloxacin',
        'doxycycline', 'cephalexin', 'fluoxetine', 'citalopram', 'paracetamol'
      ];
    }

    parseText(text) {
      if (!text || typeof text !== 'string') {
        return { medications: [], allergies: [], vitals: [], conditions: [], labs: [], rawText: '' };
      }

      return {
        medications: this.extractMedications(text),
        allergies: this.extractAllergies(text),
        vitals: this.extractVitals(text),
        conditions: this.extractConditions(text),
        labs: this.extractLabs(text),
        rawText: text
      };
    }

    extractMedications(text) {
      const medications = [];
      const lines = text.replace(/\r\n/g, '\n').split('\n');
      const seenNames = new Set();

      let inMedSection = false;

      for (let rawLine of lines) {
        let trimmed = rawLine.trim();
        if (!trimmed) continue;

        // Check for section headers
        if (/^(?:MEDICATIONS?|CURRENT MEDICATIONS?|PRESCRIPTIONS?|RX LIST|DRUGS?)\s*[:\-]?$/i.test(trimmed)) {
          inMedSection = true;
          continue;
        }
        if (/^(?:ALLERG(?:Y|IES)|VITALS?|LABS?|DIAGNOS(?:IS|ES)|IMPRESSION|NOTES?|HISTORY)\s*[:\-]?$/i.test(trimmed)) {
          inMedSection = false;
        }

        // Clean leading noise, bullet points, numbers, OCR pipes
        let clean = trimmed
          .replace(/^[\|\*\•\–\—\>~#\+]\s*/, '')
          .replace(/^\d+[\.\)\-]\s*/, '')
          .replace(/^(?:Rx|Medication|Drug|Take|Prescription)\s*[:\.\-]?\s*/i, '')
          .trim();

        if (!clean) continue;

        // Match Medication Name, Dosage, Form, and Frequency
        // e.g. "Metformin HCl 1000mg Tablet PO Twice daily with meals"
        // e.g. "Lisinopril 20 mg PO Daily in the morning"
        // e.g. "Amlodipine 5mg tab daily"
        const rxMatch = clean.match(/^([A-Za-z0-9\s\-\/\(\)]+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?|iu|puffs?|drops?|meq))\b(?:\s+(tab(?:let)?s?|cap(?:sule)?s?|inhaler|inj(?:ection)?|liquid|spray|drops?|cream|patch|sol(?:ution)?))?\s*(?:PO|oral)?\s*(.*)/i);

        let detected = null;

        if (rxMatch) {
          const rawName = rxMatch[1].replace(/^(?:Rx|Medication|Drug|Take)\s*[:\-]?\s*/i, '').trim();
          const dosage = rxMatch[2].trim();
          const formRaw = rxMatch[3] ? rxMatch[3].toLowerCase() : 'tablet';
          const rest = rxMatch[4] ? rxMatch[4].trim() : '';

          if (rawName.length >= 3 && !rawName.match(/^(?:BP|Vitals|Allergies|Lab|Impression|Date|Patient|Doctor|Signed|Refills?|Dispense)/i)) {
            let form = 'Tablet';
            if (formRaw.includes('cap')) form = 'Capsule';
            else if (formRaw.includes('inhal')) form = 'Inhaler';
            else if (formRaw.includes('inj')) form = 'Injection';
            else if (formRaw.includes('liquid') || formRaw.includes('sol')) form = 'Liquid Solution';
            else if (formRaw.includes('spray')) form = 'Nasal Spray';
            else if (formRaw.includes('cream')) form = 'Topical Cream';
            else if (formRaw.includes('patch')) form = 'Transdermal Patch';
            else if (formRaw.includes('drop')) form = 'Drops';

            let frequency = 'Once daily';
            let timing = 'Morning';
            let special = rest;

            const lowerRest = rest.toLowerCase();
            for (let [abbr, phrase] of Object.entries(this.frequencyMap)) {
              if (new RegExp('\\b' + abbr.replace('.', '\\.') + '\\b', 'i').test(lowerRest)) {
                frequency = phrase;
                break;
              }
            }

            if (lowerRest.includes('morning')) timing = 'Morning';
            else if (lowerRest.includes('evening') || lowerRest.includes('dinner') || lowerRest.includes('night') || lowerRest.includes('bedtime')) timing = 'Evening / Bedtime';
            else if (lowerRest.includes('twice') || lowerRest.includes('bid')) timing = 'Morning, Evening';
            else if (lowerRest.includes('prn') || lowerRest.includes('as needed')) timing = 'As needed (PRN)';

            const cleanName = rawName.split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');

            detected = {
              drug_name: cleanName,
              dosage: dosage.toUpperCase(),
              form: form,
              frequency: frequency,
              time_of_day: timing,
              purpose: 'Transcribed from medical document',
              special_instructions: special || 'Take as directed on prescription label'
            };
          }
        } else if (inMedSection) {
          // Inside a MEDICATIONS: section, check for known drugs or line with dosage
          const knownMatch = this.knownDrugs.find(kd => new RegExp('\\b' + kd + '\\b', 'i').test(clean));
          const numMatch = clean.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?|iu|puffs?)?)/i);
          if (knownMatch && numMatch) {
            const cleanName = knownMatch.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            let dosage = numMatch[1].trim();
            if (!/[a-z]/i.test(dosage)) dosage += ' mg';
            detected = {
              drug_name: cleanName,
              dosage: dosage.toUpperCase(),
              form: 'Tablet',
              frequency: 'Once daily',
              time_of_day: 'Morning',
              purpose: 'Transcribed from medical document',
              special_instructions: clean
            };
          }
        }

        if (detected && !seenNames.has(detected.drug_name.toLowerCase())) {
          seenNames.add(detected.drug_name.toLowerCase());
          medications.push(detected);
        }
      }

      return medications;
    }

    extractAllergies(text) {
      const allergies = [];
      const lines = text.replace(/\r\n/g, '\n').split('\n');
      const seenAllergens = new Set();
      let inAllergySection = false;

      for (let rawLine of lines) {
        let trimmed = rawLine.trim();
        if (!trimmed) continue;

        // Check for allergy headers
        if (/^(?:ALLERG(?:Y|IES)|ALLERGIC TO|KNOWN ALLERGIES)\s*[:\-]?$/i.test(trimmed)) {
          inAllergySection = true;
          continue;
        }
        if (/^(?:MEDICATIONS?|VITALS?|LABS?|DIAGNOS(?:IS|ES)|IMPRESSION|NOTES?|HISTORY)\s*[:\-]?$/i.test(trimmed)) {
          inAllergySection = false;
        }

        let allergyLineItems = null;

        // Pattern 1: Inline header "Allergies: Penicillin (anaphylaxis), Sulfa"
        const algMatch = trimmed.match(/(?:Allerg(?:y|ies)|Allergic to|Known Allergies)\s*[:\-]\s*(.*)/i);
        if (algMatch) {
          allergyLineItems = algMatch[1];
        } else if (inAllergySection) {
          // Clean bullet
          allergyLineItems = trimmed.replace(/^[\|\*\•\–\—\>~#\+]\s*/, '').replace(/^\d+[\.\)\-]\s*/, '');
        }

        if (allergyLineItems) {
          const items = allergyLineItems.split(/[,;]/);
          for (let item of items) {
            const raw = item.trim();
            if (!raw || /^(?:none|nkda|nka|no known|nil|na)\b/i.test(raw)) continue;

            let severity = 'Moderate';
            let reaction = 'Adverse reaction';
            let category = 'Drug';

            // Check reaction in parentheses or colon e.g. "Penicillin (severe anaphylaxis)" or "Sulfa: hives"
            const reactionMatch = raw.match(/([^\(\:\-]+)(?:[\(\:\-](.*?)[\)]?)?$/);
            let allergen = raw;
            if (reactionMatch) {
              allergen = reactionMatch[1].trim();
              if (reactionMatch[2]) reaction = reactionMatch[2].replace(/[\(\)]/g, '').trim();
            }

            if (!allergen || allergen.length < 2) continue;

            const lower = (allergen + ' ' + reaction).toLowerCase();
            if (lower.includes('anaphylaxis') || lower.includes('closure') || lower.includes('shock') || lower.includes('life')) {
              severity = 'Life-Threatening';
            } else if (lower.includes('severe') || lower.includes('angioedema') || lower.includes('wheezing') || lower.includes('bleeding')) {
              severity = 'Severe';
            } else if (lower.includes('mild') || lower.includes('nausea') || lower.includes('sneezing') || lower.includes('itching')) {
              severity = 'Mild';
            }

            if (lower.includes('peanut') || lower.includes('nut') || lower.includes('shellfish') || lower.includes('egg') || lower.includes('milk') || lower.includes('gluten') || lower.includes('soy')) {
              category = 'Food';
            } else if (lower.includes('latex') || lower.includes('rubber') || lower.includes('nickel') || lower.includes('adhesive')) {
              category = 'Material';
            } else if (lower.includes('pollen') || lower.includes('dander') || lower.includes('dust') || lower.includes('grass') || lower.includes('mold')) {
              category = 'Environmental';
            }

            const cleanAllergen = allergen.charAt(0).toUpperCase() + allergen.slice(1);
            if (!seenAllergens.has(cleanAllergen.toLowerCase())) {
              seenAllergens.add(cleanAllergen.toLowerCase());
              allergies.push({
                allergen: cleanAllergen,
                reaction: reaction || 'Adverse reaction',
                severity: severity,
                category: category,
                verification_status: 'Confirmed',
                notes: 'Extracted from clinical record'
              });
            }
          }
        }
      }

      return allergies;
    }

    extractVitals(text) {
      const vitals = [];
      let bp = null;
      let hr = null;
      let spo2 = null;
      let temp = null;
      let glucose = null;

      // Extract Blood Pressure e.g. "BP: 124/80" or "BP 130/85 mmHg" or "120/80 mmHg"
      const bpMatch = text.match(/(?:BP|Blood Pressure)\s*[:\-]?\s*(\d{2,3}\s*\/\s*\d{2,3})/i) ||
                      text.match(/\b(1\d\d|2\d\d|[89]\d)\s*\/\s*([4-9]\d|1[01]\d)\s*(?:mmHg)?\b/i);
      if (bpMatch) {
        if (bpMatch[2]) {
          bp = `${bpMatch[1]}/${bpMatch[2]} mmHg`;
        } else {
          bp = bpMatch[1].replace(/\s+/g, '') + ' mmHg';
        }
      }

      // Extract Heart Rate e.g. "HR: 72 bpm" or "Pulse: 74" or "HR 70"
      const hrMatch = text.match(/(?:HR|Pulse|Heart Rate)\s*[:\-]?\s*(\d{2,3})\s*(?:bpm)?/i);
      if (hrMatch) hr = parseInt(hrMatch[1]);

      // Extract SpO2 e.g. "SpO2: 98%" or "O2 Sat: 99%" or "Pulse Ox: 97%"
      const spo2Match = text.match(/(?:SpO2|O2 Sat(?:uration)?|Pulse Ox|O2)\s*[:\-]?\s*(\d{2,3})\s*%/i);
      if (spo2Match) spo2 = parseInt(spo2Match[1]);

      // Extract Temp e.g. "Temp: 36.8 C" or "T: 98.6 F" or "36.8°C"
      const tempMatch = text.match(/(?:Temp(?:erature)?|T)\s*[:\-]?\s*(\d{2,3}(?:\.\d+)?)\s*(?:°?\s*([CF]))?/i);
      if (tempMatch) {
        let val = parseFloat(tempMatch[1]);
        if (tempMatch[2] && tempMatch[2].toUpperCase() === 'F') {
          val = ((val - 32) * 5 / 9).toFixed(1); // convert to C
        }
        temp = parseFloat(val);
      }

      // Extract Blood Glucose e.g. "Glucose: 112 mg/dL" or "FSBG: 104" or "Blood Sugar: 115"
      const glucoseMatch = text.match(/(?:Glucose|Blood Sugar|FSBG|BS|Sugar)\s*[:\-]?\s*(\d{2,3})\s*(?:mg\/dL)?/i);
      if (glucoseMatch) glucose = parseInt(glucoseMatch[1]);

      if (bp || hr || spo2 || temp || glucose) {
        vitals.push({
          blood_pressure: bp || '',
          heart_rate: hr || null,
          spo2: spo2 || null,
          temperature: temp || null,
          blood_glucose: glucose || null,
          recorded_by: 'Transcribed from Scanned Record',
          notes: 'Auto-extracted from uploaded medical document'
        });
      }

      return vitals;
    }

    extractConditions(text) {
      const conditions = [];
      const lines = text.replace(/\r\n/g, '\n').split('\n');
      const seenConditions = new Set();
      let inCondSection = false;

      for (let rawLine of lines) {
        let trimmed = rawLine.trim();
        if (!trimmed) continue;

        if (/^(?:DIAGNOS(?:IS|ES)|IMPRESSION|HISTORY OF|CONDITIONS?|ACTIVE PROBLEMS?)\s*[:\-]?$/i.test(trimmed)) {
          inCondSection = true;
          continue;
        }
        if (/^(?:MEDICATIONS?|ALLERG(?:Y|IES)|VITALS?|LABS?|NOTES?|RX)\s*[:\-]?$/i.test(trimmed)) {
          inCondSection = false;
        }

        let condLineItems = null;
        const condMatch = trimmed.match(/(?:Diagnosis|Diagnoses|Impression|History of|Condition|Problem)\s*[:\-]\s*(.*)/i);
        if (condMatch) {
          condLineItems = condMatch[1];
        } else if (inCondSection) {
          condLineItems = trimmed.replace(/^[\|\*\•\–\—\>~#\+]\s*/, '').replace(/^\d+[\.\)\-]\s*/, '');
        }

        if (condLineItems) {
          const items = condLineItems.split(/[,;]/);
          for (let item of items) {
            const raw = item.trim();
            if (!raw || raw.length < 3 || /^(?:none|no acute|normal)\b/i.test(raw)) continue;

            // Extract optional ICD code: "Type 2 Diabetes Mellitus (E11.9)"
            const icdMatch = raw.match(/(.*?)\s*\(([A-Z]\d{2}(?:\.\d+)?)\)/i);
            let name = raw;
            let icd = '';
            if (icdMatch) {
              name = icdMatch[1].trim();
              icd = icdMatch[2].toUpperCase();
            }

            let category = 'General Medical';
            const lower = name.toLowerCase();
            if (lower.includes('heart') || lower.includes('hypertension') || lower.includes('cardio') || lower.includes('fibrillation')) {
              category = 'Cardiovascular';
            } else if (lower.includes('diabetes') || lower.includes('thyroid') || lower.includes('endocrine')) {
              category = 'Endocrine';
            } else if (lower.includes('asthma') || lower.includes('copd') || lower.includes('respiratory')) {
              category = 'Respiratory';
            } else if (lower.includes('kidney') || lower.includes('renal') || lower.includes('nephro')) {
              category = 'Nephrology';
            } else if (lower.includes('sclerosis') || lower.includes('neuro') || lower.includes('stroke')) {
              category = 'Neurology';
            }

            const cleanName = name.charAt(0).toUpperCase() + name.slice(1);
            if (!seenConditions.has(cleanName.toLowerCase())) {
              seenConditions.add(cleanName.toLowerCase());
              conditions.push({
                condition_name: cleanName,
                icd10_code: icd || 'R69',
                category: category,
                status: 'Active'
              });
            }
          }
        }
      }

      return conditions;
    }

    extractLabs(text) {
      const labs = [];
      const lines = text.split('\n');

      const knownLabNames = [
        'hba1c', 'egfr', 'inr', 'prothrombin', 'ldl', 'hdl', 'cholesterol',
        'triglycerides', 'creatinine', 'bun', 'potassium', 'sodium', 'alt',
        'ast', 'tsh', 'ige', 'hemoglobin', 'wbc', 'platelet', 'crp', 'glucose'
      ];

      for (let line of lines) {
        const trimmed = line.trim();
        // Only inspect if line contains 'Lab' or a known lab test name
        const hasLabContext = trimmed.match(/^(?:Lab|Test|Diagnostic)/i) || 
                              knownLabNames.some(name => new RegExp('\\b' + name + '\\b', 'i').test(trimmed));

        if (!hasLabContext) continue;

        const cleanLine = trimmed.replace(/^(?:Labs?|Diagnostics?|Results?)\s*[:\-]\s*/i, '');
        const items = cleanLine.split(/[,;]/);

        for (let item of items) {
          const itemTrimmed = item.trim();
          const labMatch = itemTrimmed.match(/([A-Za-z0-9\s\/\-\(\)]+?)\s*[:=]\s*(\>|\<)?\s*(\d+(?:\.\d+)?\s*(?:%|mg\/dL|mL\/min(?:\/1\.73m²)?|INR|kU\/L|mIU\/L|mEq\/L|g\/dL)?)\s*(?:\[(.*?)\]|\((.*?)\))?/i);

          if (labMatch) {
            const testName = labMatch[1].trim();
            const prefix = labMatch[2] || '';
            const value = prefix + labMatch[3].trim();
            const annotation = (labMatch[4] || labMatch[5] || '').toLowerCase();

            // Filter out false positives
            if (!testName.match(/^(?:BP|DOB|Date|Phone|Rx|Age|Time|HR|SpO2|Refills|Dispense)/i) && testName.length > 2) {
              let flag = 'Normal';
              if (annotation.includes('high') || annotation.includes('critical') || annotation.includes('elevated')) {
                flag = annotation.includes('critical') ? 'Critical' : 'High';
              } else if (annotation.includes('low')) {
                flag = 'Low';
              }

              labs.push({
                test_name: testName,
                result_value: value,
                reference_range: annotation || 'Normal Reference',
                flag: flag,
                category: 'Clinical Chemistry & Diagnostics'
              });
            }
          }
        }
      }

      return labs;
    }
  }

  // Pre-configured realistic sample medical documents for instant testing & demonstration
  root.SAMPLE_MEDICAL_DOCUMENTS = [
    {
      id: 'doc-rx-1',
      title: 'Outpatient Prescription Slip',
      author: 'Dr. Sarah Jenkins, MD - Memorial Heart Clinic',
      date: '2026-09-12',
      category: 'Prescription',
      description: 'Prescription slip updating diabetic glycemic regimen and adding ACE-inhibitor.',
      rawText: `SPRINGFIELD MEMORIAL HEART & METABOLIC CLINIC
Physician: Dr. Sarah Jenkins, MD  |  License #IL-8841920
Date: September 12, 2026  |  Patient: Eleanor Vance (DOB: 04/12/1958)

Rx: Metformin HCl 1000 mg Tablet PO Twice daily with morning and evening meals. Dispense #60. Refills: 3
Rx: Lisinopril 20 mg Tablet PO Once daily in the morning. Dispense #30. Refills: 5
Rx: Atorvastatin Calcium 40 mg Tablet PO Once daily at bedtime. Dispense #30. Refills: 3

Allergies: Penicillin (severe anaphylaxis), Bactrim (rash)
Vitals: BP: 124/80 mmHg, HR: 70 bpm, SpO2: 99%, Temp: 36.8 C, Glucose: 112 mg/dL
Diagnoses: Type 2 Diabetes Mellitus (E11.9), Hypertensive Heart Disease (I11.9)
Labs: HbA1c: 6.9% [High: Target < 7.0%], eGFR: 78 mL/min [Normal]`,
      previewBadgeColor: 'teal'
    },
    {
      id: 'doc-discharge-2',
      title: 'Emergency Department Triage & Allergy Panel',
      author: 'Dr. Alan Wu, MD - Bay Area Allergy & Emergency Service',
      date: '2026-09-10',
      category: 'Discharge Summary',
      description: 'Emergency assessment following accidental allergen exposure risk.',
      rawText: `SAN FRANCISCO EMERGENCY TRIAGE & IMMUNOLOGY CENTER
Attending: Dr. Alan Wu, MD, FAAAAI
Date: September 10, 2026  |  Patient: Marcus Chen (DOB: 09/23/1997)

Allergies: Peanuts & Tree Nuts (Life-Threatening Anaphylaxis), Shellfish (severe angioedema)
Vitals: BP: 118/74 mmHg, Pulse: 64 bpm, SpO2: 100%, Temp: 36.6 C, Glucose: 94 mg/dL
Diagnoses: Extrinsic Atopic Asthma (J45.21), Severe IgE Food Anaphylaxis (T78.0)

Rx: EpiPen Auto-Injector 0.3 mg Injection IM PRN severe allergic reaction. Dispense 2-Pack.
Rx: Albuterol Sulfate 90 mcg Inhaler 2 puffs Q4H PRN bronchospasm.
Rx: Cetirizine HCl 10 mg Tablet PO Once daily evening.

Labs: Specific IgE Peanut: > 100 kU/L [Critical: Class 6 High Sensitivity]`,
      previewBadgeColor: 'rose'
    },
    {
      id: 'doc-cardio-3',
      title: 'Cardiology Anticoagulation Review & Vitals Slip',
      author: 'Dr. Patrick Sullivan, MD - Mass General Brigham',
      date: '2026-09-08',
      category: 'Lab Report & Titration Slip',
      description: 'Coagulation monitoring and Warfarin dosage adjustment sheet.',
      rawText: `MASS GENERAL BRIGHAM - ANTICOAGULATION MANAGEMENT
Clinician: Dr. Patrick Sullivan, MD
Date: September 08, 2026  |  Patient: James O'Connor (DOB: 01/30/1952)

Vitals: BP: 132/76 mmHg, HR: 68 bpm, SpO2: 96%, Temp: 36.5 C, Glucose: 104 mg/dL
Diagnoses: Chronic Atrial Fibrillation (I48.20), Chronic Kidney Disease Stage 3b (N18.32)
Allergies: NSAIDs (severe peptic bleeding risk), Morphine (severe nausea/pruritus)

Rx: Warfarin Sodium 5 mg Tablet PO Once daily at 18:00 (Target INR 2.0-3.0). Dispense #30.
Rx: Metoprolol Succinate ER 50 mg Tablet PO Once daily in morning. Dispense #30.
Rx: Furosemide 20 mg Tablet PO Once daily morning. Dispense #30.

Labs: INR: 2.4 INR [Normal Therapeutic Range 2.0 - 3.0], Serum Creatinine: 1.68 mg/dL [High]`,
      previewBadgeColor: 'indigo'
    }
  ];

  root.ClinicalParser = ClinicalParser;
})(typeof window !== 'undefined' ? window : globalThis);

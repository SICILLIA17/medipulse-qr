# MediPulse QR - Patient Medical History, Document OCR & Clinical Follow-up Portal

> **Instant Bedside & Emergency Access**: Scan a patient's QR code (on a wristband, wallet card, or mobile device) to instantly view critical emergency data, active pill regimens ("what pills you're taking"), allergy alerts, and diagnostic labs.
> **Intelligent Document OCR & Transcription**: Upload or scan photos of prescription slips, hospital discharge summaries, or lab reports to auto-extract medications, allergies, vitals, and conditions directly into patient history.
> **Longitudinal Trend Analysis**: Interactive clinical trend charts for Blood Pressure (Systolic/Diastolic), Heart Rate, SpO2, Blood Glucose, and key biomarkers like HbA1c and INR.
> **Medication Lifecycle Management**: Track active vs. historical/discontinued medications, titrate dosages with audit logs, and reactivate old medications with 1 click.

---

## 🚀 Quick Start

To launch the portal:

```bash
./start.sh
```

Then open your browser to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🌟 Core Features

### 1. 📷 Medical Document Scanning & OCR Transcription
- **Scan / Upload Image**: Photograph or upload prescription slips, lab sheets, or triage notes.
- **Client-Side OCR & Clinical NLP (`public/js/clinical-parser.js`)**:
  - Automatically identifies and structures:
    - **Medications**: Drug trade/generic name, exact dosage (`mg`, `mcg`, `units`), form (`Tablet`, `Inhaler`), frequency schedule (`Twice daily with meals`, `PRN`), instructions.
    - **Allergies**: Severity tiering (`Life-Threatening`, `Severe`, `Moderate`, `Mild`) and category (`Drug`, `Food`, `Environmental`, `Material`).
    - **Bedside Vitals**: Blood Pressure, Pulse, SpO2, Temp, Glucose.
    - **Diagnoses**: Chronic conditions with ICD-10 diagnostic codes.
    - **Lab Reports**: Test values, reference ranges, and abnormal flags (`High`, `Critical`, `Normal`).
- **Interactive Review & Batch Commit**:
  - Side-by-side view with document preview and editable entity checklist.
  - 1-click **"Commit to Patient History"** saves all verified records to the SQLite database.
- **3 One-Click Pre-Loaded Sample Documents**:
  - Outpatient Rx Slip, ER Triage & Allergy Panel, and Cardiology Anticoagulation Review for instant testing.

### 2. 📈 Longitudinal Trend Analysis Visualizations (`public/js/charts.js`)
- **Interactive SVG Clinical Charts**:
  - **Blood Pressure Trajectory**: Dual-series line chart for Systolic and Diastolic pressure over time, featuring the clinical target normal zone (< 120/80 mmHg).
  - **Heart Rate Trend**: Pulse trajectory with normal sinus range (60 - 100 BPM).
  - **Blood Oxygen SpO2 Trend**: Oxygenation over time with safe >= 95% target threshold.
  - **Blood Glucose Trend**: Glycemic trajectory with target zone (70 - 130 mg/dL).
  - **Body Temperature Curve**: Temperature trend with afebrile target (36.5 - 37.5 °C).
- **Time Range Filters**: All Time, 90 Days, 30 Days.
- **Biomarker Trajectories**: Multi-month tracking of HbA1c (e.g. 7.3% ➔ 6.9%), INR Coagulation window (2.0 - 3.0), and Renal eGFR.

### 3. 🛡️ Dedicated Allergy Tracker & Risk Matrix
- **Risk Matrix Summary**: Live counts of Life-Threatening (Anaphylaxis), Severe, Moderate, and Mild allergies.
- **Category Filters**: Filter by `Drug / Antibiotic`, `Food`, `Environmental`, and `Material (Latex)`.
- **Detailed Allergy Cards**: Displays allergen name, category, verification status (*Confirmed*), clinical reactions, and cross-reactivity warnings.
- **"+ Add New Allergy"**: Instant entry with emergency triage banner synchronization.

### 4. 💊 Medication Lifecycle: Active vs. Historical & Dosage Titrations
- **Active vs. Historical Segregation**:
  - Separate tabs for **🟢 Active Medications** and **⚪ Historical / Discontinued Medications**.
- **Dosage Change (Titration) Workflow**:
  - Active pill cards feature a **"+ Change Dosage"** button.
  - Adjust dosages (e.g. Metformin 500mg ➔ 1000mg, Lisinopril 10mg ➔ 20mg) and update schedules with clinical rationale.
  - Automatically logged to the `medication_titrations` audit table.
- **Expandable Titration History**:
  - View previous dosage adjustments, dates, reasons, and prescribing doctor.
- **Discontinuation with Reason**:
  - Archive medications with clinical rationale (e.g., "Discontinued due to hypokalemia; switched to Lisinopril").
- **One-Click Reactivation**:
  - Restore archived prescriptions back into active therapy with 1 click.

### 5. ⚡ Emergency Fast-Triage Banner
- High-contrast alert styling for life-threatening anaphylaxis, anticoagulation bleeding risks (Warfarin), and **DNR (Do Not Resuscitate)** directives.
- Bold blood group badge (e.g., `O- Universal Donor`, `A+`, `B+`, `AB+`).
- **One-Tap Calling** for primary emergency contacts.

### 6. 🖨️ Printable Wristbands & Wallet Medical ID Cards
- Format A: Hospital Emergency Wristband (vinyl tear-resistant layout with barcode and QR).
- Format B: Wallet Emergency Medical ID Card (standard CR80 credit-card dimensions).
- Formatted with `@media print` CSS.

---

## 👥 5 Curated Demo Patient Scenarios

| Code | Patient | Age | Blood | Key Conditions & Regimen |
| :--- | :--- | :--- | :--- | :--- |
| **`MED-EV-8091`** | **Eleanor Vance** | 68y | `A+` | Hypertensive Heart Disease, Type 2 Diabetes, Severe Penicillin Anaphylaxis. Metformin 1000mg (titrated from 500mg), Lisinopril 20mg, Atorvastatin 40mg, Aspirin 81mg. Historical: Hydrochlorothiazide, Glipizide. |
| **`MED-MC-4120`** | **Marcus Chen** | 29y | `O-` | Universal Donor. Life-Threatening Peanut/Tree Nut Anaphylaxis (Class 6 IgE), Asthma. EpiPen Auto-Injector 0.3mg, Albuterol Inhaler. Historical: Claritin. |
| **`MED-JO-9502`** | **James O'Connor** | 74y | `B+` | Permanent Atrial Fibrillation, CKD Stage 3b. **Full DNR on File**. Bleeding Alert: Warfarin 5mg (Target INR 2.0-3.0), Metoprolol 50mg, Lasix 20mg. |
| **`MED-SM-7334`** | **Sophia Martinez** | 42y | `AB+` | Relapsing-Remitting Multiple Sclerosis (RRMS), Hashimoto's Hypothyroidism. Fingolimod (Gilenya) 0.5mg, Synthroid 75mcg, Baclofen 10mg. |
| **`MED-MP-2291`** | **Maya Patel** | 11y | `O+` | Pediatric Type 1 Diabetes (CGM & Pump user), Celiac Disease, Latex Allergy. Insulin Lispro & Glargine, Baqsimi Glucagon. |

---

## 🧪 Verification & Automated Testing

Run the test suite at any time:
```bash
./bin/node scripts/test-all.js
# Result: 20 Passed, 0 Failed
```

---

## 🛠️ Technology Stack

- **Backend**: Node.js 24 (`agy-node`) with native zero-dependency HTTP REST API.
- **Database**: Relational SQLite 3 powered by native `node:sqlite` (`DatabaseSync`).
- **Frontend**: Responsive Single Page Application, Tailwind CSS, Lucide icons, Tesseract.js.
- **Clinical Intelligence**: Native JavaScript Medical NLP Entity Extractor (`public/js/clinical-parser.js`).
- **Visualizations**: Interactive SVG Clinical Trend Charts Engine (`public/js/charts.js`).

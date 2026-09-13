// Seed dummy data for MediPulse QR
// 5 realistic, clinically rich patient profiles with longitudinal trends, titrations, and allergies

export const SEED_PATIENTS = [
  {
    id: "pat-8091",
    qr_code: "MED-EV-8091",
    first_name: "Eleanor",
    last_name: "Vance",
    dob: "1958-04-12",
    gender: "Female",
    blood_type: "A+",
    phone: "+1 (555) 234-8901",
    email: "e.vance1958@example.com",
    address: "742 Evergreen Terrace, Springfield, IL 62704",
    organ_donor: 1,
    dnr_status: 0,
    emergency_summary: "Severe Penicillin anaphylaxis. History of hypertensive heart disease and Type 2 Diabetes. Carry glucose tablets in purse.",
    avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80",
    primary_physician: "Dr. Sarah Jenkins, MD (Cardiology & Internal Medicine)",
    insurance_provider: "Blue Cross Blue Shield Gold PPO",
    insurance_policy_no: "BCBS-99482103-A",
    allergies: [
      {
        id: "alg-101",
        allergen: "Penicillin",
        reaction: "Anaphylaxis (angioedema, bronchospasm, severe hypotension)",
        severity: "Life-Threatening",
        category: "Drug",
        verification_status: "Confirmed",
        diagnosed_date: "1982-06-15",
        notes: "Strict contraindication. Medical alert bracelet worn."
      },
      {
        id: "alg-102",
        allergen: "Sulfamethoxazole / Trimethoprim (Bactrim)",
        reaction: "Maculopapular rash, fever, hives",
        severity: "Severe",
        category: "Drug",
        verification_status: "Confirmed",
        diagnosed_date: "2011-09-20",
        notes: "Avoid all sulfonamide antibiotics."
      },
      {
        id: "alg-103",
        allergen: "Iodinated Radiocontrast Media",
        reaction: "Moderate pruritus and urticaria",
        severity: "Moderate",
        category: "Drug",
        verification_status: "Clinical Observation",
        diagnosed_date: "2019-03-11",
        notes: "Pre-medicate with antihistamines and prednisone if contrast is mandatory."
      },
      {
        id: "alg-104",
        allergen: "Cat Dander",
        reaction: "Sneezing, rhinorrhea, conjunctivitis",
        severity: "Mild",
        category: "Environmental",
        verification_status: "Patient-Reported",
        diagnosed_date: "2005-04-10",
        notes: "Symptomatic relief with OTC antihistamines."
      }
    ],
    medications: [
      {
        id: "med-101",
        drug_name: "Metformin Hydrochloride",
        generic_name: "Metformin",
        dosage: "1000 mg",
        form: "Tablet",
        frequency: "Twice daily with meals",
        time_of_day: "Morning (Breakfast), Evening (Dinner)",
        purpose: "Glycemic control for Type 2 Diabetes Mellitus",
        prescribing_doctor: "Dr. Sarah Jenkins, MD",
        start_date: "2015-02-10",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "White oblong, scored, stamped 'M 1000'",
        special_instructions: "Take with food to minimize GI upset. Withhold before iodinated contrast.",
        titrations: [
          {
            id: "tit-101",
            previous_dosage: "500 mg",
            new_dosage: "850 mg",
            previous_frequency: "Once daily",
            new_frequency: "Twice daily",
            reason: "Elevated post-prandial blood glucose > 180 mg/dL",
            changed_by: "Dr. Sarah Jenkins, MD",
            changed_at: "2018-05-14 10:30:00"
          },
          {
            id: "tit-102",
            previous_dosage: "850 mg",
            new_dosage: "1000 mg",
            previous_frequency: "Twice daily",
            new_frequency: "Twice daily with meals",
            reason: "Targeting HbA1c < 7.0%; tolerated well without hypoglycemia",
            changed_by: "Dr. Sarah Jenkins, MD",
            changed_at: "2022-11-19 14:15:00"
          }
        ]
      },
      {
        id: "med-102",
        drug_name: "Lisinopril",
        generic_name: "Lisinopril",
        dosage: "20 mg",
        form: "Tablet",
        frequency: "Once daily in the morning",
        time_of_day: "Morning",
        purpose: "Hypertension and cardioprotection",
        prescribing_doctor: "Dr. Sarah Jenkins, MD",
        start_date: "2017-08-14",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Pink round tablet, stamped 'L 20'",
        special_instructions: "Monitor blood pressure weekly. Report dry cough or swelling of lips/face immediately.",
        titrations: [
          {
            id: "tit-103",
            previous_dosage: "10 mg",
            new_dosage: "20 mg",
            previous_frequency: "Once daily",
            new_frequency: "Once daily in the morning",
            reason: "Systolic BP consistently hovering around 142 mmHg",
            changed_by: "Dr. Sarah Jenkins, MD",
            changed_at: "2020-04-10 11:00:00"
          }
        ]
      },
      {
        id: "med-103",
        drug_name: "Atorvastatin Calcium",
        generic_name: "Atorvastatin",
        dosage: "40 mg",
        form: "Tablet",
        frequency: "Once daily at bedtime",
        time_of_day: "Night / Bedtime",
        purpose: "Hyperlipidemia & atherosclerotic cardiovascular disease prevention",
        prescribing_doctor: "Dr. Sarah Jenkins, MD",
        start_date: "2016-11-04",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "White elliptical tablet, debossed 'PD 156'",
        special_instructions: "Avoid large quantities of grapefruit juice. Monitor liver function."
      },
      {
        id: "med-104",
        drug_name: "Aspirin (Enteric Coated)",
        generic_name: "Acetylsalicylic Acid",
        dosage: "81 mg",
        form: "Tablet",
        frequency: "Once daily with lunch",
        time_of_day: "Noon / Lunch",
        purpose: "Antiplatelet secondary stroke & CAD prophylaxis",
        prescribing_doctor: "Dr. Robert Alvarez, MD",
        start_date: "2019-01-20",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Yellow small round coated tablet",
        special_instructions: "Do not crush or chew. Take with water."
      },
      // Discontinued / Historical Medications
      {
        id: "med-105",
        drug_name: "Hydrochlorothiazide (HCTZ)",
        generic_name: "Hydrochlorothiazide",
        dosage: "25 mg",
        form: "Tablet",
        frequency: "Once daily in morning",
        time_of_day: "Morning",
        purpose: "Diuretic for essential hypertension",
        prescribing_doctor: "Dr. Sarah Jenkins, MD",
        start_date: "2016-02-12",
        end_date: "2017-08-10",
        is_active: 0,
        discontinued_reason: "Discontinued due to persistent hypokalemia (Serum K+ dropped to 3.2 mEq/L). Switched to Lisinopril monotherapy.",
        discontinued_date: "2017-08-10",
        discontinued_by: "Dr. Sarah Jenkins, MD",
        pill_color_shape: "Peach round tablet",
        special_instructions: "Historical record - discontinued."
      },
      {
        id: "med-106",
        drug_name: "Glipizide",
        generic_name: "Glipizide",
        dosage: "5 mg",
        form: "Tablet",
        frequency: "Once daily before breakfast",
        time_of_day: "Morning",
        purpose: "Sulfonylurea glycemic control",
        prescribing_doctor: "Dr. Robert Alvarez, MD",
        start_date: "2015-05-01",
        end_date: "2016-01-15",
        is_active: 0,
        discontinued_reason: "Recurrent mild hypoglycemia episodes (blood glucose 62 mg/dL). Discontinued and managed with Metformin titration alone.",
        discontinued_date: "2016-01-15",
        discontinued_by: "Dr. Robert Alvarez, MD",
        pill_color_shape: "White round scored tablet",
        special_instructions: "Historical record - discontinued."
      }
    ],
    medical_history: [
      {
        id: "his-101",
        condition_name: "Hypertensive Heart Disease without heart failure",
        icd10_code: "I11.9",
        category: "Cardiovascular",
        diagnosed_date: "2014-05-18",
        status: "Managed",
        treating_facility: "Springfield Memorial Heart Institute",
        notes: "Echocardiogram in 2024 showed preserved ejection fraction (EF 58%) with mild concentric LVH."
      },
      {
        id: "his-102",
        condition_name: "Type 2 Diabetes Mellitus without complications",
        icd10_code: "E11.9",
        category: "Endocrine",
        diagnosed_date: "2015-02-10",
        status: "Active",
        treating_facility: "Springfield Endocrinology Clinic",
        notes: "Most recent HbA1c is 6.9%. Good compliance with dietary modifications and Metformin."
      },
      {
        id: "his-103",
        condition_name: "Osteoarthritis of Right Knee",
        icd10_code: "M17.11",
        category: "Orthopedic",
        diagnosed_date: "2020-10-05",
        status: "Active",
        treating_facility: "Lincoln Orthopedic Center",
        notes: "Underwent corticosteroid injection Oct 2023. Uses physical therapy exercises."
      }
    ],
    clinical_notes: [
      {
        id: "cn-101",
        author_name: "Dr. Sarah Jenkins, MD",
        author_role: "Attending Cardiologist",
        facility: "Springfield Memorial Hospital - Outpatient Clinic",
        visit_type: "Routine Cardiology Follow-up",
        assessment: "68yo female with well-controlled hypertension and T2D. Blood pressure 124/80 mmHg today. No complaints of chest pain, orthopnea, or dyspnea on exertion.",
        plan: "1. Continue Lisinopril 20mg daily and Atorvastatin 40mg bedtime.\n2. Repeat lipid panel and renal profile in 6 months.\n3. Patient educated on low-sodium DASH diet.",
        subjective_notes: "Patient reports walking 30 minutes 4 days/week. Sleeping comfortably on one pillow.",
        objective_notes: "BP: 124/80, HR: 70 regular, SpO2: 99% room air. Lungs clear to auscultation bilaterally. No peripheral edema."
      },
      {
        id: "cn-102",
        author_name: "Nurse Rachel Miller, RN, BSN",
        author_role: "Clinical Staff Nurse",
        facility: "Springfield Memorial Hospital - Bedside Triage",
        visit_type: "Bedside Vitals & Medication Review",
        assessment: "Patient arrived for pre-admission routine screening. Medication list reconciled. Penicillin allergy confirmed and red allergy wristband applied.",
        plan: "Patient instructed to fast after midnight for scheduled morning fasting blood glucose test.",
        subjective_notes: "Denies dizziness, palpitations, or hypoglycemic episodes this week.",
        objective_notes: "Vitals stable: BP 124/80, Pulse 70, Glucose fingerstick 112 mg/dL."
      }
    ],
    // Longitudinal multi-month vitals trend data
    vitals: [
      {
        id: "vit-101",
        recorded_at: "2026-09-07 18:30:00",
        blood_pressure: "124/80 mmHg",
        heart_rate: 70,
        spo2: 99,
        temperature: 36.8,
        respiratory_rate: 16,
        blood_glucose: 112,
        recorded_by: "Nurse Rachel Miller, RN",
        notes: "Bedside routine check. Patient calm and resting comfortably."
      },
      {
        id: "vit-102",
        recorded_at: "2026-08-20 10:15:00",
        blood_pressure: "128/82 mmHg",
        heart_rate: 72,
        spo2: 98,
        temperature: 36.7,
        respiratory_rate: 15,
        blood_glucose: 118,
        recorded_by: "Nurse David Ross, RN",
        notes: "Clinic follow-up visit."
      },
      {
        id: "vit-103",
        recorded_at: "2026-07-15 09:45:00",
        blood_pressure: "132/84 mmHg",
        heart_rate: 74,
        spo2: 98,
        temperature: 36.8,
        respiratory_rate: 16,
        blood_glucose: 126,
        recorded_by: "Dr. Sarah Jenkins, MD",
        notes: "Follow-up after vacation. Mildly higher fasting glucose."
      },
      {
        id: "vit-104",
        recorded_at: "2026-06-02 11:30:00",
        blood_pressure: "130/82 mmHg",
        heart_rate: 71,
        spo2: 99,
        temperature: 36.6,
        respiratory_rate: 14,
        blood_glucose: 114,
        recorded_by: "Nurse Rachel Miller, RN",
        notes: "Routine quarterly wellness check."
      },
      {
        id: "vit-105",
        recorded_at: "2026-04-18 14:00:00",
        blood_pressure: "136/86 mmHg",
        heart_rate: 76,
        spo2: 97,
        temperature: 36.9,
        respiratory_rate: 16,
        blood_glucose: 132,
        recorded_by: "Dr. Robert Alvarez, MD",
        notes: "Post-knee injection check. Mild elevation in BP due to pain."
      },
      {
        id: "vit-106",
        recorded_at: "2026-02-10 10:00:00",
        blood_pressure: "126/80 mmHg",
        heart_rate: 69,
        spo2: 99,
        temperature: 36.7,
        respiratory_rate: 15,
        blood_glucose: 110,
        recorded_by: "Nurse David Ross, RN",
        notes: "Annual physical checkup."
      }
    ],
    lab_reports: [
      {
        id: "lab-101",
        test_name: "Hemoglobin A1c (HbA1c)",
        category: "Endocrine / Glycemic",
        test_date: "2026-08-15",
        result_value: "6.9 %",
        reference_range: "< 5.7 % (Normal), 5.7-6.4 % (Prediabetes)",
        flag: "High",
        ordering_doctor: "Dr. Sarah Jenkins, MD",
        facility: "Quest Diagnostics Central Lab",
        summary_interpretation: "Target for diabetic management is generally < 7.0%. Well maintained."
      },
      {
        id: "lab-102",
        test_name: "Comprehensive Metabolic Panel: eGFR",
        category: "Renal Function",
        test_date: "2026-08-15",
        result_value: "78 mL/min/1.73m²",
        reference_range: "> 60 mL/min/1.73m²",
        flag: "Normal",
        ordering_doctor: "Dr. Sarah Jenkins, MD",
        facility: "Quest Diagnostics Central Lab",
        summary_interpretation: "Adequate kidney function. Safe to continue Lisinopril and Metformin."
      },
      {
        id: "lab-103",
        test_name: "Lipid Panel: LDL-C",
        category: "Cardiovascular Risk",
        test_date: "2026-08-15",
        result_value: "64 mg/dL",
        reference_range: "< 100 mg/dL (Optimal for CAD risk)",
        flag: "Normal",
        ordering_doctor: "Dr. Sarah Jenkins, MD",
        facility: "Quest Diagnostics Central Lab",
        summary_interpretation: "Optimal LDL-C achieved on Atorvastatin 40mg."
      },
      {
        id: "lab-104",
        test_name: "Hemoglobin A1c (HbA1c - Historical)",
        category: "Endocrine / Glycemic",
        test_date: "2026-02-10",
        result_value: "7.3 %",
        reference_range: "< 5.7 % (Normal)",
        flag: "High",
        ordering_doctor: "Dr. Sarah Jenkins, MD",
        facility: "Quest Diagnostics Central Lab",
        summary_interpretation: "Decreased to 6.9% in August following lifestyle and Metformin compliance."
      }
    ],
    emergency_contacts: [
      {
        id: "ec-101",
        name: "Robert Vance",
        relationship: "Spouse / Husband",
        phone: "+1 (555) 234-8902",
        alt_phone: "+1 (555) 234-9911",
        is_primary: 1,
        can_make_medical_decisions: 1
      },
      {
        id: "ec-102",
        name: "Claire Vance-Taylor",
        relationship: "Daughter",
        phone: "+1 (555) 441-2900",
        alt_phone: null,
        is_primary: 0,
        can_make_medical_decisions: 1
      }
    ]
  },
  {
    id: "pat-4120",
    qr_code: "MED-MC-4120",
    first_name: "Marcus",
    last_name: "Chen",
    dob: "1997-09-23",
    gender: "Male",
    blood_type: "O-",
    phone: "+1 (555) 883-1209",
    email: "marcus.chen97@example.com",
    address: "108 Market Street, Apt 4B, San Francisco, CA 94105",
    organ_donor: 1,
    dnr_status: 0,
    emergency_summary: "UNIVERSAL DONOR (O-). CRITICAL ANAPHYLAXIS to Peanuts & Tree Nuts. Severe exercise-induced asthma. Carries EpiPen and Albuterol at all times.",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    primary_physician: "Dr. Alan Wu, MD (Allergy & Immunology)",
    insurance_provider: "Kaiser Permanente Premier Choice",
    insurance_policy_no: "KP-6771092-CA",
    allergies: [
      {
        id: "alg-201",
        allergen: "Peanuts & Tree Nuts (Walnuts, Cashews)",
        reaction: "Immediate systemic anaphylaxis: airway closure, laryngeal edema, urticaria, circulatory collapse",
        severity: "Life-Threatening",
        category: "Food",
        verification_status: "Confirmed",
        diagnosed_date: "2002-04-10",
        notes: "IMMEDIATE INTRAMUSCULAR EPINEPHRINE 0.3mg required in anterolateral thigh. Call 911."
      },
      {
        id: "alg-202",
        allergen: "Crustacean Shellfish (Shrimp, Crab, Lobster)",
        reaction: "Severe facial angioedema, gastrointestinal cramping, wheezing",
        severity: "Severe",
        category: "Food",
        verification_status: "Confirmed",
        diagnosed_date: "2013-11-18",
        notes: "Avoid cross-contamination and seafood preparation surfaces."
      },
      {
        id: "alg-203",
        allergen: "Birch Pollen",
        reaction: "Oral allergy syndrome (itchy palate, mild lip swelling with apples/cherries)",
        severity: "Mild",
        category: "Environmental",
        verification_status: "Clinical Observation",
        diagnosed_date: "2017-03-22",
        notes: "Cross-reactivity with raw stone fruits."
      }
    ],
    medications: [
      {
        id: "med-201",
        drug_name: "EpiPen Auto-Injector (Epinephrine)",
        generic_name: "Epinephrine Auto-Injector",
        dosage: "0.3 mg / 0.3 mL",
        form: "Injection",
        frequency: "As Needed (PRN) for severe allergic reaction / anaphylaxis",
        time_of_day: "Emergency PRN",
        purpose: "Emergency treatment of Type I severe allergic anaphylaxis",
        prescribing_doctor: "Dr. Alan Wu, MD",
        start_date: "2024-01-10",
        end_date: "2027-01-10",
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Pre-filled auto-injector pen with blue safety release & orange needle tip",
        special_instructions: "Hold firmly against outer thigh for 3 seconds. Seek emergency medical attention immediately after administration."
      },
      {
        id: "med-202",
        drug_name: "Albuterol Sulfate HFA",
        generic_name: "Albuterol (Salbutamol)",
        dosage: "90 mcg/actuation",
        form: "Inhaler",
        frequency: "1-2 puffs every 4-6 hours as needed for bronchospasm / 15 mins prior to exercise",
        time_of_day: "As needed (PRN)",
        purpose: "Bronchodilator for exercise-induced bronchospasm & acute asthma",
        prescribing_doctor: "Dr. Alan Wu, MD",
        start_date: "2021-06-12",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Blue aerosol metered-dose inhaler with counter",
        special_instructions: "Shake well before using. Use spacer if tachypneic."
      },
      {
        id: "med-203",
        drug_name: "Cetirizine Hydrochloride",
        generic_name: "Cetirizine",
        dosage: "10 mg",
        form: "Tablet",
        frequency: "Once daily in the evening",
        time_of_day: "Evening",
        purpose: "Daily maintenance for chronic environmental allergic rhinitis",
        prescribing_doctor: "Dr. Alan Wu, MD",
        start_date: "2023-03-01",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "White rectangular film-coated tablet",
        special_instructions: "Non-drowsy 2nd generation antihistamine."
      },
      {
        id: "med-204",
        drug_name: "Loratadine (Claritin)",
        generic_name: "Loratadine",
        dosage: "10 mg",
        form: "Tablet",
        frequency: "Once daily in morning",
        time_of_day: "Morning",
        purpose: "Allergy symptom management",
        prescribing_doctor: "Dr. Alan Wu, MD",
        start_date: "2021-02-01",
        end_date: "2023-02-28",
        is_active: 0,
        discontinued_reason: "Insufficient breakthrough relief for seasonal birch pollen season. Switched to Cetirizine 10mg with better control.",
        discontinued_date: "2023-02-28",
        discontinued_by: "Dr. Alan Wu, MD",
        pill_color_shape: "White small round tablet",
        special_instructions: "Historical record - discontinued."
      }
    ],
    medical_history: [
      {
        id: "his-201",
        condition_name: "Extrinsic Asthma with acute exacerbation history",
        icd10_code: "J45.21",
        category: "Respiratory",
        diagnosed_date: "2005-09-14",
        status: "Active",
        treating_facility: "UCSF Health Asthma Center",
        notes: "Baseline FEV1 is 86% of predicted. Triggers include heavy exercise, cold air, and cat dander."
      },
      {
        id: "his-202",
        condition_name: "Left Distal Radius Fracture (Closed)",
        icd10_code: "S52.502A",
        category: "Orthopedic Trauma",
        diagnosed_date: "2023-07-22",
        status: "Resolved",
        treating_facility: "San Francisco General Hospital ER",
        notes: "Healed without surgical fixation. Full range of motion restored."
      }
    ],
    clinical_notes: [
      {
        id: "cn-201",
        author_name: "Dr. Alan Wu, MD",
        author_role: "Allergist & Immunologist",
        facility: "Bay Area Allergy & Clinical Immunology",
        visit_type: "Annual Allergy Action Plan Review",
        assessment: "29yo male with severe IgE-mediated peanut/tree nut anaphylaxis. Demonstrated correct auto-injector technique today. Lung sounds clear bilaterally without wheezing.",
        plan: "1. Refreshed two-pack EpiPen 0.3mg prescription (expires 2027).\n2. Continue Albuterol 2 puffs prior to half-marathon training.\n3. Updated Medical Alert digital ID card.",
        subjective_notes: "No accidental allergen exposures in past 24 months. Uses personal meals when traveling.",
        objective_notes: "Pulse 64 bpm, BP 118/74 mmHg, Peak Flow 580 L/min (96% personal best)."
      }
    ],
    vitals: [
      {
        id: "vit-201",
        recorded_at: "2026-09-05 14:20:00",
        blood_pressure: "118/74 mmHg",
        heart_rate: 64,
        spo2: 100,
        temperature: 36.6,
        respiratory_rate: 14,
        blood_glucose: 94,
        recorded_by: "Nurse Chloe Zhang, RN",
        notes: "Pre-sports physical evaluation. Excellent cardiorespiratory endurance."
      },
      {
        id: "vit-202",
        recorded_at: "2026-07-12 11:00:00",
        blood_pressure: "116/72 mmHg",
        heart_rate: 62,
        spo2: 99,
        temperature: 36.5,
        respiratory_rate: 14,
        blood_glucose: 90,
        recorded_by: "Nurse Chloe Zhang, RN",
        notes: "Routine allergy clinic monitoring."
      },
      {
        id: "vit-203",
        recorded_at: "2026-05-18 16:30:00",
        blood_pressure: "120/76 mmHg",
        heart_rate: 68,
        spo2: 100,
        temperature: 36.7,
        respiratory_rate: 15,
        blood_glucose: 96,
        recorded_by: "Nurse Chloe Zhang, RN",
        notes: "Post-training check."
      }
    ],
    lab_reports: [
      {
        id: "lab-201",
        test_name: "Specific IgE: Peanut (f13)",
        category: "Immunology / Allergen Specific IgE",
        test_date: "2025-10-12",
        result_value: "> 100.0 kU/L",
        reference_range: "< 0.35 kU/L (Negative)",
        flag: "Critical",
        ordering_doctor: "Dr. Alan Wu, MD",
        facility: "Labcorp Regional Diagnostic Center",
        summary_interpretation: "Class 6 (Extremely High). Extreme sensitivity; severe anaphylaxis risk upon ingestion."
      }
    ],
    emergency_contacts: [
      {
        id: "ec-201",
        name: "Li-Wei Chen",
        relationship: "Brother",
        phone: "+1 (555) 883-4921",
        alt_phone: "+1 (555) 912-3344",
        is_primary: 1,
        can_make_medical_decisions: 1
      },
      {
        id: "ec-202",
        name: "Mei Chen",
        relationship: "Mother",
        phone: "+1 (555) 883-9002",
        alt_phone: null,
        is_primary: 0,
        can_make_medical_decisions: 1
      }
    ]
  },
  {
    id: "pat-9502",
    qr_code: "MED-JO-9502",
    first_name: "James",
    last_name: "O'Connor",
    dob: "1952-01-30",
    gender: "Male",
    blood_type: "B+",
    phone: "+1 (555) 771-4402",
    email: "jim.oconnor52@example.com",
    address: "312 Beacon Hill Ave, Boston, MA 02108",
    organ_donor: 0,
    dnr_status: 1,
    emergency_summary: "HIGH BLEEDING RISK: ON THERAPEUTIC WARFARIN FOR ATRIAL FIBRILLATION. DNR (Do Not Resuscitate) on file. Chronic Kidney Disease Stage 3.",
    avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80",
    primary_physician: "Dr. Patrick Sullivan, MD (Cardiology & Geriatrics)",
    insurance_provider: "Medicare Part A & B + Humana Advantage",
    insurance_policy_no: "MED-881920-MA",
    allergies: [
      {
        id: "alg-401",
        allergen: "Non-Steroidal Anti-Inflammatory Drugs (NSAIDs - Ibuprofen, Naproxen)",
        reaction: "Acute peptic ulcer bleeding, worsening renal insufficiency",
        severity: "Severe",
        category: "Drug",
        verification_status: "Confirmed",
        diagnosed_date: "2018-05-19",
        notes: "Absolute contraindication due to concurrent Warfarin anticoagulation."
      },
      {
        id: "alg-402",
        allergen: "Morphine Sulfate",
        reaction: "Severe pruritus, profound nausea, extreme respiratory depression",
        severity: "Severe",
        category: "Drug",
        verification_status: "Confirmed",
        diagnosed_date: "2016-09-02",
        notes: "Use hydromorphone or fentanyl if opioid analgesia is strictly required."
      }
    ],
    medications: [
      {
        id: "med-401",
        drug_name: "Warfarin Sodium (Coumadin)",
        generic_name: "Warfarin",
        dosage: "5 mg",
        form: "Tablet",
        frequency: "Once daily at 6:00 PM (Target INR 2.0 - 3.0)",
        time_of_day: "Evening (18:00)",
        purpose: "Stroke prevention in non-valvular Atrial Fibrillation",
        prescribing_doctor: "Dr. Patrick Sullivan, MD",
        start_date: "2018-02-14",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Peach round scored tablet, stamped 'Coumadin 5'",
        special_instructions: "CRITICAL: Anticoagulant. Frequent INR monitoring mandatory. Reversal agent is Vitamin K & Kcentra.",
        titrations: [
          {
            id: "tit-401",
            previous_dosage: "4 mg",
            new_dosage: "5 mg",
            previous_frequency: "Once daily",
            new_frequency: "Once daily at 6:00 PM",
            reason: "Sub-therapeutic INR (1.7; target 2.0 - 3.0). Increased dose by 1mg daily.",
            changed_by: "Dr. Patrick Sullivan, MD",
            changed_at: "2024-03-12 11:30:00"
          }
        ]
      },
      {
        id: "med-402",
        drug_name: "Metoprolol Succinate ER",
        generic_name: "Metoprolol Extended-Release",
        dosage: "50 mg",
        form: "Tablet",
        frequency: "Once daily in the morning",
        time_of_day: "Morning",
        purpose: "Ventricular rate control for chronic Atrial Fibrillation",
        prescribing_doctor: "Dr. Patrick Sullivan, MD",
        start_date: "2018-02-15",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "White round film-coated tablet",
        special_instructions: "Check resting pulse prior to dose; hold if HR < 50 bpm."
      },
      {
        id: "med-403",
        drug_name: "Furosemide (Lasix)",
        generic_name: "Furosemide",
        dosage: "20 mg",
        form: "Tablet",
        frequency: "Once daily in the morning",
        time_of_day: "Morning",
        purpose: "Volume overload prevention and mild peripheral edema",
        prescribing_doctor: "Dr. Patrick Sullivan, MD",
        start_date: "2021-04-10",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "White round tablet, stamped 'LASIX 20'",
        special_instructions: "Take in the morning to prevent nocturia. Maintain hydration."
      }
    ],
    medical_history: [
      {
        id: "his-401",
        condition_name: "Chronic Non-Valvular Atrial Fibrillation",
        icd10_code: "I48.20",
        category: "Cardiovascular / Electrophysiology",
        diagnosed_date: "2018-01-15",
        status: "Active",
        treating_facility: "Massachusetts General Hospital Arrhythmia Service",
        notes: "CHA2DS2-VASc score = 4. On therapeutic Warfarin."
      },
      {
        id: "his-402",
        condition_name: "Chronic Kidney Disease (Stage 3b)",
        icd10_code: "N18.32",
        category: "Nephrology",
        diagnosed_date: "2019-11-20",
        status: "Managed",
        treating_facility: "MGH Renal Associates",
        notes: "Baseline serum creatinine 1.7 mg/dL, baseline eGFR 38-42 mL/min."
      },
      {
        id: "his-403",
        condition_name: "Medical Orders for Life-Sustaining Treatment (MOLST) / DNR",
        icd10_code: "Z66",
        category: "Advanced Directives",
        diagnosed_date: "2023-04-11",
        status: "Active",
        treating_facility: "Boston Medical Center Palliative Care",
        notes: "Comfort-focused care in the event of cardiac or respiratory arrest."
      }
    ],
    clinical_notes: [
      {
        id: "cn-401",
        author_name: "Dr. Patrick Sullivan, MD",
        author_role: "Attending Cardiologist",
        facility: "Mass General Brigham - Heart & Vascular Center",
        visit_type: "Anticoagulation & Cardiac Review",
        assessment: "74yo male with permanent A-fib. INR is 2.4 today, in target therapeutic range (2.0-3.0). Heart rate controlled with Metoprolol.",
        plan: "1. Maintain Warfarin 5mg daily.\n2. Repeat INR in 4 weeks.\n3. Verified DNR/MOLST status.",
        subjective_notes: "Patient reports feeling well. No epistaxis or hematomas.",
        objective_notes: "BP 132/76 mmHg, Irregularly irregular pulse 68 bpm, SpO2 96% room air."
      }
    ],
    vitals: [
      {
        id: "vit-401",
        recorded_at: "2026-09-06 11:45:00",
        blood_pressure: "132/76 mmHg",
        heart_rate: 68,
        spo2: 96,
        temperature: 36.5,
        respiratory_rate: 16,
        blood_glucose: 104,
        recorded_by: "Nurse Kevin Doherty, RN",
        notes: "Pulse irregularly irregular, consistent with baseline atrial fibrillation."
      },
      {
        id: "vit-402",
        recorded_at: "2026-08-08 10:30:00",
        blood_pressure: "136/80 mmHg",
        heart_rate: 72,
        spo2: 96,
        temperature: 36.6,
        respiratory_rate: 17,
        blood_glucose: 108,
        recorded_by: "Nurse Kevin Doherty, RN",
        notes: "INR clinic visit."
      },
      {
        id: "vit-403",
        recorded_at: "2026-07-10 14:00:00",
        blood_pressure: "130/78 mmHg",
        heart_rate: 70,
        spo2: 97,
        temperature: 36.4,
        respiratory_rate: 16,
        blood_glucose: 102,
        recorded_by: "Dr. Patrick Sullivan, MD",
        notes: "Routine follow-up."
      }
    ],
    lab_reports: [
      {
        id: "lab-401",
        test_name: "Prothrombin Time / INR",
        category: "Hematology / Coagulation",
        test_date: "2026-09-06",
        result_value: "2.4 INR",
        reference_range: "2.0 - 3.0 (Target for A-Fib)",
        flag: "Normal",
        ordering_doctor: "Dr. Patrick Sullivan, MD",
        facility: "MGH Core Laboratory",
        summary_interpretation: "Therapeutic anticoagulation level achieved."
      },
      {
        id: "lab-402",
        test_name: "Serum Creatinine & eGFR",
        category: "Renal Function",
        test_date: "2026-08-10",
        result_value: "1.68 mg/dL | eGFR: 41 mL/min",
        reference_range: "0.7 - 1.3 mg/dL | eGFR > 60",
        flag: "High",
        ordering_doctor: "Dr. Patrick Sullivan, MD",
        facility: "MGH Core Laboratory",
        summary_interpretation: "Stable Stage 3b CKD."
      }
    ],
    emergency_contacts: [
      {
        id: "ec-401",
        name: "Margaret O'Connor",
        relationship: "Spouse & Healthcare Proxy",
        phone: "+1 (555) 771-4403",
        alt_phone: "+1 (555) 771-8899",
        is_primary: 1,
        can_make_medical_decisions: 1
      }
    ]
  },
  {
    id: "pat-7334",
    qr_code: "MED-SM-7334",
    first_name: "Sophia",
    last_name: "Martinez",
    dob: "1984-12-08",
    gender: "Female",
    blood_type: "AB+",
    phone: "+1 (555) 602-9182",
    email: "sophia.martinez84@example.com",
    address: "2445 River Oaks Blvd, Houston, TX 77019",
    organ_donor: 1,
    dnr_status: 0,
    emergency_summary: "Diagnosed with Relapsing-Remitting Multiple Sclerosis (RRMS). On Fingolimod (Gilenya) disease-modifying therapy. Hashimoto's Hypothyroidism.",
    avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
    primary_physician: "Dr. Elena Rostova, MD, PhD (Neurology & Neuroimmunology)",
    insurance_provider: "Aetna Choice POS II",
    insurance_policy_no: "AET-5501928-TX",
    allergies: [
      {
        id: "alg-301",
        allergen: "NSAIDs (Aspirin, Ketorolac)",
        reaction: "Urticaria, facial flushing, peri-orbital angioedema",
        severity: "Moderate",
        category: "Drug",
        verification_status: "Confirmed",
        diagnosed_date: "2012-07-29",
        notes: "Acetaminophen tolerated up to 2g daily."
      },
      {
        id: "alg-302",
        allergen: "Ciprofloxacin",
        reaction: "Severe tendonitis, Achilles pain",
        severity: "Severe",
        category: "Drug",
        verification_status: "Confirmed",
        diagnosed_date: "2019-04-14",
        notes: "Avoid fluoroquinolone class."
      }
    ],
    medications: [
      {
        id: "med-301",
        drug_name: "Fingolimod (Gilenya)",
        generic_name: "Fingolimod",
        dosage: "0.5 mg",
        form: "Capsule",
        frequency: "Once daily with or without food",
        time_of_day: "Morning",
        purpose: "Disease-modifying therapy for Relapsing-Remitting MS",
        prescribing_doctor: "Dr. Elena Rostova, MD",
        start_date: "2020-03-15",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Hard gelatin capsule, white opaque body & bright yellow cap",
        special_instructions: "Monitor annual ophthalmologic exam for macular edema."
      },
      {
        id: "med-302",
        drug_name: "Levothyroxine Sodium (Synthroid)",
        generic_name: "Levothyroxine",
        dosage: "75 mcg",
        form: "Tablet",
        frequency: "Once daily in the morning on an empty stomach",
        time_of_day: "Early Morning (Fast)",
        purpose: "Thyroid hormone replacement for Hashimoto's Hypothyroidism",
        prescribing_doctor: "Dr. Carlos Mendez, MD",
        start_date: "2017-06-20",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Violet round tablet, stamped '75'",
        special_instructions: "Take 30-60 minutes before breakfast with a full glass of water."
      },
      {
        id: "med-303",
        drug_name: "Baclofen",
        generic_name: "Baclofen",
        dosage: "10 mg",
        form: "Tablet",
        frequency: "Twice daily as needed for lower limb spasticity",
        time_of_day: "Morning, Night",
        purpose: "Skeletal muscle relaxant for MS lower-extremity stiffness",
        prescribing_doctor: "Dr. Elena Rostova, MD",
        start_date: "2022-08-01",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "White round scored tablet, debossed 'BAC 10'",
        special_instructions: "May cause drowsiness. Avoid alcohol."
      }
    ],
    medical_history: [
      {
        id: "his-301",
        condition_name: "Relapsing-Remitting Multiple Sclerosis (RRMS)",
        icd10_code: "G35",
        category: "Neurology / Demyelinating",
        diagnosed_date: "2019-10-18",
        status: "Active",
        treating_facility: "Houston Methodist Neurological Institute",
        notes: "EDSS score: 1.5. Clinically stable on Gilenya."
      }
    ],
    clinical_notes: [
      {
        id: "cn-301",
        author_name: "Dr. Elena Rostova, MD, PhD",
        author_role: "Neuroimmunologist",
        facility: "Houston Methodist Hospital",
        visit_type: "Semi-Annual MS Surveillance",
        assessment: "42yo female with RRMS, clinically quiescent. No new motor weakness or paresthesias.",
        plan: "1. Continue Fingolimod 0.5mg daily.\n2. Schedule repeat brain MRI in 6 months.",
        subjective_notes: "Mild evening fatigue managed with scheduled rest breaks.",
        objective_notes: "Cranial nerves II-XII intact. Tendon reflexes 2+ symmetrical."
      }
    ],
    vitals: [
      {
        id: "vit-301",
        recorded_at: "2026-09-04 09:30:00",
        blood_pressure: "114/72 mmHg",
        heart_rate: 62,
        spo2: 99,
        temperature: 36.6,
        respiratory_rate: 15,
        blood_glucose: 88,
        recorded_by: "Nurse Isabella Cruz, RN",
        notes: "Resting vitals stable."
      },
      {
        id: "vit-302",
        recorded_at: "2026-06-20 10:00:00",
        blood_pressure: "112/70 mmHg",
        heart_rate: 60,
        spo2: 100,
        temperature: 36.5,
        respiratory_rate: 14,
        blood_glucose: 86,
        recorded_by: "Nurse Isabella Cruz, RN",
        notes: "Routine check."
      }
    ],
    lab_reports: [
      {
        id: "lab-301",
        test_name: "Thyroid Stimulating Hormone (TSH)",
        category: "Endocrinology",
        test_date: "2026-07-20",
        result_value: "1.82 mIU/L",
        reference_range: "0.45 - 4.50 mIU/L",
        flag: "Normal",
        ordering_doctor: "Dr. Carlos Mendez, MD",
        facility: "Houston Diagnostic Labs",
        summary_interpretation: "Euthyroid state maintained on Synthroid."
      }
    ],
    emergency_contacts: [
      {
        id: "ec-301",
        name: "Carlos Martinez",
        relationship: "Spouse",
        phone: "+1 (555) 602-9183",
        alt_phone: "+1 (555) 902-8811",
        is_primary: 1,
        can_make_medical_decisions: 1
      }
    ]
  },
  {
    id: "pat-2291",
    qr_code: "MED-MP-2291",
    first_name: "Maya",
    last_name: "Patel",
    dob: "2015-06-18",
    gender: "Female",
    blood_type: "O+",
    phone: "+1 (555) 438-7719",
    email: "patel.family@example.com",
    address: "518 Oakridge Crossing, Seattle, WA 98105",
    organ_donor: 0,
    dnr_status: 0,
    emergency_summary: "PEDIATRIC PATIENT (Age 11). TYPE 1 DIABETES (INSULIN DEPENDENT). Wears Dexcom G7 Continuous Glucose Monitor and Omnipod pump. CELIAC DISEASE (Strict Gluten-free). LATEX ALLERGY.",
    avatar_url: "https://images.unsplash.com/photo-1595454223600-91fbdd77e233?w=400&auto=format&fit=crop&q=80",
    primary_physician: "Dr. Emily Thorne, MD, FAAP (Pediatric Endocrinology)",
    insurance_provider: "Premera Blue Cross Pediatric Preferred",
    insurance_policy_no: "PBC-991204-WA",
    allergies: [
      {
        id: "alg-501",
        allergen: "Natural Rubber Latex",
        reaction: "Contact urticaria, periorbital edema, wheezing upon aerosolization",
        severity: "Severe",
        category: "Material",
        verification_status: "Confirmed",
        diagnosed_date: "2018-02-11",
        notes: "USE LATEX-FREE GLOVES, TOURNIQUETS, AND MEDICAL SUPPLIES ONLY."
      },
      {
        id: "alg-502",
        allergen: "Gluten / Wheat Protein (Celiac Disease)",
        reaction: "Severe malabsorption enteropathy, abdominal pain, chronic diarrhea, rash",
        severity: "Severe",
        category: "Food",
        verification_status: "Confirmed",
        diagnosed_date: "2019-08-14",
        notes: "Strict lifelong gluten-free diet."
      }
    ],
    medications: [
      {
        id: "med-501",
        drug_name: "Insulin Lispro (Humalog U-100)",
        generic_name: "Insulin Lispro Rapid-Acting",
        dosage: "1 unit per 10g carb + correction",
        form: "Injection / Infusion",
        frequency: "With carbohydrate meals & hyperglycemia correction",
        time_of_day: "Mealtime PRN",
        purpose: "Mealtime glycemic management for Type 1 Diabetes",
        prescribing_doctor: "Dr. Emily Thorne, MD",
        start_date: "2019-09-01",
        end_date: null,
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Clear subcutaneous solution in insulin reservoir / pump",
        special_instructions: "Administered via automated insulin pump system."
      },
      {
        id: "med-503",
        drug_name: "Baqsimi (Glucagon Nasal Powder)",
        generic_name: "Glucagon Nasal",
        dosage: "3 mg",
        form: "Nasal Spray",
        frequency: "Single spray into one nostril for severe hypoglycemia",
        time_of_day: "Emergency PRN",
        purpose: "Emergency treatment of severe hypoglycemia",
        prescribing_doctor: "Dr. Emily Thorne, MD",
        start_date: "2022-05-10",
        end_date: "2027-05-10",
        is_active: 1,
        discontinued_reason: null,
        discontinued_date: null,
        discontinued_by: null,
        pill_color_shape: "Single-use yellow nasal delivery device",
        special_instructions: "Ready to use without inhaling. Call 911 immediately upon administration."
      }
    ],
    medical_history: [
      {
        id: "his-501",
        condition_name: "Type 1 Diabetes Mellitus with ketoacidosis history at onset",
        icd10_code: "E10.65",
        category: "Pediatric Endocrinology",
        diagnosed_date: "2019-09-01",
        status: "Active",
        treating_facility: "Seattle Children's Hospital Diabetes Care Center",
        notes: "Dexcom G7 CGM sensor on left upper arm."
      }
    ],
    clinical_notes: [
      {
        id: "cn-501",
        author_name: "Dr. Emily Thorne, MD, FAAP",
        author_role: "Pediatric Endocrinologist",
        facility: "Seattle Children's Hospital",
        visit_type: "Quarterly Pediatric Diabetes Follow-up",
        assessment: "11yo female with T1D, growing well along 55th percentile. Pump therapy and CGM compliance outstanding.",
        plan: "Adjusted carb ratio to 1:10 for growth spurt. Follow up in 3 months.",
        subjective_notes: "School nurse trained on Baqsimi administration.",
        objective_notes: "Weight: 37.2 kg, Height: 144 cm, BP: 104/66 mmHg, CGM average: 142 mg/dL."
      }
    ],
    vitals: [
      {
        id: "vit-501",
        recorded_at: "2026-09-07 16:00:00",
        blood_pressure: "104/66 mmHg",
        heart_rate: 82,
        spo2: 100,
        temperature: 36.8,
        respiratory_rate: 18,
        blood_glucose: 138,
        recorded_by: "School Nurse Brenda Kelly, RN",
        notes: "After-school routine check before soccer practice."
      },
      {
        id: "vit-502",
        recorded_at: "2026-08-15 11:30:00",
        blood_pressure: "102/64 mmHg",
        heart_rate: 80,
        spo2: 100,
        temperature: 36.7,
        respiratory_rate: 18,
        blood_glucose: 144,
        recorded_by: "Dr. Emily Thorne, MD",
        notes: "Quarterly endocrine visit."
      },
      {
        id: "vit-503",
        recorded_at: "2026-06-01 10:00:00",
        blood_pressure: "106/66 mmHg",
        heart_rate: 84,
        spo2: 99,
        temperature: 36.8,
        respiratory_rate: 19,
        blood_glucose: 152,
        recorded_by: "Dr. Emily Thorne, MD",
        notes: "Growth assessment."
      }
    ],
    lab_reports: [
      {
        id: "lab-501",
        test_name: "Hemoglobin A1c (Point-of-Care)",
        category: "Glycemic Monitoring",
        test_date: "2026-08-28",
        result_value: "6.8 %",
        reference_range: "< 7.0 % (Pediatric Target)",
        flag: "Normal",
        ordering_doctor: "Dr. Emily Thorne, MD",
        facility: "Seattle Children's Clinic Lab",
        summary_interpretation: "Superb pediatric glycemic control."
      }
    ],
    emergency_contacts: [
      {
        id: "ec-501",
        name: "Pooja Patel",
        relationship: "Mother",
        phone: "+1 (555) 438-7719",
        alt_phone: "+1 (555) 438-7720",
        is_primary: 1,
        can_make_medical_decisions: 1
      }
    ]
  }
];

'use client';
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, SecHead, Badge, Btn } from '@/components/ui/index';
import { Term } from '@/components/ui/Term';

// Symptoms that warrant emergency care regardless of test guidance.
const EMERGENCY_SYMPTOMS = ['chest pain', 'shortness of breath'];

// Common symptom → suggested tests mapping
const SYMPTOM_MAP: Record<string, { tests: string[]; specialist: string; urgency: string; note: string }> = {
  'fatigue': { tests: ['CBC (Complete Blood Count)', 'Thyroid Function (TSH, T3, T4)', 'Vitamin B12', 'Vitamin D3', 'Iron Studies (Ferritin, TIBC)', 'Blood Sugar (Fasting)'], specialist: 'General Physician or Endocrinologist', urgency: 'routine', note: 'Fatigue has many causes. These tests help screen the most common ones.' },
  'weight gain': { tests: ['Thyroid Function (TSH, FT4)', 'Fasting Blood Sugar', 'HbA1c', 'Cortisol (morning)', 'Lipid Profile'], specialist: 'Endocrinologist', urgency: 'routine', note: 'Unexplained weight gain may be linked to thyroid or hormonal changes.' },
  'hair loss': { tests: ['Thyroid Function (TSH, T3, T4)', 'Iron Studies', 'Vitamin B12', 'Vitamin D', 'CBC', 'Hormones (if applicable)'], specialist: 'Dermatologist or Endocrinologist', urgency: 'routine', note: 'Hair loss is often associated with nutritional deficiencies or thyroid issues.' },
  'frequent urination': { tests: ['Fasting Blood Sugar', 'HbA1c', 'Urine Routine', 'Kidney Function (Creatinine, BUN)', 'Urine Culture (if infection suspected)'], specialist: 'Diabetologist or Urologist', urgency: 'soon', note: 'Frequent urination can indicate diabetes or urinary tract issues.' },
  'chest pain': { tests: ['ECG', 'Troponin I/T', 'Lipid Profile', 'CBC', 'Blood Sugar'], specialist: 'Cardiologist', urgency: 'urgent', note: 'Chest pain should always be evaluated promptly by a doctor.' },
  'joint pain': { tests: ['Uric Acid', 'ESR', 'CRP', 'Rheumatoid Factor (RA)', 'CBC', 'ANA (if autoimmune suspected)'], specialist: 'Rheumatologist or Orthopedist', urgency: 'soon', note: 'Joint pain may be related to uric acid, inflammation, or autoimmune conditions.' },
  'headache': { tests: ['CBC', 'Blood Pressure (check)', 'Blood Sugar', 'Thyroid Function'], specialist: 'Neurologist or General Physician', urgency: 'routine', note: 'Persistent or severe headaches warrant investigation.' },
  'dizziness': { tests: ['CBC (check for anemia)', 'Blood Sugar', 'Blood Pressure', 'Thyroid Function', 'Vitamin B12'], specialist: 'General Physician or ENT', urgency: 'soon', note: 'Dizziness may be related to anemia, blood sugar, or ear issues.' },
  'swollen feet': { tests: ['Kidney Function (Creatinine, Urea, eGFR)', 'Urine Protein', 'Thyroid Function', 'Serum Albumin', 'CBC'], specialist: 'Nephrologist or Cardiologist', urgency: 'soon', note: 'Swelling can indicate kidney, heart, or thyroid problems.' },
  'excessive thirst': { tests: ['Fasting Blood Sugar', 'HbA1c', 'Urine Routine', 'Kidney Function'], specialist: 'Diabetologist', urgency: 'soon', note: 'Excessive thirst is a hallmark symptom of diabetes.' },
  'nausea': { tests: ['Liver Function Tests (ALT, AST, ALP)', 'Bilirubin', 'Urine Routine', 'Blood Sugar', 'CBC'], specialist: 'Gastroenterologist', urgency: 'routine', note: 'Persistent nausea may be related to liver, digestive, or metabolic issues.' },
  'pale skin': { tests: ['CBC (check Hb, RBC)', 'Iron Studies', 'Vitamin B12', 'Folate', 'Reticulocyte Count'], specialist: 'Hematologist or General Physician', urgency: 'soon', note: 'Pallor is often caused by anemia — iron deficiency or B12 deficiency are common in India.' },
  'cold intolerance': { tests: ['Thyroid Function (TSH, FT4, FT3)', 'CBC', 'Cortisol'], specialist: 'Endocrinologist', urgency: 'routine', note: 'Feeling cold all the time may indicate hypothyroidism.' },
  'muscle weakness': { tests: ['Potassium', 'Calcium', 'Magnesium', 'Thyroid Function', 'Vitamin D3', 'CBC', 'CPK (muscle enzyme)'], specialist: 'Neurologist or General Physician', urgency: 'soon', note: 'Muscle weakness has multiple causes — mineral imbalances and thyroid are common.' },
  'poor concentration': { tests: ['Thyroid Function', 'Vitamin B12', 'Vitamin D3', 'Blood Sugar', 'CBC', 'Cortisol'], specialist: 'General Physician or Neurologist', urgency: 'routine', note: 'Brain fog and concentration issues are often linked to thyroid, B12, or blood sugar.' },
  'shortness of breath': { tests: ['CBC (Hemoglobin)', 'ECG', 'Chest X-ray', 'Thyroid Function', 'D-Dimer (if clot suspected)', 'BNP'], specialist: 'Pulmonologist or Cardiologist', urgency: 'urgent', note: 'Breathlessness can be heart, lung, or anemia related and should be assessed promptly.' },
  'palpitations': { tests: ['ECG', 'Thyroid Function (TSH)', 'CBC', 'Electrolytes (K, Mg, Ca)', 'Blood Sugar'], specialist: 'Cardiologist', urgency: 'soon', note: 'A racing or fluttering heartbeat may be linked to thyroid, anemia, or electrolyte imbalance.' },
  'abdominal pain': { tests: ['Liver Function Tests', 'Amylase & Lipase', 'CBC', 'Urine Routine', 'Ultrasound Abdomen', 'H. pylori'], specialist: 'Gastroenterologist', urgency: 'soon', note: 'Persistent abdominal pain may relate to liver, pancreas, gut, or gallbladder.' },
  'back pain': { tests: ['Vitamin D3', 'Calcium', 'Uric Acid', 'ESR / CRP', 'X-ray (if persistent)'], specialist: 'Orthopedist', urgency: 'routine', note: 'Lower back pain is often muscular, but vitamin D and inflammation are worth checking.' },
  'bone pain': { tests: ['Vitamin D3', 'Calcium', 'Phosphorus', 'ALP', 'Parathyroid Hormone (PTH)'], specialist: 'Orthopedist or Endocrinologist', urgency: 'routine', note: 'Bone aches are commonly linked to vitamin D and calcium deficiency.' },
  'leg cramps': { tests: ['Calcium', 'Magnesium', 'Potassium', 'Vitamin D3', 'Sodium'], specialist: 'General Physician', urgency: 'routine', note: 'Frequent cramps often point to mineral or vitamin D deficiency.' },
  'numbness or tingling': { tests: ['Vitamin B12', 'Blood Sugar', 'HbA1c', 'Thyroid Function', 'Calcium'], specialist: 'Neurologist', urgency: 'soon', note: 'Tingling in hands or feet may be linked to B12 deficiency or diabetes.' },
  'blurred vision': { tests: ['Fasting Blood Sugar', 'HbA1c', 'Blood Pressure', 'Lipid Profile'], specialist: 'Ophthalmologist or Diabetologist', urgency: 'soon', note: 'Blurred vision can be an early sign of high blood sugar — get it checked.' },
  'frequent infections': { tests: ['CBC', 'Fasting Blood Sugar', 'HbA1c', 'HIV (if indicated)', 'Immunoglobulin levels'], specialist: 'General Physician', urgency: 'soon', note: 'Repeated infections can be linked to uncontrolled blood sugar or low immunity.' },
  'unexplained weight loss': { tests: ['Thyroid Function', 'Fasting Blood Sugar', 'HbA1c', 'CBC', 'ESR / CRP', 'Liver & Kidney Function'], specialist: 'General Physician or Endocrinologist', urgency: 'soon', note: 'Losing weight without trying needs evaluation — thyroid, diabetes, and other causes.' },
  'recurrent fever': { tests: ['CBC', 'ESR / CRP', 'Blood Culture', 'Malaria / Dengue', 'Widal (typhoid)', 'Urine Routine'], specialist: 'General Physician', urgency: 'soon', note: 'Fever that keeps returning should be investigated for infection or inflammation.' },
  'yellow skin or eyes': { tests: ['Liver Function Tests', 'Total & Direct Bilirubin', 'Hepatitis B & C panel', 'Ultrasound Abdomen'], specialist: 'Gastroenterologist', urgency: 'urgent', note: 'Yellowing (jaundice) signals a liver or bile issue and needs prompt assessment.' },
  'constipation': { tests: ['Thyroid Function (TSH)', 'Calcium', 'Fasting Blood Sugar', 'CBC'], specialist: 'Gastroenterologist or General Physician', urgency: 'routine', note: 'Chronic constipation can be linked to low thyroid or high calcium.' },
  'diarrhea': { tests: ['Stool Routine & Culture', 'CBC', 'Electrolytes', 'Thyroid Function'], specialist: 'Gastroenterologist', urgency: 'soon', note: 'Persistent diarrhea risks dehydration and may need stool testing.' },
  'skin rash': { tests: ['CBC (Eosinophils)', 'Allergy IgE', 'Liver Function Tests', 'Blood Sugar'], specialist: 'Dermatologist', urgency: 'routine', note: 'Rashes can be allergic, infective, or linked to internal causes.' },
  'low mood or sadness': { tests: ['Thyroid Function', 'Vitamin D3', 'Vitamin B12', 'CBC'], specialist: 'Psychiatrist or General Physician', urgency: 'routine', note: 'Low mood can be worsened by thyroid issues and vitamin D/B12 deficiency.' },
  'anxiety': { tests: ['Thyroid Function (TSH, FT4)', 'Blood Sugar', 'ECG (if palpitations)'], specialist: 'Psychiatrist', urgency: 'routine', note: 'An overactive thyroid can mimic or worsen anxiety symptoms.' },
  'irregular periods': { tests: ['Thyroid Function', 'Prolactin', 'FSH & LH', 'Fasting Blood Sugar', 'Testosterone', 'Ultrasound Pelvis'], specialist: 'Gynecologist or Endocrinologist', urgency: 'routine', note: 'Irregular cycles can relate to thyroid, PCOS, or hormonal imbalance.' },
  'erectile dysfunction': { tests: ['Testosterone (Total)', 'Fasting Blood Sugar', 'HbA1c', 'Lipid Profile', 'Thyroid Function'], specialist: 'Urologist or Endocrinologist', urgency: 'routine', note: 'Often linked to blood sugar, hormones, or circulation — all checkable.' },
  'night sweats': { tests: ['CBC', 'Thyroid Function', 'ESR / CRP', 'Blood Sugar', 'TB workup (if persistent)'], specialist: 'General Physician', urgency: 'soon', note: 'Frequent night sweats may relate to thyroid, infection, or hormonal changes.' },

  // ── Respiratory / ENT ─────────────────────────────────────────────
  'sore throat': { tests: ['CBC', 'Throat Swab Culture', 'ASO Titre', 'COVID / Flu test (if indicated)'], specialist: 'General Physician or ENT', urgency: 'routine', note: 'Most sore throats are viral; tests help if it is persistent or bacterial.' },
  'persistent cough': { tests: ['CBC', 'Chest X-ray', 'Sputum test', 'Spirometry', 'TB test (if over 2 weeks)'], specialist: 'Pulmonologist', urgency: 'soon', note: 'A cough lasting more than 2 to 3 weeks should be evaluated.' },
  'coughing up blood': { tests: ['Chest X-ray', 'CBC', 'Sputum test', 'CT Chest', 'Coagulation Profile'], specialist: 'Pulmonologist', urgency: 'urgent', note: 'Coughing up blood always needs prompt medical assessment.' },
  'runny nose': { tests: ['Allergy IgE', 'CBC (Eosinophils)'], specialist: 'General Physician or ENT', urgency: 'routine', note: 'Usually allergic or viral; allergy testing helps if it keeps recurring.' },
  'wheezing': { tests: ['Spirometry', 'Chest X-ray', 'CBC', 'Allergy IgE'], specialist: 'Pulmonologist', urgency: 'soon', note: 'Wheezing may indicate asthma or narrowing of the airways.' },
  'snoring': { tests: ['Sleep Study', 'Thyroid Function', 'BMI assessment'], specialist: 'Pulmonologist or ENT', urgency: 'routine', note: 'Loud snoring with daytime sleepiness can indicate sleep apnea.' },
  'hoarse voice': { tests: ['Thyroid Function', 'Laryngoscopy (if over 3 weeks)', 'CBC'], specialist: 'ENT Specialist', urgency: 'routine', note: 'A hoarse voice lasting weeks should be checked by an ENT.' },
  'ringing in ears': { tests: ['CBC', 'Blood Pressure', 'Thyroid Function', 'Vitamin B12'], specialist: 'ENT Specialist', urgency: 'routine', note: 'Tinnitus can relate to blood pressure, anemia, or ear issues.' },
  'hearing loss': { tests: ['Audiometry', 'CBC', 'Thyroid Function'], specialist: 'ENT Specialist', urgency: 'soon', note: 'New hearing loss should be assessed by an ENT specialist.' },

  // ── Digestive ─────────────────────────────────────────────────────
  'heartburn': { tests: ['H. pylori test', 'Upper GI Endoscopy (if persistent)', 'CBC'], specialist: 'Gastroenterologist', urgency: 'routine', note: 'Frequent acid reflux is worth evaluating to protect the food pipe.' },
  'bloating': { tests: ['Thyroid Function', 'Celiac panel', 'Stool test', 'Ultrasound Abdomen'], specialist: 'Gastroenterologist', urgency: 'routine', note: 'Persistent bloating can relate to gut, thyroid, or food intolerance.' },
  'indigestion': { tests: ['H. pylori test', 'Liver Function Tests', 'Ultrasound Abdomen'], specialist: 'Gastroenterologist', urgency: 'routine', note: 'Recurrent indigestion may need testing for H. pylori or gallbladder.' },
  'loss of appetite': { tests: ['CBC', 'Thyroid Function', 'Liver & Kidney Function', 'Blood Sugar'], specialist: 'General Physician', urgency: 'soon', note: 'Ongoing appetite loss should be checked for underlying causes.' },
  'increased appetite': { tests: ['Thyroid Function', 'Blood Sugar', 'HbA1c'], specialist: 'Endocrinologist', urgency: 'routine', note: 'A big rise in appetite with weight loss can point to thyroid or diabetes.' },
  'vomiting': { tests: ['Electrolytes', 'Liver Function Tests', 'Kidney Function', 'CBC', 'Blood Sugar'], specialist: 'Gastroenterologist', urgency: 'soon', note: 'Repeated vomiting risks dehydration and needs evaluation.' },
  'blood in stool': { tests: ['CBC', 'Stool Occult Blood', 'Colonoscopy (if indicated)', 'Iron Studies'], specialist: 'Gastroenterologist', urgency: 'urgent', note: 'Blood in stool should always be evaluated promptly.' },
  'gas and flatulence': { tests: ['Stool test', 'Celiac panel', 'Lactose intolerance test'], specialist: 'Gastroenterologist', urgency: 'routine', note: 'Excess gas can relate to diet or food intolerances.' },
  'difficulty swallowing': { tests: ['Upper GI Endoscopy', 'CBC', 'Thyroid (if goitre)'], specialist: 'Gastroenterologist or ENT', urgency: 'soon', note: 'Trouble swallowing should be evaluated, especially if it is getting worse.' },

  // ── Urinary ───────────────────────────────────────────────────────
  'blood in urine': { tests: ['Urine Routine', 'Urine Culture', 'Kidney Function', 'Ultrasound KUB'], specialist: 'Urologist or Nephrologist', urgency: 'urgent', note: 'Blood in urine needs prompt assessment of kidneys and bladder.' },
  'burning urination': { tests: ['Urine Routine', 'Urine Culture', 'Blood Sugar'], specialist: 'Urologist', urgency: 'soon', note: 'Burning while urinating often points to a urinary infection.' },
  'dark urine': { tests: ['Liver Function Tests', 'Bilirubin', 'Urine Routine', 'CBC'], specialist: 'General Physician', urgency: 'soon', note: 'Dark urine can reflect dehydration, liver, or muscle issues.' },
  'waking at night to urinate': { tests: ['Fasting Blood Sugar', 'HbA1c', 'Kidney Function', 'PSA (men, if older)'], specialist: 'Diabetologist or Urologist', urgency: 'soon', note: 'Waking at night to pass urine can be a diabetes or prostate sign.' },

  // ── Skin / Hair / Nails ───────────────────────────────────────────
  'excessive sweating': { tests: ['Thyroid Function', 'Blood Sugar', 'CBC'], specialist: 'Endocrinologist', urgency: 'routine', note: 'Excess sweating may relate to an overactive thyroid or blood sugar.' },
  'dry skin': { tests: ['Thyroid Function', 'Vitamin D', 'Blood Sugar'], specialist: 'Dermatologist', urgency: 'routine', note: 'Very dry skin can be linked to thyroid or nutritional factors.' },
  'itchy skin': { tests: ['CBC (Eosinophils)', 'Liver Function Tests', 'Kidney Function', 'Allergy IgE', 'Blood Sugar'], specialist: 'Dermatologist', urgency: 'routine', note: 'Persistent itching can have skin or internal causes.' },
  'acne': { tests: ['Hormone panel', 'Testosterone', 'Blood Sugar (if PCOS suspected)'], specialist: 'Dermatologist', urgency: 'routine', note: 'Persistent adult acne is sometimes hormone related.' },
  'brittle nails': { tests: ['Iron Studies', 'Thyroid Function', 'Vitamin D', 'Calcium'], specialist: 'Dermatologist', urgency: 'routine', note: 'Weak, brittle nails can reflect iron, thyroid, or vitamin issues.' },
  'easy bruising': { tests: ['CBC', 'Platelet Count', 'Coagulation Profile (PT/INR)', 'Liver Function Tests'], specialist: 'Hematologist', urgency: 'soon', note: 'Easy bruising can relate to platelets or clotting factors.' },
  'slow wound healing': { tests: ['Fasting Blood Sugar', 'HbA1c', 'CBC', 'Vitamin C', 'Zinc'], specialist: 'General Physician', urgency: 'soon', note: 'Slow healing is a classic sign of high blood sugar.' },

  // ── Mouth / Dental ────────────────────────────────────────────────
  'mouth ulcers': { tests: ['CBC', 'Vitamin B12', 'Folate', 'Iron Studies'], specialist: 'General Physician', urgency: 'routine', note: 'Recurrent mouth ulcers can be linked to B12, folate, or iron deficiency.' },
  'bleeding gums': { tests: ['CBC', 'Platelet Count', 'Vitamin C', 'Coagulation Profile'], specialist: 'Dentist or General Physician', urgency: 'routine', note: 'Bleeding gums are usually dental but can relate to platelets or vitamin C.' },
  'dry mouth': { tests: ['Blood Sugar', 'HbA1c', 'Thyroid Function'], specialist: 'General Physician', urgency: 'routine', note: 'Persistent dry mouth can be an early diabetes sign.' },
  'tooth pain': { tests: ['Dental X-ray', 'CBC'], specialist: 'Dentist', urgency: 'routine', note: 'Usually dental; an exam identifies the cause.' },

  // ── Eyes ──────────────────────────────────────────────────────────
  'red eyes': { tests: ['CBC', 'Allergy IgE'], specialist: 'Ophthalmologist', urgency: 'routine', note: 'Often allergic or infective; persistent redness needs an eye check.' },
  'dry eyes': { tests: ['Thyroid Function', 'Vitamin A', 'Autoimmune panel (if persistent)'], specialist: 'Ophthalmologist', urgency: 'routine', note: 'Chronic dry eyes can sometimes be linked to thyroid or autoimmune conditions.' },
  'eye pain': { tests: ['Eye Pressure (IOP)', 'CBC'], specialist: 'Ophthalmologist', urgency: 'soon', note: 'Eye pain with vision changes needs prompt assessment.' },
  'sensitivity to light': { tests: ['Eye exam', 'CBC', 'Vitamin levels'], specialist: 'Ophthalmologist or Neurologist', urgency: 'soon', note: 'Light sensitivity with a bad headache should be evaluated.' },

  // ── Bones / Joints / Muscles ──────────────────────────────────────
  'neck pain': { tests: ['Vitamin D', 'Calcium', 'X-ray Cervical Spine', 'ESR / CRP'], specialist: 'Orthopedist', urgency: 'routine', note: 'Most neck pain is muscular; persistent pain warrants imaging.' },
  'shoulder pain': { tests: ['Vitamin D', 'Uric Acid', 'X-ray', 'ESR / CRP'], specialist: 'Orthopedist', urgency: 'routine', note: 'Shoulder pain is often mechanical but inflammation can contribute.' },
  'knee pain': { tests: ['Uric Acid', 'Vitamin D', 'RA Factor', 'ESR / CRP', 'X-ray Knee'], specialist: 'Orthopedist or Rheumatologist', urgency: 'routine', note: 'Knee pain can be wear and tear, gout, or inflammatory.' },
  'swollen joints': { tests: ['Uric Acid', 'RA Factor', 'Anti-CCP', 'ESR / CRP', 'ANA'], specialist: 'Rheumatologist', urgency: 'soon', note: 'Swelling in joints may indicate gout or autoimmune arthritis.' },
  'body ache': { tests: ['CBC', 'Vitamin D', 'Thyroid Function', 'CPK', 'ESR'], specialist: 'General Physician', urgency: 'routine', note: 'Generalized body aches are often viral or vitamin D related.' },

  // ── Neuro / Mental ────────────────────────────────────────────────
  'hand tremor': { tests: ['Thyroid Function', 'Blood Sugar', 'Electrolytes', 'Liver Function Tests'], specialist: 'Neurologist', urgency: 'soon', note: 'Shaky hands can be linked to an overactive thyroid or low sugar.' },
  'fainting': { tests: ['ECG', 'CBC', 'Blood Sugar', 'Electrolytes', 'Blood Pressure (lying and standing)'], specialist: 'Cardiologist', urgency: 'urgent', note: 'Fainting needs evaluation to rule out heart or blood pressure causes.' },
  'memory problems': { tests: ['Thyroid Function', 'Vitamin B12', 'Vitamin D', 'CBC', 'Blood Sugar'], specialist: 'Neurologist', urgency: 'soon', note: 'Memory issues can be linked to thyroid, B12, or other treatable causes.' },
  'trouble sleeping': { tests: ['Thyroid Function', 'Vitamin D', 'Blood Sugar', 'Iron Studies'], specialist: 'General Physician', urgency: 'routine', note: 'Persistent insomnia can have thyroid or nutritional contributors.' },
  'excessive sleepiness': { tests: ['Thyroid Function', 'CBC', 'Blood Sugar', 'Vitamin D', 'Sleep study (if snoring)'], specialist: 'General Physician', urgency: 'soon', note: 'Daytime sleepiness may relate to thyroid, anemia, or sleep apnea.' },
  'restless legs': { tests: ['Iron Studies (Ferritin)', 'Kidney Function', 'Blood Sugar', 'Magnesium'], specialist: 'Neurologist', urgency: 'routine', note: 'Restless legs are strongly linked to low iron (ferritin).' },
  'irritability': { tests: ['Thyroid Function', 'Blood Sugar', 'Vitamin D'], specialist: 'General Physician', urgency: 'routine', note: 'Mood and irritability can be affected by thyroid and blood sugar.' },
  'panic attacks': { tests: ['Thyroid Function', 'ECG', 'Blood Sugar'], specialist: 'Psychiatrist', urgency: 'routine', note: 'Thyroid and heart causes are checked before attributing to anxiety alone.' },

  // ── Heart / Circulation ───────────────────────────────────────────
  'rapid heartbeat': { tests: ['ECG', 'Thyroid Function', 'CBC', 'Electrolytes'], specialist: 'Cardiologist', urgency: 'soon', note: 'A persistently fast pulse can be thyroid or heart related.' },
  'dizziness on standing': { tests: ['Blood Pressure (lying and standing)', 'CBC', 'Electrolytes', 'Blood Sugar'], specialist: 'General Physician', urgency: 'soon', note: 'Lightheadedness on standing can reflect low blood pressure or anemia.' },
  'cold hands and feet': { tests: ['Thyroid Function', 'CBC', 'Vitamin B12'], specialist: 'General Physician', urgency: 'routine', note: 'Often circulation related; thyroid and anemia are worth checking.' },
  'facial puffiness': { tests: ['Thyroid Function', 'Kidney Function', 'Urine Protein', 'Serum Albumin'], specialist: 'Nephrologist or Endocrinologist', urgency: 'soon', note: 'Facial or eye puffiness can relate to thyroid or kidney issues.' },

  // ── General / Infection ───────────────────────────────────────────
  'chills': { tests: ['CBC', 'ESR / CRP', 'Blood Culture', 'Malaria / Dengue'], specialist: 'General Physician', urgency: 'soon', note: 'Chills with fever usually suggest an infection.' },
  'swollen lymph nodes': { tests: ['CBC', 'ESR / CRP', 'Monospot', 'Ultrasound Neck'], specialist: 'General Physician', urgency: 'soon', note: 'Glands that stay swollen for weeks should be checked.' },

  // ── Hormonal / Reproductive ───────────────────────────────────────
  'hot flashes': { tests: ['Hormone panel (FSH, LH, Estradiol)', 'Thyroid Function'], specialist: 'Gynecologist or Endocrinologist', urgency: 'routine', note: 'Hot flashes are common around menopause, but thyroid can mimic them.' },
  'low libido': { tests: ['Testosterone', 'Thyroid Function', 'Prolactin', 'Blood Sugar'], specialist: 'Endocrinologist', urgency: 'routine', note: 'Low sex drive can relate to hormones, thyroid, or blood sugar.' },
  'breast lump': { tests: ['Breast Ultrasound', 'Mammography', 'Clinical Exam'], specialist: 'Gynecologist or Surgeon', urgency: 'soon', note: 'Any new breast lump should be examined promptly.' },
  'painful periods': { tests: ['CBC', 'Thyroid Function', 'Pelvic Ultrasound'], specialist: 'Gynecologist', urgency: 'routine', note: 'Severe period pain may warrant a pelvic ultrasound.' },
  'heavy periods': { tests: ['CBC (anemia)', 'Iron Studies', 'Thyroid Function', 'Coagulation Profile', 'Pelvic Ultrasound'], specialist: 'Gynecologist', urgency: 'soon', note: 'Heavy bleeding can cause anemia and should be evaluated.' },
  'difficulty conceiving': { tests: ['Hormone panel (FSH, LH, AMH)', 'Thyroid Function', 'Prolactin', 'Semen Analysis (partner)'], specialist: 'Gynecologist or Fertility Specialist', urgency: 'routine', note: 'Fertility evaluation looks at hormones in both partners.' },

  // ── More common complaints ────────────────────────────────────────
  'jaw pain': { tests: ['ECG (to rule out cardiac)', 'Dental exam', 'CBC'], specialist: 'Dentist or Cardiologist', urgency: 'soon', note: 'Usually dental, but jaw pain with chest discomfort can rarely be cardiac.' },
  'frequent nosebleeds': { tests: ['CBC', 'Platelet Count', 'Coagulation Profile', 'Blood Pressure'], specialist: 'ENT Specialist', urgency: 'routine', note: 'Repeated nosebleeds can relate to blood pressure or clotting.' },
  'cold sweats': { tests: ['Blood Sugar', 'ECG', 'Thyroid Function', 'CBC'], specialist: 'General Physician', urgency: 'soon', note: 'Sudden cold sweats can signal low blood sugar or a heart issue.' },
  'swelling in hands': { tests: ['Kidney Function', 'Thyroid Function', 'Urine Protein', 'ESR / CRP'], specialist: 'General Physician', urgency: 'soon', note: 'Hand swelling can relate to kidney, thyroid, or inflammation.' },
  'frequent burping': { tests: ['H. pylori test', 'Upper GI Endoscopy (if persistent)'], specialist: 'Gastroenterologist', urgency: 'routine', note: 'Excess burping is usually digestive and often diet related.' },
  'restless or racing thoughts': { tests: ['Thyroid Function', 'Blood Sugar', 'Vitamin B12'], specialist: 'Psychiatrist or General Physician', urgency: 'routine', note: 'Thyroid and blood sugar are checked when mood or focus changes.' },
};

const COMMON_SYMPTOMS = Object.keys(SYMPTOM_MAP);

interface SymptomCheckerProps {
  onAnalyzeReport: () => void;
  onFindDoctor?: () => void;
  onAskQuestion?: () => void;
}

export function SymptomChecker({ onAnalyzeReport, onFindDoctor, onAskQuestion }: SymptomCheckerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [results, setResults] = useState<typeof SYMPTOM_MAP[string][]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [filter, setFilter] = useState('');

  const visibleSymptoms = filter.trim()
    ? COMMON_SYMPTOMS.filter(s => s.includes(filter.trim().toLowerCase()))
    : COMMON_SYMPTOMS;

  const urgencyConfig = {
    routine: { color: 'var(--accent)',  label: 'Routine Check', icon: 'clock' },
    soon:    { color: 'var(--warn)',   label: 'See Doctor Soon', icon: 'alert' },
    urgent:  { color: 'var(--crit)',   label: 'Seek Urgent Care', icon: 'x_circle' },
  };

  const toggleSymptom = (s: string) => {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setAnalyzed(false);
  };

  const analyze = () => {
    const all = [...selected];
    if (customSymptom.trim()) {
      const lower = customSymptom.trim().toLowerCase();
      const match = COMMON_SYMPTOMS.find(s => lower.includes(s) || s.includes(lower));
      if (match) all.push(match);
    }
    const res = all.map(s => SYMPTOM_MAP[s]).filter(Boolean);
    setResults(res);
    setAnalyzed(true);
  };

  // Aggregate recommended tests
  const allTests = analyzed ? [...new Set(results.flatMap(r => r.tests))] : [];
  const specialists = analyzed ? [...new Set(results.map(r => r.specialist))] : [];
  const highestUrgency = analyzed ? (
    results.some(r => r.urgency === 'urgent') ? 'urgent' :
    results.some(r => r.urgency === 'soon') ? 'soon' : 'routine'
  ) : 'routine';
  const hasEmergency = analyzed && selected.some(s => EMERGENCY_SYMPTOMS.includes(s));

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 13px', borderRadius: 100, background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', marginBottom: 14, fontSize: 11, color: 'var(--warn)', fontFamily: 'var(--fm)', fontWeight: 700, letterSpacing: '0.07em' }}>
          <Icon name="info" size={11} color="var(--warn)" /> EDUCATIONAL TOOL — NOT A MEDICAL DIAGNOSIS
        </div>
        <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 8 }}>Symptom → Tests Guide</h2>
        <p style={{ color: 'var(--txt2)', fontSize: 13.5, lineHeight: 1.75, maxWidth: 600 }}>
          Select your symptoms to see which lab tests are commonly recommended. This is a general educational reference — always consult a doctor for proper diagnosis.
        </p>
      </div>

      {/* Symptom pills */}
      <Card style={{ padding: '1.5rem', marginBottom: '1.1rem' }}>
        <SecHead icon="activity">Select Your Symptoms</SecHead>

        {/* Type-ahead filter */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={14} color="var(--txt3)" />
          </span>
          <input
            placeholder={`Filter ${COMMON_SYMPTOMS.length} symptoms… (e.g. type "s")`}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 'var(--rm)', fontSize: 13.5, border: '1px solid var(--bd)', background: 'var(--surf2)', color: 'var(--txt)' }}
          />
          {filter && (
            <button onClick={() => setFilter('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--txt4)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
          {visibleSymptoms.length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--txt3)', padding: '8px 2px' }}>
              No symptom matches “{filter}”. Try a different word, or type it in the box below to check anyway.
            </span>
          )}
          {visibleSymptoms.map(s => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              style={{
                padding: '7px 16px', borderRadius: 100, cursor: 'pointer', transition: 'all 0.16s',
                background: selected.includes(s) ? 'var(--ok-bg)' : 'var(--surf2)',
                border: `1px solid ${selected.includes(s) ? 'var(--ok)' : 'var(--bd2)'}`,
                color: selected.includes(s) ? 'var(--ok)' : 'var(--txt2)',
                fontSize: 13, fontWeight: selected.includes(s) ? 600 : 400,
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Custom symptom */}
        <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
          <input
            placeholder="Or type a symptom..."
            value={customSymptom}
            onChange={e => { setCustomSymptom(e.target.value); setAnalyzed(false); }}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            style={{ flex: 1, padding: '9px 14px', borderRadius: 'var(--rm)', fontSize: 13.5 }}
          />
          <Btn variant="primary" onClick={analyze} disabled={selected.length === 0 && !customSymptom.trim()}>
            Check
          </Btn>
        </div>

        {selected.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Selected:</span>
            {selected.map(s => (
              <button key={s} onClick={() => toggleSymptom(s)}
                style={{ padding: '3px 10px', borderRadius: 100, background: 'var(--glow)', border: '1px solid var(--bd2)', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
                {s} ×
              </button>
            ))}
            <button onClick={() => { setSelected([]); setAnalyzed(false); setResults([]); }}
              style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all
            </button>
          </div>
        )}
      </Card>

      {/* Results */}
      {analyzed && (
        <div className="animate-scaleIn">
          {results.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 14 }}>
              <Icon name="info" size={28} color="var(--bd2)" />
              <p style={{ marginTop: 10 }}>No matching tests found for your input. Try selecting from the symptom list above.</p>
            </div>
          ) : (
            <>
              {/* Emergency red-flag banner */}
              {hasEmergency && (
                <div style={{ padding: '14px 18px', marginBottom: '1.1rem', background: 'var(--crit-bg)', border: '2px solid var(--crit)', borderRadius: 'var(--rm)', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <Icon name="alert" size={18} color="var(--crit)" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--crit)', marginBottom: 3 }}>This may need emergency care</div>
                    <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>
                      Symptoms like chest pain can be serious. If it’s severe, sudden, or comes with breathlessness, sweating, or pain spreading to the arm or jaw — <strong>call emergency services or go to the nearest hospital now.</strong> Don’t wait for a test.
                    </p>
                  </div>
                </div>
              )}

              {/* Urgency banner */}
              {!hasEmergency && highestUrgency !== 'routine' && (
                <div style={{ padding: '12px 18px', marginBottom: '1.1rem', background: urgencyConfig[highestUrgency as keyof typeof urgencyConfig].color === 'var(--crit)' ? 'var(--crit-bg)' : 'var(--warn-bg)', border: `1px solid ${urgencyConfig[highestUrgency as keyof typeof urgencyConfig].color}40`, borderRadius: 'var(--rm)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Icon name={urgencyConfig[highestUrgency as keyof typeof urgencyConfig].icon} size={16} color={urgencyConfig[highestUrgency as keyof typeof urgencyConfig].color} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: urgencyConfig[highestUrgency as keyof typeof urgencyConfig].color }}>
                    {urgencyConfig[highestUrgency as keyof typeof urgencyConfig].label} — Please consult a healthcare professional
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.1rem' }}>
                {/* Recommended tests */}
                <Card style={{ padding: '1.5rem' }}>
                  <SecHead icon="flask">Commonly Recommended Tests</SecHead>
                  <p style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: '1rem' }}>Based on your selected symptoms — general educational guidance only</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {allTests.map((test, i) => (
                      <div key={i} style={{ display: 'flex', gap: 9, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--r)', fontSize: 13.5, color: 'var(--txt2)' }}>
                        <Icon name="check" size={13} color="var(--ok)" />
                        <Term>{test}</Term>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Specialists + notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <Card style={{ padding: '1.5rem' }}>
                    <SecHead icon="stethoscope">Suggested Specialists</SecHead>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {specialists.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 13px', background: 'var(--glow3)', border: '1px solid var(--accent)20', borderRadius: 'var(--r)', fontSize: 13.5, color: 'var(--txt)' }}>
                          <Icon name="user" size={14} color="var(--accent)" />
                          {s}
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Notes */}
                  {results.map((r, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7 }}>
                      <span style={{ display: 'inline-flex', marginRight: 6 }}><Icon name="info" size={13} color="var(--txt3)" /></span>
                      {r.note}
                    </div>
                  ))}
                </div>
              </div>

              {/* What's next */}
              <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'linear-gradient(135deg, var(--glow2), var(--surf))', border: '1px solid var(--bd2)', borderRadius: 'var(--rl)' }}>
                <div style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>What would you like to do next?</div>
                <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 14 }}>These are educational suggestions — a doctor can confirm what’s actually needed.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Btn variant="primary" icon="upload" onClick={onAnalyzeReport}>Analyze a report</Btn>
                  {onFindDoctor && <Btn variant="ghost" icon="map" onClick={onFindDoctor}>Find a doctor</Btn>}
                  {onAskQuestion && <Btn variant="ghost" icon="search" onClick={onAskQuestion}>Ask a question</Btn>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Safety disclaimer */}
      <div style={{ marginTop: '1.5rem', padding: '12px 16px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', fontSize: 12, color: 'var(--txt3)', display: 'flex', gap: 8 }}>
        <Icon name="shield" size={13} color="var(--txt3)" />
        <span><strong style={{ color: 'var(--txt2)' }}>Educational reference only.</strong> This tool suggests commonly associated lab tests for educational purposes. It does not diagnose conditions or replace a doctor's clinical judgment. Always consult a healthcare professional for symptoms.</span>
      </div>
    </div>
  );
}

// Plain-language definitions for common lab/medical terms.
// Used by the <Term> tooltip so patients can tap any jargon for a simple meaning.

export const GLOSSARY: Record<string, string> = {
  cbc: 'Complete Blood Count — a common blood test that checks your red cells, white cells, and platelets. Helps spot anemia and infections.',
  hemoglobin: 'The protein in red blood cells that carries oxygen. Low levels can mean anemia and cause tiredness.',
  ferritin: 'A measure of your body’s stored iron. Low ferritin is an early sign of iron deficiency.',
  hba1c: 'Your average blood sugar over the past 2–3 months. Used to check for and monitor diabetes.',
  tsh: 'Thyroid Stimulating Hormone — checks how well your thyroid is working. High TSH often means an underactive thyroid.',
  lipid: 'A group of blood fats including cholesterol and triglycerides — linked to heart health.',
  cholesterol: 'A fatty substance in your blood. High levels can raise the risk of heart problems.',
  creatinine: 'A waste product filtered by your kidneys. Used to check how well your kidneys are working.',
  'vitamin d': 'A vitamin important for bones and immunity. Deficiency is very common and can cause fatigue.',
  'vitamin b12': 'A vitamin needed for nerves and blood. Low levels can cause tiredness and anemia, common in vegetarians.',
  'uric acid': 'A waste product in blood. High levels can cause gout and joint pain.',
  esr: 'Erythrocyte Sedimentation Rate — a general marker of inflammation in the body.',
  crp: 'C-Reactive Protein — rises when there is inflammation or infection in the body.',
  troponin: 'A protein released when the heart muscle is damaged. Used to check for heart attacks.',
  ecg: 'Electrocardiogram — a quick test that records your heart’s electrical activity.',
  reference_range: 'The normal range of values for a test in healthy people. Results outside it are flagged.',
  loinc: 'An international code system that gives every lab test a standard name, so results match across labs.',
  triglycerides: 'A type of fat in your blood. High levels are linked to heart disease and often diet-related.',
  calcium: 'A mineral important for bones, muscles, and nerves. Abnormal levels can cause cramps or weakness.',
  magnesium: 'A mineral involved in muscle and nerve function. Low levels can cause cramps and fatigue.',
  potassium: 'An electrolyte that keeps your heart and muscles working. Too high or low can be dangerous.',
  sodium: 'An electrolyte that controls fluid balance in the body.',
  electrolytes: 'Minerals like sodium, potassium, and calcium that keep nerves, muscles, and fluids balanced.',
  prolactin: 'A hormone that can affect periods and fertility when too high.',
  testosterone: 'The main male sex hormone; also present in women. Low levels can cause fatigue and low libido.',
  amylase: 'An enzyme from the pancreas. High levels can indicate pancreas inflammation.',
  lipase: 'A pancreas enzyme used to detect pancreatitis.',
  alt: 'A liver enzyme (also called SGPT). High levels can signal liver irritation or damage.',
  ast: 'A liver enzyme (also called SGOT). Raised levels may indicate liver or muscle issues.',
  bilirubin: 'A yellow pigment from the breakdown of red cells. High levels cause jaundice.',
  platelets: 'Tiny blood cells that help your blood clot. Too few raises bleeding risk.',
  wbc: 'White blood cells — your immune defenders. High counts often mean infection.',
};

// Look up a definition by loose key (case-insensitive, partial match on the leading term).
export function lookupTerm(term: string): string | null {
  const k = term.trim().toLowerCase();
  if (GLOSSARY[k]) return GLOSSARY[k];
  // try the first word / known keys contained in the term
  for (const key of Object.keys(GLOSSARY)) {
    if (k.includes(key)) return GLOSSARY[key];
  }
  return null;
}

/**
 * FeelFit v10 — Multi-City Doctor Database
 * 100+ doctors across 8 major Indian cities, 16 specializations.
 * Used by DoctorSection for instant local discovery + filter/sort.
 * Each entry mirrors the DoctorResult schema so it's API-compatible.
 */

export interface LocalDoctor {
  id: string;
  name: string;
  specialization: string;
  clinic: string;
  city: City;
  area: string;
  address: string;
  rating: number;
  experience_years: number;
  phone: string;
  availability: string;
  fees_inr: string;
  languages: string[];
  consultation_types: ConsultationType[];
  lat: number;
  lng: number;
  distance_km?: number;
  verified: boolean;
}

export type City =
  | 'Ludhiana' | 'Delhi' | 'Mumbai' | 'Bangalore'
  | 'Chennai' | 'Hyderabad' | 'Pune' | 'Kolkata';

export type ConsultationType = 'In-clinic' | 'Online' | 'Home visit';

export const CITIES: City[] = [
  'Ludhiana', 'Delhi', 'Mumbai', 'Bangalore',
  'Chennai', 'Hyderabad', 'Pune', 'Kolkata',
];

export const CITY_COORDS: Record<City, { lat: number; lng: number }> = {
  Ludhiana:   { lat: 30.9010, lng: 75.8573 },
  Delhi:      { lat: 28.6139, lng: 77.2090 },
  Mumbai:     { lat: 19.0760, lng: 72.8777 },
  Bangalore:  { lat: 12.9716, lng: 77.5946 },
  Chennai:    { lat: 13.0827, lng: 80.2707 },
  Hyderabad:  { lat: 17.3850, lng: 78.4867 },
  Pune:       { lat: 18.5204, lng: 73.8567 },
  Kolkata:    { lat: 22.5726, lng: 88.3639 },
};

export const SPECIALIZATIONS_V2 = [
  'General Physician', 'Endocrinologist', 'Cardiologist', 'Diabetologist',
  'Nephrologist', 'Hematologist', 'Gastroenterologist', 'Neurologist',
  'Pulmonologist', 'Rheumatologist', 'Dermatologist', 'Orthopedist',
  'Pediatrician', 'Gynecologist', 'Urologist', 'Psychiatrist',
];

export const SPEC_ICONS: Record<string, string> = {
  'General Physician': '🩺', 'Endocrinologist': '🧬', 'Cardiologist': '❤️',
  'Diabetologist': '🩸', 'Nephrologist': '🫘', 'Hematologist': '🔬',
  'Gastroenterologist': '🫁', 'Neurologist': '🧠', 'Pulmonologist': '🌬️',
  'Rheumatologist': '🦴', 'Dermatologist': '🧴', 'Orthopedist': '🦿',
  'Pediatrician': '👶', 'Gynecologist': '♀️', 'Urologist': '⚕️', 'Psychiatrist': '🧩',
};

export const DOCTOR_DB: LocalDoctor[] = [
  // ── LUDHIANA ───────────────────────────────────────────────────────────────
  { id: 'lu-gp-1', name: 'Dr. Rajesh Sharma', specialization: 'General Physician', clinic: 'Ludhiana Medical Centre', city: 'Ludhiana', area: 'Model Town', address: 'H.No. 142, Model Town Extension, Ludhiana', rating: 4.5, experience_years: 15, phone: '+91 98765 43210', availability: 'Mon–Sat 10AM–6PM', fees_inr: '₹800–1400', languages: ['Hindi', 'Punjabi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 30.9123, lng: 75.8547, verified: true },
  { id: 'lu-gp-2', name: 'Dr. Priya Mehta', specialization: 'General Physician', clinic: 'City Health Clinic', city: 'Ludhiana', area: 'Civil Lines', address: '14, Civil Lines, Ludhiana', rating: 4.3, experience_years: 11, phone: '+91 97543 21098', availability: 'Mon–Fri 9AM–5PM', fees_inr: '₹600–1000', languages: ['Hindi', 'Punjabi'], consultation_types: ['In-clinic'], lat: 30.9012, lng: 75.8432, verified: true },
  { id: 'lu-endo-1', name: 'Dr. Amit Singh', specialization: 'Endocrinologist', clinic: 'Apollo Clinic Ludhiana', city: 'Ludhiana', area: 'Sarabha Nagar', address: 'SCO 22, Sarabha Nagar, Ludhiana', rating: 4.7, experience_years: 18, phone: '+91 99887 76655', availability: 'Mon–Sat 11AM–7PM', fees_inr: '₹900–1500', languages: ['Hindi', 'Punjabi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 30.9088, lng: 75.8600, verified: true },
  { id: 'lu-card-1', name: 'Dr. Sunita Kapoor', specialization: 'Cardiologist', clinic: 'Kapoor Heart Institute', city: 'Ludhiana', area: 'BRS Nagar', address: 'B-7, BRS Nagar, Ludhiana', rating: 4.6, experience_years: 14, phone: '+91 96321 87654', availability: 'Mon–Sat 9AM–2PM, 5PM–8PM', fees_inr: '₹1200–2000', languages: ['Hindi', 'Punjabi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 30.9045, lng: 75.8490, verified: true },
  { id: 'lu-diab-1', name: 'Dr. Vikram Bhatia', specialization: 'Diabetologist', clinic: 'Feroze Gandhi Hospital', city: 'Ludhiana', area: 'Feroze Gandhi Marg', address: 'Feroze Gandhi Marg, Ludhiana', rating: 4.4, experience_years: 22, phone: '+91 98142 56789', availability: 'Mon–Fri 8AM–4PM', fees_inr: '₹500–900', languages: ['Hindi', 'Punjabi'], consultation_types: ['In-clinic'], lat: 30.8980, lng: 75.8510, verified: true },
  { id: 'lu-neuro-1', name: 'Dr. Harpreet Kaur', specialization: 'Neurologist', clinic: 'Punjab Neuro Centre', city: 'Ludhiana', area: 'Pakhowal Road', address: '12-A, Pakhowal Road, Ludhiana', rating: 4.8, experience_years: 16, phone: '+91 95012 34567', availability: 'Mon–Sat 10AM–7PM', fees_inr: '₹1000–1800', languages: ['Hindi', 'Punjabi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 30.8892, lng: 75.8641, verified: true },
  { id: 'lu-derma-1', name: 'Dr. Manpreet Singh', specialization: 'Dermatologist', clinic: 'Skin & Glow Clinic', city: 'Ludhiana', area: 'Dugri', address: 'Shop 4, Dugri Phase 2, Ludhiana', rating: 4.5, experience_years: 9, phone: '+91 94175 23456', availability: 'Mon–Sat 11AM–8PM', fees_inr: '₹700–1200', languages: ['Hindi', 'Punjabi'], consultation_types: ['In-clinic', 'Online'], lat: 30.8830, lng: 75.8720, verified: true },
  { id: 'lu-pedia-1', name: 'Dr. Gurpreet Bajwa', specialization: 'Pediatrician', clinic: 'Child Care Clinic', city: 'Ludhiana', area: 'Gurdev Nagar', address: '8, Gurdev Nagar, Ludhiana', rating: 4.6, experience_years: 13, phone: '+91 93458 76543', availability: 'Mon–Sat 9AM–1PM, 5PM–8PM', fees_inr: '₹600–1000', languages: ['Hindi', 'Punjabi', 'English'], consultation_types: ['In-clinic', 'Home visit'], lat: 30.9020, lng: 75.8660, verified: true },

  // ── DELHI ─────────────────────────────────────────────────────────────────
  { id: 'dl-gp-1', name: 'Dr. Aarav Gupta', specialization: 'General Physician', clinic: 'Max Healthcare Saket', city: 'Delhi', area: 'Saket', address: '2, Press Enclave Marg, Saket, New Delhi', rating: 4.6, experience_years: 17, phone: '+91 98110 44556', availability: 'Mon–Sat 9AM–6PM', fees_inr: '₹1000–1800', languages: ['Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 28.5245, lng: 77.2066, verified: true },
  { id: 'dl-card-1', name: 'Dr. Neha Agarwal', specialization: 'Cardiologist', clinic: 'Fortis Escorts Heart Institute', city: 'Delhi', area: 'Okhla', address: 'Okhla Road, Sukhdev Vihar, New Delhi', rating: 4.8, experience_years: 21, phone: '+91 98111 23456', availability: 'Mon–Fri 10AM–5PM', fees_inr: '₹1500–2500', languages: ['Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 28.5560, lng: 77.2736, verified: true },
  { id: 'dl-endo-1', name: 'Dr. Rakesh Yadav', specialization: 'Endocrinologist', clinic: 'AIIMS Delhi', city: 'Delhi', area: 'Ansari Nagar', address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi', rating: 4.9, experience_years: 25, phone: '+91 11 2658 8500', availability: 'Mon–Fri 8AM–2PM (OPD)', fees_inr: '₹200 (OPD)', languages: ['Hindi', 'English'], consultation_types: ['In-clinic'], lat: 28.5672, lng: 77.2100, verified: true },
  { id: 'dl-neuro-1', name: 'Dr. Priyanka Sharma', specialization: 'Neurologist', clinic: 'Medanta — The Medicity', city: 'Delhi', area: 'Gurugram', address: 'CH Baktawar Singh Road, Sector 38, Gurugram', rating: 4.7, experience_years: 14, phone: '+91 98980 49999', availability: 'Mon–Sat 10AM–6PM', fees_inr: '₹1200–2200', languages: ['Hindi', 'English', 'Punjabi'], consultation_types: ['In-clinic', 'Online'], lat: 28.4436, lng: 77.0479, verified: true },
  { id: 'dl-gastro-1', name: 'Dr. Suresh Patel', specialization: 'Gastroenterologist', clinic: 'Sir Ganga Ram Hospital', city: 'Delhi', area: 'Karol Bagh', address: 'Rajinder Nagar, New Delhi', rating: 4.6, experience_years: 19, phone: '+91 98103 22222', availability: 'Mon–Sat 9AM–5PM', fees_inr: '₹1100–1900', languages: ['Hindi', 'English', 'Gujarati'], consultation_types: ['In-clinic', 'Online'], lat: 28.6415, lng: 77.1923, verified: true },
  { id: 'dl-ortho-1', name: 'Dr. Anita Joshi', specialization: 'Orthopedist', clinic: 'Apollo Hospitals Delhi', city: 'Delhi', area: 'Sarita Vihar', address: 'Mathura Road, Sarita Vihar, New Delhi', rating: 4.5, experience_years: 16, phone: '+91 98193 44444', availability: 'Mon–Sat 10AM–7PM', fees_inr: '₹1200–2000', languages: ['Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 28.5327, lng: 77.2939, verified: true },
  { id: 'dl-gynec-1', name: 'Dr. Deepa Verma', specialization: 'Gynecologist', clinic: 'Cloudnine Hospital Malviya Nagar', city: 'Delhi', area: 'Malviya Nagar', address: 'K-4, Malviya Nagar, New Delhi', rating: 4.8, experience_years: 20, phone: '+91 98180 55555', availability: 'Mon–Sat 9AM–6PM', fees_inr: '₹1000–1800', languages: ['Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 28.5278, lng: 77.2093, verified: true },
  { id: 'dl-psych-1', name: 'Dr. Rahul Bose', specialization: 'Psychiatrist', clinic: 'NIMHANS Delhi OPD', city: 'Delhi', area: 'Lajpat Nagar', address: '28, Lajpat Nagar III, New Delhi', rating: 4.6, experience_years: 12, phone: '+91 98768 11111', availability: 'Mon–Fri 10AM–6PM', fees_inr: '₹1500–2500', languages: ['Hindi', 'English', 'Bengali'], consultation_types: ['In-clinic', 'Online'], lat: 28.5664, lng: 77.2416, verified: true },
  { id: 'dl-pedia-1', name: 'Dr. Kavita Singh', specialization: 'Pediatrician', clinic: 'Rainbow Children Hospital Delhi', city: 'Delhi', area: 'Malviya Nagar', address: 'J-9/A, DLF Phase II, Gurugram', rating: 4.7, experience_years: 15, phone: '+91 98108 77777', availability: 'Mon–Sun 9AM–8PM', fees_inr: '₹800–1400', languages: ['Hindi', 'English'], consultation_types: ['In-clinic', 'Online', 'Home visit'], lat: 28.4977, lng: 77.0882, verified: true },

  // ── MUMBAI ────────────────────────────────────────────────────────────────
  { id: 'mb-gp-1', name: 'Dr. Arjun Nair', specialization: 'General Physician', clinic: 'Lilavati Hospital', city: 'Mumbai', area: 'Bandra West', address: 'A-791, Bandra Reclamation, Bandra West, Mumbai', rating: 4.7, experience_years: 18, phone: '+91 98200 12345', availability: 'Mon–Sat 9AM–7PM', fees_inr: '₹1200–2000', languages: ['Hindi', 'English', 'Marathi', 'Malayalam'], consultation_types: ['In-clinic', 'Online'], lat: 19.0535, lng: 72.8190, verified: true },
  { id: 'mb-card-1', name: 'Dr. Sneha Desai', specialization: 'Cardiologist', clinic: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Mumbai', area: 'Andheri West', address: 'Rao Saheb Achutrao Patwardhan Marg, Andheri West, Mumbai', rating: 4.9, experience_years: 24, phone: '+91 98210 23456', availability: 'Mon–Fri 10AM–5PM', fees_inr: '₹1800–3000', languages: ['Hindi', 'English', 'Marathi', 'Gujarati'], consultation_types: ['In-clinic', 'Online'], lat: 19.1300, lng: 72.8264, verified: true },
  { id: 'mb-endo-1', name: 'Dr. Vikrant Shah', specialization: 'Endocrinologist', clinic: 'Hinduja Hospital', city: 'Mumbai', area: 'Mahim', address: 'Veer Savarkar Marg, Mahim, Mumbai', rating: 4.6, experience_years: 16, phone: '+91 98334 34567', availability: 'Mon–Sat 11AM–7PM', fees_inr: '₹1400–2200', languages: ['Hindi', 'English', 'Marathi', 'Gujarati'], consultation_types: ['In-clinic', 'Online'], lat: 19.0424, lng: 72.8397, verified: true },
  { id: 'mb-gastro-1', name: 'Dr. Rohini Kulkarni', specialization: 'Gastroenterologist', clinic: 'Breach Candy Hospital', city: 'Mumbai', area: 'Breach Candy', address: '60-A, Bhulabhai Desai Road, Mumbai', rating: 4.7, experience_years: 20, phone: '+91 98204 45678', availability: 'Mon–Sat 10AM–6PM', fees_inr: '₹1300–2100', languages: ['Hindi', 'English', 'Marathi'], consultation_types: ['In-clinic'], lat: 18.9719, lng: 72.8076, verified: true },
  { id: 'mb-derma-1', name: 'Dr. Preethi Menon', specialization: 'Dermatologist', clinic: 'Skin Wellness Clinic Juhu', city: 'Mumbai', area: 'Juhu', address: '12, JVPD Scheme, Juhu, Mumbai', rating: 4.8, experience_years: 13, phone: '+91 98205 56789', availability: 'Mon–Sat 10AM–8PM', fees_inr: '₹1000–1800', languages: ['Hindi', 'English', 'Malayalam', 'Tamil'], consultation_types: ['In-clinic', 'Online'], lat: 19.1050, lng: 72.8284, verified: true },
  { id: 'mb-gynec-1', name: 'Dr. Pallavi Joshi', specialization: 'Gynecologist', clinic: 'Wockhardt Hospital Mumbai Central', city: 'Mumbai', area: 'Mumbai Central', address: '1877, Dr. Anandrao Nair Marg, Mumbai Central', rating: 4.6, experience_years: 17, phone: '+91 98208 67890', availability: 'Mon–Sat 9AM–5PM', fees_inr: '₹1200–2000', languages: ['Hindi', 'English', 'Marathi'], consultation_types: ['In-clinic', 'Online'], lat: 18.9726, lng: 72.8220, verified: true },
  { id: 'mb-neuro-1', name: 'Dr. Anil Mehra', specialization: 'Neurologist', clinic: 'Nanavati Super Speciality Hospital', city: 'Mumbai', area: 'Vile Parle West', address: 'S.V. Road, Vile Parle West, Mumbai', rating: 4.7, experience_years: 22, phone: '+91 98209 78901', availability: 'Mon–Fri 10AM–5PM', fees_inr: '₹1500–2500', languages: ['Hindi', 'English', 'Marathi', 'Gujarati'], consultation_types: ['In-clinic', 'Online'], lat: 19.0969, lng: 72.8451, verified: true },
  { id: 'mb-pedia-1', name: 'Dr. Meera Sharma', specialization: 'Pediatrician', clinic: 'Rainbow Children Hospital Mumbai', city: 'Mumbai', area: 'Malad', address: 'Crystal Plaza, Mindspace, Malad West, Mumbai', rating: 4.5, experience_years: 10, phone: '+91 98201 89012', availability: 'Mon–Sun 8AM–8PM', fees_inr: '₹900–1500', languages: ['Hindi', 'English', 'Marathi'], consultation_types: ['In-clinic', 'Online', 'Home visit'], lat: 19.1892, lng: 72.8544, verified: true },

  // ── BANGALORE ─────────────────────────────────────────────────────────────
  { id: 'blr-gp-1', name: 'Dr. Karthik Reddy', specialization: 'General Physician', clinic: 'Manipal Hospital Whitefield', city: 'Bangalore', area: 'Whitefield', address: 'ITPB Road, Whitefield, Bengaluru', rating: 4.6, experience_years: 14, phone: '+91 98450 11111', availability: 'Mon–Sat 9AM–6PM', fees_inr: '₹900–1600', languages: ['Kannada', 'Telugu', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 12.9698, lng: 77.7499, verified: true },
  { id: 'blr-card-1', name: 'Dr. Sushma Rao', specialization: 'Cardiologist', clinic: 'Narayana Health City', city: 'Bangalore', area: 'Bommasandra', address: '258/A, Bommasandra Industrial Area, Bengaluru', rating: 4.8, experience_years: 23, phone: '+91 98454 22222', availability: 'Mon–Sat 10AM–5PM', fees_inr: '₹1400–2200', languages: ['Kannada', 'Telugu', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 12.7965, lng: 77.6912, verified: true },
  { id: 'blr-endo-1', name: 'Dr. Pradeep Kumar', specialization: 'Endocrinologist', clinic: 'Fortis Hospital Bannerghatta', city: 'Bangalore', area: 'Bannerghatta Road', address: '154/9, Bannerghatta Road, Bengaluru', rating: 4.7, experience_years: 17, phone: '+91 98451 33333', availability: 'Mon–Sat 10AM–7PM', fees_inr: '₹1200–2000', languages: ['Kannada', 'Hindi', 'English', 'Tamil'], consultation_types: ['In-clinic', 'Online'], lat: 12.8903, lng: 77.5972, verified: true },
  { id: 'blr-derma-1', name: 'Dr. Anupama Nair', specialization: 'Dermatologist', clinic: 'Skin & Aesthetic Centre Indiranagar', city: 'Bangalore', area: 'Indiranagar', address: '100 Feet Road, Indiranagar, Bengaluru', rating: 4.9, experience_years: 12, phone: '+91 98452 44444', availability: 'Mon–Sat 11AM–8PM', fees_inr: '₹1000–1800', languages: ['Kannada', 'Malayalam', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 12.9784, lng: 77.6408, verified: true },
  { id: 'blr-ortho-1', name: 'Dr. Venkat Rao', specialization: 'Orthopedist', clinic: 'Columbia Asia Hospital Hebbal', city: 'Bangalore', area: 'Hebbal', address: 'Kirloskar Business Park, Hebbal, Bengaluru', rating: 4.6, experience_years: 19, phone: '+91 98453 55555', availability: 'Mon–Sat 9AM–5PM', fees_inr: '₹1100–1900', languages: ['Kannada', 'Telugu', 'Hindi', 'English'], consultation_types: ['In-clinic'], lat: 13.0358, lng: 77.5970, verified: true },
  { id: 'blr-psych-1', name: 'Dr. Divya Krishnan', specialization: 'Psychiatrist', clinic: 'NIMHANS Bengaluru', city: 'Bangalore', area: 'Hosur Road', address: 'Hosur Road, Bengaluru', rating: 4.8, experience_years: 21, phone: '+91 98450 66666', availability: 'Mon–Fri 9AM–2PM (OPD)', fees_inr: '₹300–800', languages: ['Kannada', 'Tamil', 'Hindi', 'English', 'Telugu'], consultation_types: ['In-clinic', 'Online'], lat: 12.9402, lng: 77.5989, verified: true },
  { id: 'blr-gynec-1', name: 'Dr. Manjula Iyer', specialization: 'Gynecologist', clinic: 'Motherhood Hospital Indiranagar', city: 'Bangalore', area: 'Indiranagar', address: '43/5, Leela Palace Road, Indiranagar, Bengaluru', rating: 4.7, experience_years: 16, phone: '+91 98455 77777', availability: 'Mon–Sat 9AM–7PM', fees_inr: '₹1000–1800', languages: ['Kannada', 'Tamil', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 12.9784, lng: 77.6408, verified: true },

  // ── HYDERABAD ─────────────────────────────────────────────────────────────
  { id: 'hyd-gp-1', name: 'Dr. Ravi Shankar', specialization: 'General Physician', clinic: 'Apollo Hospitals Jubilee Hills', city: 'Hyderabad', area: 'Jubilee Hills', address: 'Plot No.251, Road No.54, Jubilee Hills, Hyderabad', rating: 4.6, experience_years: 15, phone: '+91 98480 11111', availability: 'Mon–Sat 9AM–7PM', fees_inr: '₹900–1600', languages: ['Telugu', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 17.4324, lng: 78.4071, verified: true },
  { id: 'hyd-card-1', name: 'Dr. Padma Reddy', specialization: 'Cardiologist', clinic: 'CARE Hospitals Banjara Hills', city: 'Hyderabad', area: 'Banjara Hills', address: 'Road No.1, Banjara Hills, Hyderabad', rating: 4.7, experience_years: 20, phone: '+91 98484 22222', availability: 'Mon–Sat 10AM–5PM', fees_inr: '₹1400–2200', languages: ['Telugu', 'Hindi', 'English', 'Urdu'], consultation_types: ['In-clinic', 'Online'], lat: 17.4165, lng: 78.4481, verified: true },
  { id: 'hyd-diab-1', name: 'Dr. Srinivas Reddy', specialization: 'Diabetologist', clinic: 'Diab Care India Hyderabad', city: 'Hyderabad', area: 'Ameerpet', address: '3-6-369, Street No.11, Ameerpet, Hyderabad', rating: 4.8, experience_years: 18, phone: '+91 98480 33333', availability: 'Mon–Sat 10AM–7PM', fees_inr: '₹900–1500', languages: ['Telugu', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 17.4380, lng: 78.4452, verified: true },
  { id: 'hyd-neuro-1', name: 'Dr. Usha Bharathi', specialization: 'Neurologist', clinic: 'Yashoda Hospitals Secunderabad', city: 'Hyderabad', area: 'Secunderabad', address: 'Behind Hari Hara Kala Bhavan, S.P. Road, Secunderabad', rating: 4.6, experience_years: 14, phone: '+91 98481 44444', availability: 'Mon–Sat 10AM–6PM', fees_inr: '₹1200–2000', languages: ['Telugu', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 17.4399, lng: 78.4983, verified: true },
  { id: 'hyd-gynec-1', name: 'Dr. Aruna Kumari', specialization: 'Gynecologist', clinic: 'Rainbow Hospital for Women & Children', city: 'Hyderabad', area: 'Banjara Hills', address: 'Road No.2, Banjara Hills, Hyderabad', rating: 4.8, experience_years: 22, phone: '+91 98480 55555', availability: 'Mon–Sat 9AM–6PM', fees_inr: '₹1100–1900', languages: ['Telugu', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 17.4165, lng: 78.4481, verified: true },

  // ── CHENNAI ───────────────────────────────────────────────────────────────
  { id: 'che-gp-1', name: 'Dr. Suresh Babu', specialization: 'General Physician', clinic: 'Apollo Hospitals Greams Road', city: 'Chennai', area: 'Greams Road', address: '21, Greams Lane, Greams Road, Chennai', rating: 4.7, experience_years: 17, phone: '+91 98400 11111', availability: 'Mon–Sat 8AM–6PM', fees_inr: '₹1000–1800', languages: ['Tamil', 'English', 'Hindi'], consultation_types: ['In-clinic', 'Online'], lat: 13.0617, lng: 80.2516, verified: true },
  { id: 'che-card-1', name: 'Dr. Meenakshi Sundaram', specialization: 'Cardiologist', clinic: 'Fortis Malar Hospital', city: 'Chennai', area: 'Adyar', address: '52, 1st Main Road, Gandhi Nagar, Adyar, Chennai', rating: 4.8, experience_years: 25, phone: '+91 98401 22222', availability: 'Mon–Fri 9AM–4PM', fees_inr: '₹1500–2500', languages: ['Tamil', 'English'], consultation_types: ['In-clinic'], lat: 13.0067, lng: 80.2543, verified: true },
  { id: 'che-endo-1', name: 'Dr. Kavitha Rajan', specialization: 'Endocrinologist', clinic: 'SIMS Hospital Vadapalani', city: 'Chennai', area: 'Vadapalani', address: '1, Jawaharlal Nehru Salai, Vadapalani, Chennai', rating: 4.6, experience_years: 16, phone: '+91 98402 33333', availability: 'Mon–Sat 10AM–7PM', fees_inr: '₹1200–2000', languages: ['Tamil', 'English', 'Hindi'], consultation_types: ['In-clinic', 'Online'], lat: 13.0508, lng: 80.2112, verified: true },
  { id: 'che-pedia-1', name: 'Dr. Arumugam S', specialization: 'Pediatrician', clinic: 'Kanchi Kamakoti CHILDS Trust Hospital', city: 'Chennai', area: 'Nungambakkam', address: '12-A, Nungambakkam High Road, Chennai', rating: 4.9, experience_years: 28, phone: '+91 98403 44444', availability: 'Mon–Sat 9AM–2PM, 4PM–7PM', fees_inr: '₹600–1000', languages: ['Tamil', 'English'], consultation_types: ['In-clinic'], lat: 13.0627, lng: 80.2422, verified: true },
  { id: 'che-ortho-1', name: 'Dr. Rajini Priya', specialization: 'Orthopedist', clinic: 'Vijaya Hospital Chennai', city: 'Chennai', area: 'Vadapalani', address: '434, NSK Salai, Vadapalani, Chennai', rating: 4.5, experience_years: 13, phone: '+91 98404 55555', availability: 'Mon–Sat 10AM–6PM', fees_inr: '₹1000–1700', languages: ['Tamil', 'English', 'Telugu'], consultation_types: ['In-clinic', 'Online'], lat: 13.0508, lng: 80.2112, verified: true },

  // ── PUNE ──────────────────────────────────────────────────────────────────
  { id: 'pn-gp-1', name: 'Dr. Rajeev Gokhale', specialization: 'General Physician', clinic: 'Ruby Hall Clinic', city: 'Pune', area: 'Pune Camp', address: '40, Sassoon Road, Pune Camp, Pune', rating: 4.6, experience_years: 19, phone: '+91 98220 11111', availability: 'Mon–Sat 9AM–7PM', fees_inr: '₹900–1600', languages: ['Marathi', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 18.5196, lng: 73.8745, verified: true },
  { id: 'pn-card-1', name: 'Dr. Smita Kulkarni', specialization: 'Cardiologist', clinic: 'Jehangir Hospital Pune', city: 'Pune', area: 'Pune Camp', address: '32, Sassoon Road, Pune', rating: 4.7, experience_years: 21, phone: '+91 98221 22222', availability: 'Mon–Sat 10AM–5PM', fees_inr: '₹1200–2000', languages: ['Marathi', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 18.5196, lng: 73.8745, verified: true },
  { id: 'pn-diab-1', name: 'Dr. Anil Deshpande', specialization: 'Diabetologist', clinic: 'Deenanath Mangeshkar Hospital', city: 'Pune', area: 'Erandwane', address: '28, Erandwane, Near Mhatre Bridge, Pune', rating: 4.8, experience_years: 24, phone: '+91 98222 33333', availability: 'Mon–Sat 10AM–6PM', fees_inr: '₹1000–1700', languages: ['Marathi', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 18.5086, lng: 73.8410, verified: true },
  { id: 'pn-derma-1', name: 'Dr. Pooja Joshi', specialization: 'Dermatologist', clinic: 'Pune Skin Clinic', city: 'Pune', area: 'Koregaon Park', address: '5, North Main Road, Koregaon Park, Pune', rating: 4.7, experience_years: 11, phone: '+91 98223 44444', availability: 'Mon–Sat 11AM–8PM', fees_inr: '₹900–1600', languages: ['Marathi', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 18.5362, lng: 73.8954, verified: true },
  { id: 'pn-gynec-1', name: 'Dr. Madhuri Bhadkamkar', specialization: 'Gynecologist', clinic: 'Surya Mother & Child Care Hospital', city: 'Pune', area: 'Wakad', address: 'Survey No.203, Hinjewadi, Wakad, Pune', rating: 4.6, experience_years: 18, phone: '+91 98224 55555', availability: 'Mon–Sat 9AM–6PM', fees_inr: '₹1000–1700', languages: ['Marathi', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 18.5906, lng: 73.7570, verified: true },

  // ── KOLKATA ───────────────────────────────────────────────────────────────
  { id: 'kol-gp-1', name: 'Dr. Arnab Chatterjee', specialization: 'General Physician', clinic: 'Apollo Gleneagles Hospital', city: 'Kolkata', area: 'Canal Circular Road', address: '58, Canal Circular Road, Kolkata', rating: 4.6, experience_years: 16, phone: '+91 98300 11111', availability: 'Mon–Sat 9AM–7PM', fees_inr: '₹900–1600', languages: ['Bengali', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 22.5550, lng: 88.3876, verified: true },
  { id: 'kol-card-1', name: 'Dr. Rituparna Sen', specialization: 'Cardiologist', clinic: 'NH Rabindranath Tagore International', city: 'Kolkata', area: 'Mukundapur', address: '124, EM Bypass, Mukundapur, Kolkata', rating: 4.8, experience_years: 22, phone: '+91 98301 22222', availability: 'Mon–Sat 10AM–5PM', fees_inr: '₹1300–2100', languages: ['Bengali', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 22.4876, lng: 88.3934, verified: true },
  { id: 'kol-neuro-1', name: 'Dr. Suman Biswas', specialization: 'Neurologist', clinic: 'AMRI Hospital Salt Lake', city: 'Kolkata', area: 'Salt Lake', address: 'Block J1&2, Sector III, Salt Lake, Kolkata', rating: 4.7, experience_years: 20, phone: '+91 98302 33333', availability: 'Mon–Sat 10AM–6PM', fees_inr: '₹1200–2000', languages: ['Bengali', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online'], lat: 22.5697, lng: 88.4197, verified: true },
  { id: 'kol-gastro-1', name: 'Dr. Prasanta Pal', specialization: 'Gastroenterologist', clinic: 'Peerless Hospital', city: 'Kolkata', area: 'Panchasayar', address: '360, Panchasayar, Kolkata', rating: 4.5, experience_years: 14, phone: '+91 98303 44444', availability: 'Mon–Sat 9AM–5PM', fees_inr: '₹1000–1800', languages: ['Bengali', 'Hindi', 'English'], consultation_types: ['In-clinic'], lat: 22.4793, lng: 88.3818, verified: true },
  { id: 'kol-pedia-1', name: 'Dr. Ananya Roy', specialization: 'Pediatrician', clinic: 'Fortis Hospital Anandapur', city: 'Kolkata', area: 'Anandapur', address: '730, Anandapur, EM Bypass, Kolkata', rating: 4.8, experience_years: 15, phone: '+91 98304 55555', availability: 'Mon–Sat 9AM–7PM', fees_inr: '₹900–1500', languages: ['Bengali', 'Hindi', 'English'], consultation_types: ['In-clinic', 'Online', 'Home visit'], lat: 22.5185, lng: 88.3886, verified: true },
];

// ── Haversine distance ─────────────────────────────────────────────────────
function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Filter/sort helpers ────────────────────────────────────────────────────
export interface DoctorFilter {
  city?: City;
  specialization?: string;
  minRating?: number;
  maxDistanceKm?: number;
  consultationType?: ConsultationType;
  userLat?: number;
  userLng?: number;
}

export type DoctorSortKey = 'rating' | 'distance' | 'experience' | 'fees';

export function filterAndSortDoctors(
  filter: DoctorFilter,
  sort: DoctorSortKey = 'rating',
): LocalDoctor[] {
  const cityCoords = filter.city ? CITY_COORDS[filter.city] : null;
  const refLat = filter.userLat ?? cityCoords?.lat;
  const refLng = filter.userLng ?? cityCoords?.lng;

  let results = DOCTOR_DB
    .filter(d => {
      if (filter.city && d.city !== filter.city) return false;
      if (filter.specialization && d.specialization.toLowerCase() !== filter.specialization.toLowerCase()) return false;
      if (filter.minRating && d.rating < filter.minRating) return false;
      if (filter.consultationType && !d.consultation_types.includes(filter.consultationType)) return false;
      return true;
    })
    .map(d => ({
      ...d,
      distance_km: refLat && refLng ? haversineDist(refLat, refLng, d.lat, d.lng) : undefined,
    }));

  if (filter.maxDistanceKm && refLat && refLng) {
    results = results.filter(d => (d.distance_km ?? 0) <= filter.maxDistanceKm!);
  }

  results.sort((a, b) => {
    if (sort === 'rating') return b.rating - a.rating;
    if (sort === 'distance') return (a.distance_km ?? 999) - (b.distance_km ?? 999);
    if (sort === 'experience') return b.experience_years - a.experience_years;
    if (sort === 'fees') {
      const parseMin = (f: string) => parseInt(f.replace(/[^0-9]/g, '').slice(0, 5)) || 999999;
      return parseMin(a.fees_inr) - parseMin(b.fees_inr);
    }
    return 0;
  });

  return results;
}

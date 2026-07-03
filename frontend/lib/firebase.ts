// FeelFit — Firebase client init (Phone/OTP sign-in only).
// The web config below is NOT secret — Firebase web API keys are meant to be
// public and are restricted server-side by Firebase Auth + domain allow-list.
// Leave any NEXT_PUBLIC_FIREBASE_* var unset to keep phone sign-in disabled.

export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
};

export const firebaseEnabled = () => !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);

let _app: import('firebase/app').FirebaseApp | null = null;

/** Lazily initialise the Firebase app (only when phone sign-in is actually used). */
export async function getFirebaseApp() {
  if (!firebaseEnabled()) return null;
  if (_app) return _app;
  const { initializeApp, getApps } = await import('firebase/app');
  _app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  return _app;
}

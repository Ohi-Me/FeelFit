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

let _auth: import('firebase/auth').Auth | null = null;

/**
 * Lazily get the Auth instance with `debugErrorMap` installed, so
 * `error.message` carries a human-readable description (e.g. "This domain is
 * not authorized...") instead of the bare `Firebase: Error (auth/xxx).` that
 * `getAuth()` alone produces. `initializeAuth` is the only way to opt into
 * this — plain `getAuth(app)` always uses the near-empty prod error map.
 *
 * NOTE: error CODES (`err.code`) are reliable either way — callers should
 * still branch on `.code`, not on this message text. This only makes the
 * text better for logs/toasts that fall through to a generic case.
 */
export async function getFirebaseAuth() {
  const app = await getFirebaseApp();
  if (!app) return null;
  if (_auth) return _auth;
  const { initializeAuth, getAuth, debugErrorMap, browserLocalPersistence } = await import('firebase/auth');
  try {
    _auth = initializeAuth(app, { errorMap: debugErrorMap, persistence: browserLocalPersistence });
  } catch {
    // Already initialized elsewhere (e.g. Fast Refresh in dev) — fall back to
    // the existing instance rather than throwing.
    _auth = getAuth(app);
  }
  return _auth;
}

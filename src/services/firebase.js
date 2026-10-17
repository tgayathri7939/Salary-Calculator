/**
 * Firebase configuration and service initialization.
 * 
 * SECURITY NOTE: Firebase web configuration is NOT a secret — it identifies
 * your Firebase project. Real security is enforced by Firestore Security Rules.
 * NEVER expose service-account private keys in frontend code.
 */

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Check whether all required Firebase config values are present.
 * Returns true = Firebase mode; false = Demo (localStorage) mode.
 */
export function isFirebaseConfigured() {
  return !!(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId
  );
}

let _app = null;
let _auth = null;
let _db = null;

/**
 * Lazily initialize Firebase services.
 * Only call this when isFirebaseConfigured() === true.
 */
export async function getFirebaseServices() {
  if (_app) return { app: _app, auth: _auth, db: _db };

  const { initializeApp } = await import('firebase/app');
  const { getAuth } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');

  _app  = initializeApp(FIREBASE_CONFIG);
  _auth = getAuth(_app);
  _db   = getFirestore(_app);

  return { app: _app, auth: _auth, db: _db };
}

export { FIREBASE_CONFIG };

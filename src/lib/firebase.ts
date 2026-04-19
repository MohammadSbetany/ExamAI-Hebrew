import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 SETUP: Set the following environment variables before building the app.
// Required VITE_FIREBASE_* keys (defined in .env or CI secrets):
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
//   VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
// ─────────────────────────────────────────────────────────────────────────────
const envVarMap: Record<string, string | undefined> = {
  VITE_FIREBASE_API_KEY:            import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingVars = Object.entries(envVarMap)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required Firebase environment variables: ${missingVars.join(', ')}. ` +
    'Ensure these are set in your .env file or CI secrets.'
  );
}

const firebaseConfig = {
  apiKey:            envVarMap.VITE_FIREBASE_API_KEY,
  authDomain:        envVarMap.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         envVarMap.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     envVarMap.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVarMap.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             envVarMap.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

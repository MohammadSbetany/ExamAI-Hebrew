import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 SETUP: Replace these placeholder values with your Firebase project config.
// Go to: Firebase Console → Your Project → Project Settings → Your Apps → SDK setup
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAWt2ZQ9QSVRjkMXJ7UiXIsg4XoEKF5QMQ",
  authDomain: "examai-hebrew.firebaseapp.com",
  projectId: "examai-hebrew",
  storageBucket: "examai-hebrew.firebasestorage.app",
  messagingSenderId: "90893399593",
  appId: "1:90893399593:web:809c0858b02af3b342ce38"
};

const app  = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
if (!firebaseConfig.databaseURL) {
  console.warn('Firebase Realtime Database URL (VITE_FIREBASE_DATABASE_URL) is missing. Cloud chat sync will fail.');
}
export const db = getDatabase(firebaseApp);
export const storage = getStorage(firebaseApp);

// For multiple Firestore databases, specify which one to use
// If you have multiple Firestore instances, set VITE_FIRESTORE_DATABASE_ID in .env
// Example: "default" for the Delhi database
let firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID as string | undefined;

// CRITICAL: Filter out invalid values
if (firestoreDatabaseId === '(default)' || firestoreDatabaseId === 'undefined' || firestoreDatabaseId === '') {
  firestoreDatabaseId = undefined;
}

// Add validation
if (!firebaseConfig.projectId) {
  console.error('❌ CRITICAL: Firebase projectId is missing! Check your .env file.');
}

export const firestore = firestoreDatabaseId 
  ? getFirestore(firebaseApp, firestoreDatabaseId)
  : getFirestore(firebaseApp);

export const functions = getFunctions(firebaseApp);

console.log('🔥 Firestore initialized');
console.log('📍 Project:', firebaseConfig.projectId);
console.log('🗄️  Database ID:', firestoreDatabaseId || '(default)');
console.log('🔑 Auth initialized:', !!auth);

// Enable Firestore debug logging in development
if (import.meta.env.DEV) {
  console.log('🐛 Firestore debug mode enabled');
}

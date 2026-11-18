
import { initializeApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDUIJNxAcFZyfg9ZysjyAomuz6_8N0Y20g",
  authDomain: "l-oreal-capitol.firebaseapp.com",
  databaseURL: "https://l-oreal-capitol-default-rtdb.firebaseio.com",
  projectId: "l-oreal-capitol",
  storageBucket: "l-oreal-capitol.firebasestorage.app",
  messagingSenderId: "878865953326",
  appId: "1:878865953326:web:a3900faeaca3f38536a5bf",
  measurementId: "G-FZ3KHHLNSD"
};

/**
 * Mode test local : `EXPO_PUBLIC_USE_EMULATOR=1` redirige TOUTES les lectures/écritures
 * (SDK + REST) vers l'émulateur Firebase local. La base de production n'est jamais touchée.
 * Lancer avec : npm run dev:test
 */
export const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_EMULATOR === '1';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 9000;

export const DATABASE_URL = USE_EMULATOR
  ? `http://${EMULATOR_HOST}:${EMULATOR_PORT}`
  : firebaseConfig.databaseURL;

// Initialize Firebase
// En mode test, le SDK utilise le namespace par défaut de l'émulateur ("fake-server"),
// le même que celui des requêtes REST sans paramètre ?ns= → SDK et REST voient les mêmes données.
const app = initializeApp(
  USE_EMULATOR ? { ...firebaseConfig, databaseURL: 'https://fake-server.firebaseio.com' } : firebaseConfig
);
export const db = getDatabase(app);

if (USE_EMULATOR) {
  connectDatabaseEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
  // eslint-disable-next-line no-console
  console.log('[Capitol] Mode TEST — émulateur Firebase local', DATABASE_URL);
}

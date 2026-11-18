import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

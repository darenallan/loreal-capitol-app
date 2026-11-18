const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyDUIJNxAcFZyfg9ZysjyAomuz6_8N0Y20g",
  authDomain: "l-oreal-capitol.firebaseapp.com",
  databaseURL: "https://l-oreal-capitol-default-rtdb.firebaseio.com",
  projectId: "l-oreal-capitol",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function testFetchSpeed() {
  console.log('--- 1. Testing HTTPS REST fetch speed ---');
  const t0 = Date.now();
  try {
    const res = await fetch('https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json');
    const data = await res.json();
    const duration = Date.now() - t0;
    const count = Object.keys(data || {}).length;
    console.log(`HTTPS REST fetch: OK in ${duration}ms! Found ${count} products.`);
  } catch (err) {
    console.error('HTTPS REST fetch failed:', err);
  }

  console.log('\n--- 2. Testing Firebase SDK get() speed ---');
  const t1 = Date.now();
  try {
    const snapshot = await get(ref(db, 'products'));
    const duration = Date.now() - t1;
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    console.log(`Firebase SDK get: OK in ${duration}ms! Found ${count} products.`);
  } catch (err) {
    console.error('Firebase SDK get failed:', err);
  }
}

testFetchSpeed().then(() => process.exit(0));

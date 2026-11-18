// ⚠ ÉCRIT EN PRODUCTION et ÉCRASE tous les utilisateurs (codes compris).
// Garde-fou : ne s'exécute que si CONFIRM_PROD=oui est défini explicitement.
if (process.env.CONFIRM_PROD !== 'oui') {
  console.error('Refus : script de production. Relancer avec CONFIRM_PROD=oui si c\'est vraiment voulu.');
  process.exit(1);
}
const https = require('https');

const updatedUsers = {
  "-OzH2J5Ta0if4mtqCVIn": { "name": "Boss", "pin": "B000000.", "role": "admin", "store": "all" },
  "-OzgtrmtbVqRYW3WSBvH": { "name": "Yaya", "pin": "Y000000.", "role": "caissiere", "store": "falaise" },
  "-OzgtrmtbVqRYW3WSBvI": { "name": "Maya", "pin": "M000000.", "role": "employe", "store": "falaise" },
  "-OzgtrmtbVqRYW3WSBvK": { "name": "Angèle", "pin": "A000000.", "role": "employe", "store": "tougou" },
  "-OzgtrmtbVqRYW3WSBvL": { "name": "Ivy", "pin": "I000000.", "role": "employe", "store": "tougou" },
  "-OzktFLFNwCPBJjc88uv": { "name": "Esther", "pin": "E000000.", "role": "admin", "store": "tougou" }
};

const data = JSON.stringify(updatedUsers);

const options = {
  hostname: 'l-oreal-capitol-default-rtdb.firebaseio.com',
  port: 443,
  path: '/users.json',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(data);
req.end();

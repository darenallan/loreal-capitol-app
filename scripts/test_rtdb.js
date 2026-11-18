const https = require('https');

function testUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), rawLength: data.length });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 200), error: e.message });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Testing Firebase REST endpoints...');
  try {
    const productsShallow = await testUrl('https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json?shallow=true');
    console.log('Products shallow:', productsShallow.status, typeof productsShallow.data === 'object' ? Object.keys(productsShallow.data || {}).length : productsShallow);

    const arrivagesShallow = await testUrl('https://l-oreal-capitol-default-rtdb.firebaseio.com/arrivages.json?shallow=true');
    console.log('Arrivages shallow:', arrivagesShallow.status, typeof arrivagesShallow.data === 'object' ? Object.keys(arrivagesShallow.data || {}).length : arrivagesShallow);
    
    // Check full products size
    const productsFull = await testUrl('https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json');
    console.log('Products full payload size bytes:', productsFull.rawLength);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

main();

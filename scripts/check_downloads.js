const fs = require('fs');
const path = require('path');

const downloadDir = 'C:\\Users\\natakwe pangop marc\\Downloads';
try {
  const files = fs.readdirSync(downloadDir);
  const lorealFiles = files.filter(f => f.toLowerCase().includes('loreal') || f.toLowerCase().includes('stock') || f.endsWith('.csv') || f.endsWith('.xlsx'));
  console.log('Matching files in Downloads:');
  for (const f of lorealFiles) {
    const stat = fs.statSync(path.join(downloadDir, f));
    console.log(`${f} | ${stat.size} bytes | ${stat.mtime.toISOString()}`);
  }
} catch (e) {
  console.error('Error reading downloads:', e.message);
}

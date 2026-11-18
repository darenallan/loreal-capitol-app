const fs = require('fs');

try {
  const appJsCode = fs.readFileSync('./website/app.js', 'utf8');
  // Check if app.js parses without syntax error
  new Function(appJsCode);
  console.log('SUCCESS: website/app.js has valid JavaScript syntax!');
} catch (e) {
  console.error('ERROR in website/app.js:', e.message);
  process.exit(1);
}

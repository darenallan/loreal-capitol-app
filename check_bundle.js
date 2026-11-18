const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'dist', '_expo', 'static', 'js', 'web');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  if (content.includes('Administrateur')) {
    console.log(file + ' contains Administrateur');
    if (content.includes('Administrateur Général') || content.includes('Administrateur G\\u00e9n\\u00e9ral') || content.includes('Administrateur G')) {
      console.log('AND it contains the Boss text!');
    } else {
      console.log('But NO Boss text.');
    }
  }
}

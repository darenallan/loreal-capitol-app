const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') searchDir(full, pattern);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          console.log(`${path.relative('.', full)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

console.log('--- ref(db, ...) occurrences ---');
searchDir('src', /ref\(db,\s*['"`](products|sales|arrivages|transfers|advances)/);

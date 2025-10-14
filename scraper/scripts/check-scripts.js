const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at', indexPath);
    process.exit(2);
}

const html = fs.readFileSync(indexPath, 'utf8');
const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
let m;
const scripts = [];
while ((m = scriptRegex.exec(html))) {
    scripts.push(m[1]);
}

const results = [];
for (const s of scripts) {
    if (/^https?:\/\//i.test(s)) {
        results.push({ src: s, type: 'cdn', exists: true });
        continue;
    }
    // ignore data: or other protocols
    if (/^[a-z]+:/i.test(s)) {
        results.push({ src: s, type: 'other', exists: true });
        continue;
    }
    const p = path.join(root, s.replace(/\//g, path.sep));
    const exists = fs.existsSync(p);
    results.push({ src: s, type: 'local', path: p, exists });
}

const missing = results.filter(r => r.type === 'local' && !r.exists);

console.log('Checked', results.length, 'script tags.');
if (missing.length === 0) {
    console.log('All local script files exist.');
    process.exit(0);
}

console.error('Missing local script files:');
missing.forEach(m => console.error(' -', m.src, '->', m.path));
process.exit(1);

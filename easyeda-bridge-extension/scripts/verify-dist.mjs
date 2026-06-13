import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const required = ['dist/index.js', 'extension.json', 'images/logo.png'];

let ok = true;
for (const f of required) {
  const p = join(__dirname, '..', f);
  if (!existsSync(p)) {
    console.error(`MISSING: ${f}`);
    ok = false;
  } else {
    const size = statSync(p).size;
    if (size === 0) {
      console.error(`EMPTY FILE: ${f}`);
      ok = false;
    } else {
      console.log(`OK: ${f} (${size} bytes)`);
    }
  }
}

const manifestPath = join(__dirname, '..', 'extension.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entry = typeof manifest.entry === 'string' ? manifest.entry : '';
const normalizedEntry = entry.replace(/^\.\//, '');
const entryCandidates = [normalizedEntry, `${normalizedEntry}.js`];
if (!entry || !entryCandidates.some((candidate) => existsSync(join(__dirname, '..', candidate)))) {
  console.error(`INVALID ENTRY: ${entry || '<missing>'}`);
  ok = false;
} else {
  console.log(`OK: manifest entry (${entry})`);
}

if (!ok) process.exit(1);
console.log('\nDist verification successful ✓');

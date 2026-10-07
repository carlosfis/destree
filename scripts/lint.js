// Lint mínimo sin dependencias: comprueba sintaxis de todos los .js del proyecto con `node --check`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'legacy', 'data', '.git']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

let failed = 0;
for (const file of walk(ROOT, [])) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(String(err.stderr || err.message));
  }
}
console.log(failed ? `lint: ${failed} archivo(s) con errores` : 'lint: OK');
process.exit(failed ? 1 : 0);

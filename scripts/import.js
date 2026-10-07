// Importa un respaldo JSON (v1/v2/v3) en una página: node scripts/import.js <archivo.json> [pageId]
import fs from 'node:fs';
import { openReady, DEFAULT_PAGE_ID } from '../server/db/sqlite.js';
import { importDocument } from '../server/lib/pages.js';
const [file, pageId = DEFAULT_PAGE_ID] = process.argv.slice(2);
if (!file) { console.error('Uso: node scripts/import.js <archivo.json> [pageId]'); process.exit(1); }
const db = openReady();
const res = importDocument(db, pageId, JSON.parse(fs.readFileSync(file, 'utf8')));
db.close();
console.log(`import: ${file} → ${pageId} · ${res.nodes} nodos, ${res.edges} aristas · versión ${res.version}`);

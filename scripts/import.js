// Importa un respaldo JSON (v1/v2/v3) en una página: node scripts/import.js <archivo.json> [pageId]
import fs from 'node:fs';
import { openReady, DEFAULT_PAGE_ID } from '../server/db/sqlite.js';
import path from 'node:path';
import { importDocument } from '../server/lib/pages.js';
import { ingestDataUrls } from '../server/lib/images.js';
import { config } from '../server/config.js';
const [file, pageId = DEFAULT_PAGE_ID] = process.argv.slice(2);
if (!file) { console.error('Uso: node scripts/import.js <archivo.json> [pageId]'); process.exit(1); }
const db = openReady();
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const images = await ingestDataUrls(db, config.uploadsDir || path.join(path.dirname(config.dbPath), 'uploads'), raw); // F5
const res = importDocument(db, pageId, raw);
db.close();
console.log(`import: ${file} → ${pageId} · ${res.nodes} nodos, ${res.edges} aristas, ${images} imágenes · versión ${res.version}`);

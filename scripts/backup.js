// F6b: respaldo manual a data/backups (db + uploads) sin pasar por la API: node scripts/backup.js
import path from 'node:path';
import { openReady } from '../server/db/sqlite.js';
import { createBackup } from '../server/lib/backup.js';
import { config } from '../server/config.js';
const db = openReady(config.dbPath);
const dataDir = path.dirname(config.dbPath);
const b = await createBackup(db, { backupsDir: config.backupsDir || path.join(dataDir, 'backups'), uploadsDir: config.uploadsDir || path.join(dataDir, 'uploads'), kind: 'manual' });
db.close();
console.log(`backup: ${b.filename} · ${(b.bytes / 1024).toFixed(1)} KB · sha256 ${b.sha256.slice(0, 12)}…`);

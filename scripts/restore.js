// F6b: restaura un respaldo tar.gz (db + uploads) con el servidor PARADO: node scripts/restore.js data/backups/destree-<ts>.tar.gz
import path from 'node:path';
import { restoreBackup } from '../server/lib/backup.js';
import { config } from '../server/config.js';
const [file] = process.argv.slice(2);
if (!file) { console.error('Uso: node scripts/restore.js <respaldo.tar.gz>'); process.exit(1); }
try {
  const r = restoreBackup(path.resolve(file), { dbPath: config.dbPath, uploadsDir: config.uploadsDir || path.join(path.dirname(config.dbPath), 'uploads') });
  console.log(`restore: ${file} → ${r.dbPath} (+ ${r.uploadsDir}). Lo anterior quedó en ${r.previous}. Arranca el servidor y, si todo va bien, borra esa carpeta.`);
} catch (err) { console.error('restore: ' + err.message); process.exit(1); }

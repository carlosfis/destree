import path from 'node:path';
import fs from 'node:fs';
const ROOT = path.resolve(import.meta.dirname, '..');
// Carga .env mínima (sin dependencia): KEY=VALUE, ignora comentarios. Las variables ya definidas mandan.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
export const config = {
  root: ROOT,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '127.0.0.1',
  dbPath: process.env.DATABASE_PATH || path.join(ROOT, 'data', 'destree.db'),
  clientDir: path.join(ROOT, 'client'),
  schemaDir: path.join(ROOT, 'schema'),
  uploadsDir: process.env.UPLOADS_DIR || null, // F5: por defecto junto a la BD (data/uploads)
  backupsDir: process.env.BACKUPS_DIR || null, // F6b: por defecto data/backups
  backupKeep: Math.max(1, Number(process.env.BACKUP_KEEP) || 10), // F6b: programados conservados
  backupCron: process.env.BACKUP_CRON ?? '', // F6b: p. ej. "30 3 * * *" (vacío = sin programación)
  versionsKeep: Math.max(1, Number(process.env.VERSIONS_KEEP) || 50), // F6a: versiones auto conservadas por página
  versionsCoalesceMs: Math.max(0, Number(process.env.VERSIONS_COALESCE_MIN ?? 5) * 60e3), // F6a: autos del mismo usuario se funden en esta ventana
  trustProxy: /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || ''), // detrás de proxy TLS: cookie Secure + X-Forwarded-*
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
};

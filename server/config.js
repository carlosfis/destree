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
  trustProxy: /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || ''), // detrás de proxy TLS: cookie Secure + X-Forwarded-*
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
};

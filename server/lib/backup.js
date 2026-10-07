// F6b: respaldos: copia consistente de SQLite (node:sqlite backup) + tar.gz con uploads → backupsDir; retención; cron mínimo; lock del servidor.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { backup as sqliteBackup } from 'node:sqlite';
import { ulid, nowIso } from './ids.js';
import { HttpError } from './pages.js';
import { config } from '../config.js';

export const DB_NAME = 'destree.db';
const pub = r => ({ id: r.id, filename: r.filename, bytes: r.bytes, sha256: r.sha256, kind: r.kind, status: r.status, error: r.error, createdBy: r.created_by, createdAt: r.created_at });
export const sha256File = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** Crea `<backupsDir>/destree-<ts>.tar.gz` con destree.db (copia online) + uploads/. Registra en `backups`. */
export async function createBackup(db, { backupsDir, uploadsDir, kind = 'manual', createdBy = null, keep = config.backupKeep }) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = nowIso().replace(/[:.]/g, '-'), filename = `destree-${stamp}.tar.gz`, out = path.join(backupsDir, filename);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-bk-'));
  const id = ulid();
  db.prepare('INSERT INTO backups (id, filename, kind, status, created_by) VALUES (?, ?, ?, ?, ?)').run(id, filename, kind, 'pending', createdBy);
  try {
    await sqliteBackup(db, path.join(work, DB_NAME));
    if (uploadsDir && fs.existsSync(uploadsDir)) fs.cpSync(uploadsDir, path.join(work, 'uploads'), { recursive: true }); else fs.mkdirSync(path.join(work, 'uploads'));
    fs.writeFileSync(path.join(work, 'MANIFEST.json'), JSON.stringify({ app: 'destree', createdAt: nowIso(), kind, db: DB_NAME, uploads: 'uploads/' }, null, 2));
    execFileSync('tar', ['-czf', out, '-C', work, DB_NAME, 'uploads', 'MANIFEST.json']);
    const bytes = fs.statSync(out).size, hash = sha256File(out);
    db.prepare("UPDATE backups SET status = 'ok', bytes = ?, sha256 = ? WHERE id = ?").run(bytes, hash, id);
    applyBackupRetention(db, backupsDir, keep);
    return pub(db.prepare('SELECT * FROM backups WHERE id = ?').get(id));
  } catch (err) {
    db.prepare("UPDATE backups SET status = 'error', error = ? WHERE id = ?").run(String(err.message).slice(0, 500), id);
    fs.rmSync(out, { force: true });
    throw err;
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
/** Conserva los últimos `keep` programados (los manuales no se purgan). */
export function applyBackupRetention(db, backupsDir, keep = config.backupKeep) {
  const rows = db.prepare("SELECT * FROM backups WHERE kind = 'scheduled' AND status = 'ok' ORDER BY created_at DESC").all();
  for (const r of rows.slice(keep)) deleteBackup(db, backupsDir, r.id);
  return Math.max(0, rows.length - keep);
}
export const listBackups = db => db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all().map(pub);
export function getBackup(db, id) { const r = db.prepare('SELECT * FROM backups WHERE id = ?').get(id); if (!r) throw new HttpError(404, 'Respaldo no encontrado'); return r; }
export function deleteBackup(db, backupsDir, id) {
  const r = getBackup(db, id);
  fs.rmSync(path.join(backupsDir, r.filename), { force: true });
  db.prepare('DELETE FROM backups WHERE id = ?').run(id);
  return pub(r);
}

// --- Cron mínimo: "m h dom mon dow" con *, n, a-b, */n, listas. ---
function matchField(expr, value, min) {
  return String(expr).split(',').some(part => {
    const m = part.match(/^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/); if (!m) return false;
    const step = m[3] ? Number(m[3]) : 1;
    const lo = m[1] === '*' ? min : Number(m[1]), hi = m[2] ? Number(m[2]) : (m[1] === '*' ? Infinity : lo);
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}
export function cronMatches(expr, date = new Date()) {
  const f = String(expr || '').trim().split(/\s+/); if (f.length !== 5) return false;
  return matchField(f[0], date.getMinutes(), 0) && matchField(f[1], date.getHours(), 0) && matchField(f[2], date.getDate(), 1) && matchField(f[3], date.getMonth() + 1, 1) && matchField(f[4], date.getDay(), 0);
}
/** Comprueba cada minuto; ejecuta `run()` cuando coincide (una vez por minuto). Devuelve función para parar. */
export function scheduleBackups(expr, run, log = () => {}) {
  if (!expr) return () => {};
  let last = '';
  const timer = setInterval(() => {
    const now = new Date(), key = now.toISOString().slice(0, 16);
    if (key === last || !cronMatches(expr, now)) return;
    last = key; Promise.resolve().then(run).catch(err => log(err));
  }, 30e3);
  timer.unref();
  return () => clearInterval(timer);
}

/* --- Lock del servidor (scripts/restore.js exige servidor parado) --- */
export const lockPath = dbPath => path.join(path.dirname(dbPath), '.server.lock');
export function acquireLock(dbPath) { if (dbPath === ':memory:') return () => {}; const p = lockPath(dbPath); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, String(process.pid)); return () => fs.rmSync(p, { force: true }); }
export function serverRunning(dbPath) {
  const p = lockPath(dbPath); if (!fs.existsSync(p)) return false;
  const pid = Number(fs.readFileSync(p, 'utf8')); if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
/** Restaura un tar.gz en `dataDir` (db + uploads). Mueve lo actual a `restore-prev-<ts>/`. Devuelve rutas. */
export function restoreBackup(file, { dbPath, uploadsDir }) {
  if (!fs.existsSync(file)) throw new Error(`No existe ${file}`);
  if (serverRunning(dbPath)) throw new Error('El servidor está en marcha: detenlo antes de restaurar');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-rs-'));
  try {
    execFileSync('tar', ['-xzf', file, '-C', work]);
    if (!fs.existsSync(path.join(work, DB_NAME))) throw new Error('El archivo no contiene destree.db');
    const dataDir = path.dirname(dbPath), prev = path.join(dataDir, `restore-prev-${nowIso().replace(/[:.]/g, '-')}`);
    fs.mkdirSync(prev, { recursive: true });
    for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) if (fs.existsSync(f)) fs.renameSync(f, path.join(prev, path.basename(f)));
    if (fs.existsSync(uploadsDir)) fs.renameSync(uploadsDir, path.join(prev, 'uploads'));
    fs.copyFileSync(path.join(work, DB_NAME), dbPath);
    if (fs.existsSync(path.join(work, 'uploads'))) fs.cpSync(path.join(work, 'uploads'), uploadsDir, { recursive: true });
    return { dbPath, uploadsDir, previous: prev };
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}

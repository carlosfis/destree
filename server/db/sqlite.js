// SQLite vía node:sqlite (Node ≥22.13, sin binarios nativos). WAL + foreign_keys.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { ulid, nowIso } from '../lib/ids.js';
import { defaultTags, defaultBranchTypes } from '../lib/normalize.js';

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');
export const DEFAULT_ORG_ID = 'org_default';
export const DEFAULT_PAGE_ID = 'p_default';

export function openDb(file = config.dbPath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}
/** Ejecuta fn dentro de BEGIN IMMEDIATE … COMMIT; ROLLBACK si lanza. Devuelve el resultado de fn. */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const out = fn(); db.exec('COMMIT'); return out; } catch (err) { try { db.exec('ROLLBACK'); } catch { /* ya cerrada */ } throw err; }
}
/** Aplica server/db/migrations/NNN_*.sql pendientes en orden. Devuelve los nombres aplicados. */
export function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    transaction(db, () => { db.exec(sql); db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(f, nowIso()); });
    applied.push(f);
  }
  return applied;
}
/** Org y página por defecto (idempotente). Devuelve el id de la página principal. */
export function seed(db) {
  db.prepare('INSERT OR IGNORE INTO orgs (id, name, slug) VALUES (?, ?, ?)').run(DEFAULT_ORG_ID, 'Mi organización', 'default');
  const page = db.prepare('SELECT id FROM pages WHERE org_id = ? AND status = ? ORDER BY created_at LIMIT 1').get(DEFAULT_ORG_ID, 'active');
  if (page) return page.id;
  transaction(db, () => {
    db.prepare('INSERT INTO pages (id, org_id, name, description) VALUES (?, ?, ?, ?)').run(DEFAULT_PAGE_ID, DEFAULT_ORG_ID, 'Árbol principal', 'Página creada automáticamente.');
    defaultTags().forEach((t, i) => db.prepare('INSERT INTO tags (id, page_id, name, color, position) VALUES (?, ?, ?, ?, ?)').run(t.id, DEFAULT_PAGE_ID, t.name, t.color, i));
    defaultBranchTypes().forEach((t, i) => db.prepare('INSERT INTO branch_types (id, page_id, name, color, position) VALUES (?, ?, ?, ?, ?)').run(t.id, DEFAULT_PAGE_ID, t.name, t.color, i));
  });
  return DEFAULT_PAGE_ID;
}
export function openReady(file) { const db = openDb(file); migrate(db); seed(db); return db; }
export { ulid };

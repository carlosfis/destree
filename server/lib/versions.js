// F6a: versiones de página: snapshot gzip del page-document, coalescencia de autos (5 min), retención, diff y restore.
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { transaction } from '../db/sqlite.js';
import { ulid, nowIso } from './ids.js';
import { getDocument, saveDocument, pageMeta, HttpError } from './pages.js';
import { filterDocumentForUser } from './visibility.js';
import { config } from '../config.js';

export const REASONS = ['auto', 'manual', 'restore', 'import', 'archive', 'delete'];
const pub = r => ({ id: r.id, number: r.number, label: r.label, reason: r.reason, hash: r.hash, size: r.size, createdBy: r.created_by, createdByName: r.created_by_name ?? undefined, createdAt: r.created_at });
const latestRow = (db, pageId) => db.prepare('SELECT * FROM page_versions WHERE page_id = ? ORDER BY number DESC LIMIT 1').get(pageId);

/** Documento canónico para snapshot (sin `refs`) + hash. */
export function snapshotOf(db, pageId) {
  const { refs, ...full } = getDocument(db, pageId);
  const { version, updatedAt, createdBy, ...page } = full.page; // campos volátiles fuera del hash
  const doc = { ...full, page };
  const json = JSON.stringify(doc);
  return { doc, json, hash: createHash('sha256').update(json).digest('hex'), imageIds: [...new Set(doc.nodes.flatMap(n => [n.imageId, n.thumbIconId]).filter(Boolean))] };
}
/** Crea (o coalesce) una versión. `auto`: omite si el hash no cambió; sustituye la última si es auto del mismo usuario en < coalesceMs. Devuelve la versión o null. */
export function createVersion(db, pageId, { reason = 'auto', label = '', userId = null, coalesceMs = config.versionsCoalesceMs } = {}) {
  if (!REASONS.includes(reason)) throw new HttpError(400, 'Motivo de versión desconocido');
  return transaction(db, () => {
    const snap = snapshotOf(db, pageId), last = latestRow(db, pageId), now = nowIso();
    if (reason === 'auto' && last && last.hash === snap.hash) return null;
    const gz = gzipSync(snap.json), imgs = JSON.stringify(snap.imageIds);
    if (reason === 'auto' && last && last.reason === 'auto' && last.created_by === userId && Date.parse(now) - Date.parse(last.created_at) < coalesceMs) {
      db.prepare('UPDATE page_versions SET snapshot_gz = ?, hash = ?, size = ?, image_ids_json = ?, created_at = ? WHERE id = ?').run(gz, snap.hash, snap.json.length, imgs, now, last.id);
      return pub({ ...last, hash: snap.hash, size: snap.json.length, created_at: now });
    }
    const number = (last ? last.number : 0) + 1, id = ulid();
    db.prepare('INSERT INTO page_versions (id, page_id, number, label, reason, snapshot_gz, hash, size, image_ids_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, pageId, number, String(label || '').slice(0, 120), reason, gz, snap.hash, snap.json.length, imgs, userId, now);
    applyRetention(db, pageId);
    return pub(db.prepare('SELECT * FROM page_versions WHERE id = ?').get(id));
  });
}
/** Conserva las últimas `keep` versiones auto; nunca purga manual/restore/import/archive/delete ni páginas archived/deleted. */
export function applyRetention(db, pageId, keep = config.versionsKeep) {
  const p = db.prepare('SELECT status FROM pages WHERE id = ?').get(pageId);
  if (!p || p.status !== 'active') return 0;
  const autos = db.prepare("SELECT id FROM page_versions WHERE page_id = ? AND reason = 'auto' ORDER BY number DESC").all(pageId);
  const del = db.prepare('DELETE FROM page_versions WHERE id = ?');
  for (const r of autos.slice(keep)) del.run(r.id);
  return Math.max(0, autos.length - keep);
}
export function listVersions(db, pageId) {
  return db.prepare(`SELECT v.id, v.number, v.label, v.reason, v.hash, v.size, v.created_by, v.created_at, COALESCE(NULLIF(u.name, ''), u.email) AS created_by_name
    FROM page_versions v LEFT JOIN users u ON u.id = v.created_by WHERE v.page_id = ? ORDER BY v.number DESC`).all(pageId).map(pub);
}
/** { version, document }; `ctx` aplica visibilidad (designer). */
export function getVersion(db, pageId, number, ctx = null) {
  const r = db.prepare('SELECT * FROM page_versions WHERE page_id = ? AND number = ?').get(pageId, Number(number));
  if (!r) throw new HttpError(404, 'Versión no encontrada');
  const document = filterDocumentForUser(JSON.parse(gunzipSync(r.snapshot_gz).toString('utf8')), ctx);
  return { version: pub(r), document };
}
const NODE_FIELDS = ['type', 'name', 'description', 'imageId', 'geo', 'thumbIconId', 'tags', 'owner', 'staff', 'ownerUserId', 'parentId', 'branchTypeId', 'notes', 'docs', 'visibility', 'status', 'cellIds', 'assigneeIds'];
/** Diferencias entre dos documentos: nodos +/−/~ (campos, sin posición), movidos, aristas +/−, tags/tipos. */
export function diffDocuments(a, b) {
  const A = new Map(a.nodes.map(n => [n.id, n])), B = new Map(b.nodes.map(n => [n.id, n]));
  const added = [], removed = [], changed = [], moved = [];
  for (const [id, n] of B) if (!A.has(id)) added.push({ id, name: n.name, type: n.type });
  for (const [id, n] of A) {
    if (!B.has(id)) { removed.push({ id, name: n.name, type: n.type }); continue; }
    const m = B.get(id), fields = NODE_FIELDS.filter(f => JSON.stringify(n[f] ?? null) !== JSON.stringify(m[f] ?? null));
    if (fields.length) changed.push({ id, name: m.name, fields });
    else if (['x', 'y', 'w', 'h'].some(f => n[f] !== m[f])) moved.push(id);
  }
  const key = e => `${e.kind}|${e.from}|${e.to}`;
  const ea = new Set(a.edges.map(key)), eb = new Set(b.edges.map(key));
  const edges = { added: b.edges.filter(e => !ea.has(key(e))).map(key), removed: a.edges.filter(e => !eb.has(key(e))).map(key) };
  const lists = name => ({ added: b[name].filter(t => !a[name].some(x => x.id === t.id)).map(t => t.name), removed: a[name].filter(t => !b[name].some(x => x.id === t.id)).map(t => t.name) });
  return { nodes: { added, removed, changed, moved: moved.length }, edges, tags: lists('tags'), branchTypes: lists('branchTypes'), same: !added.length && !removed.length && !changed.length && !moved.length && !edges.added.length && !edges.removed.length };
}
export function diffVersions(db, pageId, a, b, ctx = null) {
  const A = a === 'current' ? { version: null, document: filterDocumentForUser(snapshotOf(db, pageId).doc, ctx) } : getVersion(db, pageId, a, ctx);
  const B = b === 'current' ? { version: null, document: filterDocumentForUser(snapshotOf(db, pageId).doc, ctx) } : getVersion(db, pageId, b, ctx);
  return { from: A.version, to: B.version, diff: diffDocuments(A.document, B.document) };
}
/** Restaura el contenido de la versión `number` (metadatos de página intactos) y crea una versión `restore`. */
export function restoreVersion(db, pageId, number, userId = null) {
  return transaction(db, () => {
    const meta = pageMeta(db, pageId);
    if (meta.status !== 'active') throw new HttpError(409, 'La página no está activa');
    const { version, document } = getVersion(db, pageId, number);
    const { page, ...content } = document;
    const res = saveDocument(db, pageId, content, null);
    const v = createVersion(db, pageId, { reason: 'restore', label: `Restaurada desde v${version.number}`, userId });
    return { ...res, restoredFrom: version.number, version: res.version, snapshot: v };
  });
}
/** Página borrada → activa: si el contenido difiere de la última versión, la repone. */
export function restoreLatestIfDiverged(db, pageId, userId = null) {
  const last = latestRow(db, pageId);
  if (!last) return null;
  if (snapshotOf(db, pageId).hash === last.hash) return null;
  const { page, ...content } = JSON.parse(gunzipSync(last.snapshot_gz).toString('utf8'));
  saveDocument(db, pageId, content, null);
  return last.number;
}

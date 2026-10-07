// F5: imágenes: magic bytes → sharp → webp (≤1600) + thumb 320×180; sha256 dedupe; visibilidad; huérfanas; migración de dataURLs.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { DEFAULT_ORG_ID } from '../db/sqlite.js';
import { ulid, nowIso } from './ids.js';
import { HttpError, getDocument } from './pages.js';
import { pageVisibleFor, needsFilter } from './visibility.js';

export const MAX_BYTES = 5 * 1024 * 1024;
const MAX_W = 1600, THUMB = { w: 320, h: 180 };

/** Tipo real por magic bytes: png | jpeg | webp | svg | null. SVG se rasteriza (nunca se sirve como SVG). */
export function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  const head = buf.toString('utf8', 0, Math.min(buf.length, 512)).replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'svg';
  return null;
}
export const sha256 = buf => createHash('sha256').update(buf).digest('hex');
export const filesOf = (dir, orgId, id) => ({ full: path.join(dir, orgId, `${id}.webp`), thumb: path.join(dir, orgId, `${id}.thumb.webp`) });
export const publicImage = r => ({ id: r.id, kind: r.kind, filename: r.filename, mime: r.mime, width: r.width, height: r.height, bytes: r.bytes, sha256: r.sha256, createdBy: r.created_by, createdAt: r.created_at });

/** Guarda una imagen (buffer original). Devuelve la fila (reutiliza si el sha256 ya existe en la org). */
export async function storeImage(db, dir, { buffer, orgId = DEFAULT_ORG_ID, kind = 'node', createdBy = null, filename = '' }) {
  if (!buffer || !buffer.length) throw new HttpError(400, 'Archivo vacío');
  if (buffer.length > MAX_BYTES) throw new HttpError(413, 'Imagen demasiado grande (máx. 5 MB)');
  const type = sniff(buffer);
  if (!type) throw new HttpError(415, 'Formato no admitido: solo PNG, JPEG, WebP o SVG');
  const hash = sha256(buffer);
  const dup = db.prepare('SELECT * FROM images WHERE org_id = ? AND sha256 = ?').get(orgId, hash);
  if (dup) return publicImage(dup);
  let img;
  try {
    const base = sharp(buffer, { limitInputPixels: 40e6, ...(type === 'svg' ? { density: 144 } : {}) }).rotate();
    const full = await base.clone().resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await base.clone().resize({ width: THUMB.w, height: THUMB.h, fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toBuffer();
    img = { full, thumb };
  } catch (err) { throw new HttpError(415, 'La imagen no se pudo procesar: ' + err.message); }
  const id = ulid(), f = filesOf(dir, orgId, id);
  fs.mkdirSync(path.dirname(f.full), { recursive: true });
  fs.writeFileSync(f.full, img.full.data); fs.writeFileSync(f.thumb, img.thumb);
  db.prepare('INSERT INTO images (id, org_id, kind, filename, mime, width, height, bytes, sha256, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, orgId, kind, String(filename || '').slice(0, 200), 'image/webp', img.full.info.width, img.full.info.height, img.full.data.length, hash, createdBy);
  return publicImage(db.prepare('SELECT * FROM images WHERE id = ?').get(id));
}
export function getImage(db, id) { const r = db.prepare('SELECT * FROM images WHERE id = ?').get(id); if (!r) throw new HttpError(404, 'Imagen no encontrada'); return r; }
/** Usos: nodos y portadas de página. */
export function imageUsage(db, id) {
  return { nodes: db.prepare('SELECT page_id AS pageId, id AS nodeId FROM nodes WHERE image_id = ?').all(id), pages: db.prepare('SELECT id FROM pages WHERE cover_image_id = ?').all(id).map(r => r.id) };
}
/** Regla 5: designer solo si ve algún nodo/página dueño; sin usos, solo quien la subió. admin/head siempre. */
export function imageVisibleFor(db, image, ctx) {
  if (!ctx) return false;
  if (!needsFilter(ctx)) return true;
  const use = imageUsage(db, image.id);
  for (const pid of use.pages) { const p = db.prepare('SELECT * FROM pages WHERE id = ?').get(pid); if (p && p.status !== 'deleted' && pageVisibleFor(db, p, ctx)) return true; }
  const byPage = new Map(); for (const u of use.nodes) { if (!byPage.has(u.pageId)) byPage.set(u.pageId, new Set()); byPage.get(u.pageId).add(u.nodeId); }
  for (const [pid, ids] of byPage) {
    const p = db.prepare('SELECT status FROM pages WHERE id = ?').get(pid); if (!p || p.status === 'deleted') continue;
    try { if (getDocument(db, pid, ctx).nodes.some(n => ids.has(n.id))) return true; } catch { /* 403 → no visible */ }
  }
  return !use.nodes.length && !use.pages.length && image.created_by === ctx.userId;
}
export function deleteImage(db, dir, id) {
  const img = getImage(db, id);
  const use = imageUsage(db, id);
  if (use.nodes.length || use.pages.length) throw new HttpError(409, `La imagen está en uso (${use.nodes.length} card(s), ${use.pages.length} página(s))`);
  db.prepare('DELETE FROM images WHERE id = ?').run(id);
  const f = filesOf(dir, img.org_id, id); for (const p of [f.full, f.thumb]) fs.rmSync(p, { force: true });
  return publicImage(img);
}
/** Huérfanas: sin uso y con más de `olderThanMs` (24 h) de antigüedad. Devuelve ids borrados. */
export function purgeOrphans(db, dir, olderThanMs = 86400e3) {
  const limit = new Date(Date.now() - olderThanMs).toISOString();
  const rows = db.prepare(`SELECT id FROM images i WHERE created_at < ? AND NOT EXISTS (SELECT 1 FROM nodes n WHERE n.image_id = i.id) AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.cover_image_id = i.id)`).all(limit);
  for (const r of rows) deleteImage(db, dir, r.id);
  return rows.map(r => r.id);
}
const DATA_URL = /^data:(image\/[a-z+.-]+)?;base64,([A-Za-z0-9+/=\s]+)$/i;
/** Convierte `node.image` (dataURL) en `imageId` dentro del documento (import/PUT/migración). Devuelve cuántas convirtió. */
export async function ingestDataUrls(db, dir, doc, { orgId = DEFAULT_ORG_ID, createdBy = null } = {}) {
  let n = 0;
  for (const node of (doc && Array.isArray(doc.nodes)) ? doc.nodes : []) {
    if (typeof node.image !== 'string' || !node.image.startsWith('data:')) continue;
    const m = node.image.match(DATA_URL);
    try {
      if (!m) throw new HttpError(415, 'dataURL inválida');
      const img = await storeImage(db, dir, { buffer: Buffer.from(m[2].replace(/\s/g, ''), 'base64'), orgId, createdBy, filename: `${node.name || node.id}.legacy` });
      node.imageId = img.id; n++;
    } catch { /* imagen corrupta: se descarta */ }
    node.image = null;
  }
  return n;
}
/** Al arrancar: nodes.image_legacy → images + image_id. Idempotente. */
export async function migrateLegacyImages(db, dir) {
  const rows = db.prepare('SELECT page_id, id, name, image_legacy FROM nodes WHERE image_legacy IS NOT NULL').all();
  let n = 0;
  for (const r of rows) {
    const doc = { nodes: [{ id: r.id, name: r.name, image: r.image_legacy }] };
    await ingestDataUrls(db, dir, doc);
    db.prepare('UPDATE nodes SET image_id = COALESCE(?, image_id), image_legacy = NULL, updated_at = ? WHERE page_id = ? AND id = ?').run(doc.nodes[0].imageId || null, nowIso(), r.page_id, r.id);
    if (doc.nodes[0].imageId) n++;
  }
  return n;
}
/** Export portable: incrusta el webp como dataURL en `image` (y conserva imageId). */
export function embedImages(db, dir, doc) {
  for (const n of doc.nodes) {
    if (!n.imageId) continue;
    const img = db.prepare('SELECT org_id FROM images WHERE id = ?').get(n.imageId); if (!img) continue;
    try { n.image = 'data:image/webp;base64,' + fs.readFileSync(filesOf(dir, img.org_id, n.imageId).full).toString('base64'); } catch { /* archivo ausente */ }
  }
  return doc;
}

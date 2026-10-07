// Repositorio de páginas: documento completo (page-document v3) ⇄ tablas SQLite.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ORG_ID, transaction } from '../db/sqlite.js';
import { ulid, nowIso } from './ids.js';
import { normalizeDocument, defaultDocument } from './normalize.js';
import { filterDocumentForUser, pageVisibleFor, needsFilter } from './visibility.js';

export class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; Object.assign(this, extra); } }
const j = v => JSON.stringify(v);
const pj = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };

export const PAGE_STATUS = ['active', 'archived', 'deleted'];
const pageCells = (db, pageId) => db.prepare('SELECT cell_id FROM page_cells WHERE page_id = ? ORDER BY rowid').all(pageId).map(r => r.cell_id);
/** `ctx` (F3: { role, userId, cellIds }) filtra páginas no visibles para designer. F4a: `status` active (defecto) | archived | deleted | all (activas+archivadas). */
export function listPages(db, orgId = DEFAULT_ORG_ID, ctx = null, status = 'active') {
  const where = status === 'all' ? "p.status != 'deleted'" : 'p.status = ?';
  const rows = db.prepare(`SELECT p.id, p.name, p.description, p.visibility, p.status, p.version, p.updated_at AS updatedAt, p.created_at AS createdAt, p.archived_at AS archivedAt, p.deleted_at AS deletedAt,
      (SELECT COUNT(*) FROM nodes n WHERE n.page_id = p.id) AS nodeCount, (SELECT COUNT(*) FROM nodes n WHERE n.page_id = p.id AND n.parent_id IS NULL) AS rootCount
    FROM pages p WHERE p.org_id = ? AND ${where} ORDER BY p.created_at`).all(...(status === 'all' ? [orgId] : [orgId, PAGE_STATUS.includes(status) ? status : 'active']))
    .map(p => ({ ...p, cellIds: p.visibility === 'cells' ? pageCells(db, p.id) : [] }));
  return needsFilter(ctx) ? rows.filter(p => pageVisibleFor(db, p, ctx)) : rows;
}
const groupIds = (rows, key) => { const m = new Map(); for (const r of rows) { if (!m.has(r.node_id)) m.set(r.node_id, []); m.get(r.node_id).push(r[key]); } return m; };
export function pageMeta(db, pageId) {
  const p = db.prepare('SELECT id, name, description, visibility, status, version, created_by AS createdBy, updated_at AS updatedAt, archived_at AS archivedAt, deleted_at AS deletedAt, deleted_by AS deletedBy FROM pages WHERE id = ?').get(pageId);
  if (!p) throw new HttpError(404, 'Página no encontrada');
  return p;
}
/** Documento completo de la página (v3). F3: `ctx` aplica lib/visibility.js (designer) y añade `refs` (usuarios/células citados). */
export function getDocument(db, pageId, ctx = null) {
  const p = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
  if (!p) throw new HttpError(404, 'Página no encontrada');
  if (!pageVisibleFor(db, p, ctx)) throw new HttpError(403, 'Sin acceso a esta página');
  const cellsByNode = groupIds(db.prepare('SELECT node_id, cell_id FROM node_cells WHERE page_id = ? ORDER BY rowid').all(pageId), 'cell_id');
  const assigneesByNode = groupIds(db.prepare('SELECT node_id, user_id FROM node_assignees WHERE page_id = ? ORDER BY position').all(pageId), 'user_id');
  const tagsByNode = new Map();
  for (const r of db.prepare('SELECT node_id, tag_id FROM node_tags WHERE page_id = ? ORDER BY node_id, position').all(pageId)) {
    if (!tagsByNode.has(r.node_id)) tagsByNode.set(r.node_id, []); tagsByNode.get(r.node_id).push(r.tag_id);
  }
  const nodes = db.prepare('SELECT * FROM nodes WHERE page_id = ? ORDER BY position').all(pageId).map(n => ({
    id: n.id, type: n.type, name: n.name, description: n.description, image: n.image_legacy, imageId: n.image_id,
    tags: tagsByNode.get(n.id) || [], owner: n.owner_label, ownerUserId: n.owner_user_id, parentId: n.parent_id, branchTypeId: n.branch_type_id,
    x: n.x, y: n.y, w: n.w, h: n.h, demo: !!n.demo, notes: n.notes, docs: pj(n.docs_json, []), visibility: n.visibility, status: n.status,
    cellIds: cellsByNode.get(n.id) || [], assigneeIds: assigneesByNode.get(n.id) || [],
  }));
  const edges = db.prepare('SELECT id, kind, from_node_id AS "from", to_node_id AS "to", demo FROM edges WHERE page_id = ? ORDER BY position').all(pageId).map(e => ({ ...e, demo: !!e.demo }));
  const tags = db.prepare('SELECT id, name, color FROM tags WHERE page_id = ? ORDER BY position').all(pageId);
  const branchTypes = db.prepare('SELECT id, name, color FROM branch_types WHERE page_id = ? ORDER BY position').all(pageId);
  const page = { id: p.id, name: p.name, description: p.description, visibility: p.visibility, status: p.status, version: p.version, createdBy: p.created_by, updatedAt: p.updated_at, cellIds: p.visibility === 'cells' ? pageCells(db, p.id) : [] };
  const base = defaultDocument(page);
  const doc = filterDocumentForUser({ version: 3, page, nodes, edges, tags, branchTypes, settings: { ...base.settings, ...pj(p.settings_json, {}) }, camera: { ...base.camera, ...pj(p.camera_json, {}) } }, ctx);
  return { ...doc, refs: documentRefs(db, doc) };
}
/** Nombres de usuarios y células citados por el documento (para chips sin exponer el directorio). */
function documentRefs(db, doc) {
  const users = new Set(), cells = new Set();
  for (const n of doc.nodes) { if (n.ownerUserId) users.add(n.ownerUserId); n.assigneeIds.forEach(u => users.add(u)); n.cellIds.forEach(c => cells.add(c)); }
  const q = (table, cols, ids) => ids.length ? db.prepare(`SELECT ${cols} FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [];
  return { users: q('users', 'id, name, email', [...users]).map(u => ({ id: u.id, name: u.name || u.email })), cells: q('cells', 'id, name, color', [...cells]) };
}
/** Reemplaza el contenido de la página en una transacción. `expected` (If-Match) ≠ version actual → 409. */
export function saveDocument(db, pageId, doc, expected) {
  const d = normalizeDocument(doc, { id: pageId });
  return transaction(db, () => {
    const cur = db.prepare('SELECT version, name, description, visibility, status FROM pages WHERE id = ?').get(pageId);
    if (!cur) throw new HttpError(404, 'Página no encontrada');
    if (cur.status !== 'active' && expected !== 0) throw new HttpError(409, cur.status === 'archived' ? 'La página está archivada: restáurala para editarla' : 'La página está borrada', { version: cur.version });
    if (expected != null && Number(expected) !== cur.version) throw new HttpError(409, `Versión obsoleta: el servidor tiene ${cur.version}`, { version: cur.version });
    const version = cur.version + 1, now = nowIso();
    const meta = doc && doc.page ? doc.page : {};
    db.prepare('UPDATE pages SET name = ?, description = ?, visibility = ?, settings_json = ?, camera_json = ?, version = ?, updated_at = ? WHERE id = ?')
      .run(meta.name ? d.page.name : cur.name, meta.description != null ? d.page.description : cur.description, meta.visibility ? d.page.visibility : cur.visibility,
        j({ snap: d.settings.snap, grid: d.settings.grid, minimap: d.settings.minimap }), j(d.camera), version, now, pageId);
    for (const t of ['node_tags', 'edges', 'nodes', 'tags', 'branch_types']) db.prepare(`DELETE FROM ${t} WHERE page_id = ?`).run(pageId);
    const insTag = db.prepare('INSERT INTO tags (id, page_id, name, color, position) VALUES (?, ?, ?, ?, ?)');
    d.tags.forEach((t, i) => insTag.run(t.id, pageId, t.name, t.color, i));
    const insBt = db.prepare('INSERT INTO branch_types (id, page_id, name, color, position) VALUES (?, ?, ?, ?, ?)');
    d.branchTypes.forEach((t, i) => insBt.run(t.id, pageId, t.name, t.color, i));
    const insNode = db.prepare(`INSERT INTO nodes (id, page_id, type, name, description, notes, docs_json, image_id, image_legacy, owner_user_id, owner_label, parent_id, branch_type_id, x, y, w, h, demo, visibility, status, position, updated_at)
      VALUES (@id, @pageId, @type, @name, @description, @notes, @docs, @imageId, @image, @ownerUserId, @owner, @parentId, @branchTypeId, @x, @y, @w, @h, @demo, @visibility, @status, @position, @now)`);
    const insNodeTag = db.prepare('INSERT INTO node_tags (page_id, node_id, tag_id, position) VALUES (?, ?, ?, ?)');
    d.nodes.forEach((n, i) => {
      insNode.run({ id: n.id, pageId, type: n.type, name: n.name, description: n.description, notes: n.notes, docs: j(n.docs), imageId: n.imageId, image: n.image, ownerUserId: n.ownerUserId, owner: n.owner, parentId: n.parentId, branchTypeId: n.branchTypeId, x: n.x, y: n.y, w: n.w, h: n.h, demo: n.demo ? 1 : 0, visibility: n.visibility, status: n.status, position: i, now });
      n.tags.forEach((t, k) => insNodeTag.run(pageId, n.id, t, k));
    });
    const insEdge = db.prepare('INSERT INTO edges (id, page_id, kind, from_node_id, to_node_id, demo, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
    d.edges.forEach((e, i) => insEdge.run(e.id, pageId, e.kind, e.from, e.to, e.demo ? 1 : 0, i));
    writeNodeRelations(db, pageId, d.nodes);
    return { version, nodes: d.nodes.length, edges: d.edges.length, updatedAt: now };
  });
}
/** node_cells / node_assignees desde el documento; ids desconocidos (célula o usuario ajeno a la org) se descartan. */
function writeNodeRelations(db, pageId, nodes) {
  const cells = new Set(db.prepare('SELECT id FROM cells').all().map(r => r.id));
  const users = new Set(db.prepare('SELECT user_id FROM memberships').all().map(r => r.user_id));
  const insCell = db.prepare('INSERT OR IGNORE INTO node_cells (page_id, node_id, cell_id) VALUES (?, ?, ?)');
  const insAss = db.prepare('INSERT OR IGNORE INTO node_assignees (page_id, node_id, user_id, position) VALUES (?, ?, ?, ?)');
  for (const n of nodes) {
    if (n.visibility === 'cells') n.cellIds.filter(c => cells.has(c)).forEach(c => insCell.run(pageId, n.id, c));
    n.assigneeIds.filter(u => users.has(u)).forEach((u, i) => insAss.run(pageId, n.id, u, i));
    if (n.ownerUserId && !users.has(n.ownerUserId)) db.prepare('UPDATE nodes SET owner_user_id = NULL WHERE page_id = ? AND id = ?').run(pageId, n.id);
  }
}
/** F3: parche de un nodo (visibility+cellIds | assigneeIds | ownerUserId) sin PUT completo; version += 1. */
export function patchNode(db, pageId, nodeId, patch) {
  return transaction(db, () => {
    const cur = db.prepare('SELECT * FROM nodes WHERE page_id = ? AND id = ?').get(pageId, nodeId);
    if (!cur) throw new HttpError(404, 'Nodo no encontrado');
    const now = nowIso();
    if (patch.visibility !== undefined) {
      if (cur.parent_id) throw new HttpError(400, 'Solo una raíz tiene visibilidad propia (los hijos heredan)');
      const vis = patch.visibility === 'cells' ? 'cells' : 'org';
      db.prepare('UPDATE nodes SET visibility = ?, updated_at = ? WHERE page_id = ? AND id = ?').run(vis, now, pageId, nodeId);
      db.prepare('DELETE FROM node_cells WHERE page_id = ? AND node_id = ?').run(pageId, nodeId);
      if (vis === 'cells') writeNodeRelations(db, pageId, [{ id: nodeId, visibility: vis, cellIds: patch.cellIds || [], assigneeIds: [], ownerUserId: null }]);
    }
    if (patch.assigneeIds !== undefined) {
      db.prepare('DELETE FROM node_assignees WHERE page_id = ? AND node_id = ?').run(pageId, nodeId);
      writeNodeRelations(db, pageId, [{ id: nodeId, visibility: 'inherit', cellIds: [], assigneeIds: [...new Set(patch.assigneeIds)], ownerUserId: null }]);
      db.prepare('UPDATE nodes SET updated_at = ? WHERE page_id = ? AND id = ?').run(now, pageId, nodeId);
    }
    if (patch.ownerUserId !== undefined) {
      const ok = !patch.ownerUserId || db.prepare('SELECT 1 FROM memberships WHERE user_id = ?').get(patch.ownerUserId);
      if (!ok) throw new HttpError(400, 'Usuario responsable desconocido');
      db.prepare('UPDATE nodes SET owner_user_id = ?, updated_at = ? WHERE page_id = ? AND id = ?').run(patch.ownerUserId || null, now, pageId, nodeId);
    }
    const version = db.prepare('SELECT version FROM pages WHERE id = ?').get(pageId).version + 1;
    db.prepare('UPDATE pages SET version = ?, updated_at = ? WHERE id = ?').run(version, now, pageId);
    const node = getDocument(db, pageId).nodes.find(n => n.id === nodeId);
    return { version, node, updatedAt: now };
  });
}
export function createPage(db, { name, description = '', visibility = 'org', cellIds = [], createdBy = null }, orgId = DEFAULT_ORG_ID, content = null) {
  const id = ulid();
  return transaction(db, () => {
    db.prepare('INSERT INTO pages (id, org_id, name, description, visibility, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(id, orgId, String(name).slice(0, 120), String(description).slice(0, 500), visibility === 'cells' ? 'cells' : 'org', createdBy);
    setPageCells(db, id, visibility === 'cells' ? cellIds : []);
    const page = { id, name, description, visibility };
    saveDocument(db, id, content ? { ...content, page } : defaultDocument(page), 0);
    return getDocument(db, id);
  });
}
function setPageCells(db, pageId, cellIds) {
  db.prepare('DELETE FROM page_cells WHERE page_id = ?').run(pageId);
  const ins = db.prepare('INSERT OR IGNORE INTO page_cells (page_id, cell_id) SELECT ?, id FROM cells WHERE id = ?');
  for (const c of [...new Set(cellIds || [])]) ins.run(pageId, c);
}
/** F4a: metadatos (name, description, visibility + cellIds). version += 1. */
export function updatePageMeta(db, pageId, patch) {
  return transaction(db, () => {
    const cur = pageMeta(db, pageId);
    if (cur.status === 'deleted') throw new HttpError(409, 'La página está borrada');
    const name = patch.name != null ? String(patch.name).trim().slice(0, 120) : cur.name;
    if (!name) throw new HttpError(400, 'El nombre es obligatorio');
    const vis = patch.visibility != null ? (patch.visibility === 'cells' ? 'cells' : 'org') : cur.visibility;
    const version = cur.version + 1;
    db.prepare('UPDATE pages SET name = ?, description = ?, visibility = ?, version = ?, updated_at = ? WHERE id = ?')
      .run(name, patch.description != null ? String(patch.description).slice(0, 500) : cur.description, vis, version, nowIso(), pageId);
    if (patch.visibility != null || patch.cellIds != null) setPageCells(db, pageId, vis === 'cells' ? (patch.cellIds ?? pageCells(db, pageId)) : []);
    return { ...pageMeta(db, pageId), cellIds: vis === 'cells' ? pageCells(db, pageId) : [] };
  });
}
/** F4a: archivar / desarchivar / borrar (soft) / restaurar. Transiciones válidas: active⇄archived, active|archived→deleted→active. */
export function setPageStatus(db, pageId, status, userId = null) {
  if (!PAGE_STATUS.includes(status)) throw new HttpError(400, 'Estado desconocido');
  return transaction(db, () => {
    const cur = pageMeta(db, pageId);
    if (cur.status === status) throw new HttpError(409, `La página ya está en estado ${status}`);
    if (cur.status === 'deleted' && status !== 'active') throw new HttpError(409, 'Restaura la página antes de archivarla');
    const now = nowIso();
    db.prepare('UPDATE pages SET status = ?, archived_at = ?, deleted_at = ?, deleted_by = ?, version = version + 1, updated_at = ? WHERE id = ?')
      .run(status, status === 'archived' ? now : null, status === 'deleted' ? now : null, status === 'deleted' ? userId : null, now, pageId);
    return pageMeta(db, pageId);
  });
}
/** F4a: borrado suave + export JSON del documento a `deletedDir` (hasta F6a, que lo sustituye por un snapshot `reason=delete`). */
export function deletePage(db, pageId, userId, deletedDir) {
  const doc = getDocument(db, pageId);
  const meta = setPageStatus(db, pageId, 'deleted', userId);
  let file = null;
  if (deletedDir) {
    fs.mkdirSync(deletedDir, { recursive: true });
    file = path.join(deletedDir, `${pageId}-${nowIso().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...doc, deletedAt: meta.deletedAt, deletedBy: userId }, null, 2));
  }
  return { ...meta, file };
}
/** F4a: duplica contenido (nodos, aristas, tags, tipos, células/asignados) en una página nueva. */
export function duplicatePage(db, pageId, { name, createdBy = null } = {}) {
  const src = getDocument(db, pageId);
  if (src.page.status === 'deleted') throw new HttpError(409, 'La página está borrada');
  return createPage(db, { name: name || `${src.page.name} (copia)`, description: src.page.description, visibility: src.page.visibility, cellIds: src.page.cellIds, createdBy }, DEFAULT_ORG_ID, src);
}
/** Importa un respaldo v1/v2/v3 (normaliza y persiste). Sin If-Match: sustituye lo que haya. */
export function importDocument(db, pageId, raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new HttpError(400, 'El JSON no tiene el formato esperado (nodes/edges).');
  const doc = { ...raw }; delete doc.page; // los metadatos de la página no se importan
  return saveDocument(db, pageId, doc, null);
}

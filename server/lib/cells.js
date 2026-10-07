// F3: células (equipos) y miembros. Una org; `cells.org_id` siempre DEFAULT_ORG_ID salvo multi-org futuro.
import { DEFAULT_ORG_ID, transaction } from '../db/sqlite.js';
import { ulid } from './ids.js';
import { HttpError } from './pages.js';
import { TAG_COLORS } from './normalize.js';

const pub = r => ({ id: r.id, name: r.name, color: r.color, description: r.description, leadUserId: r.lead_user_id, createdAt: r.created_at, memberIds: [] });
const withMembers = (db, cells) => {
  const byId = new Map(cells.map(c => [c.id, c]));
  if (cells.length) for (const r of db.prepare('SELECT cell_id, user_id FROM cell_members ORDER BY rowid').all()) byId.get(r.cell_id)?.memberIds.push(r.user_id);
  return cells;
};
export function listCells(db, orgId = DEFAULT_ORG_ID) {
  return withMembers(db, db.prepare('SELECT * FROM cells WHERE org_id = ? ORDER BY name').all(orgId).map(pub));
}
export function getCell(db, id, orgId = DEFAULT_ORG_ID) {
  const r = db.prepare('SELECT * FROM cells WHERE id = ? AND org_id = ?').get(id, orgId);
  if (!r) throw new HttpError(404, 'Célula no encontrada');
  return withMembers(db, [pub(r)])[0];
}
export function createCell(db, { name, color, description = '', leadUserId = null }, orgId = DEFAULT_ORG_ID) {
  const id = ulid();
  db.prepare('INSERT INTO cells (id, org_id, name, color, description, lead_user_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, orgId, String(name).trim().slice(0, 80), TAG_COLORS.includes(color) ? color : TAG_COLORS[(db.prepare('SELECT COUNT(*) AS n FROM cells').get().n) % TAG_COLORS.length], String(description).slice(0, 500), leadUserId);
  if (leadUserId) db.prepare('INSERT OR IGNORE INTO cell_members (cell_id, user_id) VALUES (?, ?)').run(id, leadUserId);
  return getCell(db, id, orgId);
}
export function updateCell(db, id, patch, orgId = DEFAULT_ORG_ID) {
  const cur = getCell(db, id, orgId);
  const next = { name: patch.name != null ? String(patch.name).trim().slice(0, 80) : cur.name, color: TAG_COLORS.includes(patch.color) ? patch.color : cur.color,
    description: patch.description != null ? String(patch.description).slice(0, 500) : cur.description, leadUserId: patch.leadUserId !== undefined ? patch.leadUserId : cur.leadUserId };
  if (!next.name) throw new HttpError(400, 'El nombre es obligatorio');
  db.prepare('UPDATE cells SET name = ?, color = ?, description = ?, lead_user_id = ? WHERE id = ?').run(next.name, next.color, next.description, next.leadUserId, id);
  if (next.leadUserId) db.prepare('INSERT OR IGNORE INTO cell_members (cell_id, user_id) VALUES (?, ?)').run(id, next.leadUserId);
  return getCell(db, id, orgId);
}
export function deleteCell(db, id, orgId = DEFAULT_ORG_ID) {
  getCell(db, id, orgId);
  db.prepare('DELETE FROM cells WHERE id = ?').run(id); // cascada: cell_members, node_cells, page_cells
}
/** Sustituye los miembros. Ignora ids que no sean usuarios de la org. */
export function setCellMembers(db, id, userIds, orgId = DEFAULT_ORG_ID) {
  const cell = getCell(db, id, orgId);
  const valid = new Set(db.prepare('SELECT user_id FROM memberships WHERE org_id = ?').all(orgId).map(r => r.user_id));
  const ids = [...new Set(userIds.filter(u => valid.has(u)))];
  if (cell.leadUserId && !ids.includes(cell.leadUserId)) ids.push(cell.leadUserId);
  return transaction(db, () => {
    db.prepare('DELETE FROM cell_members WHERE cell_id = ?').run(id);
    const ins = db.prepare('INSERT INTO cell_members (cell_id, user_id) VALUES (?, ?)');
    for (const u of ids) ins.run(id, u);
    return getCell(db, id, orgId);
  });
}
export function addCellMembers(db, cellIds, userId) {
  const ins = db.prepare('INSERT OR IGNORE INTO cell_members (cell_id, user_id) SELECT id, ? FROM cells WHERE id = ?');
  for (const c of cellIds || []) ins.run(userId, c);
}
export const userCellIds = (db, userId) => db.prepare('SELECT cell_id FROM cell_members WHERE user_id = ?').all(userId).map(r => r.cell_id);
/** ¿El head puede gestionar esta célula? (lead o miembro). Admin siempre. */
export function canManageCell(db, ctx, cellId) {
  if (ctx.role === 'admin') return true;
  if (ctx.role !== 'head') return false;
  const c = db.prepare('SELECT lead_user_id FROM cells WHERE id = ?').get(cellId);
  return !!c && (c.lead_user_id === ctx.userId || !!db.prepare('SELECT 1 FROM cell_members WHERE cell_id = ? AND user_id = ?').get(cellId, ctx.userId));
}
/** Contexto de visibilidad para lib/visibility.js a partir de la request. */
export const visibilityCtx = req => (req.user ? { role: req.role, userId: req.user.id, cellIds: userCellIds(req.server.db, req.user.id) } : null);

// F2: audit_log en toda escritura. audit(db, { orgId, userId, action, entity, entityId, meta }).
import { ulid } from './ids.js';
const stmt = new WeakMap();
export function audit(db, { orgId = null, userId = null, action, entity = '', entityId = '', meta = {} }) {
  let s = stmt.get(db);
  if (!s) { s = db.prepare('INSERT INTO audit_log (id, org_id, user_id, action, entity, entity_id, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)'); stmt.set(db, s); }
  s.run(ulid(), orgId, userId, action, entity, String(entityId ?? ''), JSON.stringify(meta));
}
/** F4b: listado paginado (más recientes primero). `before` = id (ULID) del último visto. */
export function listAudit(db, orgId, { limit = 50, before = null, action = null } = {}) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const rows = db.prepare(`SELECT a.id, a.user_id AS userId, COALESCE(NULLIF(u.name, ''), u.email) AS userName, a.action, a.entity, a.entity_id AS entityId, a.meta_json AS meta, a.created_at AS createdAt
    FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.org_id = ? ${before ? 'AND a.id < ?' : ''} ${action ? 'AND a.action LIKE ?' : ''} ORDER BY a.id DESC LIMIT ?`)
    .all(orgId, ...(before ? [before] : []), ...(action ? [action + '%'] : []), lim + 1);
  const items = rows.slice(0, lim).map(r => ({ ...r, meta: JSON.parse(r.meta || '{}') }));
  return { items, next: rows.length > lim ? items[items.length - 1].id : null };
}

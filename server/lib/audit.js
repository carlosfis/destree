// F2: audit_log en toda escritura. audit(db, { orgId, userId, action, entity, entityId, meta }).
import { ulid } from './ids.js';
const stmt = new WeakMap();
export function audit(db, { orgId = null, userId = null, action, entity = '', entityId = '', meta = {} }) {
  let s = stmt.get(db);
  if (!s) { s = db.prepare('INSERT INTO audit_log (id, org_id, user_id, action, entity, entity_id, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)'); stmt.set(db, s); }
  s.run(ulid(), orgId, userId, action, entity, String(entityId ?? ''), JSON.stringify(meta));
}

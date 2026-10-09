// F2: GET /api/users (P10: users.read, con células y asignaciones) · POST /api/users · PATCH /api/users/:id (name, role, isActive, password) · DELETE /api/users/:id (desactiva).
// P10: quien gestiona usuarios (nivel ≥4) solo toca cuentas de su nivel o inferior y solo da roles que puede asignar (admin solo lo da un admin).
import { listUsers, getUser, createUser, adminCount, deleteUserSessions, hashPassword } from '../lib/auth.js';
import { ROLES, canAssignRole, canManageUser } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';
import { transaction } from '../db/sqlite.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };

/** Células y cards (responsable/asignado) por usuario, en páginas no borradas. */
function staffDetails(db) {
  const cells = new Map(), assignments = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const r of db.prepare('SELECT user_id, cell_id FROM cell_members ORDER BY rowid').all()) push(cells, r.user_id, r.cell_id);
  const rows = db.prepare(`SELECT a.user_id AS userId, n.page_id AS pageId, p.name AS pageName, n.id AS nodeId, n.name, n.type, n.parent_id AS parentId, 'assignee' AS kind
      FROM node_assignees a JOIN nodes n ON n.page_id = a.page_id AND n.id = a.node_id JOIN pages p ON p.id = n.page_id WHERE p.status != 'deleted'
    UNION ALL SELECT n.owner_user_id, n.page_id, p.name, n.id, n.name, n.type, n.parent_id, 'owner' FROM nodes n JOIN pages p ON p.id = n.page_id WHERE n.owner_user_id IS NOT NULL AND p.status != 'deleted'
    ORDER BY 3, 5`).all();
  for (const r of rows) push(assignments, r.userId, { pageId: r.pageId, pageName: r.pageName, nodeId: r.nodeId, name: r.name, type: r.type, isRoot: !r.parentId, kind: r.kind });
  return u => ({ ...u, cellIds: cells.get(u.id) || [], assignments: assignments.get(u.id) || [] });
}

export default async function userRoutes(app) {
  const guard = app.guard('users.manage');
  const assignable = (req, role) => { if (!canAssignRole(req, role)) throw new HttpError(403, 'No puedes dar un rol por encima del tuyo'); };
  const target = (req) => {
    const cur = getUser(app.db, req.params.id, req.orgId);
    if (!cur) throw new HttpError(404, 'Usuario no encontrado');
    if (!canManageUser(req, cur.role)) throw new HttpError(403, 'No puedes gestionar una cuenta de nivel superior al tuyo');
    return cur;
  };

  app.get('/api/users', { onRequest: app.guard('users.read') }, async (req) => ({ users: listUsers(app.db, req.orgId).map(staffDetails(app.db)) }));

  app.post('/api/users', {
    onRequest: guard,
    schema: { body: { type: 'object', required: ['email', 'password', 'role'], additionalProperties: false, properties: { email: { type: 'string', format: 'email', maxLength: 200 }, name: { type: 'string', maxLength: 120 }, password: { type: 'string', minLength: 8, maxLength: 200 }, role: { enum: ROLES } } } },
  }, async (req, reply) => {
    assignable(req, req.body.role);
    const u = transaction(app.db, () => {
      const r = createUser(app.db, { ...req.body, orgId: req.orgId });
      audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'user.create', entity: 'user', entityId: r.id, meta: { role: r.role } });
      return r;
    });
    reply.code(201);
    return u;
  });

  app.patch('/api/users/:id', {
    onRequest: guard,
    schema: { params: idParam, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name: { type: 'string', maxLength: 120 }, role: { enum: ROLES }, isActive: { type: 'boolean' }, password: { type: 'string', minLength: 8, maxLength: 200 } } } },
  }, async (req) => {
    const cur = target(req);
    const { name, role, isActive, password } = req.body;
    if (role) assignable(req, role);
    const losesAdmin = cur.role === 'admin' && cur.isActive && ((role && role !== 'admin') || isActive === false);
    if (losesAdmin && adminCount(app.db, req.orgId) <= 1) throw new HttpError(409, 'No se puede degradar ni desactivar al último admin');
    if (isActive === false && cur.id === req.user.id) throw new HttpError(409, 'No puedes desactivar tu propia cuenta');
    if (role && role !== cur.role && cur.id === req.user.id) throw new HttpError(409, 'No puedes cambiar tu propio rol');
    return transaction(app.db, () => {
      if (name != null) app.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), cur.id);
      if (isActive != null) app.db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, cur.id);
      if (role) app.db.prepare('UPDATE memberships SET role = ? WHERE user_id = ? AND org_id = ?').run(role, cur.id, req.orgId);
      if (password) app.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), cur.id); // F6b: fijar contraseña (p. ej. usuarios importados)
      if (isActive === false || (role && role !== cur.role) || password) deleteUserSessions(app.db, cur.id);
      audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'user.update', entity: 'user', entityId: cur.id, meta: { ...req.body, password: password ? '***' : undefined } });
      return getUser(app.db, cur.id, req.orgId);
    });
  });

  app.delete('/api/users/:id', { onRequest: guard, schema: { params: idParam } }, async (req, reply) => {
    const cur = target(req);
    if (cur.id === req.user.id) throw new HttpError(409, 'No puedes desactivar tu propia cuenta');
    if (cur.role === 'admin' && cur.isActive && adminCount(app.db, req.orgId) <= 1) throw new HttpError(409, 'No se puede desactivar al último admin');
    transaction(app.db, () => {
      app.db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(cur.id);
      deleteUserSessions(app.db, cur.id);
      audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'user.deactivate', entity: 'user', entityId: cur.id });
    });
    return reply.code(204).send();
  });
}

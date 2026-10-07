// F2: GET/POST /api/users · PATCH /api/users/:id (name, role, isActive) · DELETE /api/users/:id (desactiva). Solo admin.
import { listUsers, getUser, createUser, adminCount, deleteUserSessions, hashPassword } from '../lib/auth.js';
import { ROLES } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';
import { transaction } from '../db/sqlite.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };

export default async function userRoutes(app) {
  const guard = app.guard('users.manage');

  app.get('/api/users', { onRequest: guard }, async (req) => ({ users: listUsers(app.db, req.orgId) }));

  app.post('/api/users', {
    onRequest: guard,
    schema: { body: { type: 'object', required: ['email', 'password', 'role'], additionalProperties: false, properties: { email: { type: 'string', format: 'email', maxLength: 200 }, name: { type: 'string', maxLength: 120 }, password: { type: 'string', minLength: 8, maxLength: 200 }, role: { enum: ROLES } } } },
  }, async (req, reply) => {
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
    const cur = getUser(app.db, req.params.id, req.orgId);
    if (!cur) throw new HttpError(404, 'Usuario no encontrado');
    const { name, role, isActive, password } = req.body;
    const losesAdmin = cur.role === 'admin' && cur.isActive && ((role && role !== 'admin') || isActive === false);
    if (losesAdmin && adminCount(app.db, req.orgId) <= 1) throw new HttpError(409, 'No se puede degradar ni desactivar al último admin');
    if (isActive === false && cur.id === req.user.id) throw new HttpError(409, 'No puedes desactivar tu propia cuenta');
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
    const cur = getUser(app.db, req.params.id, req.orgId);
    if (!cur) throw new HttpError(404, 'Usuario no encontrado');
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

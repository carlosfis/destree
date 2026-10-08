// F2: GET /api/setup · POST /api/setup · POST /api/auth/login · POST /api/auth/logout · GET /api/me · P3: PATCH /api/me (name, contraseña propia) · P6: DELETE /api/me/sessions
import { userCount, createUser, findUserByEmail, verifyPassword, createSession, deleteSession, deleteOtherSessions, setPassword, rateLimit, getUser } from '../lib/auth.js';
import { permissionsFor } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';
import { sessionCookie } from '../plugins/session.js';
import { transaction, DEFAULT_ORG_ID } from '../db/sqlite.js';
import { userCellIds } from '../lib/cells.js';
import { mailConfigured } from '../lib/mailer.js'; // P7

const email = { type: 'string', format: 'email', maxLength: 200 };
const password = { type: 'string', minLength: 8, maxLength: 200 };
const name = { type: 'string', minLength: 1, maxLength: 120 };
export const limited = async (req) => rateLimit(req.ip);

export default async function authRoutes(app) {
  const orgRow = () => app.db.prepare('SELECT id, name, slug FROM orgs WHERE id = ?').get(DEFAULT_ORG_ID);

  app.get('/api/setup', async () => ({ needed: userCount(app.db) === 0, mail: mailConfigured() })); // P7: mail → el login ofrece «¿Olvidaste tu contraseña?»

  app.post('/api/setup', {
    onRequest: limited,
    schema: { body: { type: 'object', required: ['orgName', 'email', 'password'], additionalProperties: false, properties: { orgName: name, name, email, password } } },
  }, async (req, reply) => {
    if (userCount(app.db) > 0) throw new HttpError(409, 'La instalación ya está configurada');
    const user = transaction(app.db, () => {
      app.db.prepare('UPDATE orgs SET name = ? WHERE id = ?').run(req.body.orgName.trim(), DEFAULT_ORG_ID);
      const u = createUser(app.db, { email: req.body.email, name: req.body.name || req.body.email.split('@')[0], password: req.body.password, role: 'admin' });
      audit(app.db, { orgId: DEFAULT_ORG_ID, userId: u.id, action: 'setup', entity: 'org', entityId: DEFAULT_ORG_ID, meta: { orgName: req.body.orgName } });
      return u;
    });
    const token = createSession(app.db, { userId: user.id, ua: req.headers['user-agent'], ip: req.ip });
    reply.code(201).header('Set-Cookie', sessionCookie(token));
    return me(app, user);
  });

  app.post('/api/auth/login', {
    onRequest: limited,
    schema: { body: { type: 'object', required: ['email', 'password'], additionalProperties: false, properties: { email, password: { type: 'string', minLength: 1, maxLength: 200 } } } },
  }, async (req, reply) => {
    const row = findUserByEmail(app.db, req.body.email);
    if (!row || !verifyPassword(req.body.password, row.password_hash)) throw new HttpError(401, 'Correo o contraseña incorrectos');
    if (!row.is_active) throw new HttpError(403, 'Cuenta desactivada');
    const user = getUser(app.db, row.id);
    if (!user) throw new HttpError(403, 'Sin pertenencia a la organización');
    const token = createSession(app.db, { userId: user.id, ua: req.headers['user-agent'], ip: req.ip });
    audit(app.db, { orgId: DEFAULT_ORG_ID, userId: user.id, action: 'login', entity: 'user', entityId: user.id });
    reply.header('Set-Cookie', sessionCookie(token));
    return me(app, user);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    deleteSession(app.db, req.sessionToken);
    reply.header('Set-Cookie', sessionCookie('', { clear: true })).code(204);
    return null;
  });

  app.get('/api/me', { onRequest: app.guard('pages.read') }, async (req) => me(app, req.user));

  // P3: cuenta propia. Cambiar contraseña exige la actual y cierra las demás sesiones; `name` opcional.
  app.patch('/api/me', {
    onRequest: [app.guard('pages.read'), limited],
    schema: { body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name, currentPassword: { type: 'string', minLength: 1, maxLength: 200 }, newPassword: password } } },
  }, async (req) => {
    const { name: newName, currentPassword, newPassword } = req.body;
    if ((newPassword && !currentPassword) || (currentPassword && !newPassword)) throw new HttpError(400, 'Indica la contraseña actual y la nueva');
    if (newPassword) {
      const row = app.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
      if (!verifyPassword(currentPassword, row.password_hash)) throw new HttpError(403, 'La contraseña actual no es correcta');
    }
    const closed = transaction(app.db, () => {
      let n = 0;
      if (newName != null) { app.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(newName.trim(), req.user.id); audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'user.update', entity: 'user', entityId: req.user.id, meta: { name: newName.trim(), self: true } }); }
      if (newPassword) { setPassword(app.db, req.user.id, newPassword); n = deleteOtherSessions(app.db, req.user.id, req.sessionToken); audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'user.password', entity: 'user', entityId: req.user.id, meta: { sessionsClosed: n } }); }
      return n;
    });
    return { ...me(app, getUser(app.db, req.user.id, req.orgId)), sessionsClosed: closed };
  });

  // P6: cerrar las demás sesiones (otros navegadores/dispositivos) sin cambiar la contraseña.
  app.delete('/api/me/sessions', { onRequest: app.guard('pages.read') }, async (req) => {
    const closed = deleteOtherSessions(app.db, req.user.id, req.sessionToken);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'user.sessions', entity: 'user', entityId: req.user.id, meta: { sessionsClosed: closed } });
    return { sessionsClosed: closed };
  });

  function me(app, user) {
    return { user: { id: user.id, email: user.email, name: user.name }, org: orgRow(), role: user.role, permissions: permissionsFor(user.role), cellIds: userCellIds(app.db, user.id), cells: userCells(user.id), mail: mailConfigured() };
  }
  function userCells(userId) {
    return app.db.prepare('SELECT c.id, c.name, c.color FROM cells c JOIN cell_members m ON m.cell_id = c.id WHERE m.user_id = ? ORDER BY c.name').all(userId);
  }
}

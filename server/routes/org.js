// P10: PATCH /api/org (nombre, etiquetas de roles; admin) · DELETE /api/org (borra todo y vuelve al asistente; admin con contraseña + nombre exacto).
import { getOrg, updateOrg, wipeOrg } from '../lib/org.js';
import { verifyPassword } from '../lib/auth.js';
import { ROLES, FIXED_LABEL_ROLES, LABEL_MAX } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';
import { sessionCookie } from '../plugins/session.js';
import { limited } from './auth.js';

const labelProps = Object.fromEntries(ROLES.filter(r => !FIXED_LABEL_ROLES.includes(r)).map(r => [r, { type: 'string', maxLength: LABEL_MAX }]));

export default async function orgRoutes(app) {
  app.get('/api/org', { onRequest: app.guard('users.read') }, async (req) => getOrg(app.db, req.orgId));

  app.patch('/api/org', {
    onRequest: app.guard('org.settings'),
    schema: { body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, roleLabels: { type: 'object', additionalProperties: false, properties: labelProps } } } },
  }, async (req) => {
    const org = updateOrg(app.db, req.body, req.orgId);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'org.update', entity: 'org', entityId: req.orgId, meta: req.body });
    return org;
  });

  app.delete('/api/org', {
    onRequest: [app.guard('org.delete'), limited],
    schema: { body: { type: 'object', required: ['password', 'confirmName'], additionalProperties: false, properties: { password: { type: 'string', minLength: 1, maxLength: 200 }, confirmName: { type: 'string', maxLength: 120 } } } },
  }, async (req, reply) => {
    const org = getOrg(app.db, req.orgId);
    if (req.body.confirmName.trim() !== org.name) throw new HttpError(400, 'Escribe el nombre exacto de la organización para confirmar');
    const row = app.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!row || !verifyPassword(req.body.password, row.password_hash)) throw new HttpError(403, 'La contraseña no es correcta');
    const stats = wipeOrg(app.db, { uploadsDir: app.uploadsDir }, req.orgId);
    req.log.warn({ by: req.user.email, ...stats }, 'organización eliminada'); // el audit_log también se borra
    reply.header('Set-Cookie', sessionCookie('', { clear: true })).code(204);
    return null;
  });
}

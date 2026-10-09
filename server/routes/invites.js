// F2: POST/GET /api/invites · DELETE /api/invites/:id · GET /api/invites/:token (público) · POST /api/invites/accept
// P10: solo se invita a roles que uno puede asignar (por debajo del propio; nivel ≥4 también el suyo); sin `users.manage` solo se ven/revocan las invitaciones propias.
import { createInvite, listInvites, getInviteByToken, acceptInvite, publicInvite } from '../lib/auth.js';
import { ROLES, canAssignRole, can } from '../lib/permissions.js';
import { orgRoleLabels } from '../lib/org.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';
import { sessionCookie } from '../plugins/session.js';
import { transaction } from '../db/sqlite.js';
import { limited } from './auth.js';
import { canManageCell, addCellMembers } from '../lib/cells.js';
import { sendMail, mailConfigured, publicBase, inviteMail } from '../lib/mailer.js'; // P7
import { nowIso } from '../lib/ids.js';

const tokenParam = { type: 'object', required: ['token'], properties: { token: { type: 'string', minLength: 20, maxLength: 64 } } };

export default async function inviteRoutes(app) {
  const link = (req, token) => `${publicBase(req)}/#/invite/${token}`;

  app.post('/api/invites', {
    onRequest: app.guard('invite'),
    schema: { body: { type: 'object', required: ['email', 'role'], additionalProperties: false, properties: { email: { type: 'string', format: 'email', maxLength: 200 }, role: { enum: ROLES }, cellIds: { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 64 } } } } },
  }, async (req, reply) => {
    if (!canAssignRole(req, req.body.role)) throw new HttpError(403, 'Solo puedes invitar roles por debajo del tuyo');
    const cellIds = [...new Set(req.body.cellIds || [])];
    for (const c of cellIds) if (!canManageCell(app.db, { role: req.role, userId: req.user.id }, c)) throw new HttpError(403, 'Solo puedes invitar a tus células');
    if (cellIds.some(c => !app.db.prepare('SELECT 1 FROM cells WHERE id = ? AND org_id = ?').get(c, req.orgId))) throw new HttpError(400, 'Célula desconocida');
    const inv = transaction(app.db, () => {
      const r = createInvite(app.db, { orgId: req.orgId, email: req.body.email, role: req.body.role, cellIds, invitedBy: req.user.id });
      audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'invite.create', entity: 'invite', entityId: r.id, meta: { email: r.email, role: r.role } });
      return r;
    });
    reply.code(201);
    // P7: con SMTP se envía el correo (y se anota email_sent_at); sin SMTP o si falla, el enlace se copia a mano.
    let emailSent = false, mailError = null;
    if (mailConfigured()) {
      const org = app.db.prepare('SELECT name FROM orgs WHERE id = ?').get(req.orgId);
      try { await sendMail({ to: inv.email, ...inviteMail({ orgName: org?.name || 'DesTree', role: orgRoleLabels(app.db, req.orgId)[inv.role] || inv.role, link: link(req, inv.token), expiresAt: inv.expiresAt }) }); emailSent = true; app.db.prepare('UPDATE invites SET email_sent_at = ? WHERE id = ?').run(nowIso(), inv.id); }
      catch (err) { mailError = err.message; req.log.warn({ err: err.message }, 'correo de invitación'); }
    }
    return { id: inv.id, email: inv.email, role: inv.role, cellIds, expiresAt: inv.expiresAt, link: link(req, inv.token), emailSent, ...(mailError ? { mailError } : {}) };
  });

  app.get('/api/invites', { onRequest: app.guard('invite') }, async (req) => ({ invites: listInvites(app.db, req.orgId).filter(i => can(req, 'users.manage') || i.invitedBy === req.user.id) }));

  app.delete('/api/invites/:id', { onRequest: app.guard('invite'), schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 64 } } } } }, async (req, reply) => {
    const r = can(req, 'users.manage') ? app.db.prepare('DELETE FROM invites WHERE id = ? AND org_id = ? AND used_at IS NULL').run(req.params.id, req.orgId)
      : app.db.prepare('DELETE FROM invites WHERE id = ? AND org_id = ? AND used_at IS NULL AND invited_by = ?').run(req.params.id, req.orgId, req.user.id);
    if (!r.changes) throw new HttpError(404, 'Invitación no encontrada');
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'invite.revoke', entity: 'invite', entityId: req.params.id });
    return reply.code(204).send();
  });

  // Público: datos de la invitación para la pantalla de alta. 404 / 410.
  app.get('/api/invites/:token', { schema: { params: tokenParam } }, async (req) => {
    const inv = getInviteByToken(app.db, req.params.token);
    const org = app.db.prepare('SELECT name FROM orgs WHERE id = ?').get(inv.org_id);
    return { email: inv.email, role: inv.role, roleLabel: orgRoleLabels(app.db, inv.org_id)[inv.role] || inv.role, orgName: org?.name || '', expiresAt: inv.expires_at };
  });

  app.post('/api/invites/accept', {
    onRequest: limited,
    schema: { body: { type: 'object', required: ['token', 'password'], additionalProperties: false, properties: { token: tokenParam.properties.token, name: { type: 'string', maxLength: 120 }, password: { type: 'string', minLength: 8, maxLength: 200 } } } },
  }, async (req, reply) => {
    const res = transaction(app.db, () => {
      const r = acceptInvite(app.db, { token: req.body.token, name: req.body.name || '', password: req.body.password, ua: req.headers['user-agent'], ip: req.ip });
      addCellMembers(app.db, JSON.parse(r.invite.cell_ids_json || '[]'), r.user.id); // F3: hereda células de la invitación
      audit(app.db, { orgId: r.invite.org_id, userId: r.user.id, action: 'invite.accept', entity: 'invite', entityId: r.invite.id, meta: { role: r.user.role } });
      return r;
    });
    reply.code(201).header('Set-Cookie', sessionCookie(res.token));
    return { user: res.user, invite: publicInvite(res.invite) };
  });
}

// P7: POST /api/mail/test (admin) · POST /api/auth/forgot (siempre 204) · POST /api/auth/reset (token de un solo uso, 1 h).
import { findUserByEmail, createPasswordReset, consumePasswordReset, setPassword, deleteUserSessions, rateLimit } from '../lib/auth.js';
import { sendMail, mailConfigured, publicBase, resetMail, testMail } from '../lib/mailer.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';
import { transaction, DEFAULT_ORG_ID } from '../db/sqlite.js';

const limited = async (req) => rateLimit(req.ip);

export default async function mailRoutes(app) {
  app.post('/api/mail/test', { onRequest: app.guard('org.settings') }, async (req) => {
    if (!mailConfigured()) throw new HttpError(409, 'Correo no configurado: define SMTP_URL y MAIL_FROM');
    const org = app.db.prepare('SELECT name FROM orgs WHERE id = ?').get(req.orgId);
    try { const r = await sendMail({ to: req.user.email, ...testMail({ lang: req.lang, orgName: org?.name || 'DesTree' }) }); audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'mail.test', entity: 'user', entityId: req.user.id, meta: { to: r.to } }); return { sent: true, to: r.to }; }
    catch (err) { throw new HttpError(502, 'No se pudo enviar: ' + err.message); }
  });

  // Siempre 204 (no revela si el correo existe). El envío es asíncrono para no filtrar por tiempo de respuesta.
  app.post('/api/auth/forgot', {
    onRequest: limited,
    schema: { body: { type: 'object', required: ['email'], additionalProperties: false, properties: { email: { type: 'string', format: 'email', maxLength: 200 } } } },
  }, async (req, reply) => {
    const row = mailConfigured() ? findUserByEmail(app.db, req.body.email) : null;
    if (row && row.is_active) {
      const token = createPasswordReset(app.db, row.id);
      audit(app.db, { orgId: DEFAULT_ORG_ID, userId: row.id, action: 'user.reset_request', entity: 'user', entityId: row.id });
      sendMail({ to: row.email, ...resetMail({ lang: req.lang, link: `${publicBase(req)}/#/reset/${token}` }) }).catch(err => req.log.error({ err: err.message }, 'correo de restablecimiento'));
    }
    return reply.code(204).send();
  });

  app.post('/api/auth/reset', {
    onRequest: limited,
    schema: { body: { type: 'object', required: ['token', 'password'], additionalProperties: false, properties: { token: { type: 'string', minLength: 20, maxLength: 64 }, password: { type: 'string', minLength: 8, maxLength: 200 } } } },
  }, async (req) => {
    transaction(app.db, () => {
      const r = consumePasswordReset(app.db, req.body.token); // 404 / 410
      setPassword(app.db, r.user_id, req.body.password);
      deleteUserSessions(app.db, r.user_id);
      audit(app.db, { orgId: DEFAULT_ORG_ID, userId: r.user_id, action: 'user.password', entity: 'user', entityId: r.user_id, meta: { reset: true } });
    });
    return { ok: true };
  });
}

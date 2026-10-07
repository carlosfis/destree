// F2: cookie de sesión → req.user / req.role / req.orgId. Plugin sin encapsular (skip-override) para que el hook sea global.
import { SESSION_COOKIE, SESSION_DAYS, resolveSession } from '../lib/auth.js';
import { config } from '../config.js';

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
export function sessionCookie(token, { clear = false } = {}) {
  const attrs = [`${SESSION_COOKIE}=${clear ? '' : token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${clear ? 0 : SESSION_DAYS * 86400}`];
  if (config.trustProxy) attrs.push('Secure');
  return attrs.join('; ');
}
function sessionPlugin(app, opts, done) {
  app.decorateRequest('user', null);
  app.decorateRequest('role', null);
  app.decorateRequest('orgId', null);
  app.decorateRequest('sessionToken', null);
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
    req.sessionToken = token;
    const r = resolveSession(app.db, token);
    if (!r) return;
    req.user = r.user; req.role = r.user.role; req.orgId = r.session.org_id;
  });
  done();
}
sessionPlugin[Symbol.for('skip-override')] = true;
export default sessionPlugin;

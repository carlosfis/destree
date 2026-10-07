// F2: anti-CSRF en mutaciones /api/*: si llega Origin (o Referer) debe coincidir con Host. Rutas con config.skipOriginCheck quedan exentas
// (F8a/F9a: /api/figma/report, /api/figma/hook). Sin Origin ni Referer (curl, inject) se permite: la cookie es SameSite=Lax.
import { HttpError } from '../lib/pages.js';

export function originMatches(req) {
  const src = req.headers.origin || req.headers.referer;
  if (!src) return true;
  let host;
  try { host = new URL(src).host; } catch { return false; }
  const own = req.headers['x-forwarded-host'] || req.headers.host;
  return host === own;
}
function originPlugin(app, opts, done) {
  app.addHook('onRequest', async (req) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.url.startsWith('/api/')) return;
    if (req.routeOptions?.config?.skipOriginCheck) return;
    if (!originMatches(req)) throw new HttpError(403, 'Origen no permitido');
  });
  done();
}
originPlugin[Symbol.for('skip-override')] = true;
export default originPlugin;

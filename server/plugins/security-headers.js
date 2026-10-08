// P6: cabeceras de seguridad. HTML/estáticos/uploads: CSP estricta (sin inline), frame-ancestors 'none', Referrer-Policy, Permissions-Policy.
// /api/*: solo nosniff + Referrer-Policy (JSON, sin CSP). Plugin global (skip-override).
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()';

function securityHeadersPlugin(app, opts, done) {
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    if (req.url.startsWith('/api/')) return;
    reply.header('Content-Security-Policy', CSP);
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', PERMISSIONS_POLICY);
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  });
  done();
}
securityHeadersPlugin[Symbol.for('skip-override')] = true;
export default securityHeadersPlugin;

// P6: logging sin secretos. Las URL con token (GET /api/invites/:token) se enmascaran; nunca se registran cuerpos ni cookies.
const TOKEN_ROUTES = [/^(\/api\/invites\/)(?!accept\b)[^/?#]+/];
export function redactUrl(url) {
  let u = String(url || '');
  for (const re of TOKEN_ROUTES) u = u.replace(re, '$1[redacted]');
  return u.replace(/([?&](?:token|password|pw)=)[^&#]*/gi, '$1[redacted]');
}
/** Opciones de logger para Fastify/pino: nivel + serializador de request que solo expone método, URL enmascarada e IP. */
export function loggerOptions(level = 'info', extra = {}) {
  return {
    level,
    redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'], censor: '[redacted]' },
    serializers: {
      req: r => ({ method: r.method, url: redactUrl(r.url), remoteAddress: r.ip }),
      res: r => ({ statusCode: r.statusCode }),
    },
    ...extra,
  };
}

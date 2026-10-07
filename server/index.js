// DesTree — Fastify 5 + SQLite. `node server/index.js` escucha; buildApp() se usa en tests.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import ajvFormats from 'ajv-formats';
import path from 'node:path';
import { config } from './config.js';
import { openReady } from './db/sqlite.js';
import { loadSchemas, AJV_OPTIONS, formatErrors } from './lib/schemas.js';
import { HttpError } from './lib/pages.js';
import sessionPlugin from './plugins/session.js';
import guardPlugin from './plugins/guard.js';
import originPlugin from './plugins/origin-check.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import inviteRoutes from './routes/invites.js';
import userRoutes from './routes/users.js';
import pageRoutes from './routes/pages.js';
import cellRoutes from './routes/cells.js';
import nodeRoutes from './routes/nodes.js';

export async function buildApp({ dbPath = config.dbPath, logger = { level: config.logLevel } } = {}) {
  const app = Fastify({
    logger,
    bodyLimit: 32 * 1024 * 1024,
    ajv: { customOptions: AJV_OPTIONS, plugins: [ajvFormats] },
    trustProxy: config.trustProxy,
  });
  const db = openReady(dbPath);
  app.decorate('db', db);
  app.decorate('deletedDir', dbPath === ':memory:' ? null : path.join(path.dirname(dbPath), 'deleted')); // F4a: export JSON al borrar (hasta F6a)
  app.addHook('onClose', async () => db.close());
  for (const s of loadSchemas()) app.addSchema(s);

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'validation', message: err.message, errors: formatErrors(err.validation) });
    if (err instanceof HttpError) {
      const code = { 401: 'unauthorized', 403: 'forbidden', 409: 'conflict', 410: 'gone', 429: 'rate_limited' }[err.status] || 'error';
      return reply.code(err.status).send({ error: code, message: err.message, ...(err.version != null ? { version: err.version } : {}), ...(err.setup != null ? { setup: err.setup } : {}) });
    }
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'error', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Error interno' });
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found', message: 'Ruta no encontrada' });
    return reply.code(404).type('text/plain').send('Not found');
  });

  await app.register(sessionPlugin);
  await app.register(guardPlugin);
  await app.register(originPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(inviteRoutes);
  await app.register(userRoutes);
  await app.register(pageRoutes);
  await app.register(cellRoutes);
  await app.register(nodeRoutes);
  // Cliente estático. normalize.js llega vía symlink client/js/core/normalize.js → server/lib/normalize.js.
  await app.register(fastifyStatic, { root: config.clientDir, prefix: '/', index: ['index.html'], cacheControl: false, decorateReply: false });
  app.get('/favicon.ico', (req, reply) => reply.code(204).send());
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`DesTree → http://localhost:${config.port}/`);
  } catch (err) { app.log.error(err); process.exit(1); }
}

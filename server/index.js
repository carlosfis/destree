// DesTree — Fastify 5 + SQLite. `node server/index.js` escucha; buildApp() se usa en tests.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import ajvFormats from 'ajv-formats';
import path from 'node:path';
import { config } from './config.js';
import { openReady } from './db/sqlite.js';
import { loadSchemas, AJV_OPTIONS, formatErrors } from './lib/schemas.js';
import { HttpError } from './lib/pages.js';
import healthRoutes from './routes/health.js';
import pageRoutes from './routes/pages.js';

export async function buildApp({ dbPath = config.dbPath, logger = { level: config.logLevel } } = {}) {
  const app = Fastify({
    logger,
    bodyLimit: 32 * 1024 * 1024,
    ajv: { customOptions: AJV_OPTIONS, plugins: [ajvFormats] },
  });
  const db = openReady(dbPath);
  app.decorate('db', db);
  app.addHook('onClose', async () => db.close());
  for (const s of loadSchemas()) app.addSchema(s);

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'validation', message: err.message, errors: formatErrors(err.validation) });
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.status === 409 ? 'conflict' : 'error', message: err.message, ...(err.version != null ? { version: err.version } : {}) });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'error', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Error interno' });
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found', message: 'Ruta no encontrada' });
    return reply.code(404).type('text/plain').send('Not found');
  });

  await app.register(healthRoutes);
  await app.register(pageRoutes);
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

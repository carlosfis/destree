// DesTree — Fastify 5 + SQLite. `node server/index.js` escucha; buildApp() se usa en tests.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import ajvFormats from 'ajv-formats';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { config } from './config.js';
import { openReady, migrate } from './db/sqlite.js';
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
import auditRoutes from './routes/audit.js';
import imageRoutes from './routes/images.js';
import versionRoutes from './routes/versions.js';
import backupRoutes from './routes/backups.js';
import { createBackup, scheduleBackups, acquireLock } from './lib/backup.js';
import { migrateLegacyImages, purgeOrphans } from './lib/images.js';

export async function buildApp({ dbPath = config.dbPath, logger = { level: config.logLevel } } = {}) {
  const app = Fastify({
    logger,
    bodyLimit: 32 * 1024 * 1024,
    ajv: { customOptions: AJV_OPTIONS, plugins: [ajvFormats] },
    trustProxy: config.trustProxy,
  });
  const db = openReady(dbPath);
  app.decorate('db', db);
  app.decorate('uploadsDir', config.uploadsDir || (dbPath === ':memory:' ? fs.mkdtempSync(path.join(os.tmpdir(), 'destree-uploads-')) : path.join(path.dirname(dbPath), 'uploads'))); // F5
  app.decorate('backupsDir', config.backupsDir || (dbPath === ':memory:' ? fs.mkdtempSync(path.join(os.tmpdir(), 'destree-backups-')) : path.join(path.dirname(dbPath), 'backups'))); // F6b
  const migrated = await migrateLegacyImages(db, app.uploadsDir); // F5: dataURLs heredadas → archivos
  if (migrated && logger) app.log.info(`imágenes legadas migradas: ${migrated}`);
  for (const m of migrate(db)) app.log.info(`migración aplicada tras vaciar image_legacy: ${m}`); // F7: 008 queda pendiente hasta aquí
  app.addHook('onClose', async () => db.close());
  for (const s of loadSchemas()) app.addSchema(s);

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'validation', message: err.message, errors: formatErrors(err.validation) });
    if (err instanceof HttpError) {
      const code = { 401: 'unauthorized', 403: 'forbidden', 409: 'conflict', 410: 'gone', 413: 'too_large', 415: 'unsupported', 429: 'rate_limited' }[err.status] || 'error';
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
  await app.register(auditRoutes);
  await app.register(imageRoutes);
  await app.register(versionRoutes);
  await app.register(backupRoutes);
  app.addHook('onReady', async () => { try { purgeOrphans(db, app.uploadsDir); } catch (err) { app.log.warn(err, 'purga de imágenes huérfanas'); } });
  // F6b: lock para scripts/restore.js + respaldos programados (BACKUP_CRON)
  let releaseLock = () => {};
  app.addHook('onListen', async () => { releaseLock = acquireLock(dbPath); });
  const stopCron = scheduleBackups(config.backupCron, () => createBackup(db, { backupsDir: app.backupsDir, uploadsDir: app.uploadsDir, kind: 'scheduled' }).then(b => app.log.info(`respaldo programado: ${b.filename}`)), err => app.log.error(err, 'respaldo programado'));
  app.addHook('onClose', async () => { stopCron(); releaseLock(); });
  // Cliente estático. normalize.js llega vía symlink client/js/core/normalize.js → server/lib/normalize.js.
  await app.register(fastifyStatic, { root: config.clientDir, prefix: '/', index: ['index.html'], cacheControl: false, decorateReply: false });
  app.get('/favicon.ico', (req, reply) => reply.code(204).send());
  return app;
}

/** F7: comprobaciones de arranque: carpeta de datos escribible; SERVER_SECRET solo se exige cuando haya integración Figma (F8a). */
export function checkEnvironment(log = console) {
  if (config.dbPath !== ':memory:') {
    const dir = path.dirname(config.dbPath);
    try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); } catch (err) { throw new Error(`La carpeta de datos ${dir} no es escribible (${err.message}). En Docker: chown -R 1000:1000 ./data`); }
  }
  if (!process.env.SERVER_SECRET && config.figmaPat) log.warn('SERVER_SECRET no definido: necesario para cifrar el PAT de Figma');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try { checkEnvironment(); } catch (err) { console.error(err.message); process.exit(1); }
  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`DesTree → http://localhost:${config.port}/`);
  } catch (err) { app.log.error(err); process.exit(1); }
}

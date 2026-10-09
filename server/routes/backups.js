// F6b: /api/backups (POST/GET/DELETE, descarga) · GET /api/org/export?images= (acción backups, nivel ≥4) · POST /api/org/import (P10: org.import, solo admin).
import fs from 'node:fs';
import path from 'node:path';
import { createBackup, listBackups, getBackup, deleteBackup } from '../lib/backup.js';
import { exportOrg, importOrg } from '../lib/org-export.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };

export default async function backupRoutes(app) {
  const guard = app.guard('backups');
  app.get('/api/backups', { onRequest: guard }, async () => ({ backups: listBackups(app.db), dir: app.backupsDir }));
  app.post('/api/backups', { onRequest: guard }, async (req, reply) => {
    const b = await createBackup(app.db, { backupsDir: app.backupsDir, uploadsDir: app.uploadsDir, kind: 'manual', createdBy: req.user.id });
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'backup.create', entity: 'backup', entityId: b.id, meta: { bytes: b.bytes } });
    reply.code(201); return b;
  });
  app.get('/api/backups/:id/download', { onRequest: guard, schema: { params: idParam } }, async (req, reply) => {
    const b = getBackup(app.db, req.params.id), file = path.join(app.backupsDir, b.filename);
    if (b.status !== 'ok' || !fs.existsSync(file)) throw new HttpError(404, 'Archivo de respaldo no disponible');
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'backup.download', entity: 'backup', entityId: b.id });
    reply.header('Content-Type', 'application/gzip').header('Content-Disposition', `attachment; filename="${b.filename}"`).header('Content-Length', String(b.bytes));
    return reply.send(fs.createReadStream(file));
  });
  app.delete('/api/backups/:id', { onRequest: guard, schema: { params: idParam } }, async (req, reply) => {
    deleteBackup(app.db, app.backupsDir, req.params.id);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'backup.delete', entity: 'backup', entityId: req.params.id });
    return reply.code(204).send();
  });

  app.get('/api/org/export', { onRequest: guard, schema: { querystring: { type: 'object', properties: { images: { enum: ['manifest', 'embed'] } } } } }, async (req, reply) => {
    const data = exportOrg(app.db, app.uploadsDir, { orgId: req.orgId, images: req.query.images || 'manifest' });
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'org.export', entity: 'org', entityId: req.orgId, meta: { pages: data.pages.length, images: req.query.images || 'manifest' } });
    reply.header('Content-Disposition', `attachment; filename="destree-org-${data.exportedAt.slice(0, 10)}.json"`);
    return data;
  });
  app.post('/api/org/import', { onRequest: app.guard('org.import'), schema: { body: { $ref: 'org-export.schema.json#' } }, bodyLimit: 512 * 1024 * 1024 }, async (req) => {
    const stats = importOrg(app.db, app.uploadsDir, req.body, { orgId: req.orgId, importedBy: req.user.id });
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'org.import', entity: 'org', entityId: req.orgId, meta: stats });
    return stats;
  });
}

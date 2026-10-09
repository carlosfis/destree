// F5: POST /api/images (cuerpo binario image/*, ≤5 MB) · DELETE /api/images/:id · GET /uploads/:id[/thumb] con visibilidad (regla 5).
import fs from 'node:fs';
import { storeImage, deleteImage, getImage, imageVisibleFor, filesOf, MAX_BYTES } from '../lib/images.js';
import { visibilityCtx } from '../lib/cells.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';
import { rateLimit } from '../lib/auth.js';

const limitedUpload = async (req) => rateLimit(req.ip, { max: 60, windowMs: 60e3, bucket: 'images' }); // P6

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };

export default async function imageRoutes(app) {
  // Cuerpo binario: la UI envía el File tal cual (Content-Type del archivo). Sin dependencia multipart.
  app.addContentTypeParser(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'application/octet-stream'], { parseAs: 'buffer', bodyLimit: MAX_BYTES + 1024 }, (req, body, done) => done(null, body));

  app.post('/api/images', { onRequest: [app.guard('nodes.own'), limitedUpload], schema: { querystring: { type: 'object', properties: { kind: { enum: ['node', 'page'] }, filename: { type: 'string', maxLength: 200 } } } } }, async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) throw new HttpError(415, 'Envía la imagen como cuerpo binario con su Content-Type (image/png, image/jpeg, image/webp o image/svg+xml)');
    const img = await storeImage(app.db, app.uploadsDir, { buffer: req.body, orgId: req.orgId, kind: req.query.kind || 'node', createdBy: req.user.id, filename: req.query.filename || '' });
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'image.upload', entity: 'image', entityId: img.id, meta: { bytes: img.bytes, width: img.width, height: img.height } });
    reply.code(201);
    return { ...img, url: `/uploads/${img.id}`, thumbUrl: `/uploads/${img.id}/thumb` };
  });

  app.delete('/api/images/:id', { onRequest: app.guard('pages.edit'), schema: { params: idParam } }, async (req, reply) => {
    deleteImage(app.db, app.uploadsDir, req.params.id);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'image.delete', entity: 'image', entityId: req.params.id });
    return reply.code(204).send();
  });

  const serve = (variant) => async (req, reply) => {
    const ctx = visibilityCtx(req);
    if (!ctx) throw new HttpError(401, 'Inicia sesión');
    const img = getImage(app.db, req.params.id);
    if (!imageVisibleFor(app.db, img, ctx)) throw new HttpError(403, 'Sin acceso a esta imagen');
    const file = filesOf(app.uploadsDir, img.org_id, img.id)[variant];
    if (!fs.existsSync(file)) throw new HttpError(404, 'Archivo no encontrado');
    const etag = `"${img.id}-${variant}"`;
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    reply.header('Content-Type', 'image/webp').header('Cache-Control', 'private, max-age=86400').header('ETag', etag).header('X-Content-Type-Options', 'nosniff');
    return reply.send(fs.createReadStream(file));
  };
  app.get('/uploads/:id', { schema: { params: idParam } }, serve('full'));
  app.get('/uploads/:id/thumb', { schema: { params: idParam } }, serve('thumb'));
}

// GET/POST /api/pages · GET/PUT/PATCH/DELETE /api/pages/:id · archive/unarchive/duplicate/restore-deleted · POST /api/import. Guard por acción + audit.
import { listPages, getDocument, saveDocument, createPage, importDocument, updatePageMeta, setPageStatus, deletePage, duplicatePage, pageMeta, reconcileForEditor, HttpError } from '../lib/pages.js';
import { DEFAULT_PAGE_ID } from '../db/sqlite.js';
import { audit } from '../lib/audit.js';
import { visibilityCtx } from '../lib/cells.js';
import { can } from '../lib/permissions.js';
import { ingestDataUrls, embedImages } from '../lib/images.js';
import { createVersion, restoreLatestIfDiverged } from '../lib/versions.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };
const parseIfMatch = h => { if (h == null) return null; const m = String(h).trim().match(/^(?:W\/)?"?(\d+)"?$/); if (!m) throw new HttpError(400, 'If-Match inválido: se espera la versión numérica'); return Number(m[1]); };
const metaProps = { name: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', maxLength: 500 }, visibility: { enum: ['org', 'cells'] }, cellIds: { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 64 } } };

export default async function pageRoutes(app) {
  const log = (req, action, entityId, meta) => audit(app.db, { orgId: req.orgId, userId: req.user.id, action, entity: 'page', entityId, meta });
  const visibleOr404 = (req, id) => { const p = pageMeta(app.db, id); if (p.status === 'deleted' && !can(req, 'pages.delete')) throw new HttpError(404, 'Página no encontrada'); return p; };

  app.get('/api/pages', { onRequest: app.guard('pages.read'), schema: { querystring: { type: 'object', properties: { status: { enum: ['active', 'archived', 'deleted', 'all'] } } } } }, async (req) => {
    const status = req.query.status || 'active';
    if (status === 'deleted' && !can(req, 'pages.delete')) throw new HttpError(403, 'Sin permisos para listar páginas borradas');
    return { pages: listPages(app.db, req.orgId, visibilityCtx(req), status) };
  });

  app.post('/api/pages', {
    onRequest: app.guard('pages.create'),
    schema: { body: { type: 'object', required: ['name'], additionalProperties: false, properties: metaProps } },
  }, async (req, reply) => {
    const doc = createPage(app.db, { ...req.body, createdBy: req.user.id }, req.orgId);
    log(req, 'page.create', doc.page.id, { name: doc.page.name });
    reply.code(201).header('ETag', `"${doc.page.version}"`);
    return doc;
  });

  app.get('/api/pages/:id', { onRequest: app.guard('pages.read'), schema: { params: idParam, querystring: { type: 'object', properties: { embedImages: { enum: ['1', 'true'] } } } } }, async (req, reply) => {
    visibleOr404(req, req.params.id);
    const doc = getDocument(app.db, req.params.id, visibilityCtx(req));
    if (req.query.embedImages) embedImages(app.db, app.uploadsDir, doc); // F5: export portable
    reply.header('ETag', `"${doc.page.version}"`).header('Cache-Control', 'no-store');
    return doc;
  });

  app.put('/api/pages/:id', {
    onRequest: app.guard('pages.edit'),
    schema: { params: idParam, body: { $ref: 'page-document.schema.json#' } },
  }, async (req, reply) => {
    const expected = parseIfMatch(req.headers['if-match']);
    if (expected == null) throw new HttpError(428, 'Falta la cabecera If-Match con la versión de la página');
    await ingestDataUrls(app.db, app.uploadsDir, req.body, { orgId: req.orgId, createdBy: req.user.id }); // F5: dataURL → archivo
    visibleOr404(req, req.params.id); getDocument(app.db, req.params.id, visibilityCtx(req)); // P10: lead solo edita páginas que ve (403 si no)
    const res = saveDocument(app.db, req.params.id, reconcileForEditor(app.db, req.params.id, req.body, visibilityCtx(req)), expected); // P10: conserva lo que el editor no ve
    createVersion(app.db, req.params.id, { reason: 'auto', userId: req.user.id }); // F6a: snapshot si cambió el hash (coalesce 5 min)
    log(req, 'page.save', req.params.id, { version: res.version, nodes: res.nodes });
    reply.header('ETag', `"${res.version}"`);
    return res;
  });

  // F4a: metadatos. P10: visibilidad + células con `pages.visibility` (nivel ≥3); nombre y descripción exigen `pages.meta` (nivel ≥4).
  app.patch('/api/pages/:id', { onRequest: app.guard('pages.visibility'), schema: { params: idParam, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: metaProps } } }, async (req, reply) => {
    if ((req.body.name != null || req.body.description != null) && !can(req, 'pages.meta')) throw new HttpError(403, 'Sin permisos para renombrar la página');
    const p = updatePageMeta(app.db, req.params.id, req.body);
    log(req, 'page.update', p.id, req.body);
    reply.header('ETag', `"${p.version}"`);
    return p;
  });
  const transition = (url, action, status, auditAction, snapshot) => app.post(`/api/pages/:id/${url}`, { onRequest: app.guard(action), schema: { params: idParam } }, async (req) => {
    if (snapshot) createVersion(app.db, req.params.id, { reason: snapshot, userId: req.user.id }); // F6a: antes de cambiar el estado (la retención no toca archived/deleted)
    const p = setPageStatus(app.db, req.params.id, status, req.user.id);
    if (status === 'active' && url === 'restore-deleted') { const n = restoreLatestIfDiverged(app.db, p.id, req.user.id); if (n) p.restoredFromVersion = n; } // F6a
    log(req, auditAction, p.id);
    return p;
  });
  transition('archive', 'pages.archive', 'archived', 'page.archive', 'archive');
  transition('unarchive', 'pages.archive', 'active', 'page.unarchive');
  transition('restore-deleted', 'pages.delete', 'active', 'page.restore');

  app.delete('/api/pages/:id', { onRequest: app.guard('pages.delete'), schema: { params: idParam } }, async (req) => {
    if (listPages(app.db, req.orgId, null, 'active').length <= 1 && pageMeta(app.db, req.params.id).status === 'active') throw new HttpError(409, 'No se puede borrar la única página activa');
    const v = createVersion(app.db, req.params.id, { reason: 'delete', userId: req.user.id }); // F6a: snapshot final
    const p = deletePage(app.db, req.params.id, req.user.id);
    log(req, 'page.delete', p.id, { version: v.number });
    return p;
  });

  app.post('/api/pages/:id/duplicate', { onRequest: app.guard('pages.create'), schema: { params: idParam, body: { type: ['object', 'null'], additionalProperties: false, properties: { name: metaProps.name } } } }, async (req, reply) => {
    visibleOr404(req, req.params.id);
    const doc = duplicatePage(app.db, req.params.id, { name: req.body?.name, createdBy: req.user.id });
    log(req, 'page.duplicate', doc.page.id, { from: req.params.id });
    reply.code(201).header('ETag', `"${doc.page.version}"`);
    return doc;
  });

  // Importa un respaldo legacy (v1/v2) o v3 en la página indicada (?pageId=, por defecto la principal).
  app.post('/api/import', {
    onRequest: app.guard('pages.import'),
    schema: { querystring: { type: 'object', properties: { pageId: { type: 'string', minLength: 1, maxLength: 64 } } }, body: { type: 'object' } },
    bodyLimit: 32 * 1024 * 1024,
  }, async (req) => {
    const pageId = req.query.pageId || DEFAULT_PAGE_ID;
    const images = await ingestDataUrls(app.db, app.uploadsDir, req.body, { orgId: req.orgId, createdBy: req.user.id }); // F5
    const res = importDocument(app.db, pageId, req.body);
    res.images = images;
    createVersion(app.db, pageId, { reason: 'import', userId: req.user.id }); // F6a
    log(req, 'page.import', pageId, { version: res.version, nodes: res.nodes });
    return { pageId, ...res };
  });
}

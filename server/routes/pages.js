// GET/POST /api/pages · GET/PUT/PATCH/DELETE /api/pages/:id · archive/unarchive/duplicate/restore-deleted · POST /api/import. Guard por acción + audit.
import { listPages, getDocument, saveDocument, createPage, importDocument, updatePageMeta, setPageStatus, deletePage, duplicatePage, pageMeta, HttpError } from '../lib/pages.js';
import { DEFAULT_PAGE_ID } from '../db/sqlite.js';
import { audit } from '../lib/audit.js';
import { visibilityCtx } from '../lib/cells.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };
const parseIfMatch = h => { if (h == null) return null; const m = String(h).trim().match(/^(?:W\/)?"?(\d+)"?$/); if (!m) throw new HttpError(400, 'If-Match inválido: se espera la versión numérica'); return Number(m[1]); };
const metaProps = { name: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', maxLength: 500 }, visibility: { enum: ['org', 'cells'] }, cellIds: { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 64 } } };

export default async function pageRoutes(app) {
  const log = (req, action, entityId, meta) => audit(app.db, { orgId: req.orgId, userId: req.user.id, action, entity: 'page', entityId, meta });
  const visibleOr404 = (req, id) => { const p = pageMeta(app.db, id); if (p.status === 'deleted' && req.role !== 'admin') throw new HttpError(404, 'Página no encontrada'); return p; };

  app.get('/api/pages', { onRequest: app.guard('pages.read'), schema: { querystring: { type: 'object', properties: { status: { enum: ['active', 'archived', 'deleted', 'all'] } } } } }, async (req) => {
    const status = req.query.status || 'active';
    if (status === 'deleted' && req.role !== 'admin') throw new HttpError(403, 'Solo admin lista páginas borradas');
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

  app.get('/api/pages/:id', { onRequest: app.guard('pages.read'), schema: { params: idParam } }, async (req, reply) => {
    visibleOr404(req, req.params.id);
    const doc = getDocument(app.db, req.params.id, visibilityCtx(req));
    reply.header('ETag', `"${doc.page.version}"`).header('Cache-Control', 'no-store');
    return doc;
  });

  app.put('/api/pages/:id', {
    onRequest: app.guard('pages.edit'),
    schema: { params: idParam, body: { $ref: 'page-document.schema.json#' } },
  }, async (req, reply) => {
    const expected = parseIfMatch(req.headers['if-match']);
    if (expected == null) throw new HttpError(428, 'Falta la cabecera If-Match con la versión de la página');
    const res = saveDocument(app.db, req.params.id, req.body, expected);
    log(req, 'page.save', req.params.id, { version: res.version, nodes: res.nodes });
    reply.header('ETag', `"${res.version}"`);
    return res;
  });

  // F4a: metadatos (nombre, descripción, visibilidad + células)
  app.patch('/api/pages/:id', { onRequest: app.guard('pages.edit'), schema: { params: idParam, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: metaProps } } }, async (req, reply) => {
    const p = updatePageMeta(app.db, req.params.id, req.body);
    log(req, 'page.update', p.id, req.body);
    reply.header('ETag', `"${p.version}"`);
    return p;
  });
  const transition = (url, action, status, auditAction) => app.post(`/api/pages/:id/${url}`, { onRequest: app.guard(action), schema: { params: idParam } }, async (req) => {
    const p = setPageStatus(app.db, req.params.id, status, req.user.id);
    log(req, auditAction, p.id);
    return p;
  });
  transition('archive', 'pages.archive', 'archived', 'page.archive');
  transition('unarchive', 'pages.archive', 'active', 'page.unarchive');
  transition('restore-deleted', 'pages.delete', 'active', 'page.restore');

  app.delete('/api/pages/:id', { onRequest: app.guard('pages.delete'), schema: { params: idParam } }, async (req) => {
    if (listPages(app.db, req.orgId, null, 'active').length <= 1 && pageMeta(app.db, req.params.id).status === 'active') throw new HttpError(409, 'No se puede borrar la única página activa');
    const p = deletePage(app.db, req.params.id, req.user.id, app.deletedDir);
    log(req, 'page.delete', p.id, { file: p.file });
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
    const res = importDocument(app.db, pageId, req.body);
    log(req, 'page.import', pageId, { version: res.version, nodes: res.nodes });
    return { pageId, ...res };
  });
}

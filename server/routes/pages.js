// GET/POST /api/pages · GET/PUT /api/pages/:id · POST /api/import. F2: guard por acción + audit en escrituras.
import { listPages, getDocument, saveDocument, createPage, importDocument, HttpError } from '../lib/pages.js';
import { DEFAULT_PAGE_ID } from '../db/sqlite.js';
import { audit } from '../lib/audit.js';
import { visibilityCtx } from '../lib/cells.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };
const parseIfMatch = h => { if (h == null) return null; const m = String(h).trim().match(/^(?:W\/)?"?(\d+)"?$/); if (!m) throw new HttpError(400, 'If-Match inválido: se espera la versión numérica'); return Number(m[1]); };

export default async function pageRoutes(app) {
  app.get('/api/pages', { onRequest: app.guard('pages.read') }, async (req) => ({ pages: listPages(app.db, req.orgId, visibilityCtx(req)) }));

  app.post('/api/pages', {
    onRequest: app.guard('pages.create'),
    schema: { body: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', maxLength: 500 } } } },
  }, async (req, reply) => {
    const doc = createPage(app.db, req.body);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'page.create', entity: 'page', entityId: doc.page.id, meta: { name: doc.page.name } });
    reply.code(201).header('ETag', `"${doc.page.version}"`);
    return doc;
  });

  app.get('/api/pages/:id', { onRequest: app.guard('pages.read'), schema: { params: idParam } }, async (req, reply) => {
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
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'page.save', entity: 'page', entityId: req.params.id, meta: { version: res.version, nodes: res.nodes } });
    reply.header('ETag', `"${res.version}"`);
    return res;
  });

  // Importa un respaldo legacy (v1/v2) o v3 en la página indicada (?pageId=, por defecto la principal).
  app.post('/api/import', {
    onRequest: app.guard('pages.import'),
    schema: { querystring: { type: 'object', properties: { pageId: { type: 'string', minLength: 1, maxLength: 64 } } }, body: { type: 'object' } },
    bodyLimit: 32 * 1024 * 1024,
  }, async (req) => {
    const pageId = req.query.pageId || DEFAULT_PAGE_ID;
    const res = importDocument(app.db, pageId, req.body);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'page.import', entity: 'page', entityId: pageId, meta: { version: res.version, nodes: res.nodes } });
    return { pageId, ...res };
  });
}

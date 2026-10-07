// F6a: GET /api/pages/:id/versions · POST (manual) · GET /:n · GET /:a/diff/:b · POST /:n/restore
import { listVersions, getVersion, diffVersions, createVersion, restoreVersion } from '../lib/versions.js';
import { pageMeta, getDocument, HttpError } from '../lib/pages.js';
import { visibilityCtx } from '../lib/cells.js';
import { audit } from '../lib/audit.js';

const idP = { type: 'string', minLength: 1, maxLength: 64 };
const nP = { type: 'string', pattern: '^(\\d{1,9}|current)$' };
const params = (extra = {}) => ({ type: 'object', required: ['id', ...Object.keys(extra)], properties: { id: idP, ...extra } });

export default async function versionRoutes(app) {
  /** Página legible por el usuario (designer: regla 2; borrada: solo admin). */
  const check = (req) => { const p = pageMeta(app.db, req.params.id); if (p.status === 'deleted' && req.role !== 'admin') throw new HttpError(404, 'Página no encontrada'); getDocument(app.db, req.params.id, visibilityCtx(req)); return p; };

  app.get('/api/pages/:id/versions', { onRequest: app.guard('versions.read'), schema: { params: params() } }, async (req) => { check(req); return { versions: listVersions(app.db, req.params.id) }; });

  app.post('/api/pages/:id/versions', { onRequest: app.guard('versions.write'), schema: { params: params(), body: { type: ['object', 'null'], additionalProperties: false, properties: { label: { type: 'string', maxLength: 120 } } } } }, async (req, reply) => {
    check(req);
    const v = createVersion(app.db, req.params.id, { reason: 'manual', label: req.body?.label || '', userId: req.user.id });
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'version.create', entity: 'page', entityId: req.params.id, meta: { number: v.number, label: v.label } });
    reply.code(201); return v;
  });

  app.get('/api/pages/:id/versions/:n', { onRequest: app.guard('versions.read'), schema: { params: params({ n: { type: 'string', pattern: '^\\d{1,9}$' } }) } }, async (req) => { check(req); return getVersion(app.db, req.params.id, req.params.n, visibilityCtx(req)); });

  app.get('/api/pages/:id/versions/:a/diff/:b', { onRequest: app.guard('versions.read'), schema: { params: params({ a: nP, b: nP }) } }, async (req) => { check(req); return diffVersions(app.db, req.params.id, req.params.a, req.params.b, visibilityCtx(req)); });

  app.post('/api/pages/:id/versions/:n/restore', { onRequest: app.guard('versions.write'), schema: { params: params({ n: { type: 'string', pattern: '^\\d{1,9}$' } }) } }, async (req, reply) => {
    check(req);
    const res = restoreVersion(app.db, req.params.id, req.params.n, req.user.id);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'version.restore', entity: 'page', entityId: req.params.id, meta: { from: res.restoredFrom, version: res.version } });
    reply.header('ETag', `"${res.version}"`);
    return res;
  });
}

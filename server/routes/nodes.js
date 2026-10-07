// F3: parches de nodo sin PUT completo (admin/head): visibilidad+células, asignados, responsable. Bumpean `version` de la página.
import { patchNode } from '../lib/pages.js';
import { audit } from '../lib/audit.js';

const params = { type: 'object', required: ['pageId', 'nodeId'], properties: { pageId: { type: 'string', minLength: 1, maxLength: 64 }, nodeId: { type: 'string', minLength: 1, maxLength: 64 } } };
const ids = { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 64 } };

export default async function nodeRoutes(app) {
  const guard = app.guard('pages.edit');
  const done = (req, action, res) => { audit(app.db, { orgId: req.orgId, userId: req.user.id, action, entity: 'node', entityId: req.params.nodeId, meta: { pageId: req.params.pageId, version: res.version } }); return res; };

  app.patch('/api/pages/:pageId/nodes/:nodeId/visibility', {
    onRequest: guard, schema: { params, body: { type: 'object', required: ['visibility'], additionalProperties: false, properties: { visibility: { enum: ['org', 'cells'] }, cellIds: ids } } },
  }, async (req) => done(req, 'node.visibility', patchNode(app.db, req.params.pageId, req.params.nodeId, { visibility: req.body.visibility, cellIds: req.body.cellIds || [] })));

  app.put('/api/pages/:pageId/nodes/:nodeId/assignees', {
    onRequest: guard, schema: { params, body: { type: 'object', required: ['assigneeIds'], additionalProperties: false, properties: { assigneeIds: ids } } },
  }, async (req) => done(req, 'node.assignees', patchNode(app.db, req.params.pageId, req.params.nodeId, { assigneeIds: req.body.assigneeIds })));

  app.patch('/api/pages/:pageId/nodes/:nodeId/owner', {
    onRequest: guard, schema: { params, body: { type: 'object', required: ['ownerUserId'], additionalProperties: false, properties: { ownerUserId: { type: ['string', 'null'], maxLength: 64 } } } },
  }, async (req) => done(req, 'node.owner', patchNode(app.db, req.params.pageId, req.params.nodeId, { ownerUserId: req.body.ownerUserId })));
}

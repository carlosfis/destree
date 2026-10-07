// F3: parches de nodo sin PUT completo (admin/head): visibilidad+células, asignados, responsable. Bumpean `version` de la página.
import { patchNode, listPages } from '../lib/pages.js';
import { visibilityCtx } from '../lib/cells.js';
import { audit } from '../lib/audit.js';

const params = { type: 'object', required: ['pageId', 'nodeId'], properties: { pageId: { type: 'string', minLength: 1, maxLength: 64 }, nodeId: { type: 'string', minLength: 1, maxLength: 64 } } };
const ids = { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 64 } };

export default async function nodeRoutes(app) {
  const guard = app.guard('pages.edit');
  // F4a: asignaciones del usuario en todas las páginas visibles (asignado o responsable).
  app.get('/api/me/assignments', { onRequest: app.guard('pages.read') }, async (req) => {
    const pages = new Map(listPages(app.db, req.orgId, visibilityCtx(req), 'all').map(p => [p.id, p]));
    const rows = app.db.prepare(`SELECT n.page_id AS pageId, n.id AS nodeId, n.name, n.type, n.parent_id AS parentId, n.owner_user_id = ? AS isOwner
      FROM nodes n WHERE n.owner_user_id = ? OR EXISTS (SELECT 1 FROM node_assignees a WHERE a.page_id = n.page_id AND a.node_id = n.id AND a.user_id = ?) ORDER BY n.page_id, n.position`).all(req.user.id, req.user.id, req.user.id);
    return { items: rows.filter(r => pages.has(r.pageId)).map(r => ({ pageId: r.pageId, pageName: pages.get(r.pageId).name, pageStatus: pages.get(r.pageId).status, nodeId: r.nodeId, name: r.name, type: r.type, isRoot: !r.parentId, role: r.isOwner ? 'owner' : 'assignee' })) };
  });
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

// F3: parches de nodo sin PUT completo. P10: visibilidad (`pages.visibility`), asignados/responsable (`nodes.assign`, solo en nodos visibles),
// PATCH de campos propios (`nodes.own`: quien no edita páginas solo toca cards donde es responsable o asignado). Bumpean `version` de la página.
import { patchNode, patchNodeFields, listPages, getDocument, OWN_FIELDS, HttpError } from '../lib/pages.js';
import { visibilityCtx } from '../lib/cells.js';
import { can } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';

const params = { type: 'object', required: ['pageId', 'nodeId'], properties: { pageId: { type: 'string', minLength: 1, maxLength: 64 }, nodeId: { type: 'string', minLength: 1, maxLength: 64 } } };
const ids = { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 64 } };
const str = max => ({ type: 'string', maxLength: max });
const ownBody = { type: 'object', additionalProperties: false, minProperties: 1, properties: {
  name: { type: 'string', minLength: 1, maxLength: 80 }, description: str(140), notes: str(20000), geo: str(2), status: { enum: ['active', 'draft', 'deprecated', 'archived'] },
  imageId: { type: ['string', 'null'], maxLength: 64 }, thumbIconId: { type: ['string', 'null'], maxLength: 64 }, tags: ids,
  docs: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, properties: { label: str(80), url: str(2048) } } },
  staff: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, properties: { name: str(80), role: str(80) } } },
} };

export default async function nodeRoutes(app) {
  // F4a: asignaciones del usuario en todas las páginas visibles (asignado o responsable).
  app.get('/api/me/assignments', { onRequest: app.guard('pages.read') }, async (req) => {
    const pages = new Map(listPages(app.db, req.orgId, visibilityCtx(req), 'all').map(p => [p.id, p]));
    const rows = app.db.prepare(`SELECT n.page_id AS pageId, n.id AS nodeId, n.name, n.type, n.parent_id AS parentId, n.owner_user_id = ? AS isOwner
      FROM nodes n WHERE n.owner_user_id = ? OR EXISTS (SELECT 1 FROM node_assignees a WHERE a.page_id = n.page_id AND a.node_id = n.id AND a.user_id = ?) ORDER BY n.page_id, n.position`).all(req.user.id, req.user.id, req.user.id);
    return { items: rows.filter(r => pages.has(r.pageId)).map(r => ({ pageId: r.pageId, pageName: pages.get(r.pageId).name, pageStatus: pages.get(r.pageId).status, nodeId: r.nodeId, name: r.name, type: r.type, isRoot: !r.parentId, role: r.isOwner ? 'owner' : 'assignee' })) };
  });
  const done = (req, action, res) => { audit(app.db, { orgId: req.orgId, userId: req.user.id, action, entity: 'node', entityId: req.params.nodeId, meta: { pageId: req.params.pageId, version: res.version } }); return res; };
  /** El nodo debe existir en el documento tal como lo ve el usuario (403 si la página no es visible, 404 si el nodo no). */
  const visibleNode = (req) => { const n = getDocument(app.db, req.params.pageId, visibilityCtx(req)).nodes.find(x => x.id === req.params.nodeId); if (!n) throw new HttpError(404, 'Nodo no encontrado'); return n; };

  app.patch('/api/pages/:pageId/nodes/:nodeId/visibility', {
    onRequest: app.guard('pages.visibility'), schema: { params, body: { type: 'object', required: ['visibility'], additionalProperties: false, properties: { visibility: { enum: ['org', 'cells'] }, cellIds: ids } } },
  }, async (req) => done(req, 'node.visibility', patchNode(app.db, req.params.pageId, req.params.nodeId, { visibility: req.body.visibility, cellIds: req.body.cellIds || [] })));

  app.put('/api/pages/:pageId/nodes/:nodeId/assignees', {
    onRequest: app.guard('nodes.assign'), schema: { params, body: { type: 'object', required: ['assigneeIds'], additionalProperties: false, properties: { assigneeIds: ids } } },
  }, async (req) => { visibleNode(req); return done(req, 'node.assignees', patchNode(app.db, req.params.pageId, req.params.nodeId, { assigneeIds: req.body.assigneeIds })); });

  app.patch('/api/pages/:pageId/nodes/:nodeId/owner', {
    onRequest: app.guard('nodes.assign'), schema: { params, body: { type: 'object', required: ['ownerUserId'], additionalProperties: false, properties: { ownerUserId: { type: ['string', 'null'], maxLength: 64 } } } },
  }, async (req) => { visibleNode(req); return done(req, 'node.owner', patchNode(app.db, req.params.pageId, req.params.nodeId, { ownerUserId: req.body.ownerUserId })); });

  // P10: campos propios de la card (OWN_FIELDS). Sin `pages.edit` solo en cards donde el usuario es responsable o asignado.
  app.patch('/api/pages/:pageId/nodes/:nodeId', { onRequest: app.guard('nodes.own'), schema: { params, body: ownBody } }, async (req) => {
    const n = visibleNode(req);
    if (!can(req, 'pages.edit') && n.ownerUserId !== req.user.id && !(n.assigneeIds || []).includes(req.user.id)) throw new HttpError(403, 'Solo puedes editar las cards asignadas a ti');
    const body = Object.fromEntries(Object.entries(req.body).filter(([k]) => OWN_FIELDS.includes(k)));
    return done(req, 'node.update', patchNodeFields(app.db, req.params.pageId, req.params.nodeId, body));
  });
}

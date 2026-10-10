// Página de proyecto de una card: GET (crea la plantilla la primera vez) + CRUD de secciones, fases y actividades.
// Lectura: `pages.read` sobre una card visible. Escritura: `projects.edit` (todos) pero, sin `pages.edit`, solo en cards donde uno es responsable o asignado.
import { getDocument, HttpError } from '../lib/pages.js';
import { visibilityCtx } from '../lib/cells.js';
import { can } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';
import { SECTION_KINDS, STATUSES } from '../lib/project-template.js';
import * as P from '../lib/projects.js';

const BASE = '/api/pages/:pageId/nodes/:nodeId/project';
const params = { type: 'object', required: ['pageId', 'nodeId'], properties: { pageId: { type: 'string', minLength: 1, maxLength: 64 }, nodeId: { type: 'string', minLength: 1, maxLength: 64 } } };
const paramsId = { ...params, required: [...params.required, 'id'], properties: { ...params.properties, id: { type: 'string', minLength: 1, maxLength: 64 } } };
const str = max => ({ type: 'string', maxLength: max });
const date = { type: ['string', 'null'], pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' };
const pos = { type: 'integer', minimum: 0, maximum: 10000 };
const body = (props, required = []) => ({ type: 'object', additionalProperties: false, minProperties: 1, required, properties: props });
const sectionProps = { kind: { enum: SECTION_KINDS }, title: str(80), data: { type: 'object' }, position: pos };
const phaseProps = { name: { type: 'string', minLength: 1, maxLength: 80 }, color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, position: pos };
const activityProps = { title: { type: 'string', minLength: 1, maxLength: 120 }, description: str(600), tag: str(4), assignee: str(80), phaseId: { type: ['string', 'null'], maxLength: 64 }, startDate: date, endDate: date, status: { enum: STATUSES }, position: pos };

export default async function projectRoutes(app) {
  /** La card debe existir en el documento tal como lo ve el usuario (403 página no visible, 404 card). */
  const visibleNode = (req) => { const doc = getDocument(app.db, req.params.pageId, visibilityCtx(req)); const n = doc.nodes.find(x => x.id === req.params.nodeId); if (!n) throw new HttpError(404, 'Card no encontrada'); return { doc, node: n }; };
  const canEditNode = (req, n) => can(req, 'pages.edit') || n.ownerUserId === req.user.id || (n.assigneeIds || []).includes(req.user.id);
  const editable = (req) => {
    const { doc, node } = visibleNode(req);
    if (doc.page.status !== 'active') throw new HttpError(409, 'La página no está activa');
    if (!canEditNode(req, node)) throw new HttpError(403, 'Solo puedes editar el proyecto de las cards asignadas a ti');
    return node;
  };
  const log = (req, action, entityId, meta = {}) => audit(app.db, { orgId: req.orgId, userId: req.user.id, action, entity: 'project', entityId, meta: { pageId: req.params.pageId, nodeId: req.params.nodeId, ...meta } });
  const ids = req => [req.params.pageId, req.params.nodeId];

  app.get(BASE, { onRequest: app.guard('pages.read'), schema: { params } }, async (req) => {
    const { node } = visibleNode(req);
    return { ...P.getProject(app.db, ...ids(req), node), canEdit: canEditNode(req, node) };
  });
  app.patch(BASE, { onRequest: app.guard('projects.edit'), schema: { params, body: body({ tagline: str(300), sprintWeeks: { type: 'integer', minimum: 1, maximum: 8 }, sprintOffset: { type: 'integer', minimum: -999, maximum: 999 } }) } }, async (req) => {
    editable(req); const s = P.updateSettings(app.db, ...ids(req), req.body); log(req, 'project.settings', req.params.nodeId, req.body); return s;
  });
  // Secciones del Overview
  app.post(`${BASE}/sections`, { onRequest: app.guard('projects.edit'), schema: { params, body: body(sectionProps, ['kind']) } }, async (req, reply) => {
    editable(req); const s = P.createSection(app.db, ...ids(req), req.body); log(req, 'project.section.create', s.id, { kind: s.kind, title: s.title }); reply.code(201); return s;
  });
  app.patch(`${BASE}/sections/:id`, { onRequest: app.guard('projects.edit'), schema: { params: paramsId, body: body({ title: sectionProps.title, data: sectionProps.data, position: pos }) } }, async (req) => {
    editable(req); const s = P.updateSection(app.db, ...ids(req), req.params.id, req.body); log(req, 'project.section.update', s.id, { title: s.title }); return s;
  });
  app.delete(`${BASE}/sections/:id`, { onRequest: app.guard('projects.edit'), schema: { params: paramsId } }, async (req, reply) => {
    editable(req); P.deleteSection(app.db, ...ids(req), req.params.id); log(req, 'project.section.delete', req.params.id); return reply.code(204).send();
  });
  // Fases del cronograma
  app.post(`${BASE}/phases`, { onRequest: app.guard('projects.edit'), schema: { params, body: body(phaseProps, ['name']) } }, async (req, reply) => {
    editable(req); const p = P.createPhase(app.db, ...ids(req), req.body); log(req, 'project.phase.create', p.id, { name: p.name }); reply.code(201); return p;
  });
  app.patch(`${BASE}/phases/:id`, { onRequest: app.guard('projects.edit'), schema: { params: paramsId, body: body(phaseProps) } }, async (req) => {
    editable(req); const p = P.updatePhase(app.db, ...ids(req), req.params.id, req.body); log(req, 'project.phase.update', p.id, { name: p.name }); return p;
  });
  app.delete(`${BASE}/phases/:id`, { onRequest: app.guard('projects.edit'), schema: { params: paramsId } }, async (req, reply) => {
    editable(req); P.deletePhase(app.db, ...ids(req), req.params.id); log(req, 'project.phase.delete', req.params.id); return reply.code(204).send();
  });
  // Actividades (cronograma + kanban)
  app.post(`${BASE}/activities`, { onRequest: app.guard('projects.edit'), schema: { params, body: body(activityProps, ['title']) } }, async (req, reply) => {
    editable(req); const a = P.createActivity(app.db, ...ids(req), req.body); log(req, 'project.activity.create', a.id, { title: a.title, status: a.status }); reply.code(201); return a;
  });
  app.patch(`${BASE}/activities/:id`, { onRequest: app.guard('projects.edit'), schema: { params: paramsId, body: body(activityProps) } }, async (req) => {
    editable(req); const a = P.updateActivity(app.db, ...ids(req), req.params.id, req.body); log(req, 'project.activity.update', a.id, { title: a.title, status: a.status }); return a;
  });
  app.delete(`${BASE}/activities/:id`, { onRequest: app.guard('projects.edit'), schema: { params: paramsId } }, async (req, reply) => {
    editable(req); P.deleteActivity(app.db, ...ids(req), req.params.id); log(req, 'project.activity.delete', req.params.id); return reply.code(204).send();
  });
}

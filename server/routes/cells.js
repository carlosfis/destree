// F3: GET /api/cells (admin/head) · POST/PATCH/DELETE (admin) · PUT /api/cells/:id/members (admin; head solo en sus células) · GET /api/users/directory (admin/head).
import { listCells, createCell, updateCell, deleteCell, setCellMembers, canManageCell } from '../lib/cells.js';
import { listUsers } from '../lib/auth.js';
import { TAG_COLORS } from '../lib/normalize.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/pages.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } };
const cellBody = (required) => ({ type: 'object', required, additionalProperties: false, minProperties: 1, properties: {
  name: { type: 'string', minLength: 1, maxLength: 80 }, color: { enum: TAG_COLORS }, description: { type: 'string', maxLength: 500 }, leadUserId: { type: ['string', 'null'], maxLength: 64 } } });

export default async function cellRoutes(app) {
  app.get('/api/cells', { onRequest: app.guard('cells.read') }, async (req) => ({ cells: listCells(app.db, req.orgId) }));

  app.post('/api/cells', { onRequest: app.guard('cells.manage'), schema: { body: cellBody(['name']) } }, async (req, reply) => {
    const c = createCell(app.db, req.body, req.orgId);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'cell.create', entity: 'cell', entityId: c.id, meta: { name: c.name } });
    reply.code(201); return c;
  });

  app.patch('/api/cells/:id', { onRequest: app.guard('cells.manage'), schema: { params: idParam, body: cellBody([]) } }, async (req) => {
    const c = updateCell(app.db, req.params.id, req.body, req.orgId);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'cell.update', entity: 'cell', entityId: c.id, meta: req.body });
    return c;
  });

  app.delete('/api/cells/:id', { onRequest: app.guard('cells.manage'), schema: { params: idParam } }, async (req, reply) => {
    deleteCell(app.db, req.params.id, req.orgId);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'cell.delete', entity: 'cell', entityId: req.params.id });
    return reply.code(204).send();
  });

  app.put('/api/cells/:id/members', {
    onRequest: app.guard('cells.members'),
    schema: { params: idParam, body: { type: 'object', required: ['userIds'], additionalProperties: false, properties: { userIds: { type: 'array', maxItems: 500, items: { type: 'string', minLength: 1, maxLength: 64 } } } } },
  }, async (req) => {
    if (!canManageCell(app.db, { role: req.role, userId: req.user.id }, req.params.id)) throw new HttpError(403, 'Solo puedes gestionar miembros de tus células');
    const c = setCellMembers(app.db, req.params.id, req.body.userIds, req.orgId);
    audit(app.db, { orgId: req.orgId, userId: req.user.id, action: 'cell.members', entity: 'cell', entityId: c.id, meta: { count: c.memberIds.length } });
    return c;
  });

  // Directorio mínimo (sin correos de inactivos ni fechas) para asignar responsables/asignados.
  app.get('/api/users/directory', { onRequest: app.guard('directory.read') }, async (req) => ({
    users: listUsers(app.db, req.orgId).filter(u => u.isActive).map(u => ({ id: u.id, name: u.name || u.email, email: u.email, role: u.role })),
  }));
}

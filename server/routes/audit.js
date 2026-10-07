// F4b: GET /api/audit?limit&before&action (admin). Paginación por id ULID descendente.
import { listAudit } from '../lib/audit.js';
export default async function auditRoutes(app) {
  app.get('/api/audit', {
    onRequest: app.guard('audit.read'),
    schema: { querystring: { type: 'object', properties: { limit: { type: 'string', pattern: '^[0-9]{1,3}$' }, before: { type: 'string', maxLength: 64 }, action: { type: 'string', maxLength: 64 } } } },
  }, async (req) => listAudit(app.db, req.orgId, req.query));
}

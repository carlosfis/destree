// F2/P10: matriz por niveles, tabla ruta × rol (admin/ops/head/lead/viewer/anónimo) → status; 401 sin sesión; origin-check (+skipOriginCheck); invitaciones (410); último admin; rate-limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/index.js';
import { ACTIONS, ROLES, can, permissionsFor, canAssignRole, assignableRoles, canManageUser, roleLabels, levelOf } from '../server/lib/permissions.js';
import { resetRateLimit, hashPassword, verifyPassword } from '../server/lib/auth.js';
import { setupAdmin, login, inviteAndAccept, PW } from './helpers/auth.js';

const page = (over = {}) => ({ version: 3, page: { id: 'p_default', name: 'X' }, nodes: [], edges: [], tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 }, ...over });

test('permissions.js: jerarquía estricta por nivel; roles asignables; etiquetas (Admin fija)', () => {
  for (const a of ACTIONS) assert.ok(can({ role: 'admin' }, a), a);
  assert.deepEqual(ROLES.map(levelOf), [5, 4, 3, 2, 1]);
  for (let i = 1; i < ROLES.length; i++) for (const a of permissionsFor(ROLES[i])) assert.ok(can({ role: ROLES[i - 1] }, a), `${ROLES[i - 1]} ⊇ ${ROLES[i]}: ${a}`);
  assert.deepEqual(permissionsFor('viewer'), ['pages.read', 'pages.export', 'nodes.own', 'projects.edit', 'versions.read']);
  assert.ok(can({ role: 'lead' }, 'pages.edit') && !can({ role: 'lead' }, 'pages.all') && !can({ role: 'lead' }, 'pages.visibility'));
  assert.ok(can({ role: 'head' }, 'pages.visibility') && !can({ role: 'head' }, 'pages.create') && !can({ role: 'head' }, 'users.manage'));
  assert.ok(can({ role: 'ops' }, 'users.manage') && can({ role: 'ops' }, 'backups') && !can({ role: 'ops' }, 'org.settings') && !can({ role: 'ops' }, 'org.delete'));
  assert.throws(() => can({ role: 'admin' }, 'nope'));
  assert.ok(!can(null, 'pages.read') && !can({ role: 'designer' }, 'pages.read'));
  assert.deepEqual(assignableRoles('admin'), ROLES); assert.deepEqual(assignableRoles('ops'), ['ops', 'head', 'lead', 'viewer']);
  assert.deepEqual(assignableRoles('head'), ['lead', 'viewer']); assert.deepEqual(assignableRoles('lead'), ['viewer']); assert.deepEqual(assignableRoles('viewer'), []);
  assert.ok(!canAssignRole({ role: 'ops' }, 'admin') && !canAssignRole({ role: 'head' }, 'nope'));
  assert.ok(canManageUser({ role: 'ops' }, 'ops') && !canManageUser({ role: 'ops' }, 'admin') && !canManageUser({ role: 'head' }, 'viewer'));
  assert.deepEqual(roleLabels({ admin: 'Dios', ops: ' Design Ops ', head: '', lead: 'Lead', viewer: 'x'.repeat(40) }), { admin: 'Admin', ops: 'Design Ops', head: 'Head', lead: 'Lead', viewer: 'x'.repeat(24) });
  const h = hashPassword('abc12345'); assert.ok(h.startsWith('scrypt$')); assert.ok(verifyPassword('abc12345', h)); assert.ok(!verifyPassword('abc12346', h));
});

test('rutas × rol → status; sin sesión → 401 (+setup); 403 por debajo del nivel', async (t) => {
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  app.post('/api/_skip', { config: { skipOriginCheck: true } }, async () => ({ ok: true }));
  app.post('/api/_nope', async () => ({ ok: true }));
  t.after(() => app.close());
  const st = async (o) => (await app.inject(o)).statusCode;

  // Sin usuarios: todo /api/* protegido → 401 con setup:true
  const first = await app.inject({ method: 'GET', url: '/api/pages' });
  assert.equal(first.statusCode, 401); assert.equal(first.json().setup, true);
  assert.equal((await app.inject({ method: 'GET', url: '/api/setup' })).json().needed, true);
  assert.equal(await st({ method: 'GET', url: '/api/health' }), 200);

  const admin = await setupAdmin(app);
  assert.equal(await st({ method: 'POST', url: '/api/setup', payload: { orgName: 'Otra', email: 'x@y.z', password: PW } }), 409);
  assert.equal((await app.inject({ method: 'GET', url: '/api/setup' })).json().needed, false);
  const noSess = await app.inject({ method: 'GET', url: '/api/me' });
  assert.equal(noSess.statusCode, 401); assert.equal(noSess.json().setup, false);

  const ops = (await inviteAndAccept(app, admin, 'ops@test.io', 'ops', 'Ops')).cookie;
  const head = (await inviteAndAccept(app, admin, 'head@test.io', 'head', 'Head')).cookie;
  const lead = (await inviteAndAccept(app, admin, 'lead@test.io', 'lead', 'Lead')).cookie;
  const viewer = (await inviteAndAccept(app, admin, 'des@test.io', 'viewer', 'Des')).cookie;

  const me = (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: viewer } })).json();
  assert.equal(me.role, 'viewer'); assert.deepEqual(me.permissions, permissionsFor('viewer')); assert.equal(me.org.name, 'Test org'); assert.equal(me.org.roleLabels.viewer, 'Viewer');

  const put = { method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '0' }, payload: page() };
  const table = [
    // [descripción, request, admin, ops, head, lead, viewer, anónimo]
    ['GET /api/me', { method: 'GET', url: '/api/me' }, 200, 200, 200, 200, 200, 401],
    ['GET /api/pages', { method: 'GET', url: '/api/pages' }, 200, 200, 200, 200, 200, 401],
    ['GET /api/pages/:id', { method: 'GET', url: '/api/pages/p_default' }, 200, 200, 200, 200, 200, 401],
    ['PUT /api/pages/:id', put, 200, 200, 200, 200, 403, 401],
    ['POST /api/pages', { method: 'POST', url: '/api/pages', payload: { name: 'N' } }, 201, 201, 403, 403, 403, 401],
    ['POST /api/import', { method: 'POST', url: '/api/import', payload: { nodes: [], edges: [] } }, 200, 200, 403, 403, 403, 401],
    ['PATCH /api/pages/:id (name)', { method: 'PATCH', url: '/api/pages/p_default', payload: { name: 'X' } }, 200, 200, 403, 403, 403, 401],
    ['PATCH /api/pages/:id (visibility)', { method: 'PATCH', url: '/api/pages/p_default', payload: { visibility: 'org' } }, 200, 200, 200, 403, 403, 401],
    ['GET /api/users', { method: 'GET', url: '/api/users' }, 200, 200, 403, 403, 403, 401],
    ['POST /api/users', { method: 'POST', url: '/api/users', payload: { email: 'n@test.io', password: PW, role: 'viewer' } }, 201, 201, 403, 403, 403, 401],
    ['PATCH /api/users/:id', { method: 'PATCH', url: '/api/users/nope', payload: { name: 'x' } }, 404, 404, 403, 403, 403, 401],
    ['DELETE /api/users/:id', { method: 'DELETE', url: '/api/users/nope' }, 404, 404, 403, 403, 403, 401],
    ['GET /api/org', { method: 'GET', url: '/api/org' }, 200, 200, 403, 403, 403, 401],
    ['PATCH /api/org', { method: 'PATCH', url: '/api/org', payload: { name: 'Test org' } }, 200, 403, 403, 403, 403, 401],
    ['POST /api/org/import', { method: 'POST', url: '/api/org/import', payload: {} }, 400, 403, 403, 403, 403, 401],
    ['GET /api/backups', { method: 'GET', url: '/api/backups' }, 200, 200, 403, 403, 403, 401],
    ['GET /api/invites', { method: 'GET', url: '/api/invites' }, 200, 200, 200, 200, 403, 401],
    ['POST /api/invites', { method: 'POST', url: '/api/invites', payload: { email: 'i@test.io', role: 'viewer' } }, 201, 201, 201, 201, 403, 401],
    ['DELETE /api/invites/:id', { method: 'DELETE', url: '/api/invites/nope' }, 404, 404, 404, 404, 403, 401],
    ['GET /api/cells', { method: 'GET', url: '/api/cells' }, 200, 200, 200, 200, 403, 401],
    ['POST /api/cells', { method: 'POST', url: '/api/cells', payload: { name: 'C' } }, 201, 201, 201, 403, 403, 401],
    ['GET /api/users/directory', { method: 'GET', url: '/api/users/directory' }, 200, 200, 200, 200, 403, 401],
    ['GET /api/audit', { method: 'GET', url: '/api/audit' }, 200, 200, 403, 403, 403, 401],
    ['GET /api/pages?status=deleted', { method: 'GET', url: '/api/pages?status=deleted' }, 200, 200, 403, 403, 403, 401],
    ['POST /api/pages/:id/archive', { method: 'POST', url: '/api/pages/nope/archive' }, 404, 404, 403, 403, 403, 401],
    ['DELETE /api/pages/:id', { method: 'DELETE', url: '/api/pages/nope' }, 404, 404, 403, 403, 403, 401],
    ['POST /api/pages/:id/versions', { method: 'POST', url: '/api/pages/p_default/versions', payload: { label: 'v' } }, 201, 201, 201, 403, 403, 401],
    ['PATCH …/nodes/:id/visibility', { method: 'PATCH', url: '/api/pages/p_default/nodes/nope/visibility', payload: { visibility: 'org' } }, 404, 404, 404, 403, 403, 401],
    ['PUT …/nodes/:id/assignees', { method: 'PUT', url: '/api/pages/p_default/nodes/nope/assignees', payload: { assigneeIds: [] } }, 404, 404, 404, 404, 403, 401],
    ['PATCH …/nodes/:id (campos)', { method: 'PATCH', url: '/api/pages/p_default/nodes/nope', payload: { name: 'n' } }, 404, 404, 404, 404, 404, 401],
    ['GET /api/me/assignments', { method: 'GET', url: '/api/me/assignments' }, 200, 200, 200, 200, 200, 401],
    ['POST /api/_nope (sin guard, solo origin)', { method: 'POST', url: '/api/_nope' }, 200, 200, 200, 200, 200, 200],
  ];
  const cookies = { admin, ops, head, lead, viewer, anon: '' };
  for (const [name, req, ...exp] of table) {
    for (const [i, role] of ['admin', 'ops', 'head', 'lead', 'viewer', 'anon'].entries()) {
      const r = await app.inject({ ...req, headers: { ...(req.headers || {}), cookie: cookies[role] } });
      if (req.method === 'PUT' && req.headers) req.headers['if-match'] = String(r.headers.etag ? r.json().version : req.headers['if-match']);
      if (r.statusCode === 201 && req.payload?.email) req.payload = { ...req.payload, email: `${name.includes('users') ? 'u' : 'i'}${i}@test.io` };
      assert.equal(r.statusCode, exp[i], `${name} como ${role}: ${r.body}`);
    }
  }
  // La misma invitación no se repite para el mismo correo tras aceptar: 409
  assert.equal(await st({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'des@test.io', role: 'viewer' } }), 409);

  // origin-check: Origin ajeno → 403 en mutaciones; GET no; skipOriginCheck exento; Origin propio ok
  const bad = { origin: 'https://evil.example', host: 'localhost:3000' };
  assert.equal(await st({ method: 'POST', url: '/api/_nope', headers: bad }), 403);
  assert.equal(await st({ method: 'POST', url: '/api/pages', headers: { ...bad, cookie: admin }, payload: { name: 'N' } }), 403);
  assert.equal(await st({ method: 'GET', url: '/api/pages', headers: { ...bad, cookie: admin } }), 200);
  assert.equal(await st({ method: 'POST', url: '/api/_skip', headers: bad }), 200);
  assert.equal(await st({ method: 'POST', url: '/api/_nope', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' } }), 200);
  assert.equal(await st({ method: 'POST', url: '/api/_nope', headers: { referer: 'http://localhost:3000/#/x', host: 'localhost:3000' } }), 200);

  // Usuarios: último admin no se degrada ni desactiva; desactivado pierde sesión y no entra
  const users = (await app.inject({ method: 'GET', url: '/api/users', headers: { cookie: admin } })).json().users;
  const adminId = users.find(u => u.role === 'admin').id, desId = users.find(u => u.email === 'des@test.io').id;
  assert.ok(Array.isArray(users[0].cellIds) && Array.isArray(users[0].assignments), 'P10: plantilla con células y asignaciones');
  assert.equal(await st({ method: 'PATCH', url: `/api/users/${adminId}`, headers: { cookie: admin }, payload: { role: 'head' } }), 409);
  assert.equal(await st({ method: 'PATCH', url: `/api/users/${adminId}`, headers: { cookie: admin }, payload: { isActive: false } }), 409);
  assert.equal(await st({ method: 'PATCH', url: `/api/users/${desId}`, headers: { cookie: admin }, payload: { role: 'head' } }), 200);
  assert.equal(await st({ method: 'GET', url: '/api/me', headers: { cookie: viewer } }), 401, 'cambio de rol invalida sesiones');
  const des2 = await login(app, 'des@test.io');
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: des2 } })).json().role, 'head');
  assert.equal(await st({ method: 'DELETE', url: `/api/users/${desId}`, headers: { cookie: admin } }), 204);
  assert.equal(await st({ method: 'GET', url: '/api/me', headers: { cookie: des2 } }), 401);
  assert.equal(await st({ method: 'POST', url: '/api/auth/login', payload: { email: 'des@test.io', password: PW } }), 403);
  // logout
  assert.equal(await st({ method: 'POST', url: '/api/auth/logout', headers: { cookie: head } }), 204);
  assert.equal(await st({ method: 'GET', url: '/api/me', headers: { cookie: head } }), 401);
  // audit_log
  const actions = app.db.prepare('SELECT DISTINCT action FROM audit_log').all().map(r => r.action);
  for (const a of ['setup', 'invite.create', 'invite.accept', 'page.save', 'page.create', 'page.import', 'user.create', 'user.update', 'user.deactivate', 'org.update']) assert.ok(actions.includes(a), a);
  // F4b: audit log paginado (admin), filtro por acción, más recientes primero
  const a1 = (await app.inject({ method: 'GET', url: '/api/audit?limit=3', headers: { cookie: admin } })).json();
  assert.equal(a1.items.length, 3); assert.ok(a1.next); assert.ok(a1.items[0].id > a1.items[2].id); assert.ok('userName' in a1.items[0] && typeof a1.items[0].meta === 'object');
  const a2 = (await app.inject({ method: 'GET', url: `/api/audit?limit=3&before=${a1.next}`, headers: { cookie: admin } })).json();
  assert.ok(a2.items.every(i => i.id < a1.next));
  const all = (await app.inject({ method: 'GET', url: '/api/audit?limit=200', headers: { cookie: admin } })).json();
  assert.equal(all.next, null); assert.equal(all.items.length, app.db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n);
  assert.ok((await app.inject({ method: 'GET', url: '/api/audit?action=page.', headers: { cookie: admin } })).json().items.every(i => i.action.startsWith('page.')));
});

test('invitaciones: enlace copiable, info pública (+roleLabel), token caducado → 410, usado → 410, inexistente → 404, revocar', async (t) => {
  resetRateLimit();
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(() => app.close());
  const admin = await setupAdmin(app);
  const inv = await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: admin, host: 'destree.local' }, payload: { email: 'New@Test.io', role: 'head' } });
  assert.equal(inv.statusCode, 201);
  const b = inv.json(); assert.equal(b.emailSent, false); assert.equal(b.email, 'new@test.io');
  assert.match(b.link, /^http:\/\/destree\.local\/#\/invite\/[A-Za-z0-9_-]{40,}$/);
  const token = b.link.split('/#/invite/')[1];
  const info = await app.inject({ method: 'GET', url: `/api/invites/${token}` });
  assert.equal(info.statusCode, 200); assert.equal(info.json().role, 'head'); assert.equal(info.json().roleLabel, 'Head'); assert.equal(info.json().orgName, 'Test org');
  assert.equal((await app.inject({ method: 'GET', url: '/api/invites', headers: { cookie: admin } })).json().invites.length, 1);
  assert.equal((await app.inject({ method: 'GET', url: `/api/invites/${'x'.repeat(43)}` })).statusCode, 404);
  // caducada → 410
  app.db.prepare("UPDATE invites SET expires_at = '2000-01-01T00:00:00.000Z'").run();
  assert.equal((await app.inject({ method: 'GET', url: `/api/invites/${token}` })).statusCode, 410);
  const acc0 = await app.inject({ method: 'POST', url: '/api/invites/accept', payload: { token, name: 'N', password: PW } });
  assert.equal(acc0.statusCode, 410);
  app.db.prepare("UPDATE invites SET expires_at = '2999-01-01T00:00:00.000Z'").run();
  const acc = await app.inject({ method: 'POST', url: '/api/invites/accept', payload: { token, name: 'Nuevo', password: PW } });
  assert.equal(acc.statusCode, 201); assert.equal(acc.json().user.role, 'head'); assert.ok(acc.headers['set-cookie'].includes('destree_sid='));
  assert.equal((await app.inject({ method: 'POST', url: '/api/invites/accept', payload: { token, password: PW } })).statusCode, 410);
  assert.equal((await app.inject({ method: 'GET', url: '/api/invites', headers: { cookie: admin } })).json().invites.length, 0);
  // revocar
  const inv2 = (await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'r@test.io', role: 'viewer' } })).json();
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/invites/${inv2.id}`, headers: { cookie: admin } })).statusCode, 204);
  assert.equal((await app.inject({ method: 'GET', url: `/api/invites/${inv2.link.split('/#/invite/')[1]}` })).statusCode, 404);
  // contraseña corta → 400; rate-limit en login → 429
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.co', password: '' } })).statusCode, 400);
  let last;
  for (let i = 0; i < 12; i++) last = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.co', password: 'wrongpass' } })).statusCode;
  assert.equal(last, 429);
  resetRateLimit();
});

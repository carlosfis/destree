// F2: tabla ruta × rol → status; 401 sin sesión; origin-check (+skipOriginCheck); invitaciones (410); último admin; rate-limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/index.js';
import { ACTIONS, can, permissionsFor } from '../server/lib/permissions.js';
import { resetRateLimit, hashPassword, verifyPassword } from '../server/lib/auth.js';
import { setupAdmin, login, inviteAndAccept, PW } from './helpers/auth.js';

const page = (over = {}) => ({ version: 3, page: { id: 'p_default', name: 'X' }, nodes: [], edges: [], tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 }, ...over });

test('permissions.js: matriz coherente (admin todo, designer solo lectura)', () => {
  for (const a of ACTIONS) assert.ok(can({ role: 'admin' }, a), a);
  assert.deepEqual(permissionsFor('designer'), ['pages.read', 'pages.export', 'versions.read']);
  assert.ok(!can({ role: 'head' }, 'users.manage')); assert.ok(can({ role: 'head' }, 'pages.edit'));
  assert.throws(() => can({ role: 'admin' }, 'nope'));
  assert.ok(!can(null, 'pages.read'));
  const h = hashPassword('abc12345'); assert.ok(h.startsWith('scrypt$')); assert.ok(verifyPassword('abc12345', h)); assert.ok(!verifyPassword('abc12346', h));
});

test('rutas × rol → status; sin sesión → 401 (+setup); 403 designer en mutaciones', async (t) => {
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

  const head = (await inviteAndAccept(app, admin, 'head@test.io', 'head', 'Head')).cookie;
  const designer = (await inviteAndAccept(app, admin, 'des@test.io', 'designer', 'Des')).cookie;
  // head solo invita designers
  assert.equal(await st({ method: 'POST', url: '/api/invites', headers: { cookie: head }, payload: { email: 'h2@test.io', role: 'head' } }), 403);

  const me = (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: designer } })).json();
  assert.equal(me.role, 'designer'); assert.deepEqual(me.permissions, permissionsFor('designer')); assert.equal(me.org.name, 'Test org');

  const put = { method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '0' }, payload: page() };
  const table = [
    // [descripción, request, admin, head, designer, anónimo]
    ['GET /api/me', { method: 'GET', url: '/api/me' }, 200, 200, 200, 401],
    ['GET /api/pages', { method: 'GET', url: '/api/pages' }, 200, 200, 200, 401],
    ['GET /api/pages/:id', { method: 'GET', url: '/api/pages/p_default' }, 200, 200, 200, 401],
    ['PUT /api/pages/:id', put, 200, 200, 403, 401],
    ['POST /api/pages', { method: 'POST', url: '/api/pages', payload: { name: 'N' } }, 201, 201, 403, 401],
    ['POST /api/import', { method: 'POST', url: '/api/import', payload: { nodes: [], edges: [] } }, 200, 200, 403, 401],
    ['GET /api/users', { method: 'GET', url: '/api/users' }, 200, 403, 403, 401],
    ['POST /api/users', { method: 'POST', url: '/api/users', payload: { email: 'n@test.io', password: PW, role: 'designer' } }, 201, 403, 403, 401],
    ['PATCH /api/users/:id', { method: 'PATCH', url: '/api/users/nope', payload: { name: 'x' } }, 404, 403, 403, 401],
    ['DELETE /api/users/:id', { method: 'DELETE', url: '/api/users/nope' }, 404, 403, 403, 401],
    ['GET /api/invites', { method: 'GET', url: '/api/invites' }, 200, 200, 403, 401],
    ['POST /api/invites', { method: 'POST', url: '/api/invites', payload: { email: 'i@test.io', role: 'designer' } }, 201, 201, 403, 401],
    ['DELETE /api/invites/:id', { method: 'DELETE', url: '/api/invites/nope' }, 404, 404, 403, 401],
    ['POST /api/_nope (sin guard, solo origin)', { method: 'POST', url: '/api/_nope' }, 200, 200, 200, 200],
  ];
  const cookies = { admin, head, designer, anon: '' };
  for (const [name, req, ...exp] of table) {
    for (const [i, role] of ['admin', 'head', 'designer', 'anon'].entries()) {
      const r = await app.inject({ ...req, headers: { ...(req.headers || {}), cookie: cookies[role] } });
      if (req.method === 'PUT') req.headers['if-match'] = String(r.headers.etag ? r.json().version : req.headers['if-match']);
      if (req.method === 'POST' && req.url === '/api/invites' && r.statusCode === 201) req.payload = { ...req.payload, email: `i${i}@test.io` };
      assert.equal(r.statusCode, exp[i], `${name} como ${role}: ${r.body}`);
    }
  }
  // La misma invitación no se repite para el mismo correo tras aceptar: 409
  assert.equal(await st({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'des@test.io', role: 'designer' } }), 409);

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
  assert.equal(await st({ method: 'PATCH', url: `/api/users/${adminId}`, headers: { cookie: admin }, payload: { role: 'head' } }), 409);
  assert.equal(await st({ method: 'PATCH', url: `/api/users/${adminId}`, headers: { cookie: admin }, payload: { isActive: false } }), 409);
  assert.equal(await st({ method: 'PATCH', url: `/api/users/${desId}`, headers: { cookie: admin }, payload: { role: 'head' } }), 200);
  assert.equal(await st({ method: 'GET', url: '/api/me', headers: { cookie: designer } }), 401, 'cambio de rol invalida sesiones');
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
  for (const a of ['setup', 'invite.create', 'invite.accept', 'page.save', 'page.create', 'page.import', 'user.create', 'user.update', 'user.deactivate']) assert.ok(actions.includes(a), a);
});

test('invitaciones: enlace copiable, info pública, token caducado → 410, usado → 410, inexistente → 404, revocar', async (t) => {
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
  assert.equal(info.statusCode, 200); assert.equal(info.json().role, 'head'); assert.equal(info.json().orgName, 'Test org');
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
  const inv2 = (await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'r@test.io', role: 'designer' } })).json();
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/invites/${inv2.id}`, headers: { cookie: admin } })).statusCode, 204);
  assert.equal((await app.inject({ method: 'GET', url: `/api/invites/${inv2.link.split('/#/invite/')[1]}` })).statusCode, 404);
  // contraseña corta → 400; rate-limit en login → 429
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.co', password: '' } })).statusCode, 400);
  let last;
  for (let i = 0; i < 12; i++) last = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.co', password: 'wrongpass' } })).statusCode;
  assert.equal(last, 429);
  resetRateLimit();
});

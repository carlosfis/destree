// F1: API de páginas sobre SQLite (BD temporal en disco para probar persistencia tras reabrir).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server/index.js';
import { setupAdmin, login } from './helpers/auth.js';

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/legacy-v2.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-'));
const dbPath = path.join(tmp, 'test.db');
const open = () => buildApp({ dbPath, logger: false });

test('API: health, páginas, PUT con If-Match (200/409/428/400), import legacy, persistencia', async (t) => {
  let app = await open();
  t.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  let cookie = await setupAdmin(app); // F2: todas las rutas de páginas exigen sesión
  const call = async (o) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, etag: r.headers.etag, body: r.json() }; };

  const h = await call({ method: 'GET', url: '/api/health' });
  assert.equal(h.status, 200); assert.equal(h.body.ok, true); assert.equal(h.body.db, 'ok');

  const list = await call({ method: 'GET', url: '/api/pages' });
  assert.equal(list.status, 200); assert.equal(list.body.pages.length, 1);
  const id = list.body.pages[0].id;
  assert.equal(id, 'p_default');

  const g0 = await call({ method: 'GET', url: `/api/pages/${id}` });
  assert.equal(g0.status, 200); assert.equal(g0.etag, '"0"'); assert.equal(g0.body.version, 3);
  assert.deepEqual(g0.body.nodes, []); assert.equal(g0.body.branchTypes.length, 6);

  // import legacy v2
  const imp = await call({ method: 'POST', url: '/api/import', payload: fixture });
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  assert.equal(imp.body.nodes, fixture.nodes.length); assert.equal(imp.body.version, 1);
  const g1 = await call({ method: 'GET', url: `/api/pages/${id}` });
  assert.equal(g1.body.page.version, 1); assert.equal(g1.body.nodes.length, fixture.nodes.length); assert.equal(g1.body.edges.length, fixture.edges.length);
  assert.equal(g1.body.nodes[0].owner, fixture.nodes[0].owner);
  assert.deepEqual(g1.body.nodes[0].tags, fixture.nodes[0].tags);
  const bad = await call({ method: 'POST', url: '/api/import', payload: { hola: 1 } });
  assert.equal(bad.status, 400);

  // PUT ok
  const doc = g1.body; doc.nodes[0].name = 'Renombrado'; doc.camera = { x: 1, y: 2, z: 1.5 };
  const p1 = await call({ method: 'PUT', url: `/api/pages/${id}`, headers: { 'if-match': '"1"' }, payload: doc });
  assert.equal(p1.status, 200, JSON.stringify(p1.body)); assert.equal(p1.body.version, 2); assert.equal(p1.etag, '"2"');
  // PUT con versión vieja → 409
  const p2 = await call({ method: 'PUT', url: `/api/pages/${id}`, headers: { 'if-match': '1' }, payload: doc });
  assert.equal(p2.status, 409); assert.equal(p2.body.error, 'conflict'); assert.equal(p2.body.version, 2);
  // sin If-Match → 428
  assert.equal((await call({ method: 'PUT', url: `/api/pages/${id}`, payload: doc })).status, 428);
  // inválido → 400 con errores Ajv
  const invalid = structuredClone(doc); invalid.nodes[0].type = 'foo'; delete invalid.nodes[1].id;
  const p4 = await call({ method: 'PUT', url: `/api/pages/${id}`, headers: { 'if-match': '2' }, payload: invalid });
  assert.equal(p4.status, 400); assert.equal(p4.body.error, 'validation');
  assert.deepEqual(p4.body.errors.map(e => e.path).sort(), ['/nodes/0/type', '/nodes/1']);
  // 404
  assert.equal((await call({ method: 'GET', url: '/api/pages/nope' })).status, 404);
  assert.equal((await call({ method: 'GET', url: '/api/nope' })).status, 404);
  // crear página
  const c = await call({ method: 'POST', url: '/api/pages', payload: { name: 'Segunda' } });
  assert.equal(c.status, 201); assert.equal(c.body.page.name, 'Segunda'); assert.equal(c.body.page.version, 1);
  assert.equal((await call({ method: 'GET', url: '/api/pages' })).body.pages.length, 2);
  // estático + normalize compartido
  assert.equal((await app.inject({ method: 'GET', url: '/' })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/js/core/normalize.js' })).statusCode, 200);

  // persistencia: reabrir la BD
  await app.close();
  app = await open();
  cookie = await login(app, 'admin@test.io');
  const g2 = await call({ method: 'GET', url: `/api/pages/${id}` });
  assert.equal(g2.body.page.version, 2); assert.equal(g2.body.nodes[0].name, 'Renombrado');
  assert.deepEqual(g2.body.camera, { x: 1, y: 2, z: 1.5 });
  assert.equal(g2.body.nodes.length, fixture.nodes.length);
});

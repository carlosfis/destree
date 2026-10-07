// F6a: versiones: auto en PUT (hash), coalescencia, manual, diff, restore exacto, retención, archive/delete/restore-deleted, permisos, imágenes de versiones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.VERSIONS_KEEP = '3'; process.env.VERSIONS_COALESCE_MIN = '0';
const { buildApp } = await import('../server/index.js');
const { createVersion, diffDocuments } = await import('../server/lib/versions.js');
const { setupAdmin, inviteAndAccept } = await import('./helpers/auth.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-ver-'));
const doc = (nodes, edges = []) => ({ version: 3, page: { id: 'p_default', name: 'X' }, nodes, edges, tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 } });
const root = (id, extra = {}) => ({ id, type: 'software', name: id, parentId: null, x: 0, y: 0, visibility: 'org', ...extra });

test('versiones: 3 ediciones → 3 autos; restaurar la 1ª reproduce el canvas; manual/diff/retención; archive/delete conservan; restore-deleted repone', async (t) => {
  const app = await buildApp({ dbPath: path.join(tmp, 'v.db'), logger: false });
  t.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const admin = await setupAdmin(app);
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, body: r.statusCode === 204 ? null : r.json() }; };
  const put = async (d, ver, cookie = admin) => { const r = await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': String(ver) }, payload: d }, cookie); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.version; };
  const versions = async () => (await j({ method: 'GET', url: '/api/pages/p_default/versions' }, admin)).body.versions;

  // 3 ediciones (coalescencia desactivada) → 3 autos; PUT sin cambios no crea versión
  const d1 = doc([root('a', { notes: 'uno', docs: [{ label: 'x', url: 'https://x.io' }] }), root('b', { x: 10, y: 20 })], [{ id: 'e1', kind: 'ds', from: 'a', to: 'c', demo: false }]);
  d1.nodes.push({ id: 'c', type: 'ds', name: 'DS', parentId: 'a', x: 16, y: 90 });
  let v = await put(d1, 0);
  const d2 = doc([root('a', { name: 'A2' }), root('b', { x: 99, y: 20 }), root('d')]);
  v = await put(d2, v);
  const d3 = doc([root('a', { name: 'A3' })]);
  v = await put(d3, v);
  v = await put(d3, v); // sin cambios
  let list = await versions();
  assert.deepEqual(list.map(x => [x.number, x.reason]), [[3, 'auto'], [2, 'auto'], [1, 'auto']]);
  assert.ok(list[0].createdByName === 'Admin' && list[0].size > 50 && list[0].hash.length === 64);
  // diff v1 → v2 y v2 → current
  const diff12 = (await j({ method: 'GET', url: '/api/pages/p_default/versions/1/diff/2' }, admin)).body.diff;
  assert.deepEqual(diff12.nodes.added.map(n => n.id), ['d']); assert.deepEqual(diff12.nodes.removed.map(n => n.id), ['c']);
  assert.deepEqual(diff12.nodes.changed, [{ id: 'a', name: 'A2', fields: ['name', 'notes', 'docs'] }]); assert.equal(diff12.nodes.moved, 1);
  assert.deepEqual(diff12.edges.removed, ['ds|a|c']);
  const diffCur = (await j({ method: 'GET', url: '/api/pages/p_default/versions/3/diff/current' }, admin)).body;
  assert.equal(diffCur.diff.same, true); assert.equal(diffCur.to, null);
  // ver una versión
  const g1 = (await j({ method: 'GET', url: '/api/pages/p_default/versions/1' }, admin)).body;
  assert.equal(g1.version.number, 1); assert.equal(g1.document.nodes.length, 3); assert.equal(g1.document.nodes[0].notes, 'uno');
  assert.equal((await j({ method: 'GET', url: '/api/pages/p_default/versions/99' }, admin)).status, 404);
  // restaurar la 1ª → canvas exacto (nodos, aristas, posiciones, docs) + versión 'restore'
  const rest = (await j({ method: 'POST', url: '/api/pages/p_default/versions/1/restore' }, admin)).body;
  assert.equal(rest.restoredFrom, 1); assert.equal(rest.snapshot.reason, 'restore');
  const cur = (await j({ method: 'GET', url: '/api/pages/p_default' }, admin)).body;
  const strip = n => { const { hasExternalRefs, ...rest } = n; return rest; };
  assert.deepEqual(cur.nodes.map(strip), g1.document.nodes.map(strip)); assert.deepEqual(cur.edges, g1.document.edges);
  assert.equal(cur.page.version, rest.version);
  assert.equal((await j({ method: 'GET', url: '/api/pages/p_default/versions/1/diff/current' }, admin)).body.diff.same, true);
  // manual con etiqueta
  const man = (await j({ method: 'POST', url: '/api/pages/p_default/versions', payload: { label: 'Antes del rediseño' } }, admin)).body;
  assert.equal(man.reason, 'manual'); assert.equal(man.label, 'Antes del rediseño'); assert.equal(man.number, 5);
  // retención: keep=3 autos → tras más ediciones solo quedan 3 autos; manual y restore se conservan
  v = cur.page.version;
  for (let i = 0; i < 4; i++) v = await put(doc([root('a', { name: 'A' + i })]), v);
  list = await versions();
  assert.equal(list.filter(x => x.reason === 'auto').length, 3);
  assert.ok(list.some(x => x.reason === 'manual') && list.some(x => x.reason === 'restore'));
  assert.equal(list[0].number, 9);
  // coalescencia: dos autos del mismo usuario dentro de la ventana → misma versión actualizada
  const me = app.db.prepare("SELECT id FROM users LIMIT 1").get().id;
  const before = list[0];
  app.db.prepare("UPDATE nodes SET name = 'coalesce' WHERE id = 'a'").run();
  const co = createVersion(app.db, 'p_default', { reason: 'auto', userId: me, coalesceMs: 5 * 60e3 });
  assert.equal(co.number, before.number); assert.notEqual(co.hash, before.hash);
  assert.equal((await versions()).length, list.length);
  // designer: lee versiones (filtradas), no crea ni restaura
  const des = await inviteAndAccept(app, admin, 'des@test.io', 'designer');
  app.db.prepare("UPDATE nodes SET visibility = 'cells' WHERE id = 'a'").run();
  createVersion(app.db, 'p_default', { reason: 'manual', label: 'oculta', userId: me });
  const dl = (await j({ method: 'GET', url: '/api/pages/p_default/versions' }, des.cookie)).body.versions;
  assert.ok(dl.length > 3);
  const dv = (await j({ method: 'GET', url: `/api/pages/p_default/versions/${dl[0].number}` }, des.cookie)).body;
  assert.equal(dv.document.nodes.length, 0, 'raíz solo-células oculta también en la versión');
  assert.equal((await j({ method: 'POST', url: '/api/pages/p_default/versions', payload: { label: 'x' } }, des.cookie)).status, 403);
  assert.equal((await j({ method: 'POST', url: '/api/pages/p_default/versions/1/restore' }, des.cookie)).status, 403);
  assert.equal((await j({ method: 'GET', url: `/api/pages/p_default/versions/${dl[1].number}/diff/${dl[0].number}` }, des.cookie)).status, 200);
  assert.equal((await j({ method: 'GET', url: '/api/pages/p_default/versions/1' }, admin)).status, 404, 'v1 purgada por retención');
  // archivar → versión 'archive'; restaurar en archivada → 409; borrar → 'delete'; restore-deleted con contenido manipulado → repone la última versión
  const p2 = (await j({ method: 'POST', url: '/api/pages', payload: { name: 'Otra' } }, admin)).body.page;
  await put({ ...doc([root('z1'), root('z2')]), page: { id: p2.id, name: 'Otra' } }, p2.version).catch(() => {});
  const z = await j({ method: 'PUT', url: `/api/pages/${p2.id}`, headers: { 'if-match': '1' }, payload: { ...doc([root('z1'), root('z2')]), page: { id: p2.id, name: 'Otra' } } }, admin);
  assert.equal(z.status, 200);
  assert.equal((await j({ method: 'POST', url: `/api/pages/${p2.id}/archive` }, admin)).body.status, 'archived');
  const vz = (await j({ method: 'GET', url: `/api/pages/${p2.id}/versions` }, admin)).body.versions;
  assert.equal(vz[0].reason, 'archive');
  assert.equal((await j({ method: 'POST', url: `/api/pages/${p2.id}/versions/1/restore` }, admin)).status, 409);
  await j({ method: 'POST', url: `/api/pages/${p2.id}/unarchive` }, admin);
  assert.equal((await j({ method: 'DELETE', url: `/api/pages/${p2.id}` }, admin)).body.status, 'deleted');
  const vd = (await j({ method: 'GET', url: `/api/pages/${p2.id}/versions` }, admin)).body.versions;
  assert.equal(vd[0].reason, 'delete'); assert.ok(vd.length >= 3, 'archivar y borrar conservan versiones');
  app.db.prepare('DELETE FROM nodes WHERE page_id = ?').run(p2.id); // simula pérdida de contenido
  const rd = (await j({ method: 'POST', url: `/api/pages/${p2.id}/restore-deleted` }, admin)).body;
  assert.equal(rd.status, 'active'); assert.equal(rd.restoredFromVersion, vd[0].number);
  assert.deepEqual((await j({ method: 'GET', url: `/api/pages/${p2.id}` }, admin)).body.nodes.map(n => n.id), ['z1', 'z2']);
  // la cascada al borrar físicamente una página borra sus versiones; página inexistente → 404
  assert.equal((await j({ method: 'GET', url: '/api/pages/nope/versions' }, admin)).status, 404);
  const actions = app.db.prepare('SELECT DISTINCT action FROM audit_log').all().map(r => r.action);
  for (const a of ['version.create', 'version.restore']) assert.ok(actions.includes(a), a);
});

test('diffDocuments: unidad', () => {
  const a = doc([root('a'), root('b', { tags: ['t1'] })], [{ id: 'e', kind: 'ds', from: 'a', to: 'b' }]); a.tags = [{ id: 't1', name: 'T', color: 'blue' }];
  const b = doc([root('a', { x: 5 }), root('b', { tags: [] }), root('c')]); b.tags = [];
  const d = diffDocuments(a, b);
  assert.deepEqual(d.nodes.added.map(n => n.id), ['c']); assert.deepEqual(d.nodes.changed, [{ id: 'b', name: 'b', fields: ['tags'] }]); assert.equal(d.nodes.moved, 1);
  assert.deepEqual(d.edges.removed, ['ds|a|b']); assert.deepEqual(d.tags.removed, ['T']); assert.equal(d.same, false);
  assert.equal(diffDocuments(a, a).same, true);
});

// F3: lib/visibility.js (unidad) + API: células, designer solo ve raíces org / de sus células / asignadas; hasExternalRefs; docs+notes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/index.js';
import { filterDocumentForUser } from '../server/lib/visibility.js';
import { createValidator } from '../server/lib/schemas.js';
import { setupAdmin, inviteAndAccept, PW } from './helpers/auth.js';

const N = (id, parentId = null, extra = {}) => ({ id, type: extra.type || 'software', name: id, parentId, x: 0, y: 0, visibility: parentId ? 'inherit' : 'org', cellIds: [], assigneeIds: [], ownerUserId: null, ...extra });
const E = (id, kind, from, to) => ({ id, kind, from, to, demo: false });
const doc = () => ({
  version: 3, page: { id: 'p_default', name: 'X' }, tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 },
  nodes: [
    N('rA', null, { visibility: 'cells', cellIds: ['cA'] }), N('rA_ds', 'rA', { type: 'ds' }), N('rA_feat', 'rA', { branchTypeId: 'et_feature' }),
    N('rB', null, { visibility: 'cells', cellIds: ['cB'] }), N('rB_ds', 'rB', { type: 'ds' }),
    N('rOrg'), N('rOrg_kit', 'rOrg', { type: 'uikit' }),
    N('rC', null, { visibility: 'cells', cellIds: ['cC'] }), N('rC_feat', 'rC', { branchTypeId: 'et_feature', assigneeIds: ['uDes'] }),
  ],
  edges: [E('e1', 'ds', 'rA', 'rA_ds'), E('e2', 'ds', 'rB', 'rB_ds'), E('e3', 'ds', 'rOrg', 'rB_ds'), E('e4', 'source', 'rOrg_kit', 'rA_ds'), E('e5', 'ds', 'rC', 'rA_ds')],
});

test('filterDocumentForUser: admin/head todo; designer de A ve rA, rOrg y rC (asignado en hijo), no rB; aristas cruzadas fuera + hasExternalRefs', () => {
  const d = doc();
  assert.equal(filterDocumentForUser(d, { role: 'admin', userId: 'x', cellIds: [] }), d);
  assert.equal(filterDocumentForUser(d, { role: 'head', userId: 'x', cellIds: [] }).nodes.length, 9);
  const f = filterDocumentForUser(d, { role: 'designer', userId: 'uDes', cellIds: ['cA'] });
  assert.deepEqual(f.nodes.map(n => n.id), ['rA', 'rA_ds', 'rA_feat', 'rOrg', 'rOrg_kit', 'rC', 'rC_feat']);
  assert.deepEqual(f.edges.map(e => e.id), ['e1', 'e4', 'e5']);
  const by = Object.fromEntries(f.nodes.map(n => [n.id, n.hasExternalRefs]));
  assert.equal(by.rOrg, true, 'rOrg usa rB_ds (oculto)'); assert.equal(by.rA, false); assert.equal(by.rC, false);
  // sin células ni asignaciones: solo lo público
  const g = filterDocumentForUser(d, { role: 'designer', userId: 'nadie', cellIds: [] });
  assert.deepEqual(g.nodes.map(n => n.id), ['rOrg', 'rOrg_kit']); assert.deepEqual(g.edges, []);
  assert.equal(g.nodes[1].hasExternalRefs, true);
  // responsable (ownerUserId) en un descendiente también abre la raíz
  const d2 = doc(); d2.nodes.find(n => n.id === 'rB_ds').ownerUserId = 'nadie';
  assert.ok(filterDocumentForUser(d2, { role: 'designer', userId: 'nadie', cellIds: [] }).nodes.some(n => n.id === 'rB'));
});

test('API: células CRUD/miembros, designer de célula A no recibe raíz solo-B; head asigna → ve la raíz; docs+notes; PUT designer 403', async (t) => {
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(() => app.close());
  const admin = await setupAdmin(app);
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, body: r.statusCode === 204 ? null : r.json() }; };

  // Células (admin) + head/designer
  const cA = (await j({ method: 'POST', url: '/api/cells', payload: { name: 'Célula A', color: 'blue' } }, admin)).body;
  const cB = (await j({ method: 'POST', url: '/api/cells', payload: { name: 'Célula B' } }, admin)).body;
  assert.ok(cA.id && cB.id); assert.equal(cB.color, 'brown');
  const head = await inviteAndAccept(app, admin, 'head@test.io', 'head', 'Head');
  assert.equal((await j({ method: 'PATCH', url: `/api/cells/${cA.id}`, payload: { leadUserId: head.user.id } }, admin)).body.leadUserId, head.user.id);
  // invitación con células: head solo a sus células (A sí, B no); el designer hereda cell_members
  assert.equal((await j({ method: 'POST', url: '/api/invites', payload: { email: 'd2@test.io', role: 'designer', cellIds: [cB.id] } }, head.cookie)).status, 403);
  const inv = (await j({ method: 'POST', url: '/api/invites', payload: { email: 'des@test.io', role: 'designer', cellIds: [cA.id] } }, head.cookie)).body;
  assert.equal(inv.status, undefined); assert.deepEqual(inv.cellIds, [cA.id]);
  const acc = await app.inject({ method: 'POST', url: '/api/invites/accept', payload: { token: inv.link.split('/#/invite/')[1], name: 'Des', password: PW } });
  assert.equal(acc.statusCode, 201);
  const des = String(acc.headers['set-cookie']).split(';')[0], desId = acc.json().user.id;
  const me = (await j({ method: 'GET', url: '/api/me' }, des)).body;
  assert.deepEqual(me.cellIds, [cA.id]); assert.deepEqual(me.cells, [{ id: cA.id, name: 'Célula A', color: 'blue' }]);
  // permisos de rutas de células
  assert.equal((await j({ method: 'GET', url: '/api/cells' }, des)).status, 403);
  assert.equal((await j({ method: 'GET', url: '/api/cells' }, head.cookie)).body.cells.length, 2);
  assert.equal((await j({ method: 'POST', url: '/api/cells', payload: { name: 'N' } }, head.cookie)).status, 403);
  assert.equal((await j({ method: 'PUT', url: `/api/cells/${cB.id}/members`, payload: { userIds: [desId] } }, head.cookie)).status, 403, 'head no gestiona B');
  const mA = (await j({ method: 'PUT', url: `/api/cells/${cA.id}/members`, payload: { userIds: [desId, 'nope'] } }, head.cookie)).body;
  assert.deepEqual(new Set(mA.memberIds), new Set([desId, head.user.id]));
  assert.equal((await j({ method: 'GET', url: '/api/users/directory' }, head.cookie)).body.users.length, 3);
  assert.equal((await j({ method: 'GET', url: '/api/users/directory' }, des)).status, 403);

  // Documento con raíces A (solo célula A), B (solo célula B), org; arista cruzada org → B_ds; docs + notes
  const d = doc(); d.nodes.forEach(n => { n.cellIds = n.cellIds.map(c => ({ cA: cA.id, cB: cB.id, cC: 'nope' })[c]); n.assigneeIds = []; });
  d.nodes[0].notes = '# Título\n\n- uno\n- dos\n\n[Figma](https://figma.com/x) `code`';
  d.nodes[0].docs = [{ label: 'Figma', url: 'https://www.figma.com/design/abc' }, { label: 'Notion', url: 'https://notion.so/x' }, { label: 'Repo', url: 'https://github.com/x/y' }];
  const put = await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '0' }, payload: d }, admin);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const full = (await j({ method: 'GET', url: '/api/pages/p_default' }, admin)).body;
  assert.equal(full.nodes.length, 9); assert.deepEqual(full.nodes[0].cellIds, [cA.id]); assert.equal(full.nodes[0].docs.length, 3);
  assert.deepEqual(full.refs.cells.map(c => c.name), ['Célula A', 'Célula B']);
  assert.deepEqual(full.nodes.find(n => n.id === 'rC').cellIds, [], 'célula desconocida descartada');
  const { refs, ...strict } = full; const val = createValidator().validate('page-document.schema.json', strict);
  assert.deepEqual(val.errors, [], 'documento con docs/notes/cellIds/assigneeIds válido contra el schema');
  strict.nodes[0].docs = Array(21).fill({ label: 'x', url: 'https://x.io' }); assert.equal(createValidator().validate('page-document.schema.json', strict).ok, false, 'máx 20 docs');
  // Designer de A: sin rB ni rB_ds ni e2/e3; rC (célula inexistente) tampoco; rOrg marca refs externas
  const v = (await j({ method: 'GET', url: '/api/pages/p_default' }, des)).body;
  assert.deepEqual(v.nodes.map(n => n.id), ['rA', 'rA_ds', 'rA_feat', 'rOrg', 'rOrg_kit']);
  assert.deepEqual(v.edges.map(e => e.id), ['e1', 'e4']);
  assert.equal(v.nodes.find(n => n.id === 'rOrg').hasExternalRefs, true);
  assert.equal(v.nodes[0].notes, d.nodes[0].notes); assert.equal(v.nodes[0].docs.length, 3);
  assert.equal((await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '1' }, payload: v }, des)).status, 403);
  assert.equal((await j({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB/visibility', payload: { visibility: 'org' } }, des)).status, 403);

  // head asigna al designer a la feature rC_feat (raíz rC solo-célula inexistente) → ve rC completa
  const asg = await j({ method: 'PUT', url: '/api/pages/p_default/nodes/rC_feat/assignees', payload: { assigneeIds: [desId] } }, head.cookie);
  assert.equal(asg.status, 200, JSON.stringify(asg.body)); assert.equal(asg.body.version, 2); assert.deepEqual(asg.body.node.assigneeIds, [desId]);
  const v2 = (await j({ method: 'GET', url: '/api/pages/p_default' }, des)).body;
  assert.ok(['rC', 'rC_feat'].every(id => v2.nodes.some(n => n.id === id)));
  assert.deepEqual(v2.refs.users, [{ id: desId, name: 'Des' }]);
  // visibilidad por PATCH: rB pasa a org → designer la ve; hijo → 400; owner desconocido → 400
  assert.equal((await j({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB/visibility', payload: { visibility: 'org' } }, head.cookie)).body.version, 3);
  assert.ok((await j({ method: 'GET', url: '/api/pages/p_default' }, des)).body.nodes.some(n => n.id === 'rB'));
  assert.equal((await j({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB_ds/visibility', payload: { visibility: 'cells', cellIds: [cA.id] } }, head.cookie)).status, 400);
  assert.equal((await j({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB/owner', payload: { ownerUserId: 'nope' } }, head.cookie)).status, 400);
  assert.equal((await j({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB/owner', payload: { ownerUserId: desId } }, head.cookie)).body.node.ownerUserId, desId);
  // El PUT con If-Match viejo tras los parches → 409 (la versión avanzó)
  assert.equal((await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '1' }, payload: d }, admin)).status, 409);
  // Borrar célula A: cascada en node_cells y cell_members; rA queda solo-células sin células → invisible para el designer
  assert.equal((await j({ method: 'DELETE', url: `/api/cells/${cA.id}` }, admin)).status, 204);
  assert.deepEqual((await j({ method: 'GET', url: '/api/me' }, des)).body.cellIds, []);
  assert.ok(!(await j({ method: 'GET', url: '/api/pages/p_default' }, des)).body.nodes.some(n => n.id === 'rA'));
  // Página solo-células (page_cells) sin relación → 403 y no aparece en el listado
  app.db.prepare("UPDATE pages SET visibility = 'cells' WHERE id = 'p_default'").run();
  app.db.prepare('DELETE FROM node_assignees').run(); app.db.prepare('UPDATE nodes SET owner_user_id = NULL').run();
  assert.equal((await j({ method: 'GET', url: '/api/pages/p_default' }, des)).status, 403);
  assert.equal((await j({ method: 'GET', url: '/api/pages' }, des)).body.pages.length, 0);
  assert.equal((await j({ method: 'GET', url: '/api/pages' }, head.cookie)).body.pages.length, 1);
  const actions = app.db.prepare('SELECT DISTINCT action FROM audit_log').all().map(r => r.action);
  for (const a of ['cell.create', 'cell.update', 'cell.members', 'cell.delete', 'node.assignees', 'node.visibility', 'node.owner']) assert.ok(actions.includes(a), a);
});

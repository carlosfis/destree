// P10: niveles de rol — reglas de asignación (ops/head/lead), ops no toca admins, organización (nombre, etiquetas, borrado completo),
// lead con visibilidad parcial no pierde lo que no ve al guardar, viewer edita solo sus cards, migración 012 (designer → viewer) e import antiguo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../server/index.js';
import { openDb, migrate, DEFAULT_ORG_ID } from '../server/db/sqlite.js';
import { setupAdmin, login, inviteAndAccept, PW } from './helpers/auth.js';
import { resetRateLimit } from '../server/lib/auth.js';

const j = app => async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), ...(cookie ? { cookie } : {}) } }); return { status: r.statusCode, etag: r.headers.etag, body: r.statusCode === 204 ? null : r.json() }; };
const N = (id, parentId = null, extra = {}) => ({ id, type: extra.type || 'software', name: id, parentId, x: 0, y: 0, visibility: parentId ? 'inherit' : 'org', cellIds: [], assigneeIds: [], ownerUserId: null, ...extra });
const doc = (pid, nodes, edges = []) => ({ version: 3, page: { id: pid, name: 'P' }, nodes, edges, tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 } });

test('asignación de roles: ops no da admin ni toca admins; head invita lead/viewer; lead solo viewer; nadie cambia su propio rol', async (t) => {
  resetRateLimit(); const app = await buildApp({ dbPath: ':memory:', logger: false }); t.after(() => app.close());
  const q = j(app), admin = await setupAdmin(app);
  const ops = await inviteAndAccept(app, admin, 'ops@test.io', 'ops', 'Ops');
  const head = await inviteAndAccept(app, admin, 'head@test.io', 'head', 'Head');
  const lead = await inviteAndAccept(app, admin, 'lead@test.io', 'lead', 'Lead');
  const adminId = (await q({ method: 'GET', url: '/api/me' }, admin)).body.user.id;
  assert.equal((await q({ method: 'POST', url: '/api/users', payload: { email: 'a2@test.io', password: PW, role: 'admin' } }, ops.cookie)).status, 403, 'ops no crea admins');
  assert.equal((await q({ method: 'POST', url: '/api/users', payload: { email: 'o2@test.io', password: PW, role: 'ops' } }, ops.cookie)).status, 201, 'ops sí crea ops');
  assert.equal((await q({ method: 'PATCH', url: `/api/users/${adminId}`, payload: { name: 'X' } }, ops.cookie)).status, 403, 'ops no toca a un admin');
  assert.equal((await q({ method: 'DELETE', url: `/api/users/${adminId}` }, ops.cookie)).status, 403);
  assert.equal((await q({ method: 'PATCH', url: `/api/users/${head.user.id}`, payload: { role: 'admin' } }, ops.cookie)).status, 403, 'ops no asciende a admin');
  assert.equal((await q({ method: 'PATCH', url: `/api/users/${head.user.id}`, payload: { role: 'ops' } }, ops.cookie)).status, 200, 'ops asciende hasta su nivel');
  assert.equal((await q({ method: 'PATCH', url: `/api/users/${ops.user.id}`, payload: { role: 'viewer' } }, ops.cookie)).status, 409, 'propio rol');
  assert.equal((await q({ method: 'PATCH', url: `/api/users/${head.user.id}`, payload: { role: 'admin' } }, admin)).status, 200, 'solo un admin da admin');
  for (const [cookie, role, status] of [[head.cookie, 'head', 401], [lead.cookie, 'lead', 403], [lead.cookie, 'viewer', 201], [ops.cookie, 'admin', 403], [ops.cookie, 'ops', 201]]) {
    const r = await q({ method: 'POST', url: '/api/invites', payload: { email: `${role}-${status}@x.io`, role } }, cookie);
    assert.equal(r.status, status, `${role}: ${JSON.stringify(r.body)}`); // head ascendido a admin → su sesión se cerró (401)
  }
  const head2 = await login(app, 'head@test.io');
  assert.equal((await q({ method: 'POST', url: '/api/invites', payload: { email: 'h3@x.io', role: 'head' } }, head2)).status, 201, 'ya es admin');
  // invitaciones: sin users.manage solo se ven y revocan las propias
  const mine = (await q({ method: 'POST', url: '/api/invites', payload: { email: 'v9@x.io', role: 'viewer' } }, lead.cookie)).body;
  const list = (await q({ method: 'GET', url: '/api/invites' }, lead.cookie)).body.invites;
  assert.ok(list.every(i => i.invitedBy === lead.user.id) && list.some(i => i.id === mine.id));
  const other = (await q({ method: 'GET', url: '/api/invites' }, admin)).body.invites.find(i => i.invitedBy !== lead.user.id);
  assert.equal((await q({ method: 'DELETE', url: `/api/invites/${other.id}` }, lead.cookie)).status, 404);
  assert.equal((await q({ method: 'DELETE', url: `/api/invites/${mine.id}` }, lead.cookie)).status, 204);
});

test('organización: PATCH nombre + etiquetas (Admin fija, saneadas, visibles en /me y en la invitación); DELETE borra todo y vuelve al asistente', async (t) => {
  resetRateLimit(); const app = await buildApp({ dbPath: ':memory:', logger: false }); t.after(() => app.close());
  const q = j(app), admin = await setupAdmin(app);
  const ops = (await inviteAndAccept(app, admin, 'ops@test.io', 'ops', 'Ops')).cookie;
  const r = await q({ method: 'PATCH', url: '/api/org', payload: { name: ' Agencia ', roleLabels: { ops: 'Design Ops', head: '  ', viewer: 'Designer' } } }, admin);
  assert.equal(r.status, 200); assert.equal(r.body.name, 'Agencia'); assert.deepEqual(r.body.roleLabels, { admin: 'Admin', ops: 'Design Ops', head: 'Head', lead: 'Lead', viewer: 'Designer' });
  assert.equal((await q({ method: 'PATCH', url: '/api/org', payload: { roleLabels: { admin: 'Dios', ops: 'Design Ops', viewer: 'Designer' } } }, admin)).body.roleLabels.admin, 'Admin', 'admin no se etiqueta (removeAdditional)');
  assert.equal((await q({ method: 'PATCH', url: '/api/org', payload: { name: 'X' } }, ops)).status, 403);
  assert.equal((await q({ method: 'GET', url: '/api/org' }, ops)).body.roleLabels.ops, 'Design Ops');
  assert.equal((await q({ method: 'GET', url: '/api/me' }, ops)).body.org.roleLabels.viewer, 'Designer');
  const inv = (await q({ method: 'POST', url: '/api/invites', payload: { email: 'v@x.io', role: 'viewer' } }, ops)).body;
  assert.equal((await q({ method: 'GET', url: `/api/invites/${inv.link.split('/#/invite/')[1]}` })).body.roleLabel, 'Designer');
  assert.equal(app.db.prepare('SELECT settings_json FROM orgs WHERE id = ?').get(DEFAULT_ORG_ID).settings_json, JSON.stringify({ roleLabels: { ops: 'Design Ops', viewer: 'Designer' } }), 'solo se guarda lo personalizado');
  assert.deepEqual((await q({ method: 'PATCH', url: '/api/org', payload: { roleLabels: {} } }, admin)).body.roleLabels.viewer, 'Viewer', 'reset a defecto');
  // borrado: solo admin, contraseña y nombre exacto
  await q({ method: 'POST', url: '/api/cells', payload: { name: 'C' } }, admin);
  assert.equal((await q({ method: 'DELETE', url: '/api/org', payload: { password: PW, confirmName: 'Agencia' } }, ops)).status, 403);
  assert.equal((await q({ method: 'DELETE', url: '/api/org', payload: { password: 'mala-clave', confirmName: 'Agencia' } }, admin)).status, 403);
  assert.equal((await q({ method: 'DELETE', url: '/api/org', payload: { password: PW, confirmName: 'Otra' } }, admin)).status, 400);
  const del = await app.inject({ method: 'DELETE', url: '/api/org', headers: { cookie: admin }, payload: { password: PW, confirmName: 'Agencia' } });
  assert.equal(del.statusCode, 204); assert.match(String(del.headers['set-cookie']), /destree_sid=;/);
  assert.equal((await q({ method: 'GET', url: '/api/setup' })).body.needed, true);
  assert.equal((await q({ method: 'GET', url: '/api/me' }, admin)).status, 401);
  for (const tbl of ['users', 'memberships', 'sessions', 'invites', 'cells', 'audit_log']) assert.equal(app.db.prepare(`SELECT COUNT(*) AS n FROM ${tbl}`).get().n, 0, tbl);
  assert.equal(app.db.prepare('SELECT name FROM orgs WHERE id = ?').get(DEFAULT_ORG_ID).name, 'Mi organización');
  const admin2 = await setupAdmin(app, 'nueva@x.io');
  const pages = (await q({ method: 'GET', url: '/api/pages' }, admin2)).body.pages;
  assert.deepEqual(pages.map(p => [p.name, p.nodeCount]), [['Árbol principal', 0]], 'página por defecto de nuevo');
});

test('lead: ve solo sus raíces, su PUT conserva lo oculto y no cambia visibilidades; viewer: PATCH solo en sus cards', async (t) => {
  resetRateLimit(); const app = await buildApp({ dbPath: ':memory:', logger: false }); t.after(() => app.close());
  const q = j(app), admin = await setupAdmin(app);
  const cA = (await q({ method: 'POST', url: '/api/cells', payload: { name: 'A' } }, admin)).body, cB = (await q({ method: 'POST', url: '/api/cells', payload: { name: 'B' } }, admin)).body;
  const lead = await inviteAndAccept(app, admin, 'lead@test.io', 'lead', 'Lead');
  const viewer = await inviteAndAccept(app, admin, 'v@test.io', 'viewer', 'Vi');
  await q({ method: 'PUT', url: `/api/cells/${cA.id}/members`, payload: { userIds: [lead.user.id] } }, admin);
  const nodes = [N('rOrg'), N('rOrg_ds', 'rOrg', { type: 'ds' }), N('rA', null, { visibility: 'cells', cellIds: [cA.id] }), N('rB', null, { visibility: 'cells', cellIds: [cB.id] }), N('rB_ds', 'rB', { type: 'ds', assigneeIds: [viewer.user.id] })];
  const edges = [{ id: 'e1', kind: 'ds', from: 'rB', to: 'rB_ds' }, { id: 'e2', kind: 'ds', from: 'rB', to: 'rOrg_ds' }];
  assert.equal((await q({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '0' }, payload: doc('p_default', nodes, edges) }, admin)).status, 200);
  const seen = (await q({ method: 'GET', url: '/api/pages/p_default' }, lead.cookie)).body;
  assert.deepEqual(seen.nodes.map(n => n.id).sort(), ['rA', 'rOrg', 'rOrg_ds']); assert.deepEqual(seen.edges, []); assert.ok(seen.nodes.find(n => n.id === 'rOrg_ds').hasExternalRefs);
  // el lead renombra rOrg, crea rNew, intenta cerrar rOrg a células y borra rA (que sí ve)
  const mine = seen.nodes.filter(n => n.id !== 'rA').map(n => (n.id === 'rOrg' ? { ...n, name: 'Org2', visibility: 'cells', cellIds: [cA.id] } : n)).concat([N('rNew')]);
  const put = await q({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': String(seen.page.version) }, payload: doc('p_default', mine) }, lead.cookie);
  assert.equal(put.status, 200, JSON.stringify(put.body)); assert.equal(put.body.nodes, 5, 'rOrg, rOrg_ds, rNew + rB, rB_ds ocultos');
  const full = (await q({ method: 'GET', url: '/api/pages/p_default' }, admin)).body;
  assert.deepEqual(full.nodes.map(n => n.id).sort(), ['rB', 'rB_ds', 'rNew', 'rOrg', 'rOrg_ds']);
  const rOrg = full.nodes.find(n => n.id === 'rOrg'); assert.equal(rOrg.name, 'Org2'); assert.equal(rOrg.visibility, 'org', 'sin pages.visibility no se cierra la raíz');
  assert.deepEqual(full.edges.map(e => e.id).sort(), ['e1', 'e2'], 'aristas con extremos ocultos conservadas');
  assert.equal((await q({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB/owner', payload: { ownerUserId: lead.user.id } }, lead.cookie)).status, 404, 'no asigna en nodos que no ve');
  assert.equal((await q({ method: 'PUT', url: '/api/pages/p_default/nodes/rNew/assignees', payload: { assigneeIds: [viewer.user.id] } }, lead.cookie)).status, 200);
  // página solo-células ajena → el lead no la edita
  const pB = (await q({ method: 'POST', url: '/api/pages', payload: { name: 'B', visibility: 'cells', cellIds: [cB.id] } }, admin)).body.page;
  assert.equal((await q({ method: 'PUT', url: `/api/pages/${pB.id}`, headers: { 'if-match': '1' }, payload: doc(pB.id, []) }, lead.cookie)).status, 403);
  // viewer: edita rB_ds (asignado) y no rNew… espera, rNew también se le asignó arriba → ok; rOrg no
  const own = await q({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB_ds', payload: { name: 'Mi DS', description: 'x'.repeat(140), docs: [{ label: 'Figma', url: 'https://figma.com/f' }], staff: [{ name: 'ana', role: 'UX' }], geo: 'gt', tags: ['nope'] } }, viewer.cookie);
  assert.equal(own.status, 200, JSON.stringify(own.body)); assert.equal(own.body.node.name, 'Mi DS'); assert.equal(own.body.node.description.length, 140); assert.equal(own.body.node.geo, 'GT'); assert.deepEqual(own.body.node.tags, []); assert.equal(own.body.node.docs[0].label, 'Figma');
  assert.equal((await q({ method: 'GET', url: '/api/pages/p_default' }, admin)).body.page.version, own.body.version);
  assert.equal((await q({ method: 'PATCH', url: '/api/pages/p_default/nodes/rOrg', payload: { name: 'Hack' } }, viewer.cookie)).status, 403);
  assert.equal((await q({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB_ds', payload: { x: 5, name: 'Mi DS' } }, viewer.cookie)).body.node.x, 0, 'solo campos propios (x se descarta)');
  assert.equal((await q({ method: 'PATCH', url: '/api/pages/p_default/nodes/rB_ds/visibility', payload: { visibility: 'org' } }, viewer.cookie)).status, 403);
  assert.equal((await q({ method: 'PATCH', url: '/api/pages/p_default/nodes/rOrg', payload: { name: 'Por lead' } }, lead.cookie)).status, 200, 'con pages.edit cualquier card visible');
  assert.ok(app.db.prepare("SELECT 1 FROM audit_log WHERE action = 'node.update'").get());
});

test('migración 012: designer → viewer en memberships e invites; import de export antiguo con designer', async (t) => {
  const db = openDb(':memory:');
  const dir = path.resolve(import.meta.dirname, '../server/db/migrations');
  db.exec('CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for (const f of fs.readdirSync(dir).filter(f => /^\d{3}_/.test(f) && f < '012').sort()) { db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); db.prepare("INSERT INTO _migrations VALUES (?, 'x')").run(f); }
  db.prepare("INSERT INTO orgs (id, name, slug) VALUES ('o', 'O', 'o')").run();
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u1', 'd@x.io', 'h'), ('u2', 'h@x.io', 'h')").run();
  db.prepare("INSERT INTO memberships (user_id, org_id, role) VALUES ('u1', 'o', 'designer'), ('u2', 'o', 'head')").run();
  db.prepare("INSERT INTO invites (id, org_id, email, role, token_hash, expires_at, email_sent_at) VALUES ('i1', 'o', 'n@x.io', 'designer', 't', '2999-01-01', '2026-01-01')").run();
  assert.deepEqual(migrate(db), ['012_roles.sql', '013_projects.sql', '014_gradient.sql']);
  assert.deepEqual(db.prepare('SELECT user_id, role FROM memberships ORDER BY user_id').all().map(r => r.role), ['viewer', 'head']);
  assert.deepEqual({ ...db.prepare('SELECT role, email_sent_at FROM invites').get() }, { role: 'viewer', email_sent_at: '2026-01-01' });
  assert.throws(() => db.prepare("INSERT INTO memberships (user_id, org_id, role) VALUES ('u2', 'o', 'designer')").run(), /CHECK/);
  db.close();
  resetRateLimit(); const app = await buildApp({ dbPath: ':memory:', logger: false }); t.after(() => app.close());
  const q = j(app), admin = await setupAdmin(app);
  const data = { version: 3, org: { name: 'Vieja', settings: { roleLabels: { viewer: 'Designer', admin: 'Jefe' } } }, cells: [], users: [{ id: 'old1', email: 'old@x.io', name: 'Old', role: 'designer' }], pages: [], images: [] };
  assert.equal((await q({ method: 'POST', url: '/api/org/import', payload: data }, admin)).status, 200);
  assert.equal((await q({ method: 'GET', url: '/api/users' }, admin)).body.users.find(u => u.email === 'old@x.io').role, 'viewer');
  assert.deepEqual((await q({ method: 'GET', url: '/api/org' }, admin)).body.roleLabels, { admin: 'Admin', ops: 'Ops', head: 'Head', lead: 'Lead', viewer: 'Designer' });
});

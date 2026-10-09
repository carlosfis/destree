// F4a: pages API: crear con visibilidad, listado filtrado por status y por designer, PATCH meta, archivar/desarchivar, borrado suave (admin) + export JSON, restaurar, duplicar, asignaciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server/index.js';
import { setupAdmin, inviteAndAccept } from './helpers/auth.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-pages-'));
const doc = (page, nodes = []) => ({ version: 3, page, nodes, edges: [], tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 } });
const root = (id, extra = {}) => ({ id, type: 'software', name: id, parentId: null, x: 0, y: 0, visibility: 'org', ...extra });

test('pages: visibilidad por célula en lobby, archivar reversible, borrar solo admin + restaurar, duplicar, PUT en archivada → 409', async (t) => {
  const app = await buildApp({ dbPath: path.join(tmp, 'p.db'), logger: false });
  t.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const admin = await setupAdmin(app);
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, body: r.statusCode === 204 ? null : r.json() }; };
  const head = (await inviteAndAccept(app, admin, 'head@test.io', 'head')).cookie;
  const cell = (await j({ method: 'POST', url: '/api/cells', payload: { name: 'A' } }, admin)).body;
  const des = await inviteAndAccept(app, admin, 'des@test.io', 'viewer');
  await j({ method: 'PUT', url: `/api/cells/${cell.id}/members`, payload: { userIds: [des.user.id] } }, admin);

  // admin crea 2 páginas con visibilidad distinta
  const pOrg = (await j({ method: 'POST', url: '/api/pages', payload: { name: 'Pública', description: 'para todos' } }, admin)).body.page;
  const pCell = (await j({ method: 'POST', url: '/api/pages', payload: { name: 'Solo A', visibility: 'cells', cellIds: [cell.id, 'nope'] } }, admin)).body.page;
  assert.equal(pCell.visibility, 'cells'); assert.deepEqual(pCell.cellIds, [cell.id]);
  const pOther = (await j({ method: 'POST', url: '/api/pages', payload: { name: 'Solo B', visibility: 'cells', cellIds: [] } }, admin)).body.page; // P10: head ya no crea páginas
  const names = async (cookie, status) => (await j({ method: 'GET', url: '/api/pages' + (status ? `?status=${status}` : '') }, cookie)).body.pages.map(p => p.name);
  assert.deepEqual(await names(admin), ['Árbol principal', 'Pública', 'Solo A', 'Solo B']);
  assert.deepEqual(await names(des.cookie), ['Árbol principal', 'Pública', 'Solo A'], 'designer: solo org + su célula');
  const list = (await j({ method: 'GET', url: '/api/pages' }, admin)).body.pages;
  assert.equal(list[0].rootCount, 0); assert.ok('nodeCount' in list[0] && 'updatedAt' in list[0]);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pOther.id}` }, des.cookie)).status, 403);

  // PATCH meta: renombrar exige pages.meta (head → 403; admin ok); cambiar visibilidad (head ok) → el viewer deja de verla; version avanza
  assert.equal((await j({ method: 'PATCH', url: `/api/pages/${pCell.id}`, payload: { name: 'Solo A2' } }, head)).status, 403, 'P10: head no renombra');
  const patched = (await j({ method: 'PATCH', url: `/api/pages/${pCell.id}`, payload: { name: 'Solo A2', visibility: 'cells', cellIds: [] } }, admin)).body;
  assert.equal(patched.name, 'Solo A2'); assert.deepEqual(patched.cellIds, []); assert.equal(patched.version, 2);
  assert.deepEqual(await names(des.cookie), ['Árbol principal', 'Pública']);
  assert.equal((await j({ method: 'PATCH', url: `/api/pages/${pCell.id}`, payload: { visibility: 'org' } }, des.cookie)).status, 403);
  assert.equal((await j({ method: 'PATCH', url: `/api/pages/${pCell.id}`, payload: { visibility: 'org' } }, head)).body.version, 3);
  assert.deepEqual(await names(des.cookie), ['Árbol principal', 'Pública', 'Solo A2']);
  // contenido + asignación en Pública → asignaciones cruzadas del designer
  const put = await j({ method: 'PUT', url: `/api/pages/${pOrg.id}`, headers: { 'if-match': '1' }, payload: doc({ id: pOrg.id, name: 'Pública' }, [root('r1', { assigneeIds: [des.user.id] }), root('r2')]) }, head);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal((await j({ method: 'GET', url: '/api/pages' }, admin)).body.pages.find(p => p.id === pOrg.id).rootCount, 2);
  const asg = (await j({ method: 'GET', url: '/api/me/assignments' }, des.cookie)).body.items;
  assert.deepEqual(asg.map(a => [a.pageName, a.nodeId, a.role, a.isRoot]), [['Pública', 'r1', 'assignee', true]]);

  // archivar: nivel ≥4 (head → 403); desaparece del listado por defecto; aparece con ?status=archived|all; PUT → 409; reversible
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/archive` }, des.cookie)).status, 403);
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/archive` }, head)).status, 403, 'P10: head no archiva');
  const arch = (await j({ method: 'POST', url: `/api/pages/${pOrg.id}/archive` }, admin)).body;
  assert.equal(arch.status, 'archived'); assert.ok(arch.archivedAt);
  assert.deepEqual(await names(admin), ['Árbol principal', 'Solo A2', 'Solo B']);
  assert.deepEqual(await names(admin, 'archived'), ['Pública']);
  assert.equal((await names(admin, 'all')).length, 4);
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/archive` }, admin)).status, 409, 'ya archivada');
  const putArch = await j({ method: 'PUT', url: `/api/pages/${pOrg.id}`, headers: { 'if-match': '3' }, payload: doc({ id: pOrg.id, name: 'Pública' }) }, head);
  assert.equal(putArch.status, 409); assert.match(putArch.body.message, /archivada/);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pOrg.id}` }, des.cookie)).status, 200, 'archivada sigue legible');
  assert.equal((await j({ method: 'GET', url: '/api/me/assignments' }, des.cookie)).body.items[0].pageStatus, 'archived');
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/unarchive` }, admin)).body.status, 'active');
  assert.deepEqual(await names(admin), ['Árbol principal', 'Pública', 'Solo A2', 'Solo B']);

  // duplicar (nivel ≥4; head → 403): copia contenido y relaciones
  const dup = (await j({ method: 'POST', url: `/api/pages/${pOrg.id}/duplicate`, payload: { name: 'Pública copia' } }, admin)).body;
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/duplicate`, payload: null }, head)).status, 403, 'P10: head no duplica');
  assert.equal(dup.page.name, 'Pública copia'); assert.equal(dup.nodes.length, 2); assert.deepEqual(dup.nodes[0].assigneeIds, [des.user.id]); assert.equal(dup.page.version, 1);
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/duplicate`, payload: null }, des.cookie)).status, 403);

  // borrar: solo admin; soft; export JSON; no se lista salvo ?status=deleted (admin); GET → 404 para no admin; restaurar
  assert.equal((await j({ method: 'DELETE', url: `/api/pages/${pOrg.id}` }, head)).status, 403);
  const del = (await j({ method: 'DELETE', url: `/api/pages/${pOrg.id}` }, admin)).body;
  assert.equal(del.status, 'deleted'); assert.ok(del.deletedAt);
  const snap = app.db.prepare("SELECT reason, size FROM page_versions WHERE page_id = ? ORDER BY number DESC LIMIT 1").get(pOrg.id); assert.equal(snap.reason, 'delete'); assert.ok(snap.size > 100, 'F6a: snapshot final al borrar');
  assert.deepEqual(await names(admin), ['Árbol principal', 'Solo A2', 'Solo B', 'Pública copia']);
  assert.deepEqual(await names(admin, 'deleted'), ['Pública']);
  assert.equal((await j({ method: 'GET', url: '/api/pages?status=deleted' }, head)).status, 403);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pOrg.id}` }, head)).status, 404);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pOrg.id}` }, admin)).status, 200);
  assert.deepEqual((await j({ method: 'GET', url: '/api/me/assignments' }, des.cookie)).body.items.map(i => i.pageName), ['Pública copia'], 'borrada: sin asignaciones (solo la copia)');
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/archive` }, admin)).status, 409, 'borrada no se archiva');
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pOrg.id}/restore-deleted` }, head)).status, 403);
  const rest = (await j({ method: 'POST', url: `/api/pages/${pOrg.id}/restore-deleted` }, admin)).body;
  assert.equal(rest.status, 'active'); assert.equal(rest.deletedAt, null);
  assert.deepEqual(await names(admin), ['Árbol principal', 'Pública', 'Solo A2', 'Solo B', 'Pública copia']);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pOrg.id}` }, head)).body.nodes.length, 2, 'contenido intacto tras restaurar');
  // la única página activa no se borra
  for (const id of [pOrg.id, pCell.id, pOther.id, dup.page.id]) assert.equal((await j({ method: 'DELETE', url: `/api/pages/${id}` }, admin)).status, 200);
  assert.equal((await j({ method: 'DELETE', url: '/api/pages/p_default' }, admin)).status, 409);
  const actions = app.db.prepare('SELECT DISTINCT action FROM audit_log').all().map(r => r.action);
  for (const a of ['page.update', 'page.archive', 'page.unarchive', 'page.duplicate', 'page.delete', 'page.restore']) assert.ok(actions.includes(a), a);
});

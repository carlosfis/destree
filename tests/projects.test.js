// P11: página de proyecto por card: plantilla inicial, permisos (pages.edit o responsable/asignado), secciones (saneado, orden), fases, actividades (fechas, estados), settings, duplicar, export/import org, schema, audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server/index.js';
import { createValidator } from '../server/lib/schemas.js';
import { isoWeek, sprintOf, sanitizeSectionData } from '../server/lib/project-template.js';
import { setupAdmin, inviteAndAccept } from './helpers/auth.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-projects-'));
const doc = (page, nodes = []) => ({ version: 3, page, nodes, edges: [], tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 } });
const root = (id, extra = {}) => ({ id, type: 'software', name: id, parentId: null, x: 0, y: 0, visibility: 'org', ...extra });

test('project-template: semana ISO, sprint y saneado de secciones', () => {
  assert.deepEqual([isoWeek('2026-09-28').week, isoWeek('2026-10-04').week, isoWeek('2026-10-05').week, isoWeek('2026-01-01').year, isoWeek('2026-01-01').week], [40, 40, 41, 2026, 1]);
  assert.equal(isoWeek('2026-09-28').monday.toISOString().slice(0, 10), '2026-09-28');
  assert.deepEqual([40, 41, 42, 43].map(w => sprintOf(w)), [20, 21, 21, 22]);
  assert.equal(sprintOf(40, { sprintWeeks: 1, sprintOffset: 3 }), 43);
  const links = sanitizeSectionData('links', { items: [{ label: 'ok', url: 'https://x.io', extra: 1 }, { label: 'mal', url: 'javascript:alert(1)' }], foo: 'bar' });
  assert.deepEqual(links, { items: [{ emoji: '', label: 'ok', url: 'https://x.io' }] });
  const check = sanitizeSectionData('checklist', { items: [{ text: 'a', done: 1 }, { text: '', done: false }, { text: 'b'.repeat(200) }] });
  assert.deepEqual(check.items.map(i => [i.text.length, i.done]), [[1, true], [160, false]]);
  assert.deepEqual(sanitizeSectionData('nope', { a: 1 }), {});
});

test('projects API: plantilla, permisos, secciones, fases, actividades, settings, duplicar, export/import, schema, audit', async (t) => {
  const app = await buildApp({ dbPath: path.join(tmp, 'p.db'), logger: false });
  t.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const admin = await setupAdmin(app);
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, body: r.statusCode === 204 ? null : r.json() }; };
  const des = await inviteAndAccept(app, admin, 'des@test.io', 'viewer');
  const lead = await inviteAndAccept(app, admin, 'lead@test.io', 'lead');
  const pid = 'p_default', nodes = [root('rA', { docs: [{ label: 'Figma', url: 'https://figma.com/x' }], staff: [{ name: '@ana', role: 'UX' }], description: 'Resumen A' }), root('rB', { visibility: 'cells', cellIds: [] })];
  assert.equal((await j({ method: 'PUT', url: `/api/pages/${pid}`, headers: { 'if-match': '0' }, payload: doc({ id: pid, name: 'P' }, nodes) }, admin)).status, 200);
  const B = `/api/pages/${pid}/nodes/rA/project`;

  // GET crea la plantilla (9 secciones) con datos de la card; es idempotente; valida contra el schema
  const g = await j({ method: 'GET', url: B }, admin);
  assert.equal(g.status, 200); assert.equal(g.body.canEdit, true); assert.equal(g.body.sections.length, 9);
  assert.deepEqual(g.body.sections.map(s => s.kind), ['links', 'text', 'timeline', 'cards', 'quote', 'goals', 'checklist', 'people', 'people']);
  assert.deepEqual(g.body.sections[0].data.items, [{ emoji: '', label: 'Figma', url: 'https://figma.com/x' }]);
  assert.equal(g.body.sections[1].data.text, 'Resumen A'); assert.deepEqual(g.body.sections[8].data.items, [{ name: '@ana', role: 'UX' }]);
  assert.deepEqual(g.body.settings, { tagline: '', sprintWeeks: 2, sprintOffset: 0 });
  assert.equal((await j({ method: 'GET', url: B }, admin)).body.sections[0].id, g.body.sections[0].id);
  const val = createValidator().validate('project.schema.json', g.body); assert.deepEqual(val.errors, []);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pid}/nodes/nope/project` }, admin)).status, 404);
  // viewer no asignado: lee rA (org), no ve rB (solo-células sin células), no edita
  const gv = await j({ method: 'GET', url: B }, des.cookie); assert.equal(gv.status, 200); assert.equal(gv.body.canEdit, false);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pid}/nodes/rB/project` }, des.cookie)).status, 404);
  assert.equal((await j({ method: 'POST', url: `${B}/activities`, payload: { title: 'x' } }, des.cookie)).status, 403);
  assert.equal((await j({ method: 'PATCH', url: B, payload: { tagline: 'x' } }, des.cookie)).status, 403);
  // lead (pages.edit) edita; viewer asignado también
  assert.equal((await j({ method: 'PATCH', url: B, payload: { tagline: 'Un flujo', sprintWeeks: 1, sprintOffset: 2 } }, lead.cookie)).body.sprintOffset, 2);
  assert.equal((await j({ method: 'PUT', url: `/api/pages/${pid}/nodes/rA/assignees`, payload: { assigneeIds: [des.user.id] } }, admin)).status, 200);
  assert.equal((await j({ method: 'GET', url: B }, des.cookie)).body.canEdit, true);
  assert.equal((await j({ method: 'PATCH', url: B, payload: { sprintWeeks: 9 } }, des.cookie)).status, 400);

  // secciones: crear al final / en posición, saneado por tipo, reordenar, borrar
  const s1 = await j({ method: 'POST', url: `${B}/sections`, payload: { kind: 'goals', title: 'Metas', data: { items: [{ text: 'A', value: '1', nope: 1 }], junk: true } } }, des.cookie);
  assert.equal(s1.status, 201); assert.equal(s1.body.position, 9); assert.deepEqual(s1.body.data, { items: [{ text: 'A', value: '1' }] });
  const s2 = await j({ method: 'POST', url: `${B}/sections`, payload: { kind: 'cards', title: 'Primera', position: 0 } }, lead.cookie);
  assert.equal(s2.body.position, 0); assert.deepEqual(s2.body.data, { items: [] });
  let list = (await j({ method: 'GET', url: B }, admin)).body.sections; assert.equal(list[0].id, s2.body.id); assert.equal(list[1].kind, 'links'); assert.equal(list.length, 11);
  assert.equal((await j({ method: 'POST', url: `${B}/sections`, payload: { kind: 'wat' } }, admin)).status, 400);
  const up = await j({ method: 'PATCH', url: `${B}/sections/${s2.body.id}`, payload: { title: 'Última', position: 99, data: { items: [{ code: 'U1', title: 'Líder', text: 'x' }] } } }, admin);
  assert.equal(up.body.title, 'Última'); assert.equal(up.body.position, 10); assert.equal(up.body.data.items[0].code, 'U1');
  assert.equal((await j({ method: 'PATCH', url: `${B}/sections/${s2.body.id}`, payload: { kind: 'text', title: 'Última' } }, admin)).body.kind, 'cards', 'el tipo no cambia (campo ajeno descartado)');
  assert.equal((await j({ method: 'DELETE', url: `${B}/sections/${s2.body.id}` }, admin)).status, 204);
  assert.equal((await j({ method: 'DELETE', url: `${B}/sections/${s2.body.id}` }, admin)).status, 404);
  list = (await j({ method: 'GET', url: B }, admin)).body.sections; assert.equal(list.length, 10); assert.deepEqual(list.map(s => s.position), [...Array(10).keys()]);

  // fases: color automático de la paleta, renombrar, borrar → actividades sin fase
  const f1 = await j({ method: 'POST', url: `${B}/phases`, payload: { name: 'Alineación' } }, des.cookie);
  const f2 = await j({ method: 'POST', url: `${B}/phases`, payload: { name: 'Diseño', color: '#ABCDEF' } }, des.cookie);
  assert.equal(f1.status, 201); assert.equal(f1.body.color, '#f0a331'); assert.equal(f2.body.color, '#abcdef'); assert.equal(f2.body.position, 1);
  assert.equal((await j({ method: 'POST', url: `${B}/phases`, payload: { name: '  ' } }, admin)).status, 400);
  assert.equal((await j({ method: 'PATCH', url: `${B}/phases/${f2.body.id}`, payload: { name: 'Diseño UI', position: 0 } }, admin)).body.position, 0);
  // actividades: en cronograma (fase + fecha) y solo kanban; validaciones
  const a1 = await j({ method: 'POST', url: `${B}/activities`, payload: { title: 'Discovery', description: 'Shadowing', tag: 'ux', assignee: 'Renata Villaseñor', phaseId: f1.body.id, startDate: '2026-10-05', endDate: '2026-10-16' } }, des.cookie);
  assert.equal(a1.status, 201); assert.equal(a1.body.tag, 'UX'); assert.equal(a1.body.assignee, '@Renata Villaseñor'); assert.equal(a1.body.status, 'todo');
  const a2 = await j({ method: 'POST', url: `${B}/activities`, payload: { title: 'Stakeholder map', status: 'doing', assignee: '@Todos' } }, lead.cookie);
  assert.equal(a2.body.phaseId, null); assert.equal(a2.body.startDate, null); assert.equal(a2.body.position, 1);
  assert.equal((await j({ method: 'POST', url: `${B}/activities`, payload: { title: 'x', startDate: '2026-02-30' } }, admin)).status, 400, 'fecha inválida');
  assert.equal((await j({ method: 'POST', url: `${B}/activities`, payload: { title: 'x', startDate: '2026-10-10', endDate: '2026-10-01' } }, admin)).status, 400, 'fin < inicio');
  assert.equal((await j({ method: 'POST', url: `${B}/activities`, payload: { title: 'x', phaseId: 'nope' } }, admin)).status, 400, 'fase desconocida');
  assert.equal((await j({ method: 'POST', url: `${B}/activities`, payload: { title: 'x', status: 'wat' } }, admin)).status, 400);
  assert.equal((await j({ method: 'PATCH', url: `${B}/activities/${a1.body.id}`, payload: { status: 'done' } }, des.cookie)).body.status, 'done', 'kanban: cambio de estado');
  assert.equal((await j({ method: 'PATCH', url: `${B}/activities/${a1.body.id}`, payload: { endDate: null } }, admin)).body.endDate, null);
  assert.equal((await j({ method: 'PATCH', url: `${B}/activities/${a2.body.id}`, payload: { position: 0 } }, admin)).body.position, 0);
  assert.equal((await j({ method: 'DELETE', url: `${B}/phases/${f1.body.id}` }, admin)).status, 204);
  let acts = (await j({ method: 'GET', url: B }, admin)).body.activities;
  assert.equal(acts.find(a => a.id === a1.body.id).phaseId, null, 'borrar la fase deja la actividad solo en kanban');
  assert.equal((await j({ method: 'DELETE', url: `${B}/activities/${a2.body.id}` }, lead.cookie)).status, 204);
  assert.equal((await j({ method: 'GET', url: B }, admin)).body.activities.length, 1);
  assert.deepEqual(createValidator().validate('project.schema.json', (await j({ method: 'GET', url: B }, admin)).body).errors, []);

  // duplicar página copia el proyecto con ids nuevos; archivar bloquea la edición (409) pero no la lectura
  const dup = (await j({ method: 'POST', url: `/api/pages/${pid}/duplicate` }, admin)).body.page;
  const gd = (await j({ method: 'GET', url: `/api/pages/${dup.id}/nodes/rA/project` }, admin)).body;
  assert.equal(gd.sections.length, 10); assert.equal(gd.activities[0].title, 'Discovery'); assert.notEqual(gd.activities[0].id, a1.body.id); assert.equal(gd.settings.tagline, 'Un flujo');
  assert.equal((await j({ method: 'POST', url: `/api/pages/${dup.id}/archive` }, admin)).status, 200);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${dup.id}/nodes/rA/project` }, admin)).status, 200);
  assert.equal((await j({ method: 'POST', url: `/api/pages/${dup.id}/nodes/rA/project/activities`, payload: { title: 'x' } }, admin)).status, 409);
  // la card desaparece del documento → 404, pero los datos sobreviven y vuelven con la card (undo / restaurar versión)
  const cur = (await j({ method: 'GET', url: `/api/pages/${pid}` }, admin)).body;
  assert.equal((await j({ method: 'PUT', url: `/api/pages/${pid}`, headers: { 'if-match': `"${cur.page.version}"` }, payload: { ...cur, nodes: cur.nodes.filter(n => n.id !== 'rA'), refs: undefined } }, admin)).status, 200);
  assert.equal((await j({ method: 'GET', url: B }, admin)).status, 404);
  const v2 = (await j({ method: 'GET', url: `/api/pages/${pid}` }, admin)).body;
  assert.equal((await j({ method: 'PUT', url: `/api/pages/${pid}`, headers: { 'if-match': `"${v2.page.version}"` }, payload: { ...cur, page: v2.page, refs: undefined } }, admin)).status, 200);
  assert.equal((await j({ method: 'GET', url: B }, admin)).body.activities[0].title, 'Discovery');
  // export/import de organización conserva proyectos
  const exp = (await j({ method: 'GET', url: '/api/org/export' }, admin)).body;
  assert.deepEqual(createValidator().validate('org-export.schema.json', exp).errors, []);
  assert.equal(exp.pages.find(p => p.document.page.id === pid).projects[0].activities.length, 1);
  app.db.prepare('DELETE FROM projects').run();
  const imp = await j({ method: 'POST', url: '/api/org/import', payload: exp }, admin);
  assert.equal(imp.status, 200, JSON.stringify(imp.body)); assert.equal(imp.body.projects, 2);
  assert.equal((await j({ method: 'GET', url: B }, admin)).body.activities[0].assignee, '@Renata Villaseñor');
  const actions = app.db.prepare('SELECT DISTINCT action FROM audit_log').all().map(r => r.action);
  for (const a of ['project.settings', 'project.section.create', 'project.section.update', 'project.section.delete', 'project.phase.create', 'project.phase.update', 'project.phase.delete', 'project.activity.create', 'project.activity.update', 'project.activity.delete']) assert.ok(actions.includes(a), a);
});

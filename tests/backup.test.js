// F6b: backup crea tar.gz válido (db + uploads) y se lista/descarga; retención; restore en dir vacío; export org → import en instancia limpia reproduce páginas/versiones/células/usuarios/imágenes; cron.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { buildApp } from '../server/index.js';
import { cronMatches, restoreBackup, applyBackupRetention, createBackup } from '../server/lib/backup.js';
import { setupAdmin, inviteAndAccept, login, PW } from './helpers/auth.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-bk-'));
const doc = (id, nodes) => ({ version: 3, page: { id, name: 'X' }, nodes, edges: [], tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 } });
const root = (id, extra = {}) => ({ id, type: 'software', name: id, parentId: null, x: 0, y: 0, visibility: 'org', ...extra });

test('cronMatches: *, n, */n, rangos, listas', () => {
  const d = new Date(2026, 9, 6, 3, 30); // mar 6 oct 2026 03:30
  assert.ok(cronMatches('30 3 * * *', d)); assert.ok(!cronMatches('31 3 * * *', d)); assert.ok(cronMatches('*/10 * * * *', d)); assert.ok(!cronMatches('*/7 * * * *', d));
  assert.ok(cronMatches('0,30 1-5 6 10 2', d)); assert.ok(!cronMatches('30 3 * * 0', d)); assert.ok(!cronMatches('bad', d));
});

test('backup → tar.gz válido; API lista/descarga/borra; retención; restore en carpeta vacía; export/import org', async (t) => {
  const dataA = path.join(tmp, 'a'); fs.mkdirSync(dataA);
  const app = await buildApp({ dbPath: path.join(dataA, 'destree.db'), logger: false });
  t.after(async () => { await app.close().catch(() => {}); fs.rmSync(tmp, { recursive: true, force: true }); });
  const admin = await setupAdmin(app);
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, headers: r.headers, body: r.statusCode === 204 ? null : (String(r.headers['content-type']).includes('json') ? r.json() : r.rawPayload) }; };
  // contenido: célula, head, designer en célula, imagen, 2 páginas (una archivada), versiones
  const cell = (await j({ method: 'POST', url: '/api/cells', payload: { name: 'Cel' } }, admin)).body;
  const head = await inviteAndAccept(app, admin, 'head@test.io', 'head', 'Head');
  const des = await inviteAndAccept(app, admin, 'des@test.io', 'viewer', 'Des');
  await j({ method: 'PUT', url: `/api/cells/${cell.id}/members`, payload: { userIds: [des.user.id] } }, admin);
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#c00' } }).png().toBuffer();
  const img = (await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/png' }, payload: png }, admin)).body;
  assert.equal((await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '0' }, payload: doc('p_default', [root('a', { imageId: img.id, assigneeIds: [des.user.id], notes: 'n' }), root('b', { visibility: 'cells', cellIds: [cell.id] })]) }, admin)).status, 200);
  assert.equal((await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '1' }, payload: doc('p_default', [root('a', { imageId: img.id, name: 'A2' })]) }, head.cookie)).status, 200);
  await j({ method: 'POST', url: '/api/pages/p_default/versions', payload: { label: 'hito' } }, admin);
  const p2 = (await j({ method: 'POST', url: '/api/pages', payload: { name: 'Segunda', visibility: 'cells', cellIds: [cell.id] } }, admin)).body.page;
  await j({ method: 'POST', url: `/api/pages/${p2.id}/archive` }, admin);

  // backup manual
  assert.equal((await j({ method: 'POST', url: '/api/backups' }, head.cookie)).status, 403);
  const b = (await j({ method: 'POST', url: '/api/backups' }, admin)).body;
  assert.equal(b.status, 'ok'); assert.equal(b.kind, 'manual'); assert.ok(b.bytes > 1000); assert.match(b.filename, /^destree-.*\.tar\.gz$/);
  const file = path.join(app.backupsDir, b.filename); assert.ok(fs.existsSync(file));
  const listing = execFileSync('tar', ['-tzf', file]).toString();
  assert.ok(listing.includes('destree.db') && listing.includes('MANIFEST.json') && listing.includes(`uploads/org_default/${img.id}.webp`), listing);
  const list = (await j({ method: 'GET', url: '/api/backups' }, admin)).body;
  assert.equal(list.backups.length, 1); assert.equal(list.backups[0].sha256, b.sha256);
  const dl = await j({ method: 'GET', url: `/api/backups/${b.id}/download` }, admin);
  assert.equal(dl.status, 200); assert.equal(dl.headers['content-type'], 'application/gzip'); assert.equal(dl.body.length, b.bytes);
  // retención: 3 programados con keep=2 → queda el más reciente par; los manuales no se tocan
  for (let i = 0; i < 3; i++) { await createBackup(app.db, { backupsDir: app.backupsDir, uploadsDir: app.uploadsDir, kind: 'scheduled', keep: 100 }); await new Promise(r => setTimeout(r, 5)); }
  assert.equal(applyBackupRetention(app.db, app.backupsDir, 2), 1);
  const after = (await j({ method: 'GET', url: '/api/backups' }, admin)).body.backups;
  assert.equal(after.filter(x => x.kind === 'scheduled').length, 2); assert.equal(after.filter(x => x.kind === 'manual').length, 1);
  assert.equal(fs.readdirSync(app.backupsDir).filter(f => f.endsWith('.tar.gz')).length, 3);
  for (const x of after.filter(x => x.kind === 'scheduled')) assert.equal((await j({ method: 'DELETE', url: `/api/backups/${x.id}` }, admin)).status, 204);
  assert.equal((await j({ method: 'GET', url: `/api/backups/nope/download` }, admin)).status, 404);

  // export org (embed) antes de cerrar
  const exp = (await j({ method: 'GET', url: '/api/org/export?images=embed' }, admin)).body;
  assert.equal(exp.version, 3); assert.equal(exp.pages.length, 2); assert.equal(exp.users.length, 3); assert.ok(!JSON.stringify(exp.users).includes('password'));
  assert.equal(exp.cells[0].memberIds.length, 1); assert.ok(exp.images[0].data.length > 100); assert.ok(exp.pages[0].versions.length >= 2);
  assert.equal(exp.pages.find(p => p.document.page.id === p2.id).status, 'archived');
  const manifest = (await j({ method: 'GET', url: '/api/org/export' }, admin)).body; assert.ok(!manifest.images[0].data);

  // restore en carpeta vacía (servidor "parado": sin lock) → DB con las mismas páginas e imagen
  await app.close();
  const dataB = path.join(tmp, 'b'); fs.mkdirSync(dataB);
  const r = restoreBackup(file, { dbPath: path.join(dataB, 'destree.db'), uploadsDir: path.join(dataB, 'uploads') });
  assert.ok(fs.existsSync(r.dbPath) && fs.existsSync(path.join(dataB, 'uploads', 'org_default', `${img.id}.webp`)));
  const appB = await buildApp({ dbPath: path.join(dataB, 'destree.db'), logger: false });
  t.after(() => appB.close());
  const adminB = await login(appB, 'admin@test.io');
  const pagesB = (await appB.inject({ method: 'GET', url: '/api/pages?status=all', headers: { cookie: adminB } })).json().pages;
  assert.deepEqual(pagesB.map(p => [p.name, p.status]).sort(), [['Segunda', 'archived'], ['X', 'active']]);
  assert.equal((await appB.inject({ method: 'GET', url: `/uploads/${img.id}`, headers: { cookie: adminB } })).statusCode, 200);
  // con lock vivo → rechaza
  fs.writeFileSync(path.join(dataB, '.server.lock'), String(process.pid));
  assert.throws(() => restoreBackup(file, { dbPath: path.join(dataB, 'destree.db'), uploadsDir: path.join(dataB, 'uploads') }), /en marcha/);
  fs.rmSync(path.join(dataB, '.server.lock'));
  // scripts/restore.js (CLI) en otra carpeta vacía
  const dataC = path.join(tmp, 'c'); fs.mkdirSync(dataC);
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts/restore.js'), file], { env: { ...process.env, DATABASE_PATH: path.join(dataC, 'destree.db') } }).toString();
  assert.match(out, /restore:/); assert.ok(fs.existsSync(path.join(dataC, 'destree.db')));

  // import org en instancia limpia → páginas, versiones, células, usuarios (sin contraseña → admin la fija), imágenes
  const dataD = path.join(tmp, 'd'); fs.mkdirSync(dataD);
  const appD = await buildApp({ dbPath: path.join(dataD, 'destree.db'), logger: false });
  t.after(() => appD.close());
  const adminD = await setupAdmin(appD, 'other@test.io');
  const bad = await appD.inject({ method: 'POST', url: '/api/org/import', headers: { cookie: adminD }, payload: { version: 3 } });
  assert.equal(bad.statusCode, 400);
  const imp = await appD.inject({ method: 'POST', url: '/api/org/import', headers: { cookie: adminD }, payload: exp });
  assert.equal(imp.statusCode, 200, imp.body);
  const st = imp.json(); assert.equal(st.pages, 2); assert.ok(st.versions >= 2); assert.equal(st.cells, 1); assert.equal(st.users, 3); assert.equal(st.images, 1);
  const pagesD = (await appD.inject({ method: 'GET', url: '/api/pages?status=all', headers: { cookie: adminD } })).json().pages;
  assert.deepEqual(pagesD.map(p => [p.name, p.status, p.visibility]).sort(), [['Segunda', 'archived', 'cells'], ['X', 'active', 'org']]);
  const docD = (await appD.inject({ method: 'GET', url: '/api/pages/p_default', headers: { cookie: adminD } })).json();
  assert.equal(docD.nodes[0].name, 'A2'); assert.equal(docD.nodes[0].imageId, img.id); assert.deepEqual(docD.refs.cells, []);
  const versD = (await appD.inject({ method: 'GET', url: '/api/pages/p_default/versions', headers: { cookie: adminD } })).json().versions;
  assert.ok(versD.some(v => v.label === 'hito')); assert.equal(versD[0].createdByName, 'Admin', 'autor mapeado por correo');
  assert.equal((await appD.inject({ method: 'GET', url: `/uploads/${img.id}`, headers: { cookie: adminD } })).statusCode, 200);
  const usersD = (await appD.inject({ method: 'GET', url: '/api/users', headers: { cookie: adminD } })).json().users;
  const desD = usersD.find(u => u.email === 'des@test.io'); assert.equal(desD.role, 'viewer');
  assert.equal((await appD.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'des@test.io', password: PW } })).statusCode, 401, 'importado sin contraseña');
  assert.equal((await appD.inject({ method: 'PATCH', url: `/api/users/${desD.id}`, headers: { cookie: adminD }, payload: { password: 'nueva-clave-1' } })).statusCode, 200);
  const desCookie = await login(appD, 'des@test.io', 'nueva-clave-1');
  const meD = (await appD.inject({ method: 'GET', url: '/api/me', headers: { cookie: desCookie } })).json();
  assert.equal(meD.cellIds.length, 1, 'célula importada con miembro');
  assert.equal((await appD.inject({ method: 'GET', url: '/api/pages', headers: { cookie: desCookie } })).json().pages.length, 1);
  // idempotente: importar de nuevo no duplica usuarios ni versiones
  const imp2r = await appD.inject({ method: 'POST', url: '/api/org/import', headers: { cookie: adminD }, payload: exp }); assert.equal(imp2r.statusCode, 200, imp2r.body); const imp2 = imp2r.json();
  assert.equal(imp2.users, 0); assert.equal((await appD.inject({ method: 'GET', url: '/api/pages/p_default/versions', headers: { cookie: adminD } })).json().versions.length, versD.length);
});

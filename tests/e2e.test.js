// P6: recorrido completo en una sola BD temporal (setup → 3 roles → página → visibilidad → imagen → versión → respaldo),
// cabeceras de seguridad, logs sin secretos y cierre ordenado por SIGTERM (proceso real).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import sharp from 'sharp';
import { buildApp } from '../server/index.js';
import { CSP } from '../server/plugins/security-headers.js';
import { redactUrl } from '../server/lib/log.js';
import { resetRateLimit } from '../server/lib/auth.js';
import { setupAdmin, login, inviteAndAccept, PW } from './helpers/auth.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const N = (id, parentId = null, extra = {}) => ({ id, type: extra.type || 'software', name: id, parentId, x: 0, y: 0, visibility: parentId ? 'inherit' : 'org', cellIds: [], assigneeIds: [], ownerUserId: null, ...extra });
const doc = (pageId, nodes, over = {}) => ({ version: 3, page: { id: pageId, name: 'E2E' }, nodes, edges: [], tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 }, ...over });

test('e2e: setup → login 3 roles → página → visibilidad por célula → imagen → versiones → respaldo (una BD temporal)', async (t) => {
  resetRateLimit();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-e2e-'));
  const app = await buildApp({ dbPath: path.join(tmp, 'e2e.db'), logger: false });
  t.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, etag: r.headers.etag, body: r.statusCode === 204 ? null : r.json() }; };

  const admin = await setupAdmin(app, 'admin@e2e.io');
  const head = (await inviteAndAccept(app, admin, 'head@e2e.io', 'head', 'Head')).cookie;
  const des = await inviteAndAccept(app, admin, 'des@e2e.io', 'designer', 'Des');
  for (const [c, role] of [[admin, 'admin'], [head, 'head'], [des.cookie, 'designer']]) assert.equal((await j({ method: 'GET', url: '/api/me' }, c)).body.role, role);
  assert.equal((await j({ method: 'GET', url: '/api/me' }, await login(app, 'head@e2e.io'))).body.role, 'head', 'login explícito');

  // célula con el designer como miembro
  const cell = (await j({ method: 'POST', url: '/api/cells', payload: { name: 'Squad A', color: 'blue' } }, admin)).body;
  assert.equal((await j({ method: 'PUT', url: `/api/cells/${cell.id}/members`, payload: { userIds: [des.user.id] } }, admin)).status, 200);

  // página (head) con dos raíces: una de la org y otra solo para otra célula (inexistente para el designer)
  const other = (await j({ method: 'POST', url: '/api/cells', payload: { name: 'Squad B', color: 'red' } }, admin)).body;
  const created = await j({ method: 'POST', url: '/api/pages', payload: { name: 'E2E' } }, head);
  assert.equal(created.status, 201); const pid = created.body.page.id;
  const nodes = [N('rOrg'), N('rOrg_ds', 'rOrg', { type: 'ds' }), N('rB', null, { visibility: 'cells', cellIds: [other.id] }), N('rB_ds', 'rB', { type: 'ds' })];
  const put1 = await j({ method: 'PUT', url: `/api/pages/${pid}`, headers: { 'if-match': created.etag }, payload: doc(pid, nodes) }, head);
  assert.equal(put1.status, 200, JSON.stringify(put1.body));
  const forDes = (await j({ method: 'GET', url: `/api/pages/${pid}` }, des.cookie)).body;
  assert.deepEqual(forDes.nodes.map(n => n.id).sort(), ['rOrg', 'rOrg_ds'], 'el designer no ve la raíz de otra célula');
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pid}` }, head)).body.nodes.length, 4);
  // ahora la raíz B pasa a la célula del designer → la ve
  assert.equal((await j({ method: 'PATCH', url: `/api/pages/${pid}/nodes/rB/visibility`, payload: { visibility: 'cells', cellIds: [cell.id] } }, head)).status, 200);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pid}` }, des.cookie)).body.nodes.length, 4);
  assert.equal((await j({ method: 'PUT', url: `/api/pages/${pid}`, headers: { 'if-match': '"1"' }, payload: doc(pid, nodes) }, des.cookie)).status, 403, 'designer no edita');

  // imagen → webp + thumb; se asocia a un nodo en la siguiente versión
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#09f' } }).png().toBuffer();
  const up = await j({ method: 'POST', url: '/api/images?filename=hero.png', headers: { 'content-type': 'image/png' }, payload: png }, head);
  assert.equal(up.status, 201); assert.equal(up.body.mime, 'image/webp');
  assert.equal((await app.inject({ method: 'GET', url: up.body.url, headers: { cookie: des.cookie } })).statusCode, 403, 'imagen aún sin usar: solo su autor la ve');
  // versión manual antes del renombrado (las ediciones del mismo usuario en 5 min se fusionan en una sola auto)
  const manual = await j({ method: 'POST', url: `/api/pages/${pid}/versions`, payload: { label: 'hito' } }, head);
  assert.equal(manual.status, 201);
  const v2 = (await j({ method: 'GET', url: `/api/pages/${pid}` }, head)).body.version;
  const put2 = await j({ method: 'PUT', url: `/api/pages/${pid}`, headers: { 'if-match': `"${v2}"` }, payload: doc(pid, nodes.map(n => (n.id === 'rOrg' ? { ...n, imageId: up.body.id, name: 'Org renombrada' } : n))) }, head);
  assert.equal(put2.status, 200);
  const img = await app.inject({ method: 'GET', url: up.body.url, headers: { cookie: des.cookie } });
  assert.equal(img.statusCode, 200, 'ya usada en una card visible'); assert.equal(img.headers['content-type'], 'image/webp');
  assert.equal((await app.inject({ method: 'GET', url: up.body.thumbUrl, headers: { cookie: des.cookie } })).statusCode, 200);

  // versiones: lista (designer también), diff manual → actual, restaurar → el nombre vuelve
  const versions = (await j({ method: 'GET', url: `/api/pages/${pid}/versions` }, des.cookie)).body.versions;
  assert.ok(versions.length >= 2); assert.ok(versions.some(v => v.label === 'hito'));
  const first = manual.body.number;
  const diff = (await j({ method: 'GET', url: `/api/pages/${pid}/versions/${first}/diff/current` }, head)).body.diff;
  assert.ok(diff.nodes.changed.some(c => c.id === 'rOrg'), 'diff detecta el renombrado');
  const restored = await j({ method: 'POST', url: `/api/pages/${pid}/versions/${first}/restore` }, head);
  assert.equal(restored.status, 200);
  assert.equal((await j({ method: 'GET', url: `/api/pages/${pid}` }, head)).body.nodes.find(n => n.id === 'rOrg').name, 'rOrg');
  assert.equal((await j({ method: 'POST', url: `/api/pages/${pid}/versions` }, des.cookie)).status, 403);

  // respaldo (admin): tar.gz consistente con la BD y las imágenes
  assert.equal((await j({ method: 'POST', url: '/api/backups' }, head)).status, 403);
  const bk = await j({ method: 'POST', url: '/api/backups' }, admin);
  assert.equal(bk.status, 201); assert.equal(bk.body.status, 'ok');
  assert.ok(fs.existsSync(path.join(app.backupsDir, bk.body.filename)));
  const dl = await app.inject({ method: 'GET', url: `/api/backups/${bk.body.id}/download`, headers: { cookie: admin } });
  assert.equal(dl.statusCode, 200); assert.equal(dl.headers['content-type'], 'application/gzip');

  // cuenta: cerrar las demás sesiones
  const des2 = await login(app, 'des@e2e.io');
  const closed = await j({ method: 'DELETE', url: '/api/me/sessions' }, des.cookie);
  assert.equal(closed.status, 200); assert.equal(closed.body.sessionsClosed, 1);
  assert.equal((await j({ method: 'GET', url: '/api/me' }, des2)).status, 401);
  assert.equal((await j({ method: 'GET', url: '/api/me' }, des.cookie)).status, 200);
  assert.ok(app.db.prepare("SELECT 1 FROM audit_log WHERE action = 'user.sessions'").get());
  resetRateLimit();
});

test('P6: cabeceras de seguridad (CSP estricta en HTML/estáticos, ninguna CSP en /api/*), nosniff en todo', async (t) => {
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(() => app.close());
  const html = await app.inject({ method: 'GET', url: '/' });
  assert.equal(html.statusCode, 200);
  assert.equal(html.headers['content-security-policy'], CSP);
  assert.ok(!CSP.includes('unsafe-inline') && CSP.includes("frame-ancestors 'none'") && CSP.includes("img-src 'self' data: blob:"));
  assert.equal(html.headers['x-content-type-options'], 'nosniff');
  assert.equal(html.headers['x-frame-options'], 'DENY');
  assert.equal(html.headers['referrer-policy'], 'same-origin');
  assert.ok(html.headers['permissions-policy'].includes('camera=()'));
  const js = await app.inject({ method: 'GET', url: '/js/main.js' });
  assert.equal(js.headers['content-security-policy'], CSP, 'estáticos también');
  const api = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(api.statusCode, 200); assert.equal(api.headers['content-security-policy'], undefined);
  assert.equal(api.headers['x-content-type-options'], 'nosniff');
  const nf = await app.inject({ method: 'GET', url: '/api/nope' });
  assert.equal(nf.statusCode, 404); assert.equal(nf.headers['content-security-policy'], undefined);
  // el cliente no usa style= inline (CSP sin 'unsafe-inline'): data-style + applyDataStyles
  const files = fs.readdirSync(path.join(ROOT, 'client/js'), { recursive: true }).filter(f => f.endsWith('.js'));
  for (const f of files) assert.ok(!/(?<!data-)style="/.test(fs.readFileSync(path.join(ROOT, 'client/js', f), 'utf8')), `${f}: style= inline rompe la CSP`);
  assert.ok(!/ on\w+="/.test(fs.readFileSync(path.join(ROOT, 'client/index.html'), 'utf8')));
});

test('P6: logs sin secretos — token de invitación enmascarado en la URL, sin cookies ni contraseñas', async (t) => {
  resetRateLimit();
  assert.equal(redactUrl('/api/invites/AbC-123_xyz'), '/api/invites/[redacted]');
  assert.equal(redactUrl('/api/invites/accept'), '/api/invites/accept');
  assert.equal(redactUrl('/api/pages/p1?token=abc&x=1'), '/api/pages/p1?token=[redacted]&x=1');
  let out = '';
  const stream = new Writable({ write(chunk, enc, cb) { out += chunk; cb(); } });
  const app = await buildApp({ dbPath: ':memory:', logger: { level: 'info', stream } });
  t.after(() => app.close());
  const admin = await setupAdmin(app, 'admin@log.io');
  const inv = (await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'n@log.io', role: 'designer' } })).json();
  const token = inv.link.split('/#/invite/')[1];
  assert.equal((await app.inject({ method: 'GET', url: `/api/invites/${token}` })).statusCode, 200);
  await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@log.io', password: PW } });
  await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: admin } });
  assert.ok(out.includes('/api/invites/[redacted]'), 'la petición se registra enmascarada');
  assert.ok(!out.includes(token), 'el token no aparece en los logs');
  assert.ok(!out.includes(PW), 'la contraseña no aparece');
  assert.ok(!out.includes(admin.split('=')[1]), 'la cookie de sesión no aparece');
  resetRateLimit();
});

test('P6: SIGTERM → cierre ordenado: código 0 y .server.lock liberado (proceso real)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-sig-'));
  const dbPath = path.join(tmp, 'sig.db'), port = 3900 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATABASE_PATH: dbPath, LOG_LEVEL: 'silent' }, stdio: 'ignore' });
  try {
    let ok = false;
    for (let i = 0; i < 100 && !ok; i++) { try { ok = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch { await new Promise(r => setTimeout(r, 100)); } }
    assert.ok(ok, 'el servidor arrancó');
    assert.ok(fs.existsSync(path.join(tmp, '.server.lock')), 'lock presente mientras corre');
    const exit = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    assert.equal(await exit, 0);
    assert.ok(!fs.existsSync(path.join(tmp, '.server.lock')), 'lock liberado');
  } finally { try { child.kill('SIGKILL'); } catch {} fs.rmSync(tmp, { recursive: true, force: true }); }
});

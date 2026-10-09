// F5: upload (magic bytes, sharp → webp + thumb), documento solo imageId, 415 falso PNG, 403 designer sin acceso en /uploads, import legacy con dataURL, dedupe, 409 en uso, huérfanas, embedImages.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { buildApp } from '../server/index.js';
import { sniff, purgeOrphans } from '../server/lib/images.js';
import { setupAdmin, inviteAndAccept } from './helpers/auth.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-img-'));
const doc = (page, nodes) => ({ version: 3, page, nodes, edges: [], tags: [], branchTypes: [{ id: 'et_feature', name: 'Feature', color: 'blue' }], settings: {}, camera: { x: 0, y: 0, z: 1 } });
const root = (id, extra = {}) => ({ id, type: 'software', name: id, parentId: null, x: 0, y: 0, visibility: 'org', ...extra });
const noisePng = async (w, h) => sharp({ create: { width: w, height: h, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).png({ compressionLevel: 0 }).toBuffer();

test('sniff: magic bytes png/jpeg/webp/svg; .exe renombrado → null', async () => {
  assert.equal(sniff(await noisePng(8, 8)), 'png');
  assert.equal(sniff(await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } }).jpeg().toBuffer()), 'jpeg');
  assert.equal(sniff(await sharp({ create: { width: 4, height: 4, channels: 3, background: '#0f0' } }).webp().toBuffer()), 'webp');
  assert.equal(sniff(Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')), 'svg');
  assert.equal(sniff(Buffer.concat([Buffer.from('MZ\x90\x00\x03'), Buffer.alloc(64)])), null);
  assert.equal(sniff(Buffer.from('<html><script>alert(1)</script></html>')), null);
});

test('API imágenes: upload 3 MB → webp ≤1600 + thumb; documento guarda imageId; 415; /uploads con visibilidad; dedupe; 409 en uso; huérfanas; import legacy; embedImages', async (t) => {
  const app = await buildApp({ dbPath: path.join(tmp, 'i.db'), logger: false });
  t.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const admin = await setupAdmin(app);
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { ...(o.headers || {}), cookie } }); return { status: r.statusCode, headers: r.headers, body: r.statusCode === 204 ? null : (String(r.headers['content-type']).includes('json') ? r.json() : r.rawPayload) }; };
  const png = await noisePng(1800, 700);
  assert.ok(png.length > 3 * 1024 * 1024, `png de ${png.length} bytes`);
  const up = await j({ method: 'POST', url: '/api/images?filename=big.png', headers: { 'content-type': 'image/png' }, payload: png }, admin);
  assert.equal(up.status, 201, JSON.stringify(up.body)); assert.equal(up.body.mime, 'image/webp'); assert.equal(up.body.width, 1600); assert.ok(up.body.bytes < png.length / 4);
  const id = up.body.id;
  const f = path.join(app.uploadsDir, 'org_default', `${id}.webp`), th = path.join(app.uploadsDir, 'org_default', `${id}.thumb.webp`);
  assert.ok(fs.existsSync(f) && fs.existsSync(th));
  const thumbMeta = await sharp(th).metadata(); assert.equal(thumbMeta.width, 320); assert.equal(thumbMeta.height, 180); assert.equal(thumbMeta.format, 'webp');
  // dedupe por sha256
  assert.equal((await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/png' }, payload: png }, admin)).body.id, id);
  // 415: .exe renombrado .png, html, gif no soportado; 413: > 5 MB; cuerpo no binario → 415
  assert.equal((await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/png' }, payload: Buffer.concat([Buffer.from('MZ\x90\x00'), Buffer.alloc(100)]) }, admin)).status, 415);
  assert.equal((await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/svg+xml' }, payload: Buffer.from('<html><script>x</script></html>') }, admin)).status, 415);
  assert.equal((await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/png' }, payload: Buffer.alloc(6 * 1024 * 1024) }, admin)).status, 413);
  assert.equal((await j({ method: 'POST', url: '/api/images', payload: { a: 1 } }, admin)).status, 415);
  // SVG se rasteriza (nunca se sirve como svg)
  const svg = await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/svg+xml' }, payload: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><script>alert(1)</script><rect width="400" height="200" fill="#09f"/></svg>') }, admin);
  assert.equal(svg.status, 201); assert.equal(svg.body.mime, 'image/webp');
  const svgGet = await j({ method: 'GET', url: `/uploads/${svg.body.id}` }, admin);
  assert.equal(svgGet.headers['content-type'], 'image/webp'); assert.ok(!svgGet.body.includes('script'));

  // Documento: PUT con image dataURL → se ingiere → imageId; nunca persiste dataURL
  const dataUrl = 'data:image/png;base64,' + (await noisePng(40, 30)).toString('base64');
  const put = await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': '0' }, payload: doc({ id: 'p_default', name: 'X' }, [root('rA', { imageId: id, visibility: 'cells', cellIds: [] }), root('rB', { image: dataUrl }), root('rC', { imageId: 'nope' })]) }, admin);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const got = (await j({ method: 'GET', url: '/api/pages/p_default' }, admin)).body;
  const [a, b, c] = got.nodes;
  assert.equal(a.imageId, id); assert.equal(a.image, null);
  assert.ok(b.imageId && b.imageId !== id); assert.equal(b.image, null, 'dataURL convertida a archivo');
  assert.equal(c.imageId, null, 'imageId inexistente se descarta');
  // embedImages → dataURL webp para export portable
  const emb = (await j({ method: 'GET', url: '/api/pages/p_default?embedImages=1' }, admin)).body;
  assert.match(emb.nodes[0].image, /^data:image\/webp;base64,/); assert.equal(emb.nodes[0].imageId, id);
  assert.equal((await j({ method: 'GET', url: '/api/pages/p_default' }, admin)).body.nodes[0].image, null, 'sin flag no incrusta');

  // /uploads: sin sesión 401; designer sin acceso a la raíz solo-células → 403; con acceso (asignado) → 200 + cache; thumb; 304
  assert.equal((await app.inject({ method: 'GET', url: `/uploads/${id}` })).statusCode, 401);
  const des = await inviteAndAccept(app, admin, 'des@test.io', 'viewer');
  assert.equal((await j({ method: 'GET', url: `/uploads/${id}` }, des.cookie)).status, 403, 'rA es solo-células sin células → invisible');
  assert.equal((await j({ method: 'GET', url: `/uploads/${b.imageId}/thumb` }, des.cookie)).status, 200, 'rB es org → visible');
  assert.equal((await j({ method: 'PUT', url: '/api/pages/p_default/nodes/rA/assignees', payload: { assigneeIds: [des.user.id] } }, admin)).status, 200);
  const ok = await j({ method: 'GET', url: `/uploads/${id}` }, des.cookie);
  assert.equal(ok.status, 200); assert.equal(ok.headers['content-type'], 'image/webp'); assert.match(ok.headers['cache-control'], /private/); assert.ok(ok.headers.etag);
  assert.equal((await j({ method: 'GET', url: `/uploads/${id}`, headers: { 'if-none-match': ok.headers.etag } }, des.cookie)).status, 304);
  assert.equal((await j({ method: 'GET', url: '/uploads/nope' }, admin)).status, 404);
  // P10: el viewer sube imágenes (nodes.own, para sus cards) pero no borra
  assert.equal((await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/png' }, payload: png }, des.cookie)).status, 201);
  assert.equal((await j({ method: 'DELETE', url: `/api/images/${id}` }, des.cookie)).status, 403);
  // borrar en uso → 409; imagen subida y no usada: solo visible para quien la subió (designer no) y se purga como huérfana
  assert.equal((await j({ method: 'DELETE', url: `/api/images/${id}` }, admin)).status, 409);
  const loose = (await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/png' }, payload: await noisePng(50, 50) }, admin)).body;
  assert.equal((await j({ method: 'GET', url: `/uploads/${loose.id}` }, des.cookie)).status, 403);
  assert.equal((await j({ method: 'GET', url: `/uploads/${loose.id}` }, admin)).status, 200);
  assert.deepEqual(purgeOrphans(app.db, app.uploadsDir, 86400e3), [], 'reciente: no se purga');
  // P9: una imagen usada solo como icono del thumbnail (thumbIconId) cuenta como en uso: no se purga ni se borra (409)
  const icon = (await j({ method: 'POST', url: '/api/images', headers: { 'content-type': 'image/png' }, payload: await noisePng(60, 60) }, admin)).body;
  const cur = (await j({ method: 'GET', url: '/api/pages/p_default' }, admin)).body;
  cur.nodes[1].thumbIconId = icon.id; cur.nodes[1].geo = 'MX'; // la API exige ISO alfa-2 en mayúsculas (schema); el import normaliza minúsculas
  { const r = await j({ method: 'PUT', url: '/api/pages/p_default', headers: { 'if-match': String(cur.page.version) }, payload: cur }, admin); assert.equal(r.status, 200, 'PUT con icono: ' + JSON.stringify(r.body)); }
  const withIcon = (await j({ method: 'GET', url: '/api/pages/p_default' }, admin)).body.nodes[1];
  assert.equal(withIcon.thumbIconId, icon.id); assert.equal(withIcon.geo, 'MX');
  app.db.prepare("UPDATE images SET created_at = '2000-01-01T00:00:00.000Z' WHERE id IN (?, ?)").run(loose.id, icon.id);
  assert.deepEqual(purgeOrphans(app.db, app.uploadsDir), [loose.id]);
  assert.ok(!fs.existsSync(path.join(app.uploadsDir, 'org_default', `${loose.id}.webp`)));
  assert.equal((await j({ method: 'DELETE', url: `/api/images/${icon.id}` }, admin)).status, 409, 'icono del thumbnail en uso');
  assert.equal((await j({ method: 'DELETE', url: `/api/images/${svg.body.id}` }, admin)).status, 204);
  assert.equal((await j({ method: 'GET', url: `/uploads/${svg.body.id}` }, admin)).status, 404);

  // import legacy (v2 con dataURLs) crea archivos
  const legacy = { nodes: [{ id: 'l1', type: 'software', name: 'L1', image: dataUrl, parentId: null, x: 0, y: 0 }, { id: 'l2', type: 'software', name: 'L2', image: 'data:image/png;base64,QUJD', parentId: null, x: 0, y: 0 }], edges: [] };
  const imp = await j({ method: 'POST', url: '/api/import', payload: legacy }, admin);
  assert.equal(imp.status, 200); assert.equal(imp.body.images, 1, 'una dataURL válida (la corrupta se descarta)');
  const after = (await j({ method: 'GET', url: '/api/pages/p_default' }, admin)).body.nodes;
  assert.equal(after[0].imageId, b.imageId, 'misma dataURL → mismo archivo (dedupe)'); assert.equal(after[1].imageId, null);
  const actions = app.db.prepare('SELECT DISTINCT action FROM audit_log').all().map(r => r.action);
  for (const x of ['image.upload', 'image.delete']) assert.ok(actions.includes(x), x);
});

test('migración al arrancar: nodes.image_legacy → images + image_id', async (t) => {
  const dbPath = path.join(tmp, 'legacy.db');
  const { openReady } = await import('../server/db/sqlite.js');
  const db = openReady(dbPath);
  // simula una BD anterior a F7: columna image_legacy presente y 008 pendiente
  db.exec("ALTER TABLE nodes ADD COLUMN image_legacy TEXT; DELETE FROM _migrations WHERE name = '008_drop_image_legacy.sql'");
  const png = await noisePng(20, 20);
  db.prepare("INSERT INTO nodes (id, page_id, type, name, image_legacy) VALUES ('n1', 'p_default', 'software', 'N1', ?)").run('data:image/png;base64,' + png.toString('base64'));
  assert.ok(!db.prepare("SELECT 1 FROM _migrations WHERE name = '008_drop_image_legacy.sql'").get(), '008 pendiente mientras haya dataURLs');
  db.close();
  const app = await buildApp({ dbPath, logger: false });
  t.after(() => app.close());
  const row = app.db.prepare("SELECT image_id FROM nodes WHERE id = 'n1'").get();
  assert.ok(row.image_id);
  const { hasColumn } = await import('../server/db/sqlite.js');
  assert.equal(hasColumn(app.db, 'nodes', 'image_legacy'), false, 'F7: 008 aplicada tras vaciar la columna');
  assert.ok(app.db.prepare("SELECT 1 FROM _migrations WHERE name = '008_drop_image_legacy.sql'").get());
  assert.ok(fs.existsSync(path.join(app.uploadsDir, 'org_default', `${row.image_id}.webp`)));
});

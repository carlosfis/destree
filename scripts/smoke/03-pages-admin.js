// Smoke · F4a/F4b/F5/P9/P12/F6a/F6b: lobby y páginas, #/admin, icono del thumbnail y degradado, thumbnail PNG, historial, respaldos, recarga. Lo ejecuta scripts/smoke.js con el contexto CDP (ev, send, step…).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export default async function (c) {
  const { ev, send, sleep, mouse, drag, key, center, step, fill, META, SHIFT, ROOT } = c;
// F4a: lobby → nueva página → cambio sin fugas (historial/selección vacíos) → volver → archivar/restaurar.
await step('F4a: lobby → nueva página → cambio sin fugas → volver → archivar/restaurar', async () => {
  const before = await ev(`({ page: S.pageId, nodes: S.state.nodes.length })`);
  await ev(`location.hash = '#/lobby'; true`); await sleep(500);
  const lobby = await ev(`({ visible: !document.querySelector('#lobbyView').hidden, cards: document.querySelectorAll('#lobbyView .page-card').length, current: !!document.querySelector('#lobbyView .page-card.current') })`);
  await ev(`document.querySelector('#lobbyNew').click(); true`); await sleep(150);
  await ev(`(() => { const f = document.querySelector('#confirmDialog form'); f.v.value = 'Smoke Page 2'; f.requestSubmit(); return true; })()`); await sleep(900);
  await ev(`document.querySelector('.node')?.click(); import('/js/core/history.js').then(m => m.pushHistory()); true`); await sleep(50);
  const h0 = await ev(`import('/js/core/history.js').then(m => m.history.past.length)`);
  const fresh = await ev(`({ hash: location.hash.slice(0, 4), changed: S.pageId !== ${JSON.stringify(before.page)}, nodes: S.state.nodes.length, lobbyHidden: document.querySelector('#lobbyView').hidden, btn: document.querySelector('#btnLobby').textContent, cards: document.querySelectorAll('#nodes .node').length })`);
  const newId = await ev(`S.pageId`);
  await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(null, { type: 'software', x: 10, y: 10 }))`); await sleep(100);
  await ev(`(() => { const f = document.querySelector('#editorForm'); f.elements.name.value = 'Raíz P2'; f.requestSubmit(); return true; })()`); await sleep(1000);
  const p2 = await ev(`import('/js/core/history.js').then(m => ({ nodes: S.state.nodes.length, hist: m.history.past.length, sel: [...document.querySelectorAll('.node.selected')].length, status: document.querySelector('#saveStatus').textContent }))`);
  await ev(`location.hash = '#/p/' + ${JSON.stringify(before.page)}; true`); await sleep(900);
  const back = await ev(`import('/js/core/history.js').then(m => ({ page: S.pageId === ${JSON.stringify(before.page)}, nodes: S.state.nodes.length, hist: m.history.past.length, future: m.history.future.length, sel: [...document.querySelectorAll('.node.selected')].length, popover: document.querySelector('#popover').hidden, dialog: document.querySelector('#nodeDrawer').classList.contains('open') }))`);
  if (!back.page || back.nodes !== before.nodes || back.hist !== 0 || back.sel !== 0) throw new Error('fuga de estado: ' + JSON.stringify(back));
  const arch = await ev(`fetch('/api/pages/' + ${JSON.stringify(newId)} + '/archive', { method: 'POST' }).then(r => r.status)`);
  await ev(`location.hash = '#/lobby'; true`); await sleep(500);
  const lobby2 = await ev(`({ cards: document.querySelectorAll('#lobbyView .page-card').length })`);
  await ev(`document.querySelector('#lobbyTabs [data-tab=archived]').click(); true`); await sleep(400);
  const archived = await ev(`({ cards: document.querySelectorAll('#lobbyView .page-card').length, restore: !!document.querySelector('#lobbyView [data-unarchive]') })`);
  await ev(`document.querySelector('#lobbyView [data-unarchive]').click(); true`); await sleep(500);
  const restored = await ev(`document.querySelectorAll('#lobbyView .page-card').length`);
  await ev(`document.querySelector('#lobbyTabs [data-tab=active]').click(); true`); await sleep(400);
  const active = await ev(`document.querySelectorAll('#lobbyView .page-card').length`);
  await ev(`document.querySelector('#lobbyBack').click(); true`); await sleep(400);
  const end = await ev(`({ lobbyHidden: document.querySelector('#lobbyView').hidden, page: S.pageId === ${JSON.stringify(before.page)}, nodes: S.state.nodes.length })`);
  return { lobby, h0, fresh, p2, back, arch, lobby2, archived, restored, active, end };
});
// F4b: #/admin (pestañas por permiso, audit log con acciones previas, borradas) + drawer Página (renombrar → topbar/version).
await step('F4b: #/admin (usuarios/células/borradas/audit) + pestaña Página del drawer', async () => {
  await ev(`location.hash = '#/admin/users'; true`); await sleep(1200);
  const admin = await ev(`({ visible: !document.querySelector('#adminView').hidden, tabs: [...document.querySelectorAll('#orgTabs button')].map(b => b.dataset.tab), users: document.querySelectorAll('#adminView #userRows .row').length, lobbyHidden: document.querySelector('#lobbyView')?.hidden ?? true })`);
  await ev(`document.querySelector('#orgTabs [data-tab=audit]').click(); true`); await sleep(500);
  const audit = await ev(`({ rows: document.querySelectorAll('#auditRows tr').length, actions: [...new Set([...document.querySelectorAll('#auditRows code')].map(c => c.textContent))].slice(0, 6), more: !document.querySelector('#auditMore').hidden })`);
  if (!audit.actions.includes('page.save') || !audit.actions.includes('setup') && audit.rows < 10) throw new Error('audit sin acciones previas: ' + JSON.stringify(audit));
  await ev(`document.querySelector('#orgTabs [data-tab=deleted]').click(); true`); await sleep(400);
  const deleted = await ev(`document.querySelector('#deletedRows')?.textContent.slice(0, 40)`);
  await ev(`document.querySelector('#adminBack').click(); true`); await sleep(400);
  await ev(`document.querySelector('#btnAdmin').click(); document.querySelector('#adminTabs [data-tab=page]').click(); true`); await sleep(200);
  const v0 = await ev(`S.version`);
  await ev(`(() => { const f = document.querySelector('#pageMetaForm'); f.name.value = 'Árbol renombrado'; f.requestSubmit(); return true; })()`); await sleep(700);
  const page = await ev(`({ name: S.state.page.name, btn: document.querySelector('#btnLobby').textContent, bumped: S.version > ${JSON.stringify(0)} && S.version === ${'${v0}'} + 1, adminHidden: document.querySelector('#adminView').hidden })`.replace('${v0}', JSON.stringify(v0)));
  await ev(`document.querySelector('#closeAdmin').click(); true`);
  return { admin, audit, deleted, page };
});
// F5: subir imagen desde el editor (input file vía CDP) → preview /uploads → card con thumb webp; import con dataURL → archivo.
await step('F5/P12: icono del thumbnail en editor → thumbIconId + /uploads; dataURL importada → archivo (imageId conservado); degradado en la raíz', async () => {
  const sharp = (await import('sharp')).default;
  const pngPath = path.join(os.tmpdir(), `destree-smoke-${process.pid}.png`);
  fs.writeFileSync(pngPath, await sharp({ create: { width: 640, height: 400, channels: 3, background: '#3366cc' } }).png().toBuffer());
  const nodeId = await ev(`S.state.nodes.find(n => !n.parentId).id`);
  await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(nodeId)}))`); await sleep(150);
  const grad = await ev(`({ img: !!document.querySelector('#fImgInput'), dots: document.querySelectorAll('#fGrad .grad-dot').length, active: document.querySelector('#fGrad .grad-dot.active')?.dataset.v, visible: !document.querySelector('#fGradField').hidden })`);
  if (grad.img || grad.dots !== 10 || grad.active !== 'mint' || !grad.visible) throw new Error('selector: ' + JSON.stringify(grad));
  await ev(`document.querySelector('#fGrad [data-v="sunset"]').click(); true`);
  const { root } = await send('DOM.getDocument', { depth: 1 });
  const { nodeId: inputNode } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#fThumbIconInput' });
  await send('DOM.setFileInputFiles', { nodeId: inputNode, files: [pngPath] }); await sleep(1500);
  const preview = await ev(`document.querySelector('#fThumbIcon img')?.getAttribute('src') || document.querySelector('#fThumbIcon').textContent`);
  await ev(`document.querySelector('#editorForm').requestSubmit(); true`); await sleep(1000);
  const node = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(nodeId)}); return { thumbIconId: !!n.thumbIconId, imageId: n.imageId, gradient: n.gradient, band: document.querySelector('.node[data-id="' + n.id + '"] .card-grad')?.className, status: document.querySelector('#saveStatus').textContent }; })()`);
  if (!/^\/uploads\/.+\/thumb$/.test(preview) || !node.thumbIconId || node.gradient !== 'sunset' || !/grad-sunset/.test(node.band || '')) throw new Error('upload/degradado: ' + JSON.stringify({ preview, node }));
  const srv = await ev(`fetch('/api/pages/' + S.pageId).then(r => r.json()).then(d => { const n = d.nodes.find(n => n.id === ${JSON.stringify(nodeId)}); return { thumbIconId: !!n.thumbIconId, gradient: n.gradient, child: d.nodes.find(x => x.parentId)?.gradient }; })`);
  if (srv.gradient !== 'sunset' || srv.child !== '') throw new Error('servidor: ' + JSON.stringify(srv));
  // dataURL en el documento (import legado) → el servidor crea el archivo y conserva imageId (la card ya no la muestra)
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(pngPath).toString('base64');
  const other = await ev(`S.state.nodes.find(n => n.id !== ${JSON.stringify(nodeId)} && !n.imageId).id`);
  await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(other)}); n.image = ${JSON.stringify(dataUrl)}; n.imageId = null; return import('/js/core/state.js').then(m => m.persist()); })()`); await sleep(1500);
  const ingested = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(other)}); return { imageId: !!n.imageId, image: n.image, img: !!document.querySelector('.node[data-id="' + n.id + '"] img') }; })()`);
  if (!ingested.imageId || ingested.img) throw new Error('ingesta: ' + JSON.stringify(ingested));
  fs.rmSync(pngPath, { force: true });
  return { preview: preview.slice(0, 9), node, srv, ingested };
});
await step('P9: thumbnail en editor (geo + vista previa + PNG) y botones en la ficha', async () => {
  const nodeId = await ev(`S.state.nodes.find(n => n.staff && n.staff.length)?.id || S.state.nodes[0].id`);
  await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(nodeId)}))`); await sleep(200);
  await ev(`(() => { const f = document.querySelector('#editorForm'); f.elements.geo.value = 'MX'; f.elements.geo.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await sleep(700);
  const canvas = await ev(`(() => { const c = document.querySelector('#fThumbCanvas'); const px = c.getContext('2d').getImageData(960, 540, 1, 1).data; return { w: c.width, h: c.height, painted: px[3] === 255, copy: !!document.querySelector('#fThumbCopy'), download: !!document.querySelector('#fThumbDownload') }; })()`);
  if (canvas.w !== 1920 || canvas.h !== 1080 || !canvas.painted || !canvas.copy) throw new Error('vista previa: ' + JSON.stringify(canvas));
  const png = await ev(`import('/js/ui/thumbnail.js').then(async m => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(nodeId)}); const c = await m.renderThumbnail(m.thumbnailData(n, { geo: 'MX' })); return c.toDataURL('image/png').slice(0, 22); })`);
  await ev(`document.querySelector('#editorForm').requestSubmit(); true`); await sleep(900);
  const saved = await ev(`fetch('/api/pages/' + S.pageId).then(r => r.json()).then(d => d.nodes.find(n => n.id === ${JSON.stringify(nodeId)}).geo)`);
  await ev(`import('/js/ui/node-view.js').then(m => m.openNodeView(${JSON.stringify(nodeId)}))`); await sleep(150);
  const view = await ev(`!!document.querySelector('#vThumbCopy') && !!document.querySelector('#vThumbDownload')`);
  await ev(`import('/js/ui/node-drawer.js').then(m => m.closeDrawer())`); await sleep(300);
  if (png !== 'data:image/png;base64,' || saved !== 'MX' || !view) throw new Error(JSON.stringify({ png, saved, view }));
  return { canvas, saved, view };
});
// F6a: versión manual → 3 ediciones (autos coalescidas) → panel: lista, diff (+3), restaurar la manual → nodos de vuelta, versión 'restore'.
await step('F6a: historial (manual → 3 ediciones → diff → restaurar)', async () => {
  const n0 = await ev(`S.state.nodes.length`);
  const manual = await ev(`fetch('/api/pages/' + S.pageId + '/versions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'antes' }) }).then(r => r.json()).then(v => v.number)`);
  for (let i = 0; i < 3; i++) {
    await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(null, { type: 'software', x: 900 + ${i} * 40, y: 900 }))`); await sleep(100);
    await ev(`(() => { const f = document.querySelector('#editorForm'); f.elements.name.value = 'Ver ${i}'; f.requestSubmit(); return true; })()`); await sleep(1100);
  }
  const list = await ev(`fetch('/api/pages/' + S.pageId + '/versions').then(r => r.json()).then(j => j.versions.map(v => [v.number, v.reason]))`);
  await ev(`document.querySelector('#btnVersions').click(); true`); await sleep(500);
  const panel = await ev(`({ open: document.querySelector('#editorDialog').open, items: document.querySelectorAll('.ver-list li').length, manual: !!document.querySelector('#verManual') })`);
  const li = `document.querySelector('.ver-list li[data-n="${manual}"]')`;
  await ev(`${li}.querySelector('[data-diff]').click(); true`); await sleep(400);
  const diff = await ev(`${li}.querySelector('.ver-detail').textContent.replace(/\\s+/g, ' ').slice(0, 90)`);
  await ev(`${li}.querySelector('[data-restore]').click(); true`); await sleep(200);
  await ev(`(() => { const d = document.querySelector('#confirmDialog'); [...d.querySelectorAll('[data-v]')].filter(b => b.dataset.v).at(-1).click(); return true; })()`); await sleep(1200);
  const after = await ev(`import('/js/core/history.js').then(m => ({ nodes: S.state.nodes.length, hist: m.history.past.length, dialog: document.querySelector('#editorDialog').open, status: document.querySelector('#saveStatus').textContent }))`);
  const top = await ev(`fetch('/api/pages/' + S.pageId + '/versions').then(r => r.json()).then(j => j.versions.slice(0, 2).map(v => [v.number, v.reason, v.label]))`);
  if (after.nodes !== n0 || !/\+3/.test(diff) || top[0][1] !== 'restore') throw new Error('restore: ' + JSON.stringify({ n0, list, diff, after, top }));
  return { n0, versions: list, panel, diff, after, top };
});
// F6b: #/admin → Respaldos → crear respaldo → fila ok, descarga 200, export org JSON.
await step('F6b: respaldos (crear desde #/admin, descargar, export org)', async () => {
  await ev(`location.hash = '#/admin/backups'; true`); await sleep(800);
  await ev(`document.querySelector('#bkCreate').click(); true`); await sleep(2500);
  const rows = await ev(`[...document.querySelectorAll('#bkRows .row')].map(r => r.querySelector('.count').textContent)`);
  const dl = await ev(`fetch(document.querySelector('#bkRows a[download]').getAttribute('href')).then(r => ({ status: r.status, type: r.headers.get('content-type'), len: Number(r.headers.get('content-length')) }))`);
  const exp = await ev(`fetch('/api/org/export').then(r => r.json()).then(d => ({ v: d.version, pages: d.pages.length, users: d.users.length, images: d.images.length, versions: d.pages[0].versions.length }))`);
  await ev(`document.querySelector('#adminBack').click(); true`); await sleep(300);
  if (!rows.length || !/ok/.test(rows[0]) || dl.status !== 200 || !dl.len) throw new Error('backup: ' + JSON.stringify({ rows, dl }));
  return { rows, dl, exp };
});
await step('recarga: persistencia SQLite vía API', async () => { await send('Page.reload'); await sleep(1200); return ev(`({ nodes: S.state.nodes.length, theme: document.documentElement.dataset.theme })`); });
}

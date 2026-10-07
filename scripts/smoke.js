// Smoke de paridad (F0b, F1 sobre Fastify+SQLite temporal, F2 setup/login/readonly): checklist en Chrome headless vía CDP; recoge excepciones y console.error. Uso: node scripts/smoke.js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 5174, DBG = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-smoke-'));
const srv = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATABASE_PATH: path.join(prof, 'smoke.db'), LOG_LEVEL: 'silent' }, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { srv.kill(); } catch {} try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 }); } catch {} };
process.on('exit', cleanup);
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); if (list.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const events = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } else events.push(m); };
const send = (method, params = {}) => new Promise((resolve, reject) => { ws.send(JSON.stringify({ id: ++id, method, params })); pending.set(id, { resolve, reject }); });
const problems = [];
const drain = () => { for (const m of events.splice(0)) {
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) problems.push('CONSOLE.' + m.params.type + ' ' + m.params.args.map((a) => a.description || a.value).join(' '));
  // F2: 401 en /api/me sin sesión y el 403 del PUT de designer son respuestas esperadas del flujo, no errores.
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/status of (401|403)/.test(m.params.entry.text)) problems.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
} };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
const mouse = async (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse', ...extra });
const drag = async (x1, y1, x2, y2) => { await mouse('mousePressed', x1, y1); for (let i = 1; i <= 6; i++) await mouse('mouseMoved', x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6, { buttons: 1 }); await sleep(50); await mouse('mouseReleased', x2, y2); await sleep(60); };
const key = async (k, code, modifiers = 0, text) => { await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, modifiers, text, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : undefined }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers }); await sleep(40); };
const META = 4, SHIFT = 8;
const results = [];
const step = async (name, fn) => { try { const v = await fn(); drain(); results.push(`✔ ${name}${v !== undefined ? ' → ' + JSON.stringify(v) : ''}`); } catch (e) { drain(); results.push(`✖ ${name}: ${e.message}`); } };
const center = async (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top }; })()`);

await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(1200); drain();
// F2: primer arranque → formulario de setup (org + admin); tras enviarlo arranca la app con sesión.
const fill = async (pairs) => ev(`(() => { ${pairs.map(([n, v]) => `document.querySelector('#authView [name=${n}]').value = ${JSON.stringify(v)};`).join('')} document.querySelector('#authView form').requestSubmit(); return true; })()`);
await step('setup inicial (org + admin) → sesión', async () => {
  const shown = await ev(`!document.querySelector('#authView').hidden && !!document.querySelector('#authView [name=orgName]')`);
  if (!shown) throw new Error('no apareció el formulario de setup');
  await fill([['orgName', 'Smoke SA'], ['name', 'Ana'], ['email', 'ana@smoke.io'], ['password', 'smoke-1234']]); await sleep(1200);
  return ev(`({ role: S.session.role, org: S.session.org.name, chip: document.querySelector('#userChip')?.textContent, authHidden: document.querySelector('#authView').hidden, orgBtn: !!document.querySelector('#btnOrg'), pageTab: !!document.querySelector('#adminTabs [data-tab=page]') })`);
});
await step('carga: demo + S expuesto', () => ev(`({ nodes: S.state.nodes.length, dom: document.querySelectorAll('#nodes .node').length, edges: S.state.edges.length, firstRun: S.firstRun, vp: !!S.vpRect })`));
await step('crear raíz (btnNew → menú → editor → submit)', async () => {
  await ev(`document.querySelector('#btnNew').click()`); await sleep(80);
  const n = await ev(`document.querySelectorAll('#popover .menu-item').length`); if (!n) throw new Error('sin menú');
  await ev(`document.querySelector('#popover .menu-item').click()`); await sleep(120);
  await ev(`(() => { const f = document.querySelector('#editorForm'); f.elements.name.value = 'Smoke Root'; f.requestSubmit(); })()`); await sleep(150);
  return ev(`({ open: document.querySelector('#editorDialog').open, nodes: S.state.nodes.length, last: S.state.nodes.at(-1).name })`);
});
await step('anidar DS (menú contextual del nodo → Design System)', async () => {
  const id = await ev(`S.state.nodes.at(-1).id`);
  const c = await center(`.node[data-id="${id}"] .head, .node[data-id="${id}"]`);
  await mouse('mousePressed', c.x, c.y, { button: 'right' }); await mouse('mouseReleased', c.x, c.y, { button: 'right' }); await sleep(100);
  const ok = await ev(`(() => { const b = [...document.querySelectorAll('#popover .menu-item')].find(b => /Design System/.test(b.textContent)); if (!b) return false; b.click(); return true; })()`);
  if (!ok) throw new Error('sin opción Design System en el menú');
  await sleep(120);
  await ev(`(() => { const f = document.querySelector('#editorForm'); f.elements.name.value = 'Smoke DS'; f.requestSubmit(); })()`); await sleep(150);
  return ev(`(() => { const n = S.state.nodes.at(-1); return { name: n.name, type: n.type, parentId: n.parentId, ok: n.parentId === ${JSON.stringify(id)} }; })()`);
});
await step('conectar (puerto de un software demo → Smoke DS)', async () => {
  const before = await ev(`S.state.edges.length`);
  const dsId = await ev(`S.state.nodes.at(-1).id`);
  const fromId = await ev(`S.state.nodes.find(n => n.type === 'software' && !n.parentId && n.demo)?.id`);
  if (!fromId) throw new Error('sin software demo');
  await ev(`(async () => { const m = await import('/js/canvas/camera.js'); m.fitToScreen(null, false); })()`); await sleep(100);
  const port = await center(`.node[data-id="${fromId}"] .port-r`);
  const to = await center(`.node[data-id="${dsId}"]`);
  await drag(port.x, port.y, to.x, to.y); await sleep(100);
  const n = await ev(`document.querySelectorAll('#popover .menu-item').length`);
  if (n) { await ev(`document.querySelector('#popover .menu-item').click()`); await sleep(120); }
  const after = await ev(`S.state.edges.length`);
  if (after !== before + 1) throw new Error(`edges ${before} → ${after} (popover items: ${n})`);
  return ev(`({ before: ${before}, after: S.state.edges.length, viaPopover: ${n > 0}, kinds: S.state.edges.slice(-1).map(e => e.kind) })`);
});
await step('undo / redo (⌘Z, ⇧⌘Z)', async () => {
  const a = await ev(`S.state.edges.length`);
  await key('z', 'KeyZ', META); await sleep(80); const b = await ev(`S.state.edges.length`);
  await key('z', 'KeyZ', META | SHIFT); await sleep(80); const c = await ev(`S.state.edges.length`);
  await ev(`document.querySelector('#btnUndo').click()`); await sleep(80); const d = await ev(`S.state.edges.length`);
  await ev(`document.querySelector('#btnRedo').click()`); await sleep(80); const e = await ev(`S.state.edges.length`);
  if (!(b === a - 1 && c === a && d === a - 1 && e === a)) throw new Error(`edges ${[a, b, c, d, e]}`);
  return [a, b, c, d, e];
});
await step('auto-layout (btnLayout, animación 450ms)', async () => { await ev(`document.querySelector('#btnLayout').click()`); await sleep(700); return ev(`S.state.nodes.length`); });
await step('exportar (panel admin → Datos → Exportar JSON + exportString)', async () => {
  await ev(`document.querySelector('#btnAdmin').click()`); await sleep(100);
  await ev(`document.querySelector('#adminTabs [data-tab="data"]').click()`); await sleep(100);
  await ev(`document.querySelector('#btnExport').click()`); await sleep(150);
  return ev(`(async () => { const m = await import('/js/ui/page-settings.js'); const j = JSON.parse(m.exportString()); return { v: j.version, nodes: j.nodes.length, tab: S.adminTab, toast: document.querySelector('#toasts').textContent.trim().slice(0, 40) }; })()`);
});
const actualPath = path.join(ROOT, 'export-actual.json'); const actual = fs.existsSync(actualPath) ? fs.readFileSync(actualPath, 'utf8') : JSON.stringify({ version: 2, nodes: [], edges: [], tags: [], edgeTypes: [], settings: {} });
await step('importar export-actual.json (input file → change → confirm)', async () => {
  await ev(`(() => { const inp = document.querySelector('#importFile'); const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(actual)}], 'export-actual.json', { type: 'application/json' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(300);
  const confirmed = await ev(`(() => { const d = document.querySelector('#confirmDialog'); if (!d.open) return 'no-dialog'; const b = [...d.querySelectorAll('[data-v]')].filter(b => b.dataset.v).at(-1); b.click(); return b.textContent; })()`);
  await sleep(300);
  return ev(`({ confirmed: ${JSON.stringify(confirmed)}, nodes: S.state.nodes.length, edges: S.state.edges.length, dom: document.querySelectorAll('#nodes .node').length })`);
});
await step('tema (themeSwitch)', async () => {
  const a = await ev(`document.documentElement.dataset.theme`);
  await ev(`document.querySelector('#themeSwitch').click()`); await sleep(80);
  const b = await ev(`document.documentElement.dataset.theme`);
  if (a === b) throw new Error('tema sin cambio'); return [a, b, await ev(`S.state.settings.theme`)];
});
await step('minimapa (pointer en #minimap mueve la cámara)', async () => {
  await ev(`(async () => { const m = await import('/js/ui/page-settings.js'); m.toggleAdmin(false); })()`); await sleep(500);
  const a = await ev(`({ ...S.cam, adminOpen: document.querySelector('#adminPanel').classList.contains('open') })`);
  const c = await center('#minimap');
  const diag = await ev(`(() => { const el = document.elementFromPoint(${c.x + 20}, ${c.y + 10}); return { hit: el && (el.id || el.tagName + '.' + el.className), hidden: document.querySelector('#minimap').hidden, mm: S.mmScale, setting: S.state.settings.minimap, rect: [${c.l}, ${c.t}, ${c.w}, ${c.h}] }; })()`);
  await mouse('mousePressed', c.x + 20, c.y + 10); await mouse('mouseReleased', c.x + 20, c.y + 10); await sleep(80);
  const b = await ev(`({ ...S.cam, mm: !!S.mmScale })`);
  if (a.x === b.x && a.y === b.y) throw new Error('cámara sin cambio ' + JSON.stringify({ a, b, diag })); return b;
});
await step('atajos (?, Esc, ⌘A, flechas, Delete+confirm, ⌘D, Space)', async () => {
  await key('?', 'Slash', SHIFT, '?'); await sleep(80);
  const open = await ev(`document.querySelector('#shortcutsDialog').open`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(120);
  const closed = !(await ev(`document.querySelector('#shortcutsDialog').open`));
  if (!closed) await ev(`document.querySelector('#shortcutsDialog').close()`);
  await key('a', 'KeyA', META); await sleep(80);
  const selected = await ev(`document.querySelectorAll('#nodes .node.selected').length`);
  await key('ArrowRight', 'ArrowRight', SHIFT); await sleep(80);
  await key('Escape', 'Escape'); await sleep(50);
  const id = await ev(`S.state.nodes.find(n => !n.parentId).id`);
  await ev(`(async () => { const m = await import('/js/canvas/selection.js'); m.selectOnly(${JSON.stringify(id)}); })()`);
  await key('d', 'KeyD', META); await sleep(150);
  const afterDup = await ev(`S.state.nodes.length`);
  await key('Delete', 'Delete'); await sleep(200);
  const conf = await ev(`(() => { const d = document.querySelector('#confirmDialog'); if (!d.open) return 'no-dialog'; const b = [...d.querySelectorAll('[data-v]')].filter(b => b.dataset.v).at(-1); b.click(); return b.textContent; })()`);
  await sleep(200);
  const afterDel = await ev(`S.state.nodes.length`);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space' }); await sleep(30);
  const spacePan = await ev(`({ down: S.spaceDown, cls: document.querySelector('#viewport').classList.contains('space-pan') })`);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' }); await sleep(30);
  return { open, closed, selected, afterDup, conf, afterDel, spacePan, spaceUp: await ev(`S.spaceDown`) };
});
await step('arrastre de nodo + marquee + rueda zoom', async () => {
  await ev(`(async () => { const m = await import('/js/canvas/camera.js'); m.fitToScreen(null, false); })()`); await sleep(80);
  const id = await ev(`S.state.nodes.find(n => !n.parentId).id`);
  const c = await center(`.node[data-id="${id}"] .head, .node[data-id="${id}"]`);
  const before = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(id)}); return [n.x, n.y]; })()`);
  await drag(c.x, c.y, c.x + 60, c.y + 40);
  const after = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(id)}); return [n.x, n.y]; })()`);
  const vp = await center('#viewport');
  await drag(vp.l + 5, vp.t + 60, vp.l + 300, vp.t + 300);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: vp.x, y: vp.y, deltaX: 0, deltaY: -120, modifiers: META }); await sleep(80);
  return { moved: before[0] !== after[0] || before[1] !== after[1], z: await ev(`S.cam.z`), ptr: await ev(`S.ptr`) };
});
// F3: célula → editor de raíz (visibilidad solo-células, enlaces, notas, asignarse) → badges → ficha con markdown escapado → #/me.
const NOTES = '# Título\n\n- item <b>x</b>\n\n[link](https://ok.io) [mal](javascript:alert(1)) `code`';
await step('F3: célula + editor raíz (visibilidad, 2 enlaces, notas, asignado) → chips', async () => {
  const cell = await ev(`fetch('/api/cells', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Célula Smoke', color: 'green' }) }).then(r => r.json())`);
  await ev(`location.hash = '#/admin/cells'; true`); await sleep(500);
  const tab = await ev(`({ rows: document.querySelectorAll('#adminView #cellRows .cell-row').length, cells: S.cellList.length, dir: S.userDir.length, tabs: [...document.querySelectorAll('#orgTabs button')].map(b => b.dataset.tab) })`);
  await ev(`document.querySelector('#adminBack').click(); true`); await sleep(300);
  const rootId = await ev(`S.state.nodes.find(n => !n.parentId).id`);
  await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(rootId)}))`); await sleep(150);
  const r = await ev(`(() => { const f = document.querySelector('#editorForm');
    f.querySelector('#fVis [data-v=cells]').click(); f.querySelector('#fCells input').checked = true;
    f.querySelector('#fDocAdd').click(); f.querySelector('#fDocAdd').click();
    const rows = f.querySelectorAll('.doc-row'); rows[0].querySelector('.doc-label').value = 'Figma'; rows[0].querySelector('.doc-url').value = 'https://www.figma.com/design/x';
    rows[1].querySelector('.doc-url').value = 'https://notion.so/y';
    f.elements.notes.value = ${JSON.stringify(NOTES)};
    f.querySelector('#fAssignees input').checked = true; f.elements.ownerUserId.value = S.session.user.id;
    f.requestSubmit(); return { visHidden: f.querySelector('#fVisField').hidden }; })()`); await sleep(1200);
  const n = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(rootId)}); const el = document.querySelector('.node[data-id="' + n.id + '"]');
    return { vis: n.visibility, cells: n.cellIds, docs: n.docs.length, notes: n.notes.length, ass: n.assigneeIds.length, owner: n.ownerUserId === S.session.user.id, chip: !!el.querySelector('.vis-cells'), person: el.querySelectorAll('.assignee, .owner.person').length, docsRef: el.querySelector('.docs-ref')?.textContent, status: document.querySelector('#saveStatus').textContent }; })()`);
  const server = await ev(`fetch('/api/pages/' + S.pageId).then(r => r.json()).then(d => { const n = d.nodes.find(n => n.id === ${JSON.stringify(rootId)}); return { vis: n.visibility, cells: n.cellIds.length, docs: n.docs.length, refs: d.refs.cells.map(c => c.name) }; })`);
  if (!tab.cells || !tab.dir || !tab.rows) throw new Error('pestaña Células vacía ' + JSON.stringify(tab));
  if (server.vis !== 'cells' || server.cells !== 1 || server.docs !== 2) throw new Error('servidor: ' + JSON.stringify(server));
  return { ...n, cellName: cell.name, ...r, serverRefs: server.refs };
});
await step('F3: ficha (Ver ficha) con markdown escapado + #/me con deep-link', async () => {
  const rootId = await ev(`S.state.nodes.find(n => !n.parentId).id`);
  await ev(`import('/js/ui/node-view.js').then(m => m.openNodeView(${JSON.stringify(rootId)}))`); await sleep(100);
  const view = await ev(`(() => { const d = document.querySelector('#editorDialog'); const md = d.querySelector('.md'); return { open: d.open, h3: md.querySelector('h3')?.textContent, li: md.querySelectorAll('li').length, rawB: !!md.querySelector('li b'), escaped: md.innerHTML.includes('&lt;b&gt;'), links: [...md.querySelectorAll('a')].map(a => a.getAttribute('href')), code: !!md.querySelector('code'), docs: d.querySelectorAll('.doc-list a').length, people: d.querySelectorAll('.person').length }; })()`);
  if (view.rawB || !view.escaped) throw new Error('HTML sin escapar en notas');
  if (view.links.some(h => !/^https:/.test(h))) throw new Error('enlace inseguro: ' + view.links);
  await ev(`document.querySelector('#editorDialog [data-cancel]').click(); true`);
  await ev(`location.hash = '#/me'; true`); await sleep(200);
  const me = await ev(`({ open: document.querySelector('#editorDialog').open, items: document.querySelectorAll('#editorDialog .me-list li').length, title: document.querySelector('#editorDialog h2')?.textContent })`);
  await ev(`document.querySelector('#editorDialog .me-list a').click(); true`); await sleep(600);
  const go = await ev(`({ hash: location.hash, selected: [...document.querySelectorAll('.node.selected')].map(e => e.dataset.id), open: document.querySelector('#editorDialog').open })`);
  await ev(`document.querySelector('#editorDialog [data-cancel]').click(); location.hash = ''; true`); await sleep(100);
  return { view, me, go };
});
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
  const back = await ev(`import('/js/core/history.js').then(m => ({ page: S.pageId === ${JSON.stringify(before.page)}, nodes: S.state.nodes.length, hist: m.history.past.length, future: m.history.future.length, sel: [...document.querySelectorAll('.node.selected')].length, popover: document.querySelector('#popover').hidden, dialog: document.querySelector('#editorDialog').open }))`);
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
await step('F5: upload en editor → imageId + thumb /uploads; dataURL importada → archivo', async () => {
  const sharp = (await import('sharp')).default;
  const pngPath = path.join(os.tmpdir(), `destree-smoke-${process.pid}.png`);
  fs.writeFileSync(pngPath, await sharp({ create: { width: 640, height: 400, channels: 3, background: '#3366cc' } }).png().toBuffer());
  const nodeId = await ev(`S.state.nodes.find(n => n.type !== 'software')?.id || S.state.nodes[0].id`);
  await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(nodeId)}))`); await sleep(150);
  const { root } = await send('DOM.getDocument', { depth: 1 });
  const { nodeId: inputNode } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#fImgInput' });
  await send('DOM.setFileInputFiles', { nodeId: inputNode, files: [pngPath] }); await sleep(1500);
  const preview = await ev(`document.querySelector('#fImgPreview img')?.getAttribute('src') || document.querySelector('#fImgPreview').textContent`);
  await ev(`document.querySelector('#editorForm').requestSubmit(); true`); await sleep(1000);
  const node = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(nodeId)}); const img = document.querySelector('.node[data-id="' + n.id + '"] img'); return { imageId: !!n.imageId, image: n.image, src: img?.getAttribute('src'), w: img?.naturalWidth, h: img?.naturalHeight, status: document.querySelector('#saveStatus').textContent }; })()`);
  if (!/^\/uploads\/.+\/thumb$/.test(preview) || !node.imageId || node.image) throw new Error('upload: ' + JSON.stringify({ preview, node }));
  const srv = await ev(`fetch('/api/pages/' + S.pageId).then(r => r.json()).then(d => { const n = d.nodes.find(n => n.id === ${JSON.stringify(nodeId)}); return { imageId: !!n.imageId, image: n.image }; })`);
  // dataURL en el documento (import legado) → el servidor crea el archivo y el cliente recarga con imageId
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(pngPath).toString('base64');
  const other = await ev(`S.state.nodes.find(n => n.id !== ${JSON.stringify(nodeId)} && !n.imageId).id`);
  await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(other)}); n.image = ${JSON.stringify(dataUrl)}; n.imageId = null; return import('/js/core/state.js').then(m => m.persist()); })()`); await sleep(1500);
  const ingested = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(other)}); return { imageId: !!n.imageId, image: n.image, src: document.querySelector('.node[data-id="' + n.id + '"] img')?.getAttribute('src')?.slice(0, 9) }; })()`);
  fs.rmSync(pngPath, { force: true });
  return { preview: preview.slice(0, 9), node, srv, ingested };
});
await step('recarga: persistencia SQLite vía API', async () => { await send('Page.reload'); await sleep(1200); return ev(`({ nodes: S.state.nodes.length, theme: document.documentElement.dataset.theme })`); });
// F2: invitación (enlace copiable) → alta de designer → modo lectura; PUT → 403; logout → login.
await step('invitación → designer en modo lectura (403 en PUT)', async () => {
  const link = await ev(`fetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'des@smoke.io', role: 'designer' }) }).then(r => r.json()).then(j => j.link)`);
  if (!/#\/invite\//.test(link)) throw new Error('sin enlace: ' + link);
  await ev(`fetch('/api/auth/logout', { method: 'POST' }).then(r => r.status)`);
  await send('Page.navigate', { url: link }); await sleep(900);
  await fill([['name', 'Dani'], ['password', 'smoke-1234']]); await sleep(1200);
  const put = await ev(`fetch('/api/pages/' + S.pageId, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': String(S.version) }, body: '{}' }).then(r => r.status)`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 400, y: 300, button: 'right', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 300, button: 'right', clickCount: 1 }); await sleep(100);
  await key('n', 'KeyN'); await sleep(100);
  return ev(`({ role: S.session.role, ro: S.readonly, viewer: document.body.classList.contains('viewer'), nodes: S.state.nodes.length, newHidden: document.querySelector('#btnNew').hidden, adminHidden: document.querySelector('#btnAdmin').hidden, ports: getComputedStyle(document.querySelector('.port')).display, popover: document.querySelector('#popover').hidden, status: document.querySelector('#saveStatus').textContent, put: ${'${put}'} })`.replace('${put}', JSON.stringify(put)));
});
await step('F3: designer → doble clic abre ficha; raíz solo-células oculta (no es miembro)', async () => {
  const roots = await ev(`S.state.nodes.filter(n => !n.parentId).map(n => n.visibility)`);
  if (roots.includes('cells')) throw new Error('el designer recibió una raíz solo-células ajena');
  await ev(`document.querySelector('#zoomFit').click(); true`); await sleep(500);
  const c = await center('.node');
  const under = await ev(`document.elementFromPoint(${c.x}, ${c.y + 10})?.closest('.node')?.dataset.id || null`);
  await mouse('mousePressed', c.x, c.y + 10); await mouse('mouseReleased', c.x, c.y + 10); await mouse('mousePressed', c.x, c.y + 10, { clickCount: 2 }); await mouse('mouseReleased', c.x, c.y + 10, { clickCount: 2 }); await sleep(150);
  const r = await ev(`({ open: document.querySelector('#editorDialog').open, isView: !!document.querySelector('#editorDialog .node-view'), isForm: !!document.querySelector('#editorForm'), under: ${JSON.stringify(under)}, roots: ${JSON.stringify(roots)}.length, mine: document.querySelector('#btnMe')?.textContent })`);
  await ev(`document.querySelector('#editorDialog [data-cancel]')?.click(); true`);
  return r;
});
await step('logout → login (admin)', async () => {
  await ev(`document.querySelector('#btnLogout').click(); true`); await sleep(1200);
  const login = await ev(`!document.querySelector('#authView').hidden && !!document.querySelector('#authView [name=password]') && !document.querySelector('#authView [name=orgName]')`);
  if (!login) throw new Error('no apareció el login');
  await fill([['email', 'ana@smoke.io'], ['password', 'smoke-1234']]); await sleep(1200);
  return ev(`({ role: S.session.role, ro: S.readonly, hash: location.hash, nodes: S.state.nodes.length })`);
});
drain();
console.log(results.join('\n'));
console.log(problems.length ? `\nPROBLEMAS (${problems.length}):\n` + problems.join('\n') : '\nconsola limpia: 0 excepciones / 0 console.error');
ws.close(); cleanup(); process.exit(problems.length || results.some((r) => r.startsWith('✖')) ? 1 : 0);

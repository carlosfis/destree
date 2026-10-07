// Smoke de paridad (F0b, F1 sobre Fastify+SQLite temporal): checklist en Chrome headless vía CDP; recoge excepciones y console.error. Uso: node scripts/smoke.js
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
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
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
  return ev(`(async () => { const m = await import('/js/views/admin.js'); const j = JSON.parse(m.exportString()); return { v: j.version, nodes: j.nodes.length, tab: S.adminTab, toast: document.querySelector('#toasts').textContent.trim().slice(0, 40) }; })()`);
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
  await ev(`(async () => { const m = await import('/js/views/admin.js'); m.toggleAdmin(false); })()`); await sleep(500);
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
await step('recarga: persistencia SQLite vía API', async () => { await send('Page.reload'); await sleep(1200); return ev(`({ nodes: S.state.nodes.length, theme: document.documentElement.dataset.theme })`); });
drain();
console.log(results.join('\n'));
console.log(problems.length ? `\nPROBLEMAS (${problems.length}):\n` + problems.join('\n') : '\nconsola limpia: 0 excepciones / 0 console.error');
ws.close(); cleanup(); process.exit(problems.length || results.some((r) => r.startsWith('✖')) ? 1 : 0);

// Smoke · F0b/F1/F2: setup inicial, carga, crear/anidar/conectar, undo/redo, auto-layout, export/import, tema, minimapa, atajos, arrastre. Lo ejecuta scripts/smoke.js con el contexto CDP (ev, send, step…).
import fs from 'node:fs';
import path from 'node:path';
export default async function (c) {
  const { ev, send, sleep, mouse, drag, key, center, step, fill, META, SHIFT, ROOT } = c;
// F2: primer arranque → formulario de setup (org + admin); tras enviarlo arranca la app con sesión.
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
  return ev(`({ open: document.querySelector('#nodeDrawer').classList.contains('open'), nodes: S.state.nodes.length, last: S.state.nodes.at(-1).name })`);
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
}

// Capturas para el README (docs/img/*.png) con Chrome headless vía CDP sobre un servidor con BD temporal (datos de ejemplo).
// Uso: node scripts/screenshots.js  (requiere Google Chrome). Salidas: docs/img/canvas.png, drawer.png, lobby.png.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'img');
const PORT = 5175, DBG = 9334, W = 1440, H = 900;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-shots-'));
const srv = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATABASE_PATH: path.join(prof, 'shots.db'), LOG_LEVEL: 'silent' }, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { srv.kill(); } catch {} try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 }); } catch {} };
process.on('exit', cleanup);
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); if (list.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { ws.send(JSON.stringify({ id: ++id, method, params })); pending.set(id, { resolve, reject }); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')); console.log('✔', name); };
const api = (method, url, body) => ev(`fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, headers: { 'Content-Type': 'application/json' }, body: ${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'} }).then(r => r.json())`);

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: Number(process.env.SCALE || 1), mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }); await sleep(1200);
// Setup inicial con la organización de ejemplo.
await ev(`(() => { const f = document.querySelector('#authView form'); f.orgName.value = 'Agencia Norte'; f.name.value = 'Ana Ruiz'; f.email.value = 'ana@agencia.io'; f.password.value = 'demo-12345'; f.requestSubmit(); return true; })()`); await sleep(1500);
for (let i = 0; i < 20 && !(await ev(`!!window.S && !!S.state && S.state.nodes.length > 0`)); i++) await sleep(200);
// Equipo de ejemplo: una célula y un responsable con staff en la primera raíz.
const cell = await api('POST', '/api/cells', { name: 'Squad Producto', color: 'green' });
await ev(`(() => { const r = S.state.nodes.find(n => !n.parentId); r.staff = [{ name: '@ana', role: 'Design Lead' }, { name: '@lorena', role: 'UX Designer' }]; r.owner = '@ana'; r.docs = [{ label: 'Design System', url: 'https://example.com/ds' }, { label: 'Repositorio', url: 'https://github.com/example/app' }]; r.notes = '# Alcance\\n\\n- Web y app móvil\\n- Design System compartido'; return true; })()`);
await ev(`import('/js/core/state.js').then(m => m.persist())`); await sleep(900);
await ev(`import('/js/views/cells.js').then(m => m.refreshCells())`);
await ev(`document.documentElement.dataset.theme = 'light'; true`);
await ev(`document.querySelector('#zoomFit').click(); true`); await sleep(700);
await shot('canvas.png');
// Sidebar de instancia (editor) sobre la primera raíz.
const rootId = await ev(`S.state.nodes.find(n => !n.parentId).id`);
await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(rootId)}))`); await sleep(400);
await ev(`import('/js/canvas/camera.js').then(m => m.fitToScreen(null, false))`); await sleep(500);
await shot('drawer.png');
await ev(`document.querySelector('#nodeDrawer [data-cancel]')?.click(); true`); await sleep(300);
// Lobby con varias páginas.
for (const name of ['Cliente Aurora · Banca', 'Cliente Vela · Retail', 'Interno · Herramientas']) await api('POST', '/api/pages', { name, description: 'Árbol de software y Design Systems del cliente.' });
await ev(`location.hash = '#/lobby'; true`); await sleep(900);
await shot('lobby.png');
ws.close(); cleanup(); console.log('capturas en docs/img/ · célula:', cell.name); process.exit(0);

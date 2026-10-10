// Capturas para el README (docs/img/*.png) con Chrome headless vía CDP sobre un servidor con BD temporal sembrada con los datos demo (scripts/seed-demo.js).
// Uso: node scripts/screenshots.js  (requiere Google Chrome). Salidas: docs/img/{canvas,project,drawer,schedule,org,lobby}.png.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'img');
const PORT = 5175, DBG = 9334, W = 1440, H = 900;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-shots-'));
const DB = path.join(prof, 'shots.db');
const srv = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATABASE_PATH: DB, LOG_LEVEL: 'silent' }, stdio: 'ignore' });
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
// Asistente inicial (organización ficticia) y datos demo en la misma BD temporal.
await ev(`(() => { const f = document.querySelector('#authView form'); f.orgName.value = 'Grupo Ambar'; f.name.value = 'Valentina Ríos'; f.email.value = 'admin@grupo.demo'; f.password.value = 'demo-12345'; f.requestSubmit(); return true; })()`); await sleep(1500);
for (let i = 0; i < 20 && !(await ev(`!!window.S && !!S.state && S.state.nodes.length > 0`)); i++) await sleep(200);
execFileSync(process.execPath, ['scripts/seed-demo.js', '--password=Demo-2026'], { cwd: ROOT, env: { ...process.env, DATABASE_PATH: DB }, stdio: 'ignore' });
const PAGE = 'pg_eco_ambar', ROOT_ID = 'am_portal', SCHED_ID = 'am_asig';
const go = async (hash, ms = 1000) => { await ev(`location.hash = ${JSON.stringify(hash)}; true`); await sleep(ms); };
const light = () => ev(`document.documentElement.dataset.theme = 'light'; true`);
await send('Page.reload'); await sleep(1500); await light();
// Lienzo de «Ecosistema Ambar».
await go(`#/p/${PAGE}`, 1200);
for (let i = 0; i < 20 && !(await ev(`S.state.nodes.length > 10`)); i++) await sleep(200);
await light(); await ev(`document.querySelector('#zoomFit').click(); true`); await sleep(700);
await shot('canvas.png');
// Sidebar de instancia (editor) sobre Ambar.mx.
await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(ROOT_ID)}))`); await sleep(500);
await ev(`import('/js/canvas/camera.js').then(m => m.fitToScreen(null, false))`); await sleep(500);
await shot('drawer.png');
await ev(`document.querySelector('#nodeDrawer [data-cancel]')?.click(); true`); await sleep(300);
// Página de proyecto: Overview de Ambar.mx y Cronograma de «Asignación de investigaciones».
await go(`#/p/${PAGE}/n/${ROOT_ID}/project/overview`, 1400); await light(); await sleep(200);
await shot('project.png');
await go(`#/p/${PAGE}/n/${SCHED_ID}/project/cronograma`, 1400); await light(); await sleep(200);
await shot('schedule.png');
// Lobby → Organización y Lobby de páginas.
await go('#/lobby/org', 1200); await light(); await sleep(200);
await shot('org.png');
await go('#/lobby', 800); await ev(`document.querySelector('#lobbyTabs [data-tab=active]').click(); true`); await sleep(600); await light(); await sleep(200);
await shot('lobby.png');
ws.close(); cleanup(); console.log('capturas en docs/img/'); process.exit(0);

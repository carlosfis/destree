// Smoke: checklist de UI en Chrome headless vía CDP sobre Fastify + SQLite temporal; recoge excepciones y console.error. Uso: node scripts/smoke.js
// Arranque, helpers CDP y contexto compartido aquí; los pasos viven en scripts/smoke/0*.js (se ejecutan en orden, mismo navegador y sesión).
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
const chrome = spawn(CHROME, ['--headless=new', '--lang=es', `--remote-debugging-port=${DBG}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
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
  // F2: 401 en /api/me sin sesión y el 403 del PUT de designer son respuestas esperadas del flujo, no errores. P15: los 404 a /api/…/nope son a propósito (mensajes por idioma).
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/status of (401|403)/.test(m.params.entry.text) && !(/status of 404/.test(m.params.entry.text) && /\/nope$/.test(m.params.entry.url || ''))) problems.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
} };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
const mouse = async (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse', ...extra });
const drag = async (x1, y1, x2, y2) => { await mouse('mousePressed', x1, y1); for (let i = 1; i <= 6; i++) await mouse('mouseMoved', x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6, { buttons: 1 }); await sleep(50); await mouse('mouseReleased', x2, y2); await sleep(60); };
const key = async (k, code, modifiers = 0, text) => { await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, modifiers, text, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : k === 'Escape' ? 27 : undefined }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers }); await sleep(40); };
const META = 4, SHIFT = 8;
const results = [];
const step = async (name, fn) => { try { const v = await fn(); drain(); results.push(`✔ ${name}${v !== undefined ? ' → ' + JSON.stringify(v) : ''}`); } catch (e) { drain(); results.push(`✖ ${name}: ${e.message}`); } };
const center = async (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top }; })()`);

const fill = async (pairs) => ev(`(() => { ${pairs.map(([n, v]) => `document.querySelector('#authView [name=${n}]').value = ${JSON.stringify(v)};`).join('')} document.querySelector('#authView form').requestSubmit(); return true; })()`);
const c = { ev, send, sleep, mouse, drag, key, center, step, fill, META, SHIFT, ROOT };
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(1200); drain();
for (const m of ['01-canvas', '02-team', '03-pages-admin', '04-roles', '05-i18n']) await (await import(`./smoke/${m}.js`)).default(c);
drain();
console.log(results.join('\n'));
console.log(problems.length ? `\nPROBLEMAS (${problems.length}):\n` + problems.join('\n') : '\nconsola limpia: 0 excepciones / 0 console.error');
ws.close(); cleanup(); process.exit(problems.length || results.some((r) => r.startsWith('✖')) ? 1 : 0);

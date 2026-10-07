// Render de promo/index.html a vídeo 1080p con Chrome headless (CDP, un JPEG por fotograma).
// Salida .mp4 (por defecto): H.264 codificado dentro de Chrome (WebCodecs + mp4-muxer, ver encoder.js), sin ffmpeg.
// Salida .webm: VP8 vía el ffmpeg de Playwright (~/Library/Caches/ms-playwright/ffmpeg-*; FFMPEG= para otro binario).
// Uso: node promo/render.js [salida.mp4|salida.webm] [fps]   · env: BITRATE (bps, mp4), MAX_SECONDS (prueba corta)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'promo', 'destree-motion.mp4'));
const MP4 = OUT.toLowerCase().endsWith('.mp4');
const FPS = Number(process.argv[3] || 30), W = 1920, H = 1080, DBG = 9344, BITRATE = Number(process.env.BITRATE || 8_000_000);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || path.join(os.homedir(), 'Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-render-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 }); } catch {} };
process.on('exit', cleanup);
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json(); if (list.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { ws.send(JSON.stringify({ id: ++id, method, params })); pending.set(id, { resolve, reject }); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file://' + path.join(ROOT, 'promo', 'index.html') + '?render=1' });
for (let i = 0; i < 100; i++) { if (await ev('!!window.__ready').catch(() => false)) break; await sleep(200); }
if (!(await ev('!!window.__ready'))) throw new Error('la página no quedó lista (¿GSAP/fuentes sin red?)');
const dur = await ev('window.__duration');
const frames = Math.ceil(Math.min(dur, Number(process.env.MAX_SECONDS || dur)) * FPS);
let ff, write;
if (MP4) {
  await ev(fs.readFileSync(path.join(ROOT, 'promo', 'encoder.js'), 'utf8') + '\n;true');
  console.log('H.264 vía WebCodecs:', await ev(`window.__enc.start({ width: ${W}, height: ${H}, fps: ${FPS}, bitrate: ${BITRATE} })`));
} else {
  ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '8M', '-crf', '8', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-r', String(FPS), OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  write = (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)));
}
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await ev(`window.__seek(${(f / FPS).toFixed(4)}); true`);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 94, captureBeyondViewport: false });
  if (MP4) await ev(`window.__enc.push("${shot.data}", ${f}, ${FPS})`); else await write(Buffer.from(shot.data, 'base64'));
  if (f % (FPS * 5) === 0) process.stdout.write(`\r${f}/${frames} fotogramas · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
if (MP4) {
  const size = await ev('window.__enc.finish()'); const CH = 4 * 1024 * 1024; const fd = fs.openSync(OUT, 'w');
  for (let off = 0; off < size; off += CH) fs.writeSync(fd, Buffer.from(await ev(`window.__enc.chunk(${off}, ${CH})`), 'base64'));
  fs.closeSync(fd);
} else { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
console.log(`\n→ ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${(frames / FPS).toFixed(1)}s, ${frames} fotogramas)`);
ws.close(); cleanup(); process.exit(0);

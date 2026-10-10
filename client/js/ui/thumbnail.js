/* =========================================================
   P9. Thumbnail 1920×1080 (PNG) para pegar en Figma: se dibuja en canvas con los datos de la instancia
   (staff, geografía, tipo, nombre, ruta, etiquetas, icono). Copiar → portapapeles; Descargar → archivo PNG.
   ========================================================= */
import { tagById, parentOf, typeName } from '../core/state.js';
import { imageSrc } from './uploader.js';
import { t } from '../core/i18n.js'; // P15

export const W = 1920, H = 1080;
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const C = { bg: '#0f2a24', lime: '#c8ff00', card: 'rgba(7, 20, 17, .84)', chip: 'rgba(9, 26, 22, .9)', text: '#ffffff', muted: '#9fb1ab', dark: '#0f2a24' };
const ROLE_COLORS = { PO: '#f2516e', PD: '#8b6cf0', UI: '#0f8fa6', UX: '#12a9c9' };
const PALETTE = ['#f0a331', '#3fbf6a', '#e95fd1', '#6b7bf7', '#f2516e', '#8b6cf0', '#0f8fa6', '#12a9c9'];
const CARD = { x: 72, y: 548, w: 930, h: 456, r: 44, pad: 48 };
const ICON = { x: 1040, y: 170, w: 820, h: 830 };

/** Bandera emoji a partir de ISO 3166-1 alfa-2 ('' si no es válido). */
export const flagEmoji = code => (/^[A-Z]{2}$/.test(code || '') ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : '');
const cache = { flags: null }; // Windows no dibuja banderas (muestra las letras): se detecta midiendo el glifo
function flagsSupported() {
  if (cache.flags !== null) return cache.flags;
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = `40px ${EMOJI}`;
  return (cache.flags = ctx.measureText('🇲🇽').width < ctx.measureText('🇦').width * 1.6);
}
/** Siglas del rol: «Product Owner» → PO, «UI Designer» → UI, «Developer» → DE; sin rol → 2 letras del nombre. */
export function roleInitials(role, name) {
  const words = String(role || '').trim().split(/\s+/).filter(Boolean);
  if (words.length) {
    const w0 = words[0].replace(/[^\p{L}\p{N}]/gu, '');
    if (words.length > 1) return (w0.length <= 3 ? w0 : words[0][0] + words[1][0]).toUpperCase();
    return w0.slice(0, 2).toUpperCase();
  }
  return (String(name || '').replace(/^@/, '').slice(0, 2) || '?').toUpperCase();
}
const colorFor = ini => ROLE_COLORS[ini] || PALETTE[[...ini].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

const imgCache = new Map();
function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imgCache.has(src)) imgCache.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => { imgCache.delete(src); res(null); }; i.src = src; }));
  return imgCache.get(src);
}
/** Icono del thumbnail: solo el propio (thumbIconId); sin icono, el thumbnail no lleva imagen (P12). */
export const iconSrcOf = n => (n.thumbIconId ? imageSrc({ imageId: n.thumbIconId }, 'full') : null);
/** Datos de dibujo a partir de un nodo del estado; `over` permite sustituir campos (editor con borrador). */
export function thumbnailData(n, over = {}) {
  const path = []; let p = parentOf(n), g = 0; while (p && g++ < 100) { path.unshift(p.name); p = parentOf(p); }
  const staff = n.staff && n.staff.length ? n.staff : (n.owner ? [{ name: n.owner, role: '' }] : []);
  return { name: n.name, type: typeName(n.type), path, tags: (n.tags || []).map(tagById).filter(Boolean).map(t => t.name), staff, geo: n.geo || '', iconSrc: iconSrcOf(n), year: new Date().getFullYear(), ...over };
}

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text; while (s.length && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}
function wrap(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function drawBackground(ctx) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.lime; ctx.lineCap = 'round'; ctx.lineWidth = 170;
  ctx.beginPath(); ctx.moveTo(-140, 150); ctx.bezierCurveTo(420, 90, 1060, 150, 930, 380); ctx.bezierCurveTo(810, 580, 280, 560, -140, 470); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1290, 1240); ctx.bezierCurveTo(1340, 900, 1720, 920, 1780, 700); ctx.bezierCurveTo(1830, 540, 1920, 520, 2080, 470); ctx.stroke();
}
function drawIcon(ctx, img) {
  if (!img) return;
  const s = Math.min(ICON.w / img.width, ICON.h / img.height), dw = img.width * s, dh = img.height * s;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.drawImage(img, ICON.x + (ICON.w - dw) / 2, ICON.y + (ICON.h - dh) / 2, dw, dh); ctx.restore();
}
function drawChips(ctx, staff) {
  const h = 112, gap = 40, x0 = 72, maxX = W - 60; let x = x0, y = 72, row = 0;
  for (let i = 0; i < staff.length; i++) {
    const m = staff[i], raw = String(m.name || '').replace(/^@/, ''), name = raw.charAt(0).toUpperCase() + raw.slice(1), role = String(m.role || '');
    ctx.font = `600 28px ${FONT}`; const wn = Math.min(ctx.measureText(name).width, 420);
    ctx.font = `400 24px ${FONT}`; const wr = Math.min(ctx.measureText(role).width, 420);
    const tw = Math.max(wn, wr, 60), w = 24 + 66 + 22 + tw + 36;
    if (x + w > maxX) {
      if (++row > 1) { // tercera fila: resumen «+N»
        const rest = staff.length - i; ctx.font = `600 28px ${FONT}`; const mw = ctx.measureText(`+${rest}`).width + 60;
        if (x + mw <= maxX) { rr(ctx, x, y, mw, h, h / 2); ctx.fillStyle = C.chip; ctx.fill(); ctx.fillStyle = C.text; ctx.textBaseline = 'middle'; ctx.fillText(`+${rest}`, x + 30, y + h / 2); }
        break;
      }
      x = x0; y += h + 20;
    }
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = C.chip; ctx.fill();
    const ini = roleInitials(role, name);
    ctx.beginPath(); ctx.arc(x + 24 + 33, y + h / 2, 33, 0, Math.PI * 2); ctx.fillStyle = colorFor(ini); ctx.fill();
    ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 26px ${FONT}`; ctx.fillText(ini, x + 24 + 33, y + h / 2 + 1);
    ctx.textAlign = 'left'; const tx = x + 24 + 66 + 22;
    ctx.font = `600 28px ${FONT}`; ctx.fillText(ellipsize(ctx, name, 420), tx, y + (role ? 40 : h / 2));
    if (role) { ctx.fillStyle = C.muted; ctx.font = `400 24px ${FONT}`; ctx.fillText(ellipsize(ctx, role, 420), tx, y + 76); }
    x += w + gap;
  }
}
function drawCard(ctx, d) {
  const { x, y, w, h, r, pad } = CARD;
  rr(ctx, x, y, w, h, r); ctx.fillStyle = C.card; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip(); ctx.translate(x + 330, y); ctx.scale(4.4, 1); // resplandor lima elíptico en el borde superior
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 120); g.addColorStop(0, 'rgba(200,255,0,.5)'); g.addColorStop(1, 'rgba(200,255,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-130, 0, 260, 120); ctx.restore();
  let cx = x + pad; const cy = y + 70; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (d.geo) {
    if (flagsSupported()) { ctx.font = `40px ${EMOJI}`; ctx.fillStyle = C.text; ctx.fillText(flagEmoji(d.geo), cx, cy + 2); cx += ctx.measureText(flagEmoji(d.geo)).width + 18; }
    else { ctx.font = `700 22px ${FONT}`; const fw = ctx.measureText(d.geo).width + 28; rr(ctx, cx, cy - 22, fw, 44, 12); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.fillStyle = C.text; ctx.fillText(d.geo, cx + 14, cy + 1); cx += fw + 18; }
  }
  ctx.font = `500 26px ${FONT}`; const pw = Math.min(ctx.measureText(d.type).width, 400) + 44;
  rr(ctx, cx, cy - 22, pw, 44, 22); ctx.fillStyle = C.lime; ctx.fill(); ctx.fillStyle = C.dark; ctx.fillText(ellipsize(ctx, d.type, 400), cx + 22, cy + 1);
  // Título: hasta 2 líneas, reduce el cuerpo hasta que quepa
  const maxW = w - pad * 2; let size = 92, lines;
  ctx.textBaseline = 'alphabetic';
  for (;;) { ctx.font = `800 ${size}px ${FONT}`; lines = wrap(ctx, d.name || 'Sin nombre', maxW); if (lines.length <= 2 || size <= 56) break; size -= 6; }
  if (lines.length > 2) lines = [lines[0], ellipsize(ctx, lines.slice(1).join(' '), maxW)];
  const lh = size * 1.12, top = y + 118, bottom = y + h - 96; // bloque de título centrado entre la píldora y el subtítulo
  const ty = top + Math.max(0, (bottom - top - lines.length * lh) / 2) + size * 0.86;
  ctx.fillStyle = C.text; lines.forEach((l, i) => ctx.fillText(ellipsize(ctx, l, maxW), x + pad, ty + i * lh));
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(ellipsize(ctx, [...d.path, d.name, ...d.tags, String(d.year)].filter(Boolean).map(s => `[${s}]`).join(' '), maxW), x + pad, y + h - 52);
}

/** Dibuja el thumbnail en `canvas` (se crea uno si no se pasa). Devuelve el canvas. */
export async function renderThumbnail(d, canvas = document.createElement('canvas')) {
  canvas.width = W; canvas.height = H;
  const [img] = await Promise.all([loadImage(d.iconSrc), document.fonts?.ready]);
  const ctx = canvas.getContext('2d');
  drawBackground(ctx); drawIcon(ctx, img); drawCard(ctx, d); drawChips(ctx, d.staff || []);
  return canvas;
}
const toBlob = canvas => new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error(t('No se pudo generar el PNG')))), 'image/png'));
export const canCopyImages = () => !!(navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined');
/** Copia el PNG al portapapeles. Debe llamarse directamente desde el gesto del usuario (Safari exige la promesa síncrona). */
export function copyThumbnail(d) {
  if (!canCopyImages()) return Promise.reject(new Error(t('Este navegador no permite copiar imágenes; usa «Descargar PNG».')));
  const blob = renderThumbnail(d).then(toBlob);
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
export async function downloadThumbnail(d) {
  const blob = await toBlob(await renderThumbnail(d));
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${String(d.name || 'thumbnail').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'thumbnail'}-thumbnail.png`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

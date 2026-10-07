/* =========================================================
   4. Cámara (pan / zoom) y conversión de coordenadas
   ========================================================= */
import { $, clamp, MIN_Z, MAX_Z } from '../core/utils.js';
import { viewport, world } from '../core/dom.js';
import { S, saveCam, nodeById, roots } from '../core/state.js';
import { nodeRect } from './render-nodes.js';
import { drawMinimap } from './minimap.js';
export function measureViewport() { S.vpRect = viewport.getBoundingClientRect(); }
window.addEventListener('resize', () => { measureViewport(); applyCamera(); });

export const toWorld = (sx, sy) => ({ x: (sx - S.cam.x) / S.cam.z, y: (sy - S.cam.y) / S.cam.z });
export const toScreen = (wx, wy) => ({ x: wx * S.cam.z + S.cam.x, y: wy * S.cam.z + S.cam.y });
export const ptrPos = e => ({ x: e.clientX - S.vpRect.left, y: e.clientY - S.vpRect.top });

export function applyCamera() {
  world.style.transform = `translate(${S.cam.x}px, ${S.cam.y}px) scale(${S.cam.z})`;
  let step = 24;
  while (step * S.cam.z < 14) step *= 2;
  while (step * S.cam.z > 64) step /= 2;
  viewport.style.backgroundSize = `${step * S.cam.z}px ${step * S.cam.z}px`;
  viewport.style.backgroundPosition = `${S.cam.x}px ${S.cam.y}px`;
  $('#zoomLabel').textContent = Math.round(S.cam.z * 100) + '%';
  if (!S.camRaf) S.camRaf = requestAnimationFrame(() => { S.camRaf = 0; drawMinimap(); });
  saveCam();
}
export function zoomAt(sx, sy, factor) {
  const nz = clamp(S.cam.z * factor, MIN_Z, MAX_Z);
  const k = nz / S.cam.z;
  S.cam.x = sx - (sx - S.cam.x) * k;
  S.cam.y = sy - (sy - S.cam.y) * k;
  S.cam.z = nz;
  applyCamera();
}
export function zoomStep(factor) { zoomAt(S.vpRect.width / 2, S.vpRect.height / 2, factor); }
export function setZoom(z) { zoomAt(S.vpRect.width / 2, S.vpRect.height / 2, z / S.cam.z); }

export function nodesBBox(ids) {
  const list = ids ? ids.map(nodeById).filter(Boolean) : roots();
  if (!list.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of list) { const r = nodeRect(n); x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export function fitToScreen(ids, animate = true) {
  const bb = nodesBBox(ids && ids.length ? ids : null);
  if (!bb) { S.cam = { x: S.vpRect.width / 2, y: S.vpRect.height / 2, z: 1 }; applyCamera(); return; }
  const pad = 80;
  const z = clamp(Math.min((S.vpRect.width - pad * 2) / Math.max(bb.w, 1), (S.vpRect.height - pad * 2) / Math.max(bb.h, 1)), MIN_Z, 1.5);
  const target = { z, x: S.vpRect.width / 2 - (bb.x + bb.w / 2) * z, y: S.vpRect.height / 2 - (bb.y + bb.h / 2) * z };
  if (!animate) { S.cam = target; applyCamera(); return; }
  animateCamera(target);
}
export function animateCamera(target, ms = 320) {
  const start = { ...S.cam }, t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    const t = ease(clamp((now - t0) / ms, 0, 1));
    S.cam.x = start.x + (target.x - start.x) * t;
    S.cam.y = start.y + (target.y - start.y) * t;
    S.cam.z = start.z + (target.z - start.z) * t;
    applyCamera();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}


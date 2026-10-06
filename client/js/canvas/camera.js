'use strict';
/* =========================================================
   4. Cámara (pan / zoom) y conversión de coordenadas
   ========================================================= */
const viewport = $('#viewport');
const world = $('#world');
const nodesLayer = $('#nodes');
const edgeLayer = $('#edgeLayer');
const guidesSvg = $('#guides');
let vpRect = viewport.getBoundingClientRect();
function measureViewport() { vpRect = viewport.getBoundingClientRect(); }
window.addEventListener('resize', () => { measureViewport(); applyCamera(); });

const toWorld = (sx, sy) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z });
const toScreen = (wx, wy) => ({ x: wx * cam.z + cam.x, y: wy * cam.z + cam.y });
const ptrPos = e => ({ x: e.clientX - vpRect.left, y: e.clientY - vpRect.top });

let camRaf = 0;
function applyCamera() {
  world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
  let step = 24;
  while (step * cam.z < 14) step *= 2;
  while (step * cam.z > 64) step /= 2;
  viewport.style.backgroundSize = `${step * cam.z}px ${step * cam.z}px`;
  viewport.style.backgroundPosition = `${cam.x}px ${cam.y}px`;
  $('#zoomLabel').textContent = Math.round(cam.z * 100) + '%';
  if (!camRaf) camRaf = requestAnimationFrame(() => { camRaf = 0; drawMinimap(); });
  saveCam();
}
function zoomAt(sx, sy, factor) {
  const nz = clamp(cam.z * factor, MIN_Z, MAX_Z);
  const k = nz / cam.z;
  cam.x = sx - (sx - cam.x) * k;
  cam.y = sy - (sy - cam.y) * k;
  cam.z = nz;
  applyCamera();
}
function zoomStep(factor) { zoomAt(vpRect.width / 2, vpRect.height / 2, factor); }
function setZoom(z) { zoomAt(vpRect.width / 2, vpRect.height / 2, z / cam.z); }

function nodesBBox(ids) {
  const list = ids ? ids.map(nodeById).filter(Boolean) : roots();
  if (!list.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of list) { const r = nodeRect(n); x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function fitToScreen(ids, animate = true) {
  const bb = nodesBBox(ids && ids.length ? ids : null);
  if (!bb) { cam = { x: vpRect.width / 2, y: vpRect.height / 2, z: 1 }; applyCamera(); return; }
  const pad = 80;
  const z = clamp(Math.min((vpRect.width - pad * 2) / Math.max(bb.w, 1), (vpRect.height - pad * 2) / Math.max(bb.h, 1)), MIN_Z, 1.5);
  const target = { z, x: vpRect.width / 2 - (bb.x + bb.w / 2) * z, y: vpRect.height / 2 - (bb.y + bb.h / 2) * z };
  if (!animate) { cam = target; applyCamera(); return; }
  animateCamera(target);
}
function animateCamera(target, ms = 320) {
  const start = { ...cam }, t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    const t = ease(clamp((now - t0) / ms, 0, 1));
    cam.x = start.x + (target.x - start.x) * t;
    cam.y = start.y + (target.y - start.y) * t;
    cam.z = start.z + (target.z - start.z) * t;
    applyCamera();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}


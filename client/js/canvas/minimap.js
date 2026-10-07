/* =========================================================
   8. Minimapa
   ========================================================= */
import { $ } from '../core/utils.js';
import { S, isContainer, depthOf } from '../core/state.js';
import { applyCamera, nodesBBox } from './camera.js';
import { sel, nodeRect } from './render-nodes.js';
export const minimap = $('#minimap');
export function drawMinimap() {
  const show = S.state.settings.minimap;
  minimap.hidden = !show;
  if (!show) return;
  const dpr = window.devicePixelRatio || 1;
  const W = 200, H = 130;
  if (minimap.width !== W * dpr) { minimap.width = W * dpr; minimap.height = H * dpr; }
  const ctx = minimap.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cs = getComputedStyle(document.documentElement);
  const bb = nodesBBox() || { x: 0, y: 0, w: 1000, h: 600 };
  const vw = S.vpRect.width / S.cam.z, vh = S.vpRect.height / S.cam.z;
  const vx = -S.cam.x / S.cam.z, vy = -S.cam.y / S.cam.z;
  const x1 = Math.min(bb.x, vx), y1 = Math.min(bb.y, vy), x2 = Math.max(bb.x + bb.w, vx + vw), y2 = Math.max(bb.y + bb.h, vy + vh);
  const pad = 10;
  const s = Math.min((W - pad * 2) / Math.max(x2 - x1, 1), (H - pad * 2) / Math.max(y2 - y1, 1));
  const ox = (W - (x2 - x1) * s) / 2 - x1 * s, oy = (H - (y2 - y1) * s) / 2 - y1 * s;
  S.mmScale = { s, ox, oy };
  const colors = { software: cs.getPropertyValue('--c-software'), ds: cs.getPropertyValue('--c-ds'), uikit: cs.getPropertyValue('--c-uikit') };
  for (const n of [...S.state.nodes].sort((a, b) => depthOf(a) - depthOf(b))) {
    const r = nodeRect(n);
    const x = ox + r.x * s, y = oy + r.y * s, w = Math.max(2, r.w * s), h = Math.max(2, r.h * s);
    if (isContainer(n)) {
      ctx.globalAlpha = sel.nodes.has(n.id) ? .9 : .5;
      ctx.strokeStyle = colors.software; ctx.lineWidth = n.parentId ? .8 : 1.4;
      ctx.strokeRect(x, y, w, h);
    } else {
      ctx.globalAlpha = sel.nodes.has(n.id) ? 1 : .7;
      ctx.fillStyle = colors[n.type] || '#999';
      ctx.fillRect(x, y, w, h);
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = cs.getPropertyValue('--accent');
  ctx.lineWidth = 1.2;
  ctx.fillStyle = cs.getPropertyValue('--accent-soft');
  ctx.fillRect(ox + vx * s, oy + vy * s, vw * s, vh * s);
  ctx.strokeRect(ox + vx * s, oy + vy * s, vw * s, vh * s);
}
(() => {
  let dragging = false;
  const moveTo = e => {
    if (!S.mmScale) return;
    const r = minimap.getBoundingClientRect();
    const wx = (e.clientX - r.left - S.mmScale.ox) / S.mmScale.s, wy = (e.clientY - r.top - S.mmScale.oy) / S.mmScale.s;
    S.cam.x = S.vpRect.width / 2 - wx * S.cam.z; S.cam.y = S.vpRect.height / 2 - wy * S.cam.z;
    applyCamera();
  };
  minimap.addEventListener('pointerdown', e => { dragging = true; minimap.setPointerCapture(e.pointerId); moveTo(e); e.stopPropagation(); });
  minimap.addEventListener('pointermove', e => { if (dragging) moveTo(e); });
  minimap.addEventListener('pointerup', () => dragging = false);
  minimap.addEventListener('pointercancel', () => dragging = false);
})();


/* =========================================================
   9. Interacción con puntero: arrastre, re-anidamiento, pan, marquee, pinch, conexión, resize
   ========================================================= */
import { $, $$, clamp, GRID, DRAG_THRESHOLD, MIN_Z, MAX_Z } from '../core/utils.js';
import { viewport } from '../core/dom.js';
import { S, save, nodeById, isContainer, depthOf, worldPos } from '../core/state.js';
import { history, pushHistory, undo, updateUndoButtons } from '../core/history.js';
import { toWorld, ptrPos, applyCamera } from './camera.js';
import { sel, nodeEls, nodeRect, anchorRect, computeSizes, applySizes, contentMin } from './render-nodes.js';
import { portPoint, updateEdgePaths } from './render-edges.js';
import {
  applySelection, selectOnly, toggleSelect, clearSelection, selectEdge, renderAll,
} from './selection.js';
import { beginDrag, applyDrag, cleanupDrag, endDrag, updateMarquee } from './pointer-drag.js';
import { closePopover, showEdgePopover } from '../ui/popover.js';
import { proposeConnection } from '../ui/connections.js';
export const pointers = new Map();     // punteros activos (para pinch)

export function setTool(tool) {
  S.state.settings.tool = tool;
  $$('#toolSeg button').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  viewport.classList.toggle('tool-hand', tool === 'hand');
  save();
}

/** Contenedor más profundo bajo un punto de mundo, excluyendo ids. */
export function containerAt(wp, exclude) {
  let best = null, bestDepth = -1;
  for (const n of S.state.nodes) {
    if (!isContainer(n) || (exclude && exclude.has(n.id))) continue;
    const r = nodeRect(n);
    if (wp.x >= r.x && wp.x <= r.x + r.w && wp.y >= r.y && wp.y <= r.y + r.h) { const d = depthOf(n); if (d > bestDepth) { bestDepth = d; best = n; } }
  }
  return best;
}

export function onPointerDown(e) {
  if (S.popoverOpen) closePopover();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const p = ptrPos(e);

  if (e.pointerType === 'touch' && pointers.size === 2) {
    if (S.ptr && S.ptr.type === 'drag') cancelGesture();
    const [a, b] = [...pointers.values()];
    S.ptr = { type: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y), startCenter: { x: (a.x + b.x) / 2 - S.vpRect.left, y: (a.y + b.y) / 2 - S.vpRect.top }, startCam: { ...S.cam } };
    return;
  }
  if (S.ptr && S.ptr.type !== 'pendingDrag' && S.ptr.type !== 'pendingMarquee') return;

  const port = e.target.closest('.port');
  const node = e.target.closest('.node');
  let edge = e.target.closest('.edge'), edgeBehind = false;
  if (!edge && node && e.target === node && node.classList.contains('ctr')) { // línea dibujada bajo el cuerpo del contenedor
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('hit'));
    if (hit) { edge = hit.closest('.edge'); edgeBehind = !!edge; }
  }
  const panMode = e.button === 1 || S.spaceDown || S.state.settings.tool === 'hand';

  if (e.target.closest('[data-action]')) return;
  if (e.button === 2) return;

  if (panMode) {
    S.ptr = { type: 'pan', sx: p.x, sy: p.y, cx: S.cam.x, cy: S.cam.y };
    viewport.classList.add('panning');
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (node && e.target.closest('.resize')) {
    const n = nodeById(node.dataset.id);
    pushHistory();
    S.ptr = { type: 'resize', id: n.id, pointerId: e.pointerId };
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (port && node) {
    const n = nodeById(node.dataset.id);
    const from = portPoint(anchorRect(n), port.dataset.port);
    S.ptr = { type: 'connect', fromId: n.id, from, target: null };
    viewport.classList.add('connecting');
    viewport.setPointerCapture(e.pointerId);
    $('#tempEdge').hidden = false;
    e.preventDefault();
    return;
  }
  if (edge && (edgeBehind || !node)) {
    S.ptr = { type: 'edgeClick', id: edge.dataset.id, sx: p.x, sy: p.y, clientX: e.clientX, clientY: e.clientY, nodeId: edgeBehind ? node.dataset.id : null, pointerId: e.pointerId };
    return;
  }
  if (node) {
    const id = node.dataset.id;
    const wasSelected = sel.nodes.has(id);
    if (!wasSelected) { if (e.shiftKey) toggleSelect(id); else selectOnly(id); }
    S.ptr = { type: 'pendingDrag', id, sx: p.x, sy: p.y, shift: e.shiftKey, wasSelected, pointerId: e.pointerId, px: p.x, py: p.y };
    e.preventDefault();
    return;
  }
  if (edge) {
    S.ptr = { type: 'edgeClick', id: edge.dataset.id, sx: p.x, sy: p.y, clientX: e.clientX, clientY: e.clientY };
    return;
  }
  if (e.pointerType === 'touch') {
    S.ptr = { type: 'pan', sx: p.x, sy: p.y, cx: S.cam.x, cy: S.cam.y };
    viewport.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button === 0) S.ptr = { type: 'pendingMarquee', sx: p.x, sy: p.y, shift: e.shiftKey, base: new Set(sel.nodes), pointerId: e.pointerId };
}

export function onPointerMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!S.ptr) return;
  const p = ptrPos(e);

  switch (S.ptr.type) {
    case 'pinch': {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2 - S.vpRect.left, y: (a.y + b.y) / 2 - S.vpRect.top };
      const z = clamp(S.ptr.startCam.z * (dist / S.ptr.startDist), MIN_Z, MAX_Z);
      const w = { x: (S.ptr.startCenter.x - S.ptr.startCam.x) / S.ptr.startCam.z, y: (S.ptr.startCenter.y - S.ptr.startCam.y) / S.ptr.startCam.z };
      S.cam.z = z; S.cam.x = center.x - w.x * z; S.cam.y = center.y - w.y * z;
      applyCamera();
      return;
    }
    case 'pan':
      S.cam.x = S.ptr.cx + (p.x - S.ptr.sx); S.cam.y = S.ptr.cy + (p.y - S.ptr.sy);
      applyCamera();
      return;
    case 'resize': {
      const n = nodeById(S.ptr.id); if (!n) return;
      const wp = toWorld(p.x, p.y), w0 = worldPos(n), cm = contentMin(n);
      const snap = S.state.settings.snap && !e.altKey;
      let w = wp.x - w0.x, h = wp.y - w0.y;
      if (snap) { w = Math.round(w / GRID) * GRID; h = Math.round(h / GRID) * GRID; }
      n.w = Math.max(cm.w, w); n.h = Math.max(cm.h, h);
      computeSizes(); applySizes(); updateEdgePaths();
      return;
    }
    case 'edgeClick':
      if (S.ptr.nodeId && Math.hypot(p.x - S.ptr.sx, p.y - S.ptr.sy) >= DRAG_THRESHOLD) { // si se arrastra, mover el contenedor
        const id = S.ptr.nodeId; if (!sel.nodes.has(id)) selectOnly(id);
        S.ptr = { type: 'pendingDrag', id, sx: S.ptr.sx, sy: S.ptr.sy, shift: false, wasSelected: true, pointerId: S.ptr.pointerId, px: p.x, py: p.y };
        beginDrag(); S.ptr.px = p.x; S.ptr.py = p.y;
        if (!S.rafPending) S.rafPending = requestAnimationFrame(applyDrag);
      }
      return;
    case 'pendingDrag':
      if (Math.hypot(p.x - S.ptr.sx, p.y - S.ptr.sy) < DRAG_THRESHOLD) return;
      beginDrag();
      // fallthrough
    case 'drag':
      S.ptr.px = p.x; S.ptr.py = p.y; S.ptr.alt = e.altKey;
      if (!S.rafPending) S.rafPending = requestAnimationFrame(applyDrag);
      return;
    case 'pendingMarquee':
      if (Math.hypot(p.x - S.ptr.sx, p.y - S.ptr.sy) < DRAG_THRESHOLD) return;
      S.ptr.type = 'marquee';
      viewport.setPointerCapture(S.ptr.pointerId);
      $('#marquee').hidden = false;
      // fallthrough
    case 'marquee':
      updateMarquee(p);
      return;
    case 'connect': {
      const w = toWorld(p.x, p.y);
      $('#tempEdge').setAttribute('d', `M${S.ptr.from.x} ${S.ptr.from.y} L${w.x} ${w.y}`);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const node = el && el.closest('.node');
      const targetId = node && node.dataset.id !== S.ptr.fromId ? node.dataset.id : null;
      if (targetId !== S.ptr.target) {
        if (S.ptr.target) nodeEls.get(S.ptr.target)?.classList.remove('target');
        S.ptr.target = targetId;
        if (targetId) nodeEls.get(targetId)?.classList.add('target');
      }
      return;
    }
  }
}

export function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (!S.ptr) return;
  const p = ptrPos(e);
  switch (S.ptr.type) {
    case 'pinch':
      if (pointers.size < 2) S.ptr = null;
      return;
    case 'pan':
      viewport.classList.remove('panning');
      S.ptr = null; return;
    case 'resize':
      S.ptr = null; renderAll(); save(); return;
    case 'pendingDrag':
      if (S.ptr.shift && S.ptr.wasSelected) toggleSelect(S.ptr.id);
      else if (!S.ptr.shift && S.ptr.wasSelected) selectOnly(S.ptr.id);
      S.ptr = null; return;
    case 'drag':
      endDrag(); return;
    case 'pendingMarquee':
      if (!S.ptr.shift) clearSelection();
      S.ptr = null; return;
    case 'marquee':
      $('#marquee').hidden = true;
      S.ptr = null; applySelection(); return;
    case 'edgeClick':
      if (Math.hypot(p.x - S.ptr.sx, p.y - S.ptr.sy) < DRAG_THRESHOLD) { selectEdge(S.ptr.id); showEdgePopover(S.ptr.id, S.ptr.clientX, S.ptr.clientY); }
      S.ptr = null; return;
    case 'connect': {
      const { fromId, target } = S.ptr;
      finishConnect();
      if (target) proposeConnection(fromId, target, e.clientX, e.clientY);
      return;
    }
  }
}
export function finishConnect() {
  if (S.ptr && S.ptr.target) nodeEls.get(S.ptr.target)?.classList.remove('target');
  $('#tempEdge').hidden = true;
  viewport.classList.remove('connecting');
  S.ptr = null;
}
export function cancelGesture() {
  if (!S.ptr) return;
  if (S.ptr.type === 'drag') {
    for (const [id, pos] of S.ptr.start) { const n = nodeById(id); if (n) { n.x = pos.x; n.y = pos.y; } }
    cleanupDrag();
    history.past.pop(); updateUndoButtons();
    renderAll();
    return;
  }
  if (S.ptr.type === 'resize') { S.ptr = null; undo(); return; }
  if (S.ptr.type === 'connect') return finishConnect();
  if (S.ptr.type === 'marquee') $('#marquee').hidden = true;
  viewport.classList.remove('panning');
  S.ptr = null;
}


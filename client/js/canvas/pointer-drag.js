/* --- Arrastre de nodos (con re-anidamiento al soltar) --- */
import { $, MOD, CARD_W, GRID, SNAP_DIST } from '../core/utils.js';
import { viewport, nodesLayer, guidesSvg } from '../core/dom.js';
import {
  S, save, nodeById, isContainer, defaultBranchType, ancestorsOf, descendantsOf, worldPos, typeName } from '../core/state.js';
import { pushHistory } from '../core/history.js';
import { toWorld, toScreen, ptrPos, applyCamera, zoomAt, fitToScreen } from './camera.js';
import { sel, sizes, nodeEls, nodeRect, clampInside } from './render-nodes.js';
import { updateEdgePaths } from './render-edges.js';
import { selectOnly, selectAll, selectEdge, topLevelSelection, renderAll } from './selection.js';
import { containerAt, onPointerDown, onPointerMove, onPointerUp } from './pointer-gestures.js';
import { menuPopover, showAddMenu, showNodeMenu, showEdgePopover } from '../ui/popover.js';
import { openEditor } from '../ui/card-editor.js';
import { toast } from '../ui/theme.js';
export function beginDrag() {
  pushHistory();
  S.ptr.type = 'drag';
  if (!sel.nodes.has(S.ptr.id)) selectOnly(S.ptr.id);
  const moving = topLevelSelection();
  if (!moving.includes(S.ptr.id)) { // se arrastró un hijo de algo seleccionado: mover solo su ancestro seleccionado
    const anc = ancestorsOf(S.ptr.id).find(a => sel.nodes.has(a)); S.ptr.id = anc || S.ptr.id;
  }
  S.ptr.moving = new Set(moving);
  S.ptr.start = new Map(moving.map(id => { const n = nodeById(id); return [id, { x: n.x, y: n.y }]; }));
  S.ptr.exclude = new Set(moving); moving.forEach(id => descendantsOf(id).forEach(d => S.ptr.exclude.add(d)));
  S.ptr.edgeSet = new Set(S.ptr.exclude);
  S.ptr.lifted = new Set(); moving.forEach(id => ancestorsOf(id).forEach(a => S.ptr.lifted.add(a)));
  S.ptr.dropHL = null;
  viewport.setPointerCapture(S.ptr.pointerId);
  for (const id of S.ptr.moving) nodeEls.get(id)?.classList.add('dragging');
  for (const id of S.ptr.lifted) nodeEls.get(id)?.classList.add('lift');
}
export function applyDrag() {
  S.rafPending = 0;
  if (!S.ptr || S.ptr.type !== 'drag') return;
  const primary = S.ptr.start.get(S.ptr.id);
  if (!primary) return;
  let nx = primary.x + (S.ptr.px - S.ptr.sx) / S.cam.z;
  let ny = primary.y + (S.ptr.py - S.ptr.sy) / S.cam.z;
  if (S.state.settings.snap && !S.ptr.alt && !S.altDown) { nx = Math.round(nx / GRID) * GRID; ny = Math.round(ny / GRID) * GRID; }
  const g = computeGuides(S.ptr.id, nx, ny, S.ptr.exclude);
  nx = g.x; ny = g.y;
  const ddx = nx - primary.x, ddy = ny - primary.y;
  for (const [id, pos] of S.ptr.start) {
    const n = nodeById(id); if (!n) continue;
    n.x = pos.x + ddx; n.y = pos.y + ddy;
    const el = nodeEls.get(id); if (el) el.style.transform = `translate(${n.x}px, ${n.y}px)`;
  }
  updateEdgePaths(S.ptr.edgeSet);
  drawGuides(g.lines);
  // Resaltar el contenedor destino bajo el puntero
  const wp = toWorld(S.ptr.px, S.ptr.py);
  const target = containerAt(wp, S.ptr.exclude);
  const hl = target && target.id !== (nodeById(S.ptr.id).parentId || null) ? target.id : null;
  if (hl !== S.ptr.dropHL) {
    if (S.ptr.dropHL) nodeEls.get(S.ptr.dropHL)?.classList.remove('drop-target');
    S.ptr.dropHL = hl;
    if (hl) nodeEls.get(hl)?.classList.add('drop-target');
  }
}
export function cleanupDrag() {
  if (S.rafPending) { cancelAnimationFrame(S.rafPending); S.rafPending = 0; }
  for (const id of S.ptr.moving || []) nodeEls.get(id)?.classList.remove('dragging');
  for (const id of S.ptr.lifted || []) nodeEls.get(id)?.classList.remove('lift');
  if (S.ptr.dropHL) nodeEls.get(S.ptr.dropHL)?.classList.remove('drop-target');
  drawGuides([]);
  S.ptr = null;
}
export function endDrag() {
  if (!S.ptr) return;
  if (S.rafPending) { cancelAnimationFrame(S.rafPending); S.rafPending = 0; applyDrag(); }
  const wp = toWorld(S.ptr.px, S.ptr.py);
  const target = containerAt(wp, S.ptr.exclude);
  const reverted = [], nested = [];
  for (const id of S.ptr.moving) {
    const n = nodeById(id); if (!n) continue;
    const cur = n.parentId || null, tid = target ? target.id : null;
    if (tid === cur) { clampInside(n); continue; }
    const w = worldPos(n);
    if (!target) {
      if (isContainer(n)) { n.parentId = null; n.branchTypeId = null; n.x = w.x; n.y = w.y; }
      else { const s = S.ptr.start.get(id); n.x = s.x; n.y = s.y; reverted.push(n.name); }
      continue;
    }
    const tp = worldPos(target);
    n.parentId = target.id; n.x = w.x - tp.x; n.y = w.y - tp.y; clampInside(n);
    if (isContainer(n) && !n.branchTypeId) n.branchTypeId = defaultBranchType();
    nested.push(`${n.name} → ${target.name}`);
  }
  cleanupDrag();
  renderAll(); save();
  if (reverted.length) toast(`${reverted.join(', ')}: ${typeName('ds')} y ${typeName('uikit')} deben vivir dentro de ${typeName('software')}.`, 'error', 3600);
  else if (nested.length) toast(nested.join(' · '));
}

/* --- Guías inteligentes: alineación y distancia respecto a los hermanos --- */
export function computeGuides(id, nx, ny, exclude) {
  const n = nodeById(id);
  const s = sizes.get(id) || { w: CARD_W, h: 120 };
  const off = n.parentId ? worldPos(nodeById(n.parentId)) : { x: 0, y: 0 };
  const me = { x: off.x + nx, y: off.y + ny, w: s.w, h: s.h };
  const th = SNAP_DIST / S.cam.z;
  let bestX = null, bestY = null;
  const others = S.state.nodes.filter(o => (o.parentId || null) === (n.parentId || null) && !exclude.has(o.id)).map(nodeRect);
  for (const o of others) {
    const xs = [[me.x, o.x], [me.x + me.w / 2, o.cx], [me.x + me.w, o.x + o.w], [me.x, o.x + o.w], [me.x + me.w, o.x]];
    const ys = [[me.y, o.y], [me.y + me.h / 2, o.cy], [me.y + me.h, o.y + o.h], [me.y, o.y + o.h], [me.y + me.h, o.y]];
    for (const [mine, theirs] of xs) { const d = theirs - mine; if (Math.abs(d) <= th && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, line: theirs, o }; }
    for (const [mine, theirs] of ys) { const d = theirs - mine; if (Math.abs(d) <= th && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, line: theirs, o }; }
  }
  const lines = [];
  if (bestX) { me.x += bestX.d; lines.push({ type: 'v', x: bestX.line, y1: Math.min(me.y, bestX.o.y), y2: Math.max(me.y + me.h, bestX.o.y + bestX.o.h) }); }
  if (bestY) { me.y += bestY.d; lines.push({ type: 'h', y: bestY.line, x1: Math.min(me.x, bestY.o.x), x2: Math.max(me.x + me.w, bestY.o.x + bestY.o.w) }); }
  let near = null;
  for (const o of others) {
    const overlapV = Math.min(me.y + me.h, o.y + o.h) - Math.max(me.y, o.y);
    if (overlapV > 10) {
      const gap = o.x >= me.x + me.w ? o.x - (me.x + me.w) : me.x >= o.x + o.w ? me.x - (o.x + o.w) : -1;
      if (gap >= 0 && gap < 400 && (!near || gap < near.gap)) near = { gap, type: 'h', y: Math.max(me.y, o.y) + overlapV / 2, x1: o.x >= me.x ? me.x + me.w : o.x + o.w, x2: o.x >= me.x ? o.x : me.x };
    }
    const overlapH = Math.min(me.x + me.w, o.x + o.w) - Math.max(me.x, o.x);
    if (overlapH > 10) {
      const gap = o.y >= me.y + me.h ? o.y - (me.y + me.h) : me.y >= o.y + o.h ? me.y - (o.y + o.h) : -1;
      if (gap >= 0 && gap < 400 && (!near || gap < near.gap)) near = { gap, type: 'v', x: Math.max(me.x, o.x) + overlapH / 2, y1: o.y >= me.y ? me.y + me.h : o.y + o.h, y2: o.y >= me.y ? o.y : me.y };
    }
  }
  if (near && (bestX || bestY)) lines.push({ ...near, gapLabel: Math.round(near.gap) });
  return { x: me.x - off.x, y: me.y - off.y, lines };
}
export function drawGuides(lines) {
  if (!lines.length) { guidesSvg.innerHTML = ''; return; }
  let html = '';
  for (const l of lines) {
    if (l.gapLabel !== undefined) {
      if (l.type === 'h') { const a = toScreen(l.x1, l.y), b = toScreen(l.x2, l.y); html += `<line class="gap" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><text x="${(a.x + b.x) / 2}" y="${a.y - 5}">${l.gapLabel}</text>`; }
      else { const a = toScreen(l.x, l.y1), b = toScreen(l.x, l.y2); html += `<line class="gap" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><text x="${a.x + 14}" y="${(a.y + b.y) / 2 + 3}">${l.gapLabel}</text>`; }
    } else if (l.type === 'v') { const a = toScreen(l.x, l.y1 - 20), b = toScreen(l.x, l.y2 + 20); html += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }
    else { const a = toScreen(l.x1 - 20, l.y), b = toScreen(l.x2 + 20, l.y); html += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }
  }
  guidesSvg.innerHTML = html;
}

/* --- Marquee --- */
export function updateMarquee(p) {
  const x = Math.min(p.x, S.ptr.sx), y = Math.min(p.y, S.ptr.sy), w = Math.abs(p.x - S.ptr.sx), h = Math.abs(p.y - S.ptr.sy);
  const m = $('#marquee');
  m.style.left = x + 'px'; m.style.top = y + 'px'; m.style.width = w + 'px'; m.style.height = h + 'px';
  const a = toWorld(x, y), b = toWorld(x + w, y + h);
  const next = new Set(S.ptr.shift ? S.ptr.base : []);
  for (const n of S.state.nodes) {
    const r = nodeRect(n);
    if (r.x < b.x && r.x + r.w > a.x && r.y < b.y && r.y + r.h > a.y) next.add(n.id);
  }
  sel.nodes = next; sel.edge = null;
  for (const [id, el] of nodeEls) el.classList.toggle('selected', next.has(id));
}

viewport.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
viewport.addEventListener('dragstart', e => e.preventDefault());

/* --- Rueda: pan con dos dedos, zoom con Ctrl/⌘ o pinch de trackpad --- */
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  const p = ptrPos(e);
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? S.vpRect.height : 1;
  if (e.ctrlKey || e.metaKey) zoomAt(p.x, p.y, Math.exp(-e.deltaY * k * 0.01));
  else { S.cam.x -= e.deltaX * k; S.cam.y -= e.deltaY * k; applyCamera(); }
}, { passive: false });

viewport.addEventListener('dblclick', e => {
  const node = e.target.closest('.node');
  if (node && !e.target.closest('.port, .resize')) openEditor(node.dataset.id);
});

/* --- Menú contextual --- */
viewport.addEventListener('contextmenu', e => {
  e.preventDefault();
  const node = e.target.closest('.node');
  if (node) { if (!sel.nodes.has(node.dataset.id)) selectOnly(node.dataset.id); showNodeMenu(node.dataset.id, e.clientX, e.clientY); return; }
  const edge = e.target.closest('.edge');
  if (edge) { selectEdge(edge.dataset.id); showEdgePopover(edge.dataset.id, e.clientX, e.clientY); return; }
  const w = toWorld(...Object.values(ptrPos(e)));
  menuPopover(e.clientX, e.clientY, [
    { title: 'Lienzo' },
    { label: 'Nueva Main instance aquí', ico: '▣', action: () => openEditor(null, { type: 'software', x: w.x, y: w.y }) },
    '-',
    { label: 'Seleccionar todo', kbd: `${MOD}+A`, action: selectAll },
    { label: 'Ajustar a pantalla', kbd: 'Shift+1', action: () => fitToScreen() },
  ]);
});

/* --- Botones ⋯ y ＋ dentro de los nodos --- */
nodesLayer.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.closest('.node').dataset.id;
  const r = btn.getBoundingClientRect();
  if (btn.dataset.action === 'add') { showAddMenu(id, r.left, r.bottom + 4); return; }
  if (!sel.nodes.has(id)) selectOnly(id);
  showNodeMenu(id, r.left, r.bottom + 4);
});


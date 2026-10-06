'use strict';
/* =========================================================
   9. Interacción con puntero: arrastre, re-anidamiento, pan, marquee, pinch, conexión, resize
   ========================================================= */
let ptr = null;                 // gesto en curso
const pointers = new Map();     // punteros activos (para pinch)
let spaceDown = false;
let altDown = false;
let rafPending = 0;

function setTool(tool) {
  state.settings.tool = tool;
  $$('#toolSeg button').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  viewport.classList.toggle('tool-hand', tool === 'hand');
  save();
}

/** Contenedor más profundo bajo un punto de mundo, excluyendo ids. */
function containerAt(wp, exclude) {
  let best = null, bestDepth = -1;
  for (const n of state.nodes) {
    if (!isContainer(n) || (exclude && exclude.has(n.id))) continue;
    const r = nodeRect(n);
    if (wp.x >= r.x && wp.x <= r.x + r.w && wp.y >= r.y && wp.y <= r.y + r.h) { const d = depthOf(n); if (d > bestDepth) { bestDepth = d; best = n; } }
  }
  return best;
}

function onPointerDown(e) {
  if (popoverOpen) closePopover();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const p = ptrPos(e);

  if (e.pointerType === 'touch' && pointers.size === 2) {
    if (ptr && ptr.type === 'drag') cancelGesture();
    const [a, b] = [...pointers.values()];
    ptr = { type: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y), startCenter: { x: (a.x + b.x) / 2 - vpRect.left, y: (a.y + b.y) / 2 - vpRect.top }, startCam: { ...cam } };
    return;
  }
  if (ptr && ptr.type !== 'pendingDrag' && ptr.type !== 'pendingMarquee') return;

  const port = e.target.closest('.port');
  const node = e.target.closest('.node');
  let edge = e.target.closest('.edge'), edgeBehind = false;
  if (!edge && node && e.target === node && node.classList.contains('ctr')) { // línea dibujada bajo el cuerpo del contenedor
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('hit'));
    if (hit) { edge = hit.closest('.edge'); edgeBehind = !!edge; }
  }
  const panMode = e.button === 1 || spaceDown || state.settings.tool === 'hand';

  if (e.target.closest('[data-action]')) return;
  if (e.button === 2) return;

  if (panMode) {
    ptr = { type: 'pan', sx: p.x, sy: p.y, cx: cam.x, cy: cam.y };
    viewport.classList.add('panning');
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (node && e.target.closest('.resize')) {
    const n = nodeById(node.dataset.id);
    pushHistory();
    ptr = { type: 'resize', id: n.id, pointerId: e.pointerId };
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (port && node) {
    const n = nodeById(node.dataset.id);
    const from = portPoint(anchorRect(n), port.dataset.port);
    ptr = { type: 'connect', fromId: n.id, from, target: null };
    viewport.classList.add('connecting');
    viewport.setPointerCapture(e.pointerId);
    $('#tempEdge').hidden = false;
    e.preventDefault();
    return;
  }
  if (edge && (edgeBehind || !node)) {
    ptr = { type: 'edgeClick', id: edge.dataset.id, sx: p.x, sy: p.y, clientX: e.clientX, clientY: e.clientY, nodeId: edgeBehind ? node.dataset.id : null, pointerId: e.pointerId };
    return;
  }
  if (node) {
    const id = node.dataset.id;
    const wasSelected = sel.nodes.has(id);
    if (!wasSelected) { if (e.shiftKey) toggleSelect(id); else selectOnly(id); }
    ptr = { type: 'pendingDrag', id, sx: p.x, sy: p.y, shift: e.shiftKey, wasSelected, pointerId: e.pointerId, px: p.x, py: p.y };
    e.preventDefault();
    return;
  }
  if (edge) {
    ptr = { type: 'edgeClick', id: edge.dataset.id, sx: p.x, sy: p.y, clientX: e.clientX, clientY: e.clientY };
    return;
  }
  if (e.pointerType === 'touch') {
    ptr = { type: 'pan', sx: p.x, sy: p.y, cx: cam.x, cy: cam.y };
    viewport.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button === 0) ptr = { type: 'pendingMarquee', sx: p.x, sy: p.y, shift: e.shiftKey, base: new Set(sel.nodes), pointerId: e.pointerId };
}

function onPointerMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!ptr) return;
  const p = ptrPos(e);

  switch (ptr.type) {
    case 'pinch': {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2 - vpRect.left, y: (a.y + b.y) / 2 - vpRect.top };
      const z = clamp(ptr.startCam.z * (dist / ptr.startDist), MIN_Z, MAX_Z);
      const w = { x: (ptr.startCenter.x - ptr.startCam.x) / ptr.startCam.z, y: (ptr.startCenter.y - ptr.startCam.y) / ptr.startCam.z };
      cam.z = z; cam.x = center.x - w.x * z; cam.y = center.y - w.y * z;
      applyCamera();
      return;
    }
    case 'pan':
      cam.x = ptr.cx + (p.x - ptr.sx); cam.y = ptr.cy + (p.y - ptr.sy);
      applyCamera();
      return;
    case 'resize': {
      const n = nodeById(ptr.id); if (!n) return;
      const wp = toWorld(p.x, p.y), w0 = worldPos(n), cm = contentMin(n);
      const snap = state.settings.snap && !e.altKey;
      let w = wp.x - w0.x, h = wp.y - w0.y;
      if (snap) { w = Math.round(w / GRID) * GRID; h = Math.round(h / GRID) * GRID; }
      n.w = Math.max(cm.w, w); n.h = Math.max(cm.h, h);
      computeSizes(); applySizes(); updateEdgePaths();
      return;
    }
    case 'edgeClick':
      if (ptr.nodeId && Math.hypot(p.x - ptr.sx, p.y - ptr.sy) >= DRAG_THRESHOLD) { // si se arrastra, mover el contenedor
        const id = ptr.nodeId; if (!sel.nodes.has(id)) selectOnly(id);
        ptr = { type: 'pendingDrag', id, sx: ptr.sx, sy: ptr.sy, shift: false, wasSelected: true, pointerId: ptr.pointerId, px: p.x, py: p.y };
        beginDrag(); ptr.px = p.x; ptr.py = p.y;
        if (!rafPending) rafPending = requestAnimationFrame(applyDrag);
      }
      return;
    case 'pendingDrag':
      if (Math.hypot(p.x - ptr.sx, p.y - ptr.sy) < DRAG_THRESHOLD) return;
      beginDrag();
      // fallthrough
    case 'drag':
      ptr.px = p.x; ptr.py = p.y; ptr.alt = e.altKey;
      if (!rafPending) rafPending = requestAnimationFrame(applyDrag);
      return;
    case 'pendingMarquee':
      if (Math.hypot(p.x - ptr.sx, p.y - ptr.sy) < DRAG_THRESHOLD) return;
      ptr.type = 'marquee';
      viewport.setPointerCapture(ptr.pointerId);
      $('#marquee').hidden = false;
      // fallthrough
    case 'marquee':
      updateMarquee(p);
      return;
    case 'connect': {
      const w = toWorld(p.x, p.y);
      $('#tempEdge').setAttribute('d', `M${ptr.from.x} ${ptr.from.y} L${w.x} ${w.y}`);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const node = el && el.closest('.node');
      const targetId = node && node.dataset.id !== ptr.fromId ? node.dataset.id : null;
      if (targetId !== ptr.target) {
        if (ptr.target) nodeEls.get(ptr.target)?.classList.remove('target');
        ptr.target = targetId;
        if (targetId) nodeEls.get(targetId)?.classList.add('target');
      }
      return;
    }
  }
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (!ptr) return;
  const p = ptrPos(e);
  switch (ptr.type) {
    case 'pinch':
      if (pointers.size < 2) ptr = null;
      return;
    case 'pan':
      viewport.classList.remove('panning');
      ptr = null; return;
    case 'resize':
      ptr = null; renderAll(); save(); return;
    case 'pendingDrag':
      if (ptr.shift && ptr.wasSelected) toggleSelect(ptr.id);
      else if (!ptr.shift && ptr.wasSelected) selectOnly(ptr.id);
      ptr = null; return;
    case 'drag':
      endDrag(); return;
    case 'pendingMarquee':
      if (!ptr.shift) clearSelection();
      ptr = null; return;
    case 'marquee':
      $('#marquee').hidden = true;
      ptr = null; applySelection(); return;
    case 'edgeClick':
      if (Math.hypot(p.x - ptr.sx, p.y - ptr.sy) < DRAG_THRESHOLD) { selectEdge(ptr.id); showEdgePopover(ptr.id, ptr.clientX, ptr.clientY); }
      ptr = null; return;
    case 'connect': {
      const { fromId, target } = ptr;
      finishConnect();
      if (target) proposeConnection(fromId, target, e.clientX, e.clientY);
      return;
    }
  }
}
function finishConnect() {
  if (ptr && ptr.target) nodeEls.get(ptr.target)?.classList.remove('target');
  $('#tempEdge').hidden = true;
  viewport.classList.remove('connecting');
  ptr = null;
}
function cancelGesture() {
  if (!ptr) return;
  if (ptr.type === 'drag') {
    for (const [id, pos] of ptr.start) { const n = nodeById(id); if (n) { n.x = pos.x; n.y = pos.y; } }
    cleanupDrag();
    history.past.pop(); updateUndoButtons();
    renderAll();
    return;
  }
  if (ptr.type === 'resize') { ptr = null; undo(); return; }
  if (ptr.type === 'connect') return finishConnect();
  if (ptr.type === 'marquee') $('#marquee').hidden = true;
  viewport.classList.remove('panning');
  ptr = null;
}


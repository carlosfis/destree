'use strict';
/* =========================================================
   17. Auto-layout jerárquico (recursivo por contenedor, animado y deshacible)
   ---------------------------------------------------------
   Dentro de cada contenedor: primero una fila (con salto) de sub-contenedores,
   debajo una fila de DS y UI Kits. Las raíces se acomodan en filas.
   ========================================================= */
function computeLayout(rootIds) {
  const target = new Map(), tmp = new Map();
  const byName = (a, b) => a.name.localeCompare(b.name);
  const typeOrder = { software: 0, ds: 1, uikit: 2 };
  const layout = n => {
    if (!isContainer(n)) { const s = { w: CARD_W, h: measured.get(n.id) || 120 }; tmp.set(n.id, s); return s; }
    const headH = measured.get(n.id) || 60;
    const kids = childrenOf(n.id).sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || byName(a, b));
    kids.forEach(layout);
    const ctrs = kids.filter(isContainer), leaves = kids.filter(k => !isContainer(k));
    let x = PAD, y = headH + HEAD_GAP, rowH = 0, maxR = 0, bottom = y;
    const MAXW = 1100;
    const place = list => {
      for (const k of list) {
        const s = tmp.get(k.id);
        if (x > PAD && x + s.w > MAXW) { x = PAD; y += rowH + GAP; rowH = 0; }
        target.set(k.id, { x, y }); x += s.w + GAP; rowH = Math.max(rowH, s.h); maxR = Math.max(maxR, x - GAP); bottom = Math.max(bottom, y + s.h);
      }
      if (list.length) { y += rowH + GAP; x = PAD; rowH = 0; }
    };
    place(ctrs); place(leaves);
    const s = { w: Math.max(CTR_MIN_W, maxR + PAD), h: Math.max(headH + CTR_MIN_BODY, kids.length ? bottom + PAD : 0), headH };
    tmp.set(n.id, s); return s;
  };
  const rs = (rootIds ? rootIds.map(nodeById).filter(Boolean) : roots()).sort(byName);
  rs.forEach(layout);
  let x = 0, y = 0, rowH = 0; const MAXW = 2400;
  for (const r of rs) {
    const s = tmp.get(r.id);
    if (x > 0 && x + s.w > MAXW) { x = 0; y += rowH + 100; rowH = 0; }
    target.set(r.id, { x, y }); x += s.w + 100; rowH = Math.max(rowH, s.h);
  }
  return target;
}
function autoLayout() {
  if (!state.nodes.length) return toast('No hay cards que ordenar');
  pushHistory();
  for (const n of state.nodes) { n.w = 0; n.h = 0; } // tamaños manuales se descartan
  const target = computeLayout();
  animateNodesTo(target, () => { save(); fitToScreen(); toast('Auto-layout aplicado (Ctrl/⌘+Z para deshacer)'); });
}
function animateNodesTo(target, done, ms = 450) {
  const start = new Map([...target.keys()].map(id => { const n = nodeById(id); return [id, { x: n.x, y: n.y }]; }));
  const t0 = performance.now(); const ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    const t = ease(clamp((now - t0) / ms, 0, 1));
    for (const [id, to] of target) { const n = nodeById(id), s = start.get(id); if (!n) continue; n.x = s.x + (to.x - s.x) * t; n.y = s.y + (to.y - s.y) * t; }
    computeSizes(); applySizes(); updateNodeTransforms(target.keys()); updateEdgePaths();
    if (t < 1) requestAnimationFrame(step);
    else { for (const [id, to] of target) { const n = nodeById(id); if (n) { n.x = Math.round(to.x); n.y = Math.round(to.y); } } renderAll(); done && done(); }
  };
  requestAnimationFrame(step);
}


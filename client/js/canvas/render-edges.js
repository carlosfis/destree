'use strict';
/* =========================================================
   6. Renderizado: aristas SVG
   ========================================================= */
function portPoint(r, side) {
  switch (side) {
    case 't': return { x: r.cx, y: r.y };
    case 'b': return { x: r.cx, y: r.y + r.h };
    case 'l': return { x: r.x, y: r.cy };
    default:  return { x: r.x + r.w, y: r.cy };
  }
}
function edgeGeometry(e) {
  const a = nodeById(e.from), b = nodeById(e.to);
  if (!a || !b) return null;
  const ra = anchorRect(a), rb = anchorRect(b);
  if (e.kind === 'ds' && b.parentId === a.id) { // el DS vive dentro de este software: tramo corto y recto
    const x = clamp(rb.x + Math.min(40, rb.w / 4), ra.x + 16, ra.x + ra.w - 16), y1 = ra.y + ra.h, y2 = rb.y; // desplazado del puerto superior
    const blocked = childrenOf(a.id).some(o => { if (o.id === b.id) return false; const r = nodeRect(o); return r.x <= x && x <= r.x + r.w && r.y < y2 && r.y + r.h > y1; });
    if (!blocked) return { d: `M${x.toFixed(1)} ${y1.toFixed(1)} L${x.toFixed(1)} ${y2.toFixed(1)}`, mid: { x, y: (y1 + y2) / 2 } };
    // Hay un hermano en medio: bajar por el margen izquierdo del contenedor y entrar por el lado izquierdo
    const xm = ra.x + 8;
    return { d: `M${xm} ${y1.toFixed(1)} L${xm} ${rb.cy.toFixed(1)} L${rb.x.toFixed(1)} ${rb.cy.toFixed(1)}`, mid: { x: xm, y: (y1 + rb.cy) / 2 } };
  }
  const dx = rb.cx - ra.cx, dy = rb.cy - ra.cy;
  // Dentro del mismo contenedor (padre → hijo) la salida es siempre por abajo de la cabecera
  const internal = isAncestor(a.id, b.id) || isAncestor(b.id, a.id);
  const vertical = internal || Math.abs(dy) > Math.abs(dx) * 1.15;
  let sa, sb;
  if (vertical) { sa = dy >= 0 ? 'b' : 't'; sb = dy >= 0 ? 't' : 'b'; }
  else { sa = dx >= 0 ? 'r' : 'l'; sb = dx >= 0 ? 'l' : 'r'; }
  const p1 = portPoint(ra, sa), p2 = portPoint(rb, sb);
  const dist = vertical ? Math.abs(p2.y - p1.y) : Math.abs(p2.x - p1.x);
  const d = Math.max(30, Math.min(160, dist / 2));
  const off = (p, s) => s === 't' ? { x: p.x, y: p.y - d } : s === 'b' ? { x: p.x, y: p.y + d } : s === 'l' ? { x: p.x - d, y: p.y } : { x: p.x + d, y: p.y };
  const c1 = off(p1, sa), c2 = off(p2, sb);
  const mid = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
  return { d: `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`, mid };
}
const SVG_NS = 'http://www.w3.org/2000/svg';
/** Dónde nació un DS: «Checkout · Portal Web» (feature + aplicativo raíz). */
function hostLabel(n) { const h = parentOf(n); if (!h) return n.name; const r = rootOf(h); return r.id === h.id ? h.name : `${h.name} · ${r.name}`; }
function edgeTitle(e) {
  const a = nodeById(e.from), b = nodeById(e.to); if (!a || !b) return '';
  if (e.kind === 'source') return `${a.name} deriva de ${b.name}`;
  return isExternalDs(e) ? `${a.name} usa ${b.name} (DS nacido en ${hostLabel(b)})` : `${a.name} usa ${b.name}`;
}
function renderEdges() {
  const seen = new Set();
  const order = { source: 0, ds: 1 };
  const sorted = [...state.edges].sort((a, b) => order[a.kind] - order[b.kind]);
  for (const e of sorted) {
    seen.add(e.id);
    let g = edgeEls.get(e.id);
    if (!g) {
      g = document.createElementNS(SVG_NS, 'g');
      g.dataset.id = e.id;
      const hit = document.createElementNS(SVG_NS, 'path'); hit.setAttribute('class', 'hit');
      const line = document.createElementNS(SVG_NS, 'path'); line.setAttribute('class', 'line');
      const text = document.createElementNS(SVG_NS, 'text');
      g.append(hit, line, text);
      edgeEls.set(e.id, g);
    }
    edgeLayer.appendChild(g);
    const ext = e.kind === 'ds' && isExternalDs(e);
    g.setAttribute('class', `edge kind-${e.kind}${ext ? ' external' : ''}`);
    g.children[2].textContent = ext ? `DS nacido en ${hostLabel(nodeById(e.to))}` : '';
    g.children[0].setAttribute('aria-label', edgeTitle(e));
  }
  for (const [id, g] of edgeEls) if (!seen.has(id)) { g.remove(); edgeEls.delete(id); }
  updateEdgePaths();
}
/** Actualiza solo la geometría (rápido, se usa durante el arrastre). */
function updateEdgePaths(nodeIds) {
  for (const e of state.edges) {
    if (nodeIds && !nodeIds.has(e.from) && !nodeIds.has(e.to)) continue;
    const g = edgeEls.get(e.id); if (!g) continue;
    const geo = edgeGeometry(e); if (!geo) continue;
    g.children[0].setAttribute('d', geo.d);
    g.children[1].setAttribute('d', geo.d);
    const text = g.children[2];
    if (text.textContent) { text.setAttribute('x', geo.mid.x); text.setAttribute('y', geo.mid.y); }
  }
}


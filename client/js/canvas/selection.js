/* =========================================================
   7. Selección y resaltado de linaje
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S, nodeById, roots, ancestorsOf, descendantsOf } from '../core/state.js';
import { sel, nodeEls, edgeEls, renderNodes } from './render-nodes.js';
import { renderEdges } from './render-edges.js';
import { drawMinimap } from './minimap.js';
import { adminPanel, renderAdmin } from '../views/admin.js';
/** Linaje de la selección: ancestros, descendientes y nodos conectados por DS / fuente. */
export function lineageSet() {
  if (!sel.nodes.size) return null;
  const L = new Set(sel.nodes);
  for (const id of sel.nodes) {
    ancestorsOf(id).forEach(x => L.add(x));
    descendantsOf(id).forEach(x => L.add(x));
    for (const e of S.state.edges) { if (e.from === id) L.add(e.to); if (e.to === id) L.add(e.from); }
  }
  return L;
}
export function applySelection() {
  const L = lineageSet();
  for (const [id, el] of nodeEls) {
    el.classList.toggle('selected', sel.nodes.has(id));
    el.classList.toggle('dim', !!L && !L.has(id));
  }
  for (const e of S.state.edges) {
    const g = edgeEls.get(e.id); if (!g) continue;
    g.classList.toggle('selected', sel.edge === e.id);
    g.classList.toggle('dim', !!L && !(L.has(e.from) && L.has(e.to)));
  }
  updateStatus();
}
export function selectOnly(id) { sel.nodes = new Set(id ? [id] : []); sel.edge = null; applySelection(); }
export function toggleSelect(id) { if (sel.nodes.has(id)) sel.nodes.delete(id); else sel.nodes.add(id); sel.edge = null; applySelection(); }
export function clearSelection() { sel.nodes.clear(); sel.edge = null; applySelection(); }
export function selectAll() { sel.nodes = new Set(roots().map(n => n.id)); sel.edge = null; applySelection(); }
export function selectEdge(id) { sel.nodes.clear(); sel.edge = id; applySelection(); }
/** Ids seleccionados sin ningún ancestro seleccionado (los que realmente se mueven). */
export function topLevelSelection() { return [...sel.nodes].filter(id => nodeById(id) && !ancestorsOf(id).some(a => sel.nodes.has(a))); }

export function updateStatus() {
  const bar = $('#statusBar');
  const r = roots().length;
  const parts = [`${r} raíz${r === 1 ? '' : 'ces'}`, `${S.state.nodes.length} cards`, `${S.state.edges.length} conexiones`];
  if (sel.nodes.size) parts.push(`${sel.nodes.size} seleccionada${sel.nodes.size > 1 ? 's' : ''}`);
  if (sel.edge) parts.push('1 conexión seleccionada');
  bar.innerHTML = parts.map(p => `<span>${esc(p)}</span>`).join('');
}

export function renderAll() {
  renderNodes();
  renderEdges();
  applySelection();
  drawMinimap();
  if ($('#adminPanel').classList.contains('open')) renderAdmin();
}


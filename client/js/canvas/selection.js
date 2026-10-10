/* =========================================================
   7. Selección y resaltado de linaje
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S, nodeById, roots, ancestorsOf, descendantsOf } from '../core/state.js';
import { sel, nodeEls, edgeEls, renderNodes } from './render-nodes.js';
import { renderEdges } from './render-edges.js';
import { drawMinimap } from './minimap.js';
import { adminPanel, renderAdmin } from '../ui/page-settings.js';
import { t } from '../core/i18n.js'; // P15
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
  const parts = [t(r === 1 ? '{n} raíz' : '{n} raíces', { n: r }), t('{n} cards', { n: S.state.nodes.length }), t('{n} conexiones', { n: S.state.edges.length })];
  if (sel.nodes.size) parts.push(t(sel.nodes.size > 1 ? '{n} seleccionadas' : '{n} seleccionada', { n: sel.nodes.size }));
  if (sel.edge) parts.push(t('1 conexión seleccionada'));
  bar.innerHTML = parts.map(p => `<span>${esc(p)}</span>`).join('');
}

/** Guía centrada cuando la página no tiene cards (editor: crear la primera Main instance; lectura: aviso). */
export function renderEmptyHint() {
  const el = $('#emptyHint'); if (!el || !S.state) return;
  const empty = S.state.nodes.length === 0;
  el.hidden = !empty;
  if (!empty) { el.innerHTML = ''; return; }
  el.innerHTML = S.readonly
    ? `<h3>${t('Esta página está vacía')}</h3><p>${t('Aún no hay cards visibles para ti. Cuando el equipo añada contenido aparecerá aquí.')}</p>`
    : `<h3>${t('Esta página está vacía')}</h3><p>${t('Crea la primera <b>Main instance</b> (un software raíz) y anida dentro sus features, Design Systems y UI Kits.')}</p><button type="button" class="btn primary" id="emptyNew">${t('＋ Nueva Main instance')}</button><p class="hint">${t('También con clic derecho en el fondo o la tecla <kbd>N</kbd>.')}</p>`;
  el.onpointerdown = e => e.stopPropagation(); // no inicia marquee ni pan
  $('#emptyNew', el)?.addEventListener('click', () => $('#btnNew').click());
}

export function renderAll() {
  renderNodes();
  renderEdges();
  applySelection();
  drawMinimap();
  renderEmptyHint();
  if ($('#adminPanel').classList.contains('open')) renderAdmin();
}


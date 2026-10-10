/* =========================================================
   3. Historial (deshacer / rehacer) basado en snapshots
   ========================================================= */
import { $, HISTORY_MAX } from './utils.js';
import { S, save } from './state.js';
import { sel } from '../canvas/render-nodes.js';
import { renderAll } from '../canvas/selection.js';
import { toast } from '../ui/theme.js';
import { t } from './i18n.js'; // P15
export const history = { past: [], future: [] };
export function snapshot() { return JSON.stringify({ nodes: S.state.nodes, edges: S.state.edges, tags: S.state.tags, branchTypes: S.state.branchTypes }); }
export function pushHistory() {
  history.past.push(snapshot());
  if (history.past.length > HISTORY_MAX) history.past.shift();
  history.future.length = 0;
  updateUndoButtons();
}
export function restoreSnapshot(snap) {
  const d = JSON.parse(snap);
  Object.assign(S.state, d);
  const ids = new Set(S.state.nodes.map(n => n.id));
  for (const id of [...sel.nodes]) if (!ids.has(id)) sel.nodes.delete(id);
  if (sel.edge && !S.state.edges.some(e => e.id === sel.edge)) sel.edge = null;
  renderAll(); save();
}
export function undo() {
  if (!history.past.length) return toast(t('Nada que deshacer'));
  history.future.push(snapshot());
  restoreSnapshot(history.past.pop());
  updateUndoButtons();
}
export function redo() {
  if (!history.future.length) return toast(t('Nada que rehacer'));
  history.past.push(snapshot());
  restoreSnapshot(history.future.pop());
  updateUndoButtons();
}
export function updateUndoButtons() {
  $('#btnUndo').disabled = !history.past.length;
  $('#btnRedo').disabled = !history.future.length;
}


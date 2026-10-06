'use strict';
/* =========================================================
   3. Historial (deshacer / rehacer) basado en snapshots
   ========================================================= */
const history = { past: [], future: [] };
function snapshot() { return JSON.stringify({ nodes: state.nodes, edges: state.edges, tags: state.tags, edgeTypes: state.edgeTypes }); }
function pushHistory() {
  history.past.push(snapshot());
  if (history.past.length > HISTORY_MAX) history.past.shift();
  history.future.length = 0;
  updateUndoButtons();
}
function restoreSnapshot(snap) {
  const d = JSON.parse(snap);
  Object.assign(state, d);
  const ids = new Set(state.nodes.map(n => n.id));
  for (const id of [...sel.nodes]) if (!ids.has(id)) sel.nodes.delete(id);
  if (sel.edge && !state.edges.some(e => e.id === sel.edge)) sel.edge = null;
  renderAll(); save();
}
function undo() {
  if (!history.past.length) return toast('Nada que deshacer');
  history.future.push(snapshot());
  restoreSnapshot(history.past.pop());
  updateUndoButtons();
}
function redo() {
  if (!history.future.length) return toast('Nada que rehacer');
  history.past.push(snapshot());
  restoreSnapshot(history.future.pop());
  updateUndoButtons();
}
function updateUndoButtons() {
  $('#btnUndo').disabled = !history.past.length;
  $('#btnRedo').disabled = !history.future.length;
}


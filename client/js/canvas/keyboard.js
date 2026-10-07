/* =========================================================
   10. Teclado
   ========================================================= */
import { $ } from '../core/utils.js';
import { viewport } from '../core/dom.js';
import { S, save, nodeById } from '../core/state.js';
import { pushHistory, undo, redo } from '../core/history.js';
import { zoomStep, setZoom, fitToScreen } from './camera.js';
import { sel, computeSizes, applySizes, clampInside, updateNodeTransforms } from './render-nodes.js';
import { updateEdgePaths } from './render-edges.js';
import { clearSelection, selectAll, topLevelSelection } from './selection.js';
import { setTool, cancelGesture } from './pointer-gestures.js';
import { closePopover, showNewMenu } from '../ui/popover.js';
import { openEditor } from '../ui/card-editor.js';
import { deleteSelection, duplicateSelection } from '../ui/node-actions.js';
import { adminPanel, toggleAdmin } from '../ui/page-settings.js';
import { openShortcuts } from '../ui/theme.js';
export function nudge(dx, dy) {
  const ids = topLevelSelection(); if (!ids.length) return;
  if (!S.nudgeTimer) pushHistory();
  clearTimeout(S.nudgeTimer); S.nudgeTimer = setTimeout(() => S.nudgeTimer = null, 700);
  for (const id of ids) { const n = nodeById(id); if (n) { n.x += dx; n.y += dy; clampInside(n); } }
  computeSizes(); applySizes(); updateNodeTransforms(ids); updateEdgePaths(); save();
}
document.addEventListener('keydown', e => {
  const t = e.target;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
  const dialogOpen = !!$('dialog[open]');
  if (e.key === 'Alt') S.altDown = true;
  if (e.key === 'Escape') {
    if (S.popoverOpen) { closePopover(); return; }
    if (dialogOpen) return;
    if (S.ptr) { cancelGesture(); return; }
    if ($('#adminPanel').classList.contains('open')) { toggleAdmin(false); return; }
    clearSelection(); return;
  }
  if (typing || dialogOpen) return;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (e.code === 'Space') { if (!S.spaceDown) { S.spaceDown = true; viewport.classList.add('space-pan'); } e.preventDefault(); return; }
  if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && key === 'y') { e.preventDefault(); redo(); return; }
  if (mod && key === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (mod && key === 'a') { e.preventDefault(); selectAll(); return; }
  if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomStep(1.2); return; }
  if (mod && e.key === '-') { e.preventDefault(); zoomStep(1 / 1.2); return; }
  if (mod && e.key === '0') { e.preventDefault(); setZoom(1); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0);
    return;
  }
  if (e.key === '?') { e.preventDefault(); openShortcuts(); return; }
  if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitToScreen(); return; }
  if (e.shiftKey && e.code === 'Digit2') { e.preventDefault(); fitToScreen([...sel.nodes]); return; }
  if (e.key === '=' || e.key === '+') { zoomStep(1.2); return; }
  if (e.key === '-') { zoomStep(1 / 1.2); return; }
  if (key === 'v') { setTool('select'); return; }
  if (key === 'h') { setTool('hand'); return; }
  if (key === 'n') { const r = $('#btnNew').getBoundingClientRect(); showNewMenu(r.left, r.bottom + 4); return; }
  if (key === 'e' || e.key === 'Enter') { if (sel.nodes.size === 1) { e.preventDefault(); openEditor([...sel.nodes][0]); } return; }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space') { S.spaceDown = false; viewport.classList.remove('space-pan'); }
  if (e.key === 'Alt') S.altDown = false;
});
window.addEventListener('blur', () => { S.spaceDown = false; S.altDown = false; viewport.classList.remove('space-pan'); });


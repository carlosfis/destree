'use strict';
/* =========================================================
   10. Teclado
   ========================================================= */
let nudgeTimer = null;
function nudge(dx, dy) {
  const ids = topLevelSelection(); if (!ids.length) return;
  if (!nudgeTimer) pushHistory();
  clearTimeout(nudgeTimer); nudgeTimer = setTimeout(() => nudgeTimer = null, 700);
  for (const id of ids) { const n = nodeById(id); if (n) { n.x += dx; n.y += dy; clampInside(n); } }
  computeSizes(); applySizes(); updateNodeTransforms(ids); updateEdgePaths(); save();
}
document.addEventListener('keydown', e => {
  const t = e.target;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
  const dialogOpen = !!$('dialog[open]');
  if (e.key === 'Alt') altDown = true;
  if (e.key === 'Escape') {
    if (popoverOpen) { closePopover(); return; }
    if (dialogOpen) return;
    if (ptr) { cancelGesture(); return; }
    if ($('#adminPanel').classList.contains('open')) { toggleAdmin(false); return; }
    clearSelection(); return;
  }
  if (typing || dialogOpen) return;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (e.code === 'Space') { if (!spaceDown) { spaceDown = true; viewport.classList.add('space-pan'); } e.preventDefault(); return; }
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
  if (e.code === 'Space') { spaceDown = false; viewport.classList.remove('space-pan'); }
  if (e.key === 'Alt') altDown = false;
});
window.addEventListener('blur', () => { spaceDown = false; altDown = false; viewport.classList.remove('space-pan'); });


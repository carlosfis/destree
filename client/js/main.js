'use strict';
/* =========================================================
   19. Botones de la UI e inicialización
   ========================================================= */
$('#btnNew').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); showNewMenu(r.left, r.bottom + 4); });
$('#btnLayout').addEventListener('click', autoLayout);
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
$('#btnHelp').addEventListener('click', openShortcuts);
$('#toolSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTool(b.dataset.tool); });
$('#zoomIn').addEventListener('click', () => zoomStep(1.25));
$('#zoomOut').addEventListener('click', () => zoomStep(1 / 1.25));
$('#zoomFit').addEventListener('click', () => fitToScreen());
$('#zoomLabel').addEventListener('click', () => setZoom(1));
viewport.addEventListener('pointerdown', () => { if (innerWidth <= 720 && adminPanel.classList.contains('open')) toggleAdmin(false); });

function init() {
  applyTheme();
  measureViewport();
  applySettingsUI();
  renderAll();
  updateUndoButtons();
  if (firstRun) {
    // Primera carga: acomodar el ejemplo y encuadrarlo
    const target = computeLayout();
    for (const [id, p] of target) { const n = nodeById(id); n.x = p.x; n.y = p.y; }
    renderAll();
    fitToScreen(null, false);
    persist();
  } else applyCamera();
  setSaveStatus('Guardado');
}
init();

/* =========================================================
   19. Botones de la UI e inicialización
   ========================================================= */
import { $ } from './core/utils.js';
import { viewport } from './core/dom.js';
import { S, persist, setSaveStatus, nodeById, bootstrap } from './core/state.js';
import { undo, redo, updateUndoButtons } from './core/history.js';
import { measureViewport, applyCamera, zoomStep, setZoom, fitToScreen } from './canvas/camera.js';
import { renderAll, clearSelection } from './canvas/selection.js';
import { setTool } from './canvas/pointer-gestures.js';
import { showNewMenu } from './ui/popover.js';
import { adminPanel, toggleAdmin, applySettingsUI } from './views/admin.js';
import { computeLayout, autoLayout } from './canvas/layout.js';
import { applyTheme, openShortcuts } from './ui/theme.js';
import './canvas/keyboard.js'; // solo efectos (listeners)
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

export async function init() {
  measureViewport(); // F0b: antes era eager en camera.js (S.vpRect); debe preceder a applyTheme → drawMinimap
  await bootstrap(); // F1: documento desde la API (o localStorage si no hay servidor)
  applyTheme();
  applySettingsUI();
  renderAll();
  updateUndoButtons();
  if (S.firstRun) {
    // Primera carga: acomodar el ejemplo y encuadrarlo
    const target = computeLayout();
    for (const [id, p] of target) { const n = nodeById(id); n.x = p.x; n.y = p.y; }
    renderAll();
    fitToScreen(null, false);
    persist();
  } else applyCamera();
  setSaveStatus(S.offline ? 'Sin conexión' : 'Guardado');
}
// F1: tras un 409 state.js recarga el documento del servidor y avisa aquí para repintar.
document.addEventListener('destree:reload', () => { clearSelection(); applyTheme(); applySettingsUI(); renderAll(); applyCamera(); });
init();


if (['localhost', '127.0.0.1'].includes(location.hostname)) window.S = S; // solo depuración en dev
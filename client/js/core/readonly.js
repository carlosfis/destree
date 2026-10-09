/* =========================================================
   F2. Modo lectura (viewer, sin `pages.edit`): sin edición, sin menús, sin PUT. P10: sus propias cards (responsable/asignado) abren el editor acotado (`nodes.own`).
   ========================================================= */
import { $ } from './utils.js';
import { viewport } from './dom.js';
import { S, isMyNode } from './state.js';
import { setTool } from '../canvas/pointer-gestures.js';
import { sel } from '../canvas/render-nodes.js';
import { openNodeView } from '../ui/node-view.js';
import { openEditor } from '../ui/card-editor.js';
import { isDrawerOpen, closeDrawer } from '../ui/node-drawer.js';

export const canEdit = () => !S.session || S.session.permissions.includes('pages.edit');
/** P10: en modo lectura, la ficha de una card propia se abre como editor acotado. */
const openCard = id => (isMyNode(id) && S.session?.permissions.includes('nodes.own') ? openEditor(id) : openNodeView(id));
const ALLOWED_KEYS = new Set(['Escape', '?', '+', '=', '-', '0', ' ', 'h', 'H', 'Shift', 'Meta', 'Control', 'Alt']);
const block = e => { e.stopImmediatePropagation(); e.preventDefault(); };

/** Desactiva pointer (puertos, resize, menús, editor), teclado de edición y botones; deja pan/zoom/tema. */
export function applyReadonly() {
  S.readonly = true;
  document.body.classList.add('viewer');
  ['#btnNew', '#btnLayout', '#btnUndo', '#btnRedo', '#btnAdmin', '#toolSeg'].forEach(s => { const el = $(s); if (el) el.hidden = true; });
  setTool('hand');
  viewport.addEventListener('contextmenu', block, true);
  viewport.addEventListener('dblclick', e => { block(e); const node = e.target.closest('.node'); if (node) openCard(node.dataset.id); }, true); // F3: ficha de lectura · P10: editor si es propia
  viewport.addEventListener('pointerdown', e => { if (e.target.closest('.port, .resize, [data-action]')) block(e); }, true);
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || $('dialog[open]');
    if (typing) return;
    if (e.key === 'Escape' && isDrawerOpen()) { block(e); closeDrawer(); return; }
    if (e.shiftKey && (e.code === 'Digit1' || e.code === 'Digit2')) return;
    if (e.key === 'Enter' && sel.nodes.size === 1) { block(e); openCard([...sel.nodes][0]); return; }
    if (!ALLOWED_KEYS.has(e.key)) block(e);
  }, true);
}

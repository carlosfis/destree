/* =========================================================
   F2. Modo lectura (designer): sin edición, sin menús, sin PUT
   ========================================================= */
import { $ } from './utils.js';
import { viewport } from './dom.js';
import { S } from './state.js';
import { setTool } from '../canvas/pointer-gestures.js';

export const canEdit = () => !S.session || S.session.permissions.includes('pages.edit');
const ALLOWED_KEYS = new Set(['Escape', '?', '+', '=', '-', '0', ' ', 'h', 'H', 'Shift', 'Meta', 'Control', 'Alt']);
const block = e => { e.stopImmediatePropagation(); e.preventDefault(); };

/** Desactiva pointer (puertos, resize, menús, editor), teclado de edición y botones; deja pan/zoom/tema. */
export function applyReadonly() {
  S.readonly = true;
  document.body.classList.add('viewer');
  ['#btnNew', '#btnLayout', '#btnUndo', '#btnRedo', '#btnAdmin', '#toolSeg'].forEach(s => { const el = $(s); if (el) el.hidden = true; });
  setTool('hand');
  viewport.addEventListener('contextmenu', block, true);
  viewport.addEventListener('dblclick', block, true);
  viewport.addEventListener('pointerdown', e => { if (e.target.closest('.port, .resize, [data-action]')) block(e); }, true);
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || $('dialog[open]');
    if (typing) return;
    if (e.shiftKey && (e.code === 'Digit1' || e.code === 'Digit2')) return;
    if (!ALLOWED_KEYS.has(e.key)) block(e);
  }, true);
}

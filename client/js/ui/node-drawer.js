/* =========================================================
   Sidebar de instancia (#nodeDrawer): sustituye al modal para editar (Main/Child instance) y para la ficha de lectura.
   Cabecera + pestañas (General · Staff · Documentación · Notas) + cuerpo con un panel por pestaña + pie opcional.
   ========================================================= */
import { $, $$ } from '../core/utils.js';

export const nodeDrawer = $('#nodeDrawer');
export const isDrawerOpen = () => nodeDrawer.classList.contains('open');
export const TABS = [{ id: 'general', label: 'General' }, { id: 'staff', label: 'Staff' }, { id: 'docs', label: 'Documentación' }, { id: 'notes', label: 'Notas' }];
/** Título homologado: raíz → Main instance; cualquier card con contenedor → Child instance. */
export const instanceLabel = parentId => (parentId ? 'Child instance' : 'Main instance');

/** Markup completo del sidebar. `panes` = { tabId: html }. `tag` = 'form' (editor) | 'div' (ficha). */
export function drawerHTML({ title, badge = '', tabs = TABS, panes, footer = '', tag = 'form', id = '', cls = '' }) {
  return `<${tag}${id ? ` id="${id}"` : ''} class="drawer-inner ${cls}">
    <header>${badge}<h2 id="drawerTitle">${title}</h2><button type="button" class="icon-btn" data-cancel title="Cerrar (Esc)" aria-label="Cerrar">✕</button></header>
    <nav class="tabs drawer-tabs">${tabs.map((t, i) => `<button type="button" data-tab="${t.id}" class="${i === 0 ? 'active' : ''}">${t.label}</button>`).join('')}</nav>
    <div class="dialog-body drawer-body">${tabs.map((t, i) => `<section class="tab-pane" data-pane="${t.id}"${i ? ' hidden' : ''}>${panes[t.id] || ''}</section>`).join('')}</div>
    ${footer ? `<footer>${footer}</footer>` : ''}
  </${tag}>`;
}
/** Abre el sidebar con `html`; `onClose` se ejecuta una vez al cerrar. Devuelve el elemento interior (form o div). */
export function openDrawer(html, { onClose = null } = {}) {
  closeDrawer();
  clearTimeout(nodeDrawer._clear);
  nodeDrawer.innerHTML = html;
  nodeDrawer._onClose = onClose;
  $('.drawer-tabs', nodeDrawer)?.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $$('[data-cancel]', nodeDrawer).forEach(b => b.addEventListener('click', closeDrawer));
  $('#adminPanel')?.classList.remove('open'); // un solo panel lateral a la vez
  nodeDrawer.classList.add('open');
  return nodeDrawer.firstElementChild;
}
export function closeDrawer() {
  if (!isDrawerOpen()) return;
  nodeDrawer.classList.remove('open');
  const fn = nodeDrawer._onClose; nodeDrawer._onClose = null; if (fn) fn();
  nodeDrawer._clear = setTimeout(() => { if (!isDrawerOpen()) nodeDrawer.innerHTML = ''; }, 260); // tras la transición
}
export function showTab(id) {
  $$('.drawer-tabs button', nodeDrawer).forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $$('.tab-pane', nodeDrawer).forEach(p => { p.hidden = p.dataset.pane !== id; });
}
/** Pestaña que contiene un elemento (para llevar al usuario al error de validación). */
export const tabOf = el => el?.closest('.tab-pane')?.dataset.pane || null;

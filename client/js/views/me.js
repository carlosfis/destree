/* =========================================================
   F3. "Mis asignaciones" (#/me): nodos donde el usuario está asignado o es responsable; deep-link #/n/<id> centra el nodo
   ========================================================= */
import { $, esc, TYPE_META } from '../core/utils.js';
import { S, nodeById, myNodes, rootOf } from '../core/state.js';
import * as api from '../core/api.js';
import { fitToScreen } from '../canvas/camera.js';
import { selectOnly, renderAll } from '../canvas/selection.js';
import { openNodeView } from '../ui/node-view.js';
import { pathOf, editorDialog } from '../ui/card-editor.js';
import { t } from '../core/i18n.js'; // P15

/** Centra y selecciona un nodo; abre su ficha. Devuelve false si no existe (o no es visible). */
export function goToNode(id, view = true) {
  const n = nodeById(id); if (!n) return false;
  if (editorDialog.open) editorDialog.close();
  selectOnly(id); renderAll(); fitToScreen([id]);
  if (view) setTimeout(() => openNodeView(id), 350);
  return true;
}

/** F4a: asignaciones en todas las páginas visibles (API); sin servidor, las de la página actual. */
export async function assignmentItems() {
  if (!S.offline) { try { return await api.myAssignments(); } catch { /* cae a local */ } }
  const me = S.session?.user.id;
  return myNodes().map(n => ({ pageId: S.pageId, pageName: S.state.page.name, pageStatus: 'active', nodeId: n.id, name: n.name, type: n.type, isRoot: !n.parentId, role: n.ownerUserId === me ? 'owner' : 'assignee', path: n.parentId ? pathOf(rootOf(n)) : '' }));
}
export const assignmentHTML = items => (items.length ? `<ul class="me-list">${items.map(a => `<li><a href="#/p/${encodeURIComponent(a.pageId)}/n/${encodeURIComponent(a.nodeId)}"><span class="type-badge">${TYPE_META[a.type].label}</span><b>${esc(a.name)}</b><span class="url">${esc(a.pageName)}${a.pageStatus === 'archived' ? ' ' + t('(archivada)') : ''}${a.path ? ' › ' + esc(a.path) : ''}</span><span class="chip tag-gray">${a.role === 'owner' ? t('responsable') : t('asignado')}</span></a></li>`).join('')}</ul>` : `<div class="empty">${t('No tienes cards asignadas.')}</div>`);

export async function openMyAssignments() {
  if (!S.session) return;
  const items = await assignmentItems();
  editorDialog.innerHTML = `<div class="dialog-inner node-view">
    <header><h2>${t('Mis asignaciones')}</h2><button type="button" class="icon-btn" data-cancel aria-label="${t('Cerrar')}">✕</button></header>
    <div class="dialog-body">
      <p class="hint">${t('Cards donde eres responsable o estás asignado, en todas las páginas que puedes ver.')}</p>
      ${assignmentHTML(items)}
    </div>
    <footer><button type="button" class="btn" data-cancel>${t('Cerrar')}</button></footer>
  </div>`;
  editorDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => { editorDialog.close(); if (location.hash === '#/me') history.replaceState(null, '', location.pathname); }));
  $('.me-list', editorDialog)?.addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); editorDialog.close(); location.hash = a.getAttribute('href'); });
  editorDialog.showModal();
}

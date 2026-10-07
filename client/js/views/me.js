/* =========================================================
   F3. "Mis asignaciones" (#/me): nodos donde el usuario está asignado o es responsable; deep-link #/n/<id> centra el nodo
   ========================================================= */
import { $, esc, TYPE_META } from '../core/utils.js';
import { S, nodeById, myNodes, rootOf } from '../core/state.js';
import { fitToScreen } from '../canvas/camera.js';
import { selectOnly, renderAll } from '../canvas/selection.js';
import { openNodeView } from '../ui/node-view.js';
import { pathOf, editorDialog } from '../ui/card-editor.js';

/** Centra y selecciona un nodo; abre su ficha. Devuelve false si no existe (o no es visible). */
export function goToNode(id, view = true) {
  const n = nodeById(id); if (!n) return false;
  if (editorDialog.open) editorDialog.close();
  selectOnly(id); renderAll(); fitToScreen([id]);
  if (view) setTimeout(() => openNodeView(id), 350);
  return true;
}

export function openMyAssignments() {
  if (!S.session) return;
  const mine = myNodes();
  const me = S.session.user.id;
  editorDialog.innerHTML = `<div class="dialog-inner node-view">
    <header><h2>Mis asignaciones</h2><button type="button" class="icon-btn" data-cancel>✕</button></header>
    <div class="dialog-body">
      <p class="hint">Cards donde eres responsable o estás asignado en esta página (${esc(S.state.page.name)}).</p>
      ${mine.length ? `<ul class="me-list">${mine.map(n => `<li><a href="#/n/${encodeURIComponent(n.id)}" data-id="${n.id}"><span class="type-badge">${TYPE_META[n.type].label}</span><b>${esc(n.name)}</b>${n.parentId ? `<span class="url">${esc(pathOf(rootOf(n)))}</span>` : ''}<span class="chip tag-gray">${n.ownerUserId === me ? 'responsable' : 'asignado'}</span></a></li>`).join('')}</ul>` : '<div class="empty">No tienes cards asignadas en esta página.</div>'}
    </div>
    <footer><button type="button" class="btn" data-cancel>Cerrar</button></footer>
  </div>`;
  editorDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => { editorDialog.close(); if (location.hash === '#/me') history.replaceState(null, '', location.pathname); }));
  $('.me-list', editorDialog)?.addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); location.hash = a.getAttribute('href'); });
  editorDialog.showModal();
}

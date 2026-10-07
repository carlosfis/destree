/* =========================================================
   F3. Ficha de nodo en modo lectura (designer: doble clic / Enter / #/n/<id>); docs[] + notas en markdown
   ========================================================= */
import { $, esc, TYPE_META } from '../core/utils.js';
import { S, nodeById, tagById, rootOf, userName, cellById } from '../core/state.js';
import { renderMarkdown } from './markdown.js';
import { editorDialog, pathOf } from './card-editor.js';

const VIS_LABEL = { org: 'Toda la organización', cells: 'Solo células', inherit: 'Hereda de la raíz' };
const SAFE_URL = /^https?:\/\//i;

export function openNodeView(id) {
  const n = nodeById(id); if (!n) return;
  const root = rootOf(n);
  const tags = n.tags.map(tagById).filter(Boolean);
  const people = (n.assigneeIds || []).map(u => `<span class="chip tag-gray person">${esc(userName(u))}</span>`).join('');
  const cells = (root.cellIds || []).map(c => cellById(c)).filter(Boolean).map(c => `<span class="chip tag-${esc(c.color)}">${esc(c.name)}</span>`).join('');
  const docs = (n.docs || []).filter(d => SAFE_URL.test(d.url)).map(d => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.label || d.url)}</a><span class="url">${esc(d.url)}</span></li>`).join('');
  editorDialog.innerHTML = `<div class="dialog-inner node-view">
    <header><h2><span class="type-badge">${TYPE_META[n.type].label}</span> ${esc(n.name)}</h2><button type="button" class="icon-btn" data-cancel>✕</button></header>
    <div class="dialog-body">
      ${n.parentId ? `<div class="hint">${esc(pathOf(n))}</div>` : ''}
      ${n.description ? `<p class="desc">${esc(n.description)}</p>` : ''}
      ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="chip tag-${t.color}">${esc(t.name)}</span>`).join('')}</div>` : ''}
      <dl class="meta">
        <dt>Responsable</dt><dd>${n.ownerUserId ? esc(userName(n.ownerUserId)) : (n.owner ? esc(n.owner) : '—')}</dd>
        <dt>Asignados</dt><dd>${people || '—'}</dd>
        <dt>Visibilidad</dt><dd>${esc(VIS_LABEL[root.visibility] || root.visibility)}${root.visibility === 'cells' ? ` ${cells || '<span class="hint">(sin células)</span>'}` : ''}${n.parentId ? ` <span class="hint">(raíz: ${esc(root.name)})</span>` : ''}</dd>
        ${n.hasExternalRefs ? '<dt>Conexiones</dt><dd class="hint">Tiene conexiones con elementos que no puedes ver.</dd>' : ''}
      </dl>
      <h3>Enlaces</h3>${docs ? `<ul class="doc-list">${docs}</ul>` : '<div class="empty">Sin enlaces.</div>'}
      <h3>Notas</h3>${n.notes ? `<div class="md">${renderMarkdown(n.notes)}</div>` : '<div class="empty">Sin notas.</div>'}
    </div>
    <footer><button type="button" class="btn" data-cancel>Cerrar</button></footer>
  </div>`;
  editorDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => editorDialog.close()));
  editorDialog.showModal();
  $('footer .btn', editorDialog).focus();
}

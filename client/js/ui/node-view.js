/* =========================================================
   F3. Ficha de instancia en modo lectura (designer: doble clic / Enter / #/n/<id>) en el sidebar, con las mismas pestañas del editor
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S, nodeById, tagById, rootOf, userName, cellById, typeName } from '../core/state.js';
import { renderMarkdown } from './markdown.js';
import { pathOf } from './card-editor.js';
import { imageSrc } from './uploader.js';
import { drawerHTML, openDrawer, instanceLabel } from './node-drawer.js';

const VIS_LABEL = { org: 'Toda la organización', cells: 'Solo células', inherit: 'Hereda de la raíz' };
const SAFE_URL = /^https?:\/\//i;

export function openNodeView(id) {
  const n = nodeById(id); if (!n) return;
  const root = rootOf(n);
  const tags = n.tags.map(tagById).filter(Boolean);
  const img = imageSrc(n, 'full');
  const people = (n.assigneeIds || []).map(u => `<span class="chip tag-gray person">${esc(userName(u))}</span>`).join('');
  const cells = (root.cellIds || []).map(c => cellById(c)).filter(Boolean).map(c => `<span class="chip tag-${esc(c.color)}">${esc(c.name)}</span>`).join('');
  const staff = (n.staff && n.staff.length ? n.staff : (n.owner ? [{ name: n.owner, role: '' }] : [])).map(m => `<li><span class="owner">${esc(m.name)}</span>${m.role ? `<span class="role">${esc(m.role)}</span>` : ''}</li>`).join('');
  const docs = (n.docs || []).filter(d => SAFE_URL.test(d.url)).map(d => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.label || d.url)}</a><span class="url">${esc(d.url)}</span></li>`).join('');
  const panes = {
    general: `${img ? `<div class="hero"><img src="${img}" alt=""></div>` : ''}
      <dl class="meta">
        <dt>Tipo</dt><dd>${esc(typeName(n.type))}</dd>
        <dt>Nombre</dt><dd>${esc(n.name)}</dd>
        <dt>Contenedor padre</dt><dd>${n.parentId ? esc(pathOf(nodeById(n.parentId))) : '— (raíz)'}</dd>
        ${n.hasExternalRefs ? '<dt>Conexiones</dt><dd class="hint">Tiene conexiones con elementos que no puedes ver.</dd>' : ''}
      </dl>
      ${n.description ? `<p class="desc">${esc(n.description)}</p>` : ''}
      ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="chip tag-${t.color}">${esc(t.name)}</span>`).join('')}</div>` : ''}`,
    staff: `<h3 class="section">Staff</h3>${staff ? `<ul class="staff-list">${staff}</ul>` : '<div class="empty">Sin staff.</div>'}
      <dl class="meta">
        <dt>Responsable</dt><dd>${n.ownerUserId ? esc(userName(n.ownerUserId)) : '—'}</dd>
        <dt>Asignados</dt><dd>${people || '—'}</dd>
        <dt>Visibilidad</dt><dd>${esc(VIS_LABEL[root.visibility] || root.visibility)}${root.visibility === 'cells' ? ` ${cells || '<span class="hint">(sin células)</span>'}` : ''}${n.parentId ? ` <span class="hint">(raíz: ${esc(root.name)})</span>` : ''}</dd>
      </dl>`,
    docs: docs ? `<ul class="doc-list">${docs}</ul>` : '<div class="empty">Sin enlaces.</div>',
    notes: n.notes ? `<div class="md">${renderMarkdown(n.notes)}</div>` : '<div class="empty">Sin notas.</div>',
  };
  const badge = `<span class="type-badge">${esc(typeName(n.type))}</span>`;
  openDrawer(drawerHTML({ title: `${instanceLabel(n.parentId)} · ${esc(n.name)}`, badge, panes, footer: '<button type="button" class="btn" data-cancel>Cerrar</button>', tag: 'div', cls: 'node-view' }));
  $('#nodeDrawer footer .btn').focus();
}

/* =========================================================
   F3. Secciones del editor de card: documentación (docs[] + notas), equipo (responsable, asignados) y visibilidad de raíz
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';

const row = (d, i) => `<div class="doc-row" data-i="${i}"><input class="doc-label" maxlength="80" placeholder="Etiqueta" value="${esc(d.label)}"><input class="doc-url" type="url" maxlength="2048" placeholder="https://…" value="${esc(d.url)}"><button type="button" class="icon-btn doc-del" title="Quitar">🗑</button></div>`;

/** HTML de documentación. `bind(form)` conecta añadir/quitar; `read(form)` devuelve { docs, notes }. */
export function docsSection(draft) {
  const html = `<div class="field"><label>Enlaces de documentación <span class="counter" id="fDocCount">${draft.docs.length}/20</span></label>
      <div id="fDocs">${draft.docs.map(row).join('')}</div>
      <button type="button" class="btn" id="fDocAdd">＋ Añadir enlace</button><div class="hint">Figma, Notion, repositorio, Storybook… Solo http(s).</div></div>
    <div class="field"><label>Notas <span class="counter" id="fNotesCount">${draft.notes.length}/4000</span></label>
      <textarea name="notes" maxlength="4000" rows="5" placeholder="Markdown básico: # títulos, - listas, [enlace](https://…), \`código\`, **negrita**">${esc(draft.notes)}</textarea></div>`;
  const bind = form => {
    const box = $('#fDocs', form), count = () => { $('#fDocCount', form).textContent = `${box.children.length}/20`; $('#fDocAdd', form).disabled = box.children.length >= 20; };
    $('#fDocAdd', form).addEventListener('click', () => { if (box.children.length >= 20) return; box.insertAdjacentHTML('beforeend', row({ label: '', url: '' }, box.children.length)); count(); box.lastElementChild.querySelector('.doc-url').focus(); });
    box.addEventListener('click', e => { const b = e.target.closest('.doc-del'); if (b) { b.parentElement.remove(); count(); } });
    form.notes.addEventListener('input', () => { $('#fNotesCount', form).textContent = `${form.notes.value.length}/4000`; });
    count();
  };
  const read = form => ({
    docs: [...form.querySelectorAll('.doc-row')].map(r => ({ label: r.querySelector('.doc-label').value.trim().slice(0, 80), url: r.querySelector('.doc-url').value.trim().slice(0, 2048) })).filter(d => /^https?:\/\//i.test(d.url)).slice(0, 20),
    notes: form.notes.value.slice(0, 4000),
  });
  return { html, bind, read };
}

/** Responsable (usuario) + asignados; solo con directorio (admin/head). */
export function teamSection(draft) {
  const users = S.userDir || [];
  if (!users.length) return { html: '', read: () => ({}) };
  const opt = u => `<option value="${u.id}" ${u.id === draft.ownerUserId ? 'selected' : ''}>${esc(u.name)}</option>`;
  const html = `<div class="field"><label>Responsable (usuario)</label><select name="ownerUserId"><option value="">— Sin responsable —</option>${users.map(opt).join('')}</select></div>
    <div class="field"><label>Asignados</label><div class="check-list" id="fAssignees">${users.map(u => `<label><input type="checkbox" value="${u.id}" ${(draft.assigneeIds || []).includes(u.id) ? 'checked' : ''}>${esc(u.name)}<span class="where">${esc(u.role)}</span></label>`).join('')}</div>
      <div class="hint">Un designer asignado ve la raíz completa aunque sea solo-células.</div></div>`;
  const read = form => ({ ownerUserId: form.ownerUserId.value || null, assigneeIds: [...form.querySelectorAll('#fAssignees input:checked')].map(i => i.value) });
  return { html, read };
}

/** Visibilidad de raíz: org | cells (+ células). Se oculta si el nodo no es raíz software. */
export function visibilitySection(draft) {
  const cells = S.cellList || [];
  const html = `<div class="field" id="fVisField"><label>Visibilidad de la raíz</label>
      <div class="segmented" id="fVis"><button type="button" data-v="org" class="${draft.visibility !== 'cells' ? 'active' : ''}">Toda la organización</button><button type="button" data-v="cells" class="${draft.visibility === 'cells' ? 'active' : ''}">Solo células</button></div>
      <div class="check-list" id="fCells" ${draft.visibility === 'cells' ? '' : 'hidden'}>${cells.length ? cells.map(c => `<label><input type="checkbox" value="${c.id}" ${(draft.cellIds || []).includes(c.id) ? 'checked' : ''}><span class="t-dot tag-${esc(c.color)}"></span>${esc(c.name)}</label>`).join('') : '<div class="empty">No hay células: créalas en Administrar → Células.</div>'}</div>
      <div class="hint">Los hijos heredan la visibilidad de su raíz. Los asignados y responsables siempre la ven.</div></div>`;
  const bind = form => {
    $('#fVis', form).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      form.querySelectorAll('#fVis button').forEach(x => x.classList.toggle('active', x === b));
      $('#fCells', form).hidden = b.dataset.v !== 'cells';
    });
  };
  const read = (form, isRoot) => {
    if (!isRoot) return { visibility: 'inherit', cellIds: [] };
    const vis = form.querySelector('#fVis button.active')?.dataset.v === 'cells' ? 'cells' : 'org';
    return { visibility: vis, cellIds: vis === 'cells' ? [...form.querySelectorAll('#fCells input:checked')].map(i => i.value) : [] };
  };
  return { html, bind, read };
}

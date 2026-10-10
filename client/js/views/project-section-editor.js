/* =========================================================
   P11. Editor de una sección del Overview en #projectDialog: título + campos según el tipo (SPEC de project-template.js):
   textos sueltos (textarea / input) y listas de ítems con columnas (añadir / quitar filas). Guardar → PATCH; Eliminar → DELETE.
   ========================================================= */
import { $, $$, esc } from '../core/utils.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox } from '../ui/dialogs.js';
import { SPEC, KIND_LABEL, MAX_ITEMS } from '../core/project-template.js';

export const projectDialog = $('#projectDialog');
const COL_LABEL = { emoji: 'Icono', label: 'Etiqueta', url: 'URL (https://…)', value: 'Valor', text: 'Texto', code: 'Código', title: 'Título', done: 'Hecho', status: 'Estado', name: '@Nombre', role: 'Rol', quote: 'Cita', highlight: 'Texto a resaltar (parte de la cita)' };
const LIST_LABEL = { items: 'Elementos', metrics: 'Métricas' };
const LONG = new Set(['text', 'quote']);
const wide = k => (k === 'text' || k === 'url' ? 'wide' : k === 'emoji' || k === 'code' || k === 'done' ? 'narrow' : '');

const rowHTML = (cols, it = {}) => `<div class="pj-row">${Object.entries(cols).map(([k, r]) => r === 'bool'
  ? `<label class="pj-cell narrow" title="${esc(COL_LABEL[k])}"><input type="checkbox" data-col="${k}" ${it[k] ? 'checked' : ''}></label>`
  : `<input class="pj-cell ${wide(k)}" data-col="${k}" maxlength="${r}" placeholder="${esc(COL_LABEL[k] || k)}" value="${esc(it[k] || '')}" autocomplete="off">`).join('')}<button type="button" class="icon-btn pj-row-del" title="Quitar" aria-label="Quitar">🗑</button></div>`;

function fieldsHTML(kind, data) {
  return Object.entries(SPEC[kind]).map(([key, rule]) => {
    if (typeof rule === 'number') return LONG.has(key)
      ? `<div class="field"><label>${esc(COL_LABEL[key] || key)}</label><textarea name="${key}" maxlength="${rule}" rows="${key === 'text' ? 6 : 3}">${esc(data[key] || '')}</textarea></div>`
      : `<div class="field"><label>${esc(COL_LABEL[key] || key)}</label><input name="${key}" maxlength="${rule}" value="${esc(data[key] || '')}" autocomplete="off"></div>`;
    if (rule === 'bool') return '';
    return `<div class="field"><label>${esc(LIST_LABEL[key] || key)} <span class="counter" data-count="${key}"></span></label><div class="pj-rows" data-list="${key}">${(data[key] || []).map(it => rowHTML(rule, it)).join('')}</div><button type="button" class="btn" data-add="${key}">＋ Añadir</button></div>`;
  }).join('');
}
function readData(form, kind) {
  const out = {};
  for (const [key, rule] of Object.entries(SPEC[kind])) {
    if (typeof rule === 'number') out[key] = form.elements[key].value.slice(0, rule);
    else if (rule !== 'bool') out[key] = $$(`[data-list="${key}"] .pj-row`, form).map(r => Object.fromEntries(Object.keys(rule).map(k => { const el = r.querySelector(`[data-col="${k}"]`); return [k, el.type === 'checkbox' ? el.checked : el.value.trim()]; })));
  }
  return out;
}
/** Abre el editor de `sec`; al guardar o eliminar llama a ctx.refresh(). */
export function openSectionEditor(sec, ctx) {
  projectDialog.innerHTML = `<form class="dialog-inner pj-editor"><header><h2>Editar sección</h2><button type="button" class="icon-btn" data-cancel aria-label="Cerrar">✕</button></header>
    <div class="dialog-body">
      <div class="field"><label>Título <span class="hint">${esc(KIND_LABEL[sec.kind])}</span></label><input name="title" maxlength="80" value="${esc(sec.title)}" autocomplete="off"></div>
      ${fieldsHTML(sec.kind, sec.data || {})}
    </div>
    <footer><button type="button" class="btn danger left" data-del>Eliminar sección</button><button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn primary">Guardar</button></footer></form>`;
  const form = $('form', projectDialog);
  const counts = () => $$('[data-count]', form).forEach(c => { const n = $$(`[data-list="${c.dataset.count}"] .pj-row`, form).length; c.textContent = `${n}/${MAX_ITEMS}`; const b = $(`[data-add="${c.dataset.count}"]`, form); if (b) b.disabled = n >= MAX_ITEMS; });
  form.addEventListener('click', e => {
    const add = e.target.closest('[data-add]'); if (add) { const list = $(`[data-list="${add.dataset.add}"]`, form); if (list.children.length >= MAX_ITEMS) return; list.insertAdjacentHTML('beforeend', rowHTML(SPEC[sec.kind][add.dataset.add])); counts(); list.lastElementChild.querySelector('input:not([type=checkbox])')?.focus(); return; }
    const del = e.target.closest('.pj-row-del'); if (del) { del.parentElement.remove(); counts(); }
  });
  const close = () => projectDialog.close();
  $$('[data-cancel]', form).forEach(b => b.addEventListener('click', close));
  projectDialog.oncancel = ev => { ev.preventDefault(); close(); };
  $('[data-del]', form).addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'Eliminar sección', message: `«${sec.title || KIND_LABEL[sec.kind]}» desaparecerá del overview.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] });
    if (!ok) return;
    try { await api.deleteSection(ctx.pid, ctx.nid, sec.id); close(); toast('Sección eliminada'); await ctx.refresh(); } catch (err) { toast(err.message, 'error', 5000); }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('[type=submit]', form); btn.disabled = true;
    try { await api.updateSection(ctx.pid, ctx.nid, sec.id, { title: form.elements.title.value.trim().slice(0, 80), data: readData(form, sec.kind) }); close(); toast('Sección guardada'); await ctx.refresh(); }
    catch (err) { toast('No se pudo guardar: ' + err.message, 'error', 6000); btn.disabled = false; }
  });
  counts();
  projectDialog.showModal();
  form.elements.title.focus();
}

/* =========================================================
   P11. Diálogos del cronograma / kanban en #projectDialog: actividad (título, descripción, siglas, @responsable, fase, fechas, estado),
   fase (nombre + color de la paleta) y numeración de sprints. Cada guardado llama a ctx.refresh().
   ========================================================= */
import { $, $$, esc, applyDataStyles } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox } from '../ui/dialogs.js';
import { STATUSES, STATUS_META, PHASE_COLORS } from '../core/project-template.js';

const dlg = () => $('#projectDialog');
const TAGS = ['UX', 'UI', 'PD', 'PO', 'CL', 'QA', 'DEV', 'AN'];
/** Formulario modal genérico: `html` = cuerpo + pie; `onSubmit(form)` puede lanzar (se muestra el error y el diálogo sigue abierto). */
function openForm({ title, html, onSubmit, focus = 'input, textarea, select' }) {
  const d = dlg();
  d.innerHTML = `<form class="dialog-inner pj-editor"><header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-cancel aria-label="Cerrar">✕</button></header>${html}</form>`;
  const form = $('form', d); applyDataStyles(form);
  const close = () => d.close();
  $$('[data-cancel]', form).forEach(b => b.addEventListener('click', close));
  d.oncancel = ev => { ev.preventDefault(); close(); };
  form.addEventListener('submit', async e => {
    e.preventDefault(); const btn = $('[type=submit]', form); if (btn) btn.disabled = true;
    try { await onSubmit(form); close(); } catch (err) { toast('No se pudo guardar: ' + err.message, 'error', 6000); if (btn) btn.disabled = false; }
  });
  d.showModal(); $(focus, form)?.focus();
  return { form, close };
}
/** Nombres sugeridos para @responsable: staff de la card, usuarios citados/directorio y @Todos. */
function assigneeOptions(node) {
  const names = new Set(['@Todos']);
  for (const m of node.staff || []) if (m.name) names.add(m.name);
  for (const u of [...(S.userDir || []), ...(S.docRefs?.users || [])]) if (u.name) names.add('@' + u.name);
  if (S.session?.user?.name) names.add('@' + S.session.user.name);
  return [...names];
}
/** Crear (activity=null, con `preset`) o editar una actividad. `readOnly` para quien no puede editar. */
export function openActivityDialog({ activity = null, preset = {}, readOnly = false }, ctx) {
  const a = { title: '', description: '', tag: '', assignee: '', phaseId: null, startDate: '', endDate: '', status: 'todo', ...preset, ...(activity || {}) };
  const dis = readOnly ? 'disabled' : '';
  const html = `<div class="dialog-body">
      <div class="field"><label>Título *</label><input name="title" maxlength="120" value="${esc(a.title)}" required ${dis} autocomplete="off"></div>
      <div class="field"><label>Descripción</label><textarea name="description" maxlength="600" rows="3" ${dis}>${esc(a.description)}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Siglas (círculo)</label><input name="tag" maxlength="4" list="pjTags" value="${esc(a.tag)}" placeholder="UX" ${dis} autocomplete="off"><datalist id="pjTags">${TAGS.map(t => `<option value="${t}">`).join('')}</datalist></div>
        <div class="field"><label>@Responsable</label><input name="assignee" maxlength="80" list="pjWho" value="${esc(a.assignee)}" placeholder="@usuario" ${dis} autocomplete="off"><datalist id="pjWho">${assigneeOptions(ctx.node).map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fase del cronograma</label><select name="phaseId" ${dis}><option value="">— Solo en el kanban —</option>${ctx.data.phases.map(p => `<option value="${esc(p.id)}" ${p.id === a.phaseId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Estado</label><select name="status" ${dis}>${STATUSES.map(s => `<option value="${s}" ${s === a.status ? 'selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Inicio</label><input type="date" name="startDate" value="${esc(a.startDate || '')}" ${dis}></div>
        <div class="field"><label>Fin</label><input type="date" name="endDate" value="${esc(a.endDate || '')}" ${dis}></div>
      </div>
      <div class="hint">Con fase y fecha de inicio la actividad aparece en el cronograma; en el kanban aparece siempre. Las canceladas no se borran.</div>
    </div>
    <footer>${activity && !readOnly ? '<button type="button" class="btn danger left" data-del>Eliminar</button>' : ''}<button type="button" class="btn" data-cancel>${readOnly ? 'Cerrar' : 'Cancelar'}</button>${readOnly ? '' : `<button type="submit" class="btn primary">${activity ? 'Guardar' : 'Crear'}</button>`}</footer>`;
  const { form, close } = openForm({ title: readOnly ? 'Actividad' : activity ? 'Editar actividad' : 'Nueva actividad', html, onSubmit: async f => {
    const body = { title: f.elements.title.value.trim(), description: f.elements.description.value, tag: f.elements.tag.value.trim(), assignee: f.elements.assignee.value.trim(), phaseId: f.elements.phaseId.value || null, startDate: f.elements.startDate.value || null, endDate: f.elements.endDate.value || null, status: f.elements.status.value };
    if (!body.title) throw new Error('El título es obligatorio');
    if (activity) await api.updateActivity(ctx.pid, ctx.nid, activity.id, body); else await api.createActivity(ctx.pid, ctx.nid, body);
    toast(activity ? 'Actividad guardada' : 'Actividad creada'); await ctx.refresh();
  } });
  $('[data-del]', form)?.addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'Eliminar actividad', message: `«${a.title}» se eliminará del cronograma y del kanban. Si solo quieres descartarla, cámbiala a Cancelled.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] });
    if (!ok) return;
    try { await api.deleteActivity(ctx.pid, ctx.nid, activity.id); close(); toast('Actividad eliminada'); await ctx.refresh(); } catch (err) { toast(err.message, 'error', 5000); }
  });
}
const swatches = cur => `<div class="color-grid pj-colors">${PHASE_COLORS.map(c => `<button type="button" data-color="${c}" class="${c === cur ? 'active' : ''}" data-style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('')}</div>`;
/** Crear (phase=null) o editar una fase: nombre + color. */
export function openPhaseDialog({ phase = null }, ctx) {
  const cur = phase?.color || PHASE_COLORS[ctx.data.phases.length % PHASE_COLORS.length];
  const html = `<div class="dialog-body">
      <div class="field"><label>Nombre *</label><input name="name" maxlength="80" value="${esc(phase?.name || '')}" required placeholder="p. ej. Investigación de campo" autocomplete="off"></div>
      <div class="field"><label>Color</label>${swatches(cur)}<input type="hidden" name="color" value="${cur}"></div>
    </div>
    <footer><button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn primary">${phase ? 'Guardar' : 'Crear fase'}</button></footer>`;
  const { form } = openForm({ title: phase ? 'Editar fase' : 'Nueva fase', html, onSubmit: async f => {
    const body = { name: f.elements.name.value.trim(), color: f.elements.color.value };
    if (!body.name) throw new Error('El nombre es obligatorio');
    if (phase) await api.updatePhase(ctx.pid, ctx.nid, phase.id, body); else await api.createPhase(ctx.pid, ctx.nid, body);
    toast(phase ? 'Fase guardada' : 'Fase creada'); await ctx.refresh();
  } });
  $('.pj-colors', form).addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (!b) return; $$('.pj-colors button', form).forEach(x => x.classList.toggle('active', x === b)); form.elements.color.value = b.dataset.color; });
}
/** Numeración de sprints bajo cada semana. */
export function openSprintDialog(ctx) {
  const s = ctx.data.settings || {};
  const html = `<div class="dialog-body">
      <div class="field-row">
        <div class="field"><label>Semanas por sprint</label><input type="number" name="sprintWeeks" min="1" max="8" value="${s.sprintWeeks || 2}"></div>
        <div class="field"><label>Ajuste del número</label><input type="number" name="sprintOffset" min="-999" max="999" value="${s.sprintOffset || 0}"></div>
      </div>
      <div class="hint">El sprint se calcula por bloques desde la semana 1 del año (semanas 41–42 → sprint 21 con 2 semanas por sprint). Usa el ajuste para cuadrar con tu numeración.</div>
    </div>
    <footer><button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn primary">Guardar</button></footer>`;
  openForm({ title: 'Sprints', html, onSubmit: async f => { await api.patchProject(ctx.pid, ctx.nid, { sprintWeeks: Number(f.elements.sprintWeeks.value) || 2, sprintOffset: Number(f.elements.sprintOffset.value) || 0 }); await ctx.refresh(); } });
}

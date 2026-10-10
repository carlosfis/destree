/* =========================================================
   P11. Cronograma: fases como filas (primera columna fija) × semanas ISO como columnas (se generan desde las fechas de las actividades;
   scroll horizontal cuando el proyecto se alarga). Cada actividad: círculo con siglas en el color de su fase, título, línea hasta la fecha de fin y descripción.
   Línea vertical = hoy. Solo entran las actividades con fase y fecha de inicio.
   ========================================================= */
import { $, esc } from '../core/utils.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox } from '../ui/dialogs.js';
import { menuPopover } from '../ui/popover.js';
import { isoWeek, sprintOf } from '../core/project-template.js';
import { openActivityDialog, openPhaseDialog, openSprintDialog } from './project-activity.js';

export const COLW = 104, ROW = 62, PAD = 18, MIN_COLS = 6; // px: ancho de semana, alto por actividad, margen vertical de fase
const DAY = COLW / 7, MS_DAY = 864e5;
const utc = s => Date.parse(s + 'T00:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
const num = i => String(i + 1).padStart(2, '0');
/** Semanas del cronograma: desde la del primer inicio hasta la del último fin (mínimo MIN_COLS); sin actividades, desde la semana actual. */
export function weeksOf(acts, today = new Date()) {
  const starts = acts.map(a => utc(a.startDate)), ends = acts.map(a => utc(a.endDate || a.startDate));
  const first = isoWeek(iso(new Date(starts.length ? Math.min(...starts) : today))).monday;
  const last = isoWeek(iso(new Date(ends.length ? Math.max(...ends) : today))).monday;
  const count = Math.max(MIN_COLS, Math.round((last - first) / MS_DAY / 7) + 1);
  return { start: first, count, weeks: Array.from({ length: count }, (_, i) => { const m = new Date(first.getTime() + i * 7 * MS_DAY); return { ...isoWeek(iso(m)), monday: m }; }) };
}
const x = (start, date) => Math.round((utc(date) - start) / MS_DAY * DAY);

export function renderSchedule(box, ctx) {
  const { data, canEdit } = ctx;
  const phases = data.phases, byPhase = new Map(phases.map(p => [p.id, []]));
  for (const a of data.activities) if (a.phaseId && a.startDate && byPhase.has(a.phaseId)) byPhase.get(a.phaseId).push(a);
  const scheduled = [...byPhase.values()].flat();
  const { start, count, weeks } = weeksOf(scheduled);
  const width = count * COLW;
  const todayX = x(start, iso(new Date())); const showToday = todayX >= 0 && todayX <= width;
  const cols = weeks.map((w, i) => `<i class="sched-col" data-style="left:${i * COLW}px"></i>`).join('');
  const marker = showToday ? `<i class="sched-today" data-style="left:${todayX}px"></i>` : '';
  const rows = phases.map((p, i) => {
    const acts = byPhase.get(p.id).sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.position - b.position));
    const h = PAD * 2 + Math.max(1, acts.length) * ROW;
    const items = acts.map((a, r) => {
      const left = x(start, a.startDate), right = x(start, a.endDate || a.startDate) + DAY;
      const line = Math.max(22, right - left - 34);
      return `<div class="act" data-id="${esc(a.id)}" data-style="left:${left}px;top:${PAD + r * ROW}px" title="${esc(a.title)}${a.endDate ? ` · ${a.startDate} → ${a.endDate}` : ` · ${a.startDate}`}">
        <span class="act-dot" data-style="background:${esc(p.color)}">${esc(a.tag)}</span>
        <div class="act-body"><b class="act-title">${esc(a.title)}</b><span class="act-line" data-style="width:${line}px;background:${esc(p.color)}"><i data-style="background:${esc(p.color)}"></i></span>${a.description ? `<p class="act-desc">${esc(a.description)}</p>` : ''}</div></div>`;
    }).join('');
    return `<div class="sched-row" data-phase="${esc(p.id)}" data-style="height:${h}px">
      <div class="sched-phase"><span class="sched-num">${num(i)}</span><h3>${esc(p.name)}</h3>${canEdit ? `<div class="sched-phase-tools"><button type="button" class="btn ghost" data-add-act title="Nueva actividad en esta fase">＋ Actividad</button><button type="button" class="icon-btn" data-phase-menu title="Opciones de la fase" aria-label="Opciones de la fase">⋯</button></div>` : ''}</div>
      <div class="sched-track" data-style="width:${width}px">${cols}${marker}${items}</div></div>`;
  }).join('');
  box.innerHTML = `<div class="sched-toolbar"><span class="hint">${scheduled.length} actividad${scheduled.length === 1 ? '' : 'es'} en ${phases.length} fase${phases.length === 1 ? '' : 's'} · ${count} semanas</span><span class="spacer"></span>
      ${canEdit ? '<button type="button" class="btn" id="schedSprints" title="Numeración de sprints">⚙ Sprints</button><button type="button" class="btn" id="schedAddPhase">＋ Nueva fase</button><button type="button" class="btn primary" id="schedAddAct">＋ Actividad</button>' : ''}</div>
    <div class="sched-wrap"><div class="sched">
      <div class="sched-head"><div class="sched-corner"></div><div class="sched-weeks" data-style="width:${width}px">${weeks.map(w => `<div class="sched-week"><b>Semana ${w.week}</b><span>Sprint ${sprintOf(w.week, data.settings)}</span></div>`).join('')}${showToday ? `<i class="sched-today-cap" data-style="left:${todayX}px"></i>` : ''}</div></div>
      ${rows || `<div class="sched-empty">${canEdit ? 'Crea la primera fase y añade actividades con fecha para dibujar el cronograma.' : 'Este proyecto aún no tiene cronograma.'}</div>`}
      ${showToday && rows ? `<div class="sched-foot"><div class="sched-corner"></div><div class="sched-track" data-style="width:${width}px"><i class="sched-today-cap bottom" data-style="left:${todayX}px"></i></div></div>` : ''}
    </div></div>`;
  box.addEventListener('click', e => {
    const act = e.target.closest('.act'); if (act) { const a = data.activities.find(z => z.id === act.dataset.id); if (a) openActivityDialog({ activity: a, readOnly: !canEdit }, ctx); return; }
    if (!canEdit) return;
    const row = e.target.closest('.sched-row'); const p = row && phases.find(z => z.id === row.dataset.phase);
    if (e.target.closest('[data-add-act]') && p) return openActivityDialog({ preset: { phaseId: p.id, startDate: iso(new Date()) } }, ctx);
    const pm = e.target.closest('[data-phase-menu]'); if (pm && p) { const r = pm.getBoundingClientRect(); return phaseMenu(p, r.left, r.bottom + 4, ctx); }
  });
  if (!canEdit) return;
  $('#schedAddPhase', box).addEventListener('click', () => openPhaseDialog({}, ctx));
  $('#schedAddAct', box).addEventListener('click', () => openActivityDialog({ preset: { phaseId: phases[0]?.id || null, startDate: iso(new Date()) } }, ctx));
  $('#schedSprints', box).addEventListener('click', () => openSprintDialog(ctx));
}
function phaseMenu(p, px, py, ctx) {
  const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); await ctx.refresh(); } catch (err) { toast(err.message, 'error', 5000); } };
  const n = ctx.data.phases.length;
  menuPopover(px, py, [
    { title: p.name },
    { label: 'Editar fase (nombre, color)', ico: '✎', action: () => openPhaseDialog({ phase: p }, ctx) },
    ...(p.position > 0 ? [{ label: 'Subir', ico: '↑', action: () => act(() => api.updatePhase(ctx.pid, ctx.nid, p.id, { position: p.position - 1 })) }] : []),
    ...(p.position < n - 1 ? [{ label: 'Bajar', ico: '↓', action: () => act(() => api.updatePhase(ctx.pid, ctx.nid, p.id, { position: p.position + 1 })) }] : []),
    '-',
    { label: 'Eliminar fase', ico: '🗑', danger: true, action: async () => {
      const ok = await confirmBox({ title: 'Eliminar fase', message: `«${p.name}» desaparecerá del cronograma. Sus actividades se conservan en el kanban (sin fase).`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] });
      if (ok) act(() => api.deletePhase(ctx.pid, ctx.nid, p.id), 'Fase eliminada');
    } },
  ]);
}

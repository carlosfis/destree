/* =========================================================
   P11. Actividades Kanban: cuatro columnas (To Do · Doing · Done · Cancelled) con todas las actividades (del cronograma y las sueltas).
   Card: círculo gris (outline), título, descripción y @responsable. Arrastrar entre columnas o cambiar el estado desde su modal.
   ========================================================= */
import { $, $$, esc } from '../core/utils.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { STATUSES, STATUS_META } from '../core/project-template.js';
import { openActivityDialog } from './project-activity.js';

const br = s => esc(s).replace(/\n/g, '<br>');
export const cardHTML = (a, canEdit) => `<article class="kb-card" data-id="${esc(a.id)}" ${canEdit ? 'draggable="true"' : ''} tabindex="0">
    <div class="kb-title"><span class="kb-dot"></span><b>${esc(a.title)}</b></div>
    ${a.description ? `<p>${br(a.description)}</p>` : ''}${a.assignee ? `<span class="kb-who">${esc(a.assignee)}</span>` : ''}</article>`;

export function renderKanban(box, ctx) {
  const { data, canEdit } = ctx;
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, data.activities.filter(a => a.status === s).sort((a, b) => a.position - b.position)]));
  box.innerHTML = `<div class="kb-toolbar"><span class="hint">${data.activities.length} actividad${data.activities.length === 1 ? '' : 'es'}${canEdit ? ' · arrastra una card para cambiar su estado' : ''}</span><span class="spacer"></span>${canEdit ? '<button type="button" class="btn primary" id="kbNew">＋ Nueva actividad</button>' : ''}</div>
    <div class="kanban">${STATUSES.map(s => `<section class="kb-col kb-${s}" data-status="${s}"><header><h3>${STATUS_META[s].label}</h3><p>${STATUS_META[s].desc}</p></header><div class="kb-cards">${byStatus[s].map(a => cardHTML(a, canEdit)).join('')}</div></section>`).join('')}</div>`;
  const open = id => { const a = data.activities.find(z => z.id === id); if (a) openActivityDialog({ activity: a, readOnly: !canEdit }, ctx); };
  box.addEventListener('click', e => { const c = e.target.closest('.kb-card'); if (c) open(c.dataset.id); });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('kb-card')) open(e.target.dataset.id); });
  if (!canEdit) return;
  $('#kbNew', box).addEventListener('click', () => openActivityDialog({}, ctx));
  // Drag & drop nativo: la card viaja a la columna; el servidor fija el estado y se recarga.
  const move = async (id, status) => {
    const a = data.activities.find(z => z.id === id); if (!a || a.status === status) return;
    const card = $(`.kb-card[data-id="${CSS.escape(id)}"]`, box); $(`.kb-col[data-status="${status}"] .kb-cards`, box)?.appendChild(card);
    try { await api.updateActivity(ctx.pid, ctx.nid, id, { status }); toast(`→ ${STATUS_META[status].label}`); await ctx.refresh(); } catch (err) { toast(err.message, 'error', 5000); await ctx.refresh(); }
  };
  box.addEventListener('dragstart', e => { const c = e.target.closest('.kb-card'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  box.addEventListener('dragend', e => { e.target.closest('.kb-card')?.classList.remove('dragging'); $$('.kb-col.over', box).forEach(c => c.classList.remove('over')); });
  box.addEventListener('dragover', e => { const col = e.target.closest('.kb-col'); if (!col) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; $$('.kb-col.over', box).forEach(c => c !== col && c.classList.remove('over')); col.classList.add('over'); });
  box.addEventListener('dragleave', e => { const col = e.target.closest('.kb-col'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
  box.addEventListener('drop', e => { const col = e.target.closest('.kb-col'); if (!col) return; e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, col.dataset.status); });
  box.moveActivity = move; // smoke / depuración: mover sin gesto de ratón
}

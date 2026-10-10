/* =========================================================
   P11. Overview del proyecto: tagline + secciones numeradas (enlaces, texto+métricas, línea de tiempo, tarjetas, cita, objetivos, entregables, personas).
   Quien puede editar (pages.edit o responsable/asignado) añade, reordena, edita y elimina secciones.
   ========================================================= */
import { $, esc } from '../core/utils.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox, promptBox } from '../ui/dialogs.js';
import { menuPopover } from '../ui/popover.js';
import { roleInitials } from '../ui/thumbnail.js';
import { SECTION_KINDS, KIND_LABEL } from '../core/project-template.js';
import { openSectionEditor } from './project-section-editor.js';

const SAFE_URL = /^https?:\/\//i;
const br = s => esc(s).replace(/\n/g, '<br>');
const num = i => String(i + 1).padStart(2, '0');
/** HTML del cuerpo de una sección según su tipo. '' si no tiene contenido. */
export function sectionBodyHTML(sec) {
  const d = sec.data || {}, items = d.items || [];
  switch (sec.kind) {
    case 'links': return items.length ? `<div class="pj-links">${items.filter(i => SAFE_URL.test(i.url)).map(i => `<a class="pj-link" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${i.emoji ? `<span>${esc(i.emoji)}</span>` : ''}<span>${esc(i.label || i.url)}</span></a>`).join('')}</div>` : '';
    case 'text': return (d.text || (d.metrics || []).length) ? `${d.text ? `<p class="pj-text">${br(d.text)}</p>` : ''}${(d.metrics || []).length ? `<div class="pj-metrics">${d.metrics.map(m => `<div class="pj-metric"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}</div>` : ''}` : '';
    case 'timeline': return items.length ? `<ul class="pj-timeline">${items.map(i => `<li><span class="pj-tl-dot"></span><span class="pj-tl-label">${esc(i.label)}</span><p>${br(i.text)}</p></li>`).join('')}</ul>` : '';
    case 'cards': return items.length ? `<div class="pj-cards">${items.map(i => `<div class="pj-card"><span class="pj-code">${esc(i.code)}</span><b>${esc(i.title)}</b><p>${br(i.text)}</p></div>`).join('')}</div>` : '';
    case 'quote': {
      if (!d.quote && !items.length) return '';
      const q = esc(d.quote), h = esc(d.highlight);
      const quote = h && q.includes(h) ? q.replace(h, `<em>${h}</em>`) : q;
      return `<div class="pj-quote">${d.quote ? `<blockquote>“${quote}”</blockquote>` : ''}${items.length ? `<div class="pj-quote-items">${items.map(i => `<div><b>${esc(i.title)}</b><p>${br(i.text)}</p></div>`).join('')}</div>` : ''}</div>`;
    }
    case 'goals': return items.length ? `<ul class="pj-goals">${items.map(i => `<li><span>${esc(i.text)}</span>${i.value ? `<span class="pj-pill">${esc(i.value)}</span>` : ''}</li>`).join('')}</ul>` : '';
    case 'checklist': return items.length ? `<ul class="pj-checklist">${items.map(i => `<li class="${i.done ? 'done' : ''}"><span class="pj-check">${i.done ? '✓' : ''}</span><span class="pj-check-text">${esc(i.text)}</span><span class="pj-check-status">${esc(i.status || (i.done ? 'Listo' : 'En curso'))}</span></li>`).join('')}</ul>` : '';
    case 'people': return items.length ? `<ul class="pj-people">${items.map(i => `<li><span class="pj-avatar">${esc(roleInitials(i.role, i.name))}</span><span><b>${esc(i.name)}</b><small>${esc(i.role)}</small></span></li>`).join('')}</ul>` : '';
    default: return '';
  }
}
const toolsHTML = `<div class="pj-tools"><button type="button" class="icon-btn" data-up title="Subir" aria-label="Subir">↑</button><button type="button" class="icon-btn" data-down title="Bajar" aria-label="Bajar">↓</button><button type="button" class="icon-btn" data-edit title="Editar sección" aria-label="Editar sección">✎</button><button type="button" class="icon-btn" data-del title="Eliminar sección" aria-label="Eliminar sección">🗑</button></div>`;

export function renderOverview(box, ctx) {
  const { data, canEdit } = ctx;
  const tagline = data.settings?.tagline || '';
  const sections = data.sections.map((s, i) => ({ s, i, body: sectionBodyHTML(s) })).filter(x => canEdit || x.body);
  box.innerHTML = `<div class="pj-tagline-wrap">${tagline ? `<p class="pj-tagline">${esc(tagline)}</p>` : canEdit ? '<p class="pj-tagline hint">Añade una frase que resuma el proyecto.</p>' : ''}${canEdit ? '<button type="button" class="icon-btn pj-tagline-edit" id="pjTagline" title="Editar frase" aria-label="Editar frase">✎</button>' : ''}</div>
    <div class="pj-sections">${sections.map(({ s, i, body }) => `<article class="pj-section ${body ? '' : 'is-empty'}" data-id="${esc(s.id)}">
        <div class="pj-sec-head"><span class="pj-num">${num(i)}</span><h2>${esc(s.title || KIND_LABEL[s.kind])}</h2>${canEdit ? toolsHTML : ''}</div>
        <div class="pj-sec-body">${body || `<div class="pj-empty">Sin contenido · ${esc(KIND_LABEL[s.kind])} · <button type="button" class="linkish" data-edit>Editar</button></div>`}</div>
      </article>`).join('')}${!sections.length ? '<div class="empty">Este proyecto aún no tiene secciones.</div>' : ''}</div>
    ${canEdit ? '<div class="pj-add"><button type="button" class="btn" id="pjAddSection">＋ Añadir sección</button></div>' : ''}`;
  if (!canEdit) return;
  const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); await ctx.refresh(); } catch (err) { toast(err.message, 'error', 5000); } };
  $('#pjTagline', box).addEventListener('click', async () => { const v = await promptBox({ title: 'Frase del proyecto', label: 'Tagline (≤300)', value: tagline, okLabel: 'Guardar' }); if (v != null) act(() => api.patchProject(ctx.pid, ctx.nid, { tagline: v.slice(0, 300) })); });
  $('#pjAddSection', box).addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    menuPopover(r.left, r.bottom + 4, [{ title: 'Tipo de sección' }, ...SECTION_KINDS.map(k => ({ label: KIND_LABEL[k], ico: '▤', action: () => act(async () => { const s = await api.createSection(ctx.pid, ctx.nid, { kind: k, title: KIND_LABEL[k] }); await ctx.refresh(); openSectionEditor(s, ctx); }) }))]);
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-up], button[data-down], button[data-edit], button[data-del]'); if (!b) return;
    const art = b.closest('.pj-section'); const sec = data.sections.find(s => s.id === art?.dataset.id); if (!sec) return;
    if (b.hasAttribute('data-edit')) return openSectionEditor(sec, ctx);
    if (b.hasAttribute('data-up') || b.hasAttribute('data-down')) { const pos = Math.max(0, sec.position + (b.hasAttribute('data-up') ? -1 : 1)); if (pos !== sec.position) act(() => api.updateSection(ctx.pid, ctx.nid, sec.id, { position: pos })); return; }
    confirmBox({ title: 'Eliminar sección', message: `«${sec.title || KIND_LABEL[sec.kind]}» desaparecerá del overview.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] })
      .then(ok => { if (ok) act(() => api.deleteSection(ctx.pid, ctx.nid, sec.id), 'Sección eliminada'); });
  });
}

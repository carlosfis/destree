/* =========================================================
   14. Editor de instancia (crear / editar) en el sidebar #nodeDrawer, por pestañas:
   General (tipo, nombre, contenedor, descripción, color de marca en Main instances, etiquetas, relaciones) · Staff · Documentación · Notas
   ========================================================= */
import { $, $$, uid, esc, TYPE_META, TAG_COLORS, applyDataStyles } from '../core/utils.js';
import {
  S, save, nodeById, tagById, isContainer, childrenOf, sourceEdgeOf, dsOf, defaultBranchType, parentOf,
  rootOf, isAncestor, worldPos, typeName, isMyNode, projectHash,
} from '../core/state.js';
import * as api from '../core/api.js'; // P10: PATCH de campos propios
import { pushHistory } from '../core/history.js';
import { freeSpot } from '../canvas/render-nodes.js';
import { selectOnly, renderAll } from '../canvas/selection.js';
import { wouldCycle } from './connections.js';
import { deleteNodes } from './node-actions.js';
import { toast } from './theme.js';
import { docsSection, staffSection, teamSection, visibilitySection } from './card-editor-docs.js';
import { GRADIENTS, DEFAULT_GRADIENT } from '../core/normalize.js'; // P12
import { drawerHTML, openDrawer, closeDrawer, showTab, tabOf, instanceLabel } from './node-drawer.js';
import { thumbnailSection } from './thumbnail-section.js'; // P9
export const editorDialog = $('#editorDialog'); // modal: lo siguen usando #/me y el panel de versiones
/** Ruta legible de un contenedor: Raíz › Hijo › Nieto */
export function pathOf(n) { const parts = [n.name]; let p = parentOf(n), g = 0; while (p && g++ < 100) { parts.unshift(p.name); p = parentOf(p); } return parts.join(' › '); }

const OWN_FIELDS = ['name', 'description', 'gradient', 'tags', 'staff', 'docs', 'notes', 'geo', 'thumbIconId']; // P10: lo que un viewer cambia en sus cards
export function openEditor(id, preset = {}) {
  const own = S.readonly; // P10: sin pages.edit solo se abren las cards propias, en modo acotado (sin tipo, contenedor, relaciones ni borrado)
  if (own && !(id && isMyNode(id) && S.session?.permissions.includes('nodes.own'))) return;
  const node = id ? nodeById(id) : null;
  if (id && !node) return;
  const draft = node
    ? { ...node, tags: [...node.tags], docs: (node.docs || []).map(d => ({ ...d })), staff: (node.staff || []).map(m => ({ ...m })) }
    : { id: null, type: preset.type || 'software', name: '', description: '', image: null, tags: [], owner: '', staff: [], parentId: preset.parentId || null, branchTypeId: null, x: preset.x ?? 0, y: preset.y ?? 0, notes: '', docs: [], ownerUserId: null, assigneeIds: [], visibility: 'org', cellIds: [], imageId: null, geo: '', thumbIconId: null, gradient: DEFAULT_GRADIENT };
  if (!draft.gradient) draft.gradient = DEFAULT_GRADIENT;
  const docsSec = docsSection(draft), staffSec = staffSection(draft), teamSec = teamSection(draft), visSec = visibilitySection(draft), thumbSec = thumbnailSection(draft); // F3 · P9
  draft.sourceId = node ? (sourceEdgeOf(node.id)?.to || '') : '';
  draft.dsIds = node ? new Set(dsOf(node.id).map(n => n.id)) : new Set();
  const hasKids = node ? childrenOf(node.id).length : 0;
  const title = parentId => `${node ? '' : 'Nueva '}${instanceLabel(parentId)}`;
  const T = { software: esc(typeName('software')), ds: esc(typeName('ds')), uikit: esc(typeName('uikit')) };

  const panes = {
    general: `<div class="field"><label>Tipo</label><div class="type-picker" id="fType">${Object.entries(TYPE_META).map(([k, m]) => `<button type="button" data-v="${k}" class="${k === draft.type ? 'active' : ''}" title="${esc(m.desc)}"><span class="t"><span class="dot" data-style="background:${m.color}"></span>${T[k]}</span><span class="d">${m.desc}</span></button>`).join('')}</div>
        ${hasKids ? `<div class="hint">Este contenedor tiene ${hasKids} elemento${hasKids > 1 ? 's' : ''} dentro; para cambiarlo de tipo primero muévelos o elimínalos.</div>` : ''}</div>
      <div class="field" id="fNameField"><label>Nombre *</label><input name="name" maxlength="80" value="${esc(draft.name)}" placeholder="Nombre de la instancia" autocomplete="off"><div class="error" hidden>El nombre es obligatorio.</div></div>
      <div class="field-row">
        <div class="field" id="fParentField"><label id="fParentLabel">Contenedor padre</label><select name="parent"></select><div class="error" hidden>${T.ds} y ${T.uikit} deben vivir dentro de ${T.software}.</div></div>
        <div class="field" id="fBranchField"><label>Tipo de ramificación</label><select name="branchType">${S.state.branchTypes.map(t => `<option value="${t.id}" ${t.id === (draft.branchTypeId || defaultBranchType()) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Descripción breve <span class="counter" id="fCounter">${draft.description.length}/140</span></label><textarea name="description" maxlength="140" rows="2" placeholder="¿Qué es y para qué sirve?">${esc(draft.description)}</textarea></div>
      <div class="field" id="fGradField"><label>Color de marca <span class="hint">Main instance</span></label><div class="grad-picker" id="fGrad">${GRADIENTS.map(g => `<button type="button" class="grad-dot grad-${g.id} ${g.id === draft.gradient ? 'active' : ''}" data-v="${g.id}" title="${g.colors.join(' → ')}" aria-label="${g.id}"></button>`).join('')}</div><div class="hint">Se muestra en la cabecera de la card, en la ficha y en los encabezados de su página de proyecto.</div></div>
      <div class="field"><label>Etiquetas</label><div class="chips-select" id="fTags"></div></div>
      <h3 class="section" id="fRelHead">Relaciones</h3>
      <div class="field" id="fSourceField"><label>Fuente * (${T.ds} o ${T.software} del que deriva)</label><select name="source"></select><div class="error" hidden>${T.uikit} debe tener fuente.</div></div>
      <div class="field" id="fDSField"><label>${T.ds} que usa</label><div class="check-list" id="fDS"></div><div class="hint">Si ${T.ds} vive en otro ${T.software} raíz, la línea se dibuja discontinua.</div></div>
      ${thumbSec.html}`,
    staff: `${staffSec.html}${teamSec.html}${visSec.html}`,
    docs: docsSec.html,
    notes: docsSec.notesHtml,
  };
  const footer = `${node && !own ? '<button type="button" class="btn danger left" id="fDelete">Eliminar</button>' : ''}${node ? `<button type="button" class="btn ${own ? 'left' : ''}" id="fProject" title="Overview, cronograma y actividades">▤ Proyecto</button>` : ''}<button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn primary">${node ? 'Guardar cambios' : 'Crear'}</button>`;
  const form = openDrawer(drawerHTML({ title: title(draft.parentId), panes, footer, tag: 'form', id: 'editorForm' }), { onClose: () => thumbSec.unbind() });
  if (own) form.classList.add('own-mode'); // CSS oculta tipo, contenedor, relaciones y nueva etiqueta
  const sortByPath = (a, b) => pathOf(a).localeCompare(pathOf(b));

  const refreshType = () => {
    $$('#fType button').forEach(b => b.classList.toggle('active', b.dataset.v === draft.type));
    const soft = draft.type === 'software';
    $('#fSourceField').hidden = draft.type !== 'uikit';
    $('#fDSField').hidden = !soft;
    $('#fRelHead').hidden = draft.type === 'ds';
    $('#fParentLabel').textContent = soft ? 'Contenedor padre (vacío = raíz)' : 'Contenedor padre *';
    // Contenedores válidos: software que no sea el propio nodo ni un descendiente suyo
    const parents = S.state.nodes.filter(n => isContainer(n) && n.id !== draft.id && !(draft.id && isAncestor(draft.id, n.id))).sort(sortByPath);
    const current = form.parent.value !== undefined && form.parent.options.length ? form.parent.value : (draft.parentId || '');
    form.parent.innerHTML = (soft ? '<option value="">— Ninguno: Main instance (raíz) —</option>' : `<option value="">— Selecciona ${T.software} —</option>`) +
      parents.map(n => `<option value="${n.id}" ${n.id === current ? 'selected' : ''}>${esc(pathOf(n))}</option>`).join('');
    refreshBranch();
    const srcSel = form.source;
    const candidates = S.state.nodes.filter(n => n.id !== draft.id && !(draft.id && wouldCycle('source', draft.id, n.id)))
      .sort((a, b) => (a.type === 'ds' ? 0 : a.type === 'uikit' ? 1 : 2) - (b.type === 'ds' ? 0 : b.type === 'uikit' ? 1 : 2) || a.name.localeCompare(b.name));
    srcSel.innerHTML = `<option value="">— Selecciona la fuente —</option>` + candidates.map(n => `<option value="${n.id}" ${n.id === draft.sourceId ? 'selected' : ''}>${esc(n.name)} · ${esc(typeName(n.type))}${n.parentId ? ` (en ${esc(rootOf(n).name)})` : ''}</option>`).join('');
    const dsList = S.state.nodes.filter(n => (n.type === 'ds' || n.type === 'uikit') && n.id !== draft.id).sort((a, b) => a.name.localeCompare(b.name));
    $('#fDS').innerHTML = dsList.length ? dsList.map(n => `<label><input type="checkbox" value="${n.id}" ${draft.dsIds.has(n.id) ? 'checked' : ''}><span class="t-dot" data-style="background:${TYPE_META[n.type].color}"></span>${esc(n.name)}<span class="where">${esc(typeName(n.type))} · en ${esc(rootOf(n).name)}</span></label>`).join('')
      : `<div class="empty">Aún no hay ${T.ds} ni ${T.uikit}.</div>`; applyDataStyles($('#fDS'));
  };
  const refreshBranch = () => {
    $('#fBranchField').hidden = !(draft.type === 'software' && form.parent.value); const vf = $('#fVisField'); if (vf) vf.hidden = !(draft.type === 'software' && !form.parent.value); // P10: sin pages.visibility no hay sección
    $('#fGradField').hidden = !(draft.type === 'software' && !form.parent.value); // P12: solo Main instances
    $('#drawerTitle').textContent = title(form.parent.value || null);
  };
  const refreshTags = () => {
    const box = $('#fTags');
    box.innerHTML = S.state.tags.map(t => `<span class="chip tag-${t.color} ${draft.tags.includes(t.id) ? 'on' : ''}" data-id="${t.id}">${esc(t.name)}</span>`).join('') +
      (own ? '' : `<span class="add-tag"><input placeholder="＋ nueva etiqueta" id="fNewTag"></span>`);
    box.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { const i = draft.tags.indexOf(c.dataset.id); i >= 0 ? draft.tags.splice(i, 1) : draft.tags.push(c.dataset.id); refreshTags(); }));
    $('#fNewTag')?.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return; ev.preventDefault();
      const name = ev.target.value.trim(); if (!name) return;
      let t = S.state.tags.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!t) { t = { id: uid(), name, color: TAG_COLORS[S.state.tags.length % TAG_COLORS.length] }; S.state.tags.push(t); save(); }
      if (!draft.tags.includes(t.id)) draft.tags.push(t.id);
      refreshTags(); $('#fNewTag').focus();
    });
  };
  $('#fGrad').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; draft.gradient = b.dataset.v; $$('#fGrad button').forEach(x => x.classList.toggle('active', x === b)); });
  refreshType(); refreshTags(); docsSec.bind(form); staffSec.bind(form); visSec.bind(form);
  thumbSec.bind(form, () => ({ name: form.name.value.trim() || 'Sin nombre', type: typeName(draft.type), path: form.parent.value && nodeById(form.parent.value) ? pathOf(nodeById(form.parent.value)).split(' › ') : [], tags: draft.tags.map(tagById).filter(Boolean).map(t => t.name), staff: staffSec.read(form).staff })); // P9: vista previa con el borrador

  $('#fType').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v !== 'software' && hasKids) return toast('Este contenedor tiene elementos dentro; muévelos o elimínalos antes de cambiar el tipo.', 'error', 3600);
    draft.type = b.dataset.v; refreshType();
  });
  form.parent.addEventListener('change', refreshBranch);
  form.description.addEventListener('input', () => { const c = $('#fCounter'); c.textContent = `${form.description.value.length}/140`; c.classList.toggle('over', form.description.value.length >= 140); });
  $('#fDelete')?.addEventListener('click', () => { closeDrawer(); deleteNodes([node.id]); });
  $('#fProject')?.addEventListener('click', () => { closeDrawer(); location.hash = projectHash(node.id); }); // P11

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.name.value.trim();
    const sourceId = form.source.value;
    const parentId = form.parent.value || null;
    const invalid = [];
    const mark = (sel, bad) => { const f = $(sel); f.classList.toggle('invalid', bad); $('.error', f).hidden = !bad; if (bad) invalid.push(f); };
    mark('#fNameField', !name);
    mark('#fParentField', draft.type !== 'software' && !parentId);
    mark('#fSourceField', draft.type === 'uikit' && !sourceId);
    if (invalid.length) { showTab(tabOf(invalid[0])); $('input, select', invalid[0])?.focus(); return; }
    if (own) return saveOwn(node, { name, description: form.description.value.trim().slice(0, 140), ...(node.parentId ? {} : { gradient: draft.gradient }), tags: draft.tags.filter(tagById), ...staffSec.read(form), ...docsSec.read(form), ...thumbSec.read(form) });
    if (parentId && (parentId === draft.id || (draft.id && isAncestor(draft.id, parentId)))) return toast('No se puede anidar dentro de sí mismo', 'error');
    pushHistory();
    const isRoot = draft.type === 'software' && !parentId;
    const data = { type: draft.type, name, description: form.description.value.trim().slice(0, 140), image: null, imageId: null, gradient: isRoot ? draft.gradient : '', tags: draft.tags.filter(tagById), ...staffSec.read(form), ...docsSec.read(form), ...teamSec.read(form), ...visSec.read(form, isRoot), ...thumbSec.read(form) };
    let target = node;
    if (node) {
      Object.assign(node, data);
      if (parentId !== (node.parentId || null)) {
        if (parentId) { const spot = freeSpot(parentId); node.x = spot.x; node.y = spot.y; }
        else { const w = worldPos(node); node.x = w.x; node.y = w.y; }
      }
    } else {
      target = { id: uid(), ...data, parentId: null, branchTypeId: null, x: Math.round(draft.x), y: Math.round(draft.y), w: 0, h: 0, demo: false, status: 'active', imageId: null, ownerUserId: data.ownerUserId ?? null, assigneeIds: data.assigneeIds || [] };
      if (parentId) { const spot = freeSpot(parentId); target.x = spot.x; target.y = spot.y; }
      S.state.nodes.push(target);
    }
    target.parentId = parentId;
    target.branchTypeId = data.type === 'software' && parentId ? form.branchType.value : null;
    if (data.type !== 'software') { target.w = 0; target.h = 0; }
    // Sincroniza aristas derivadas del formulario
    const tid = target.id;
    if (data.type !== 'software') S.state.edges = S.state.edges.filter(e => !(e.kind === 'ds' && e.from === tid));
    if (data.type === 'software') S.state.edges = S.state.edges.filter(e => !(e.kind === 'ds' && e.to === tid));
    if (data.type !== 'uikit') S.state.edges = S.state.edges.filter(e => !(e.kind === 'source' && e.from === tid));
    if (data.type === 'uikit') {
      S.state.edges = S.state.edges.filter(e => !(e.kind === 'source' && e.from === tid));
      if (!wouldCycle('source', tid, sourceId)) S.state.edges.push({ id: uid(), kind: 'source', from: tid, to: sourceId, demo: false });
    }
    if (data.type === 'software') {
      const chosen = new Set($$('#fDS input:checked').map(i => i.value));
      S.state.edges = S.state.edges.filter(e => !(e.kind === 'ds' && e.from === tid && !chosen.has(e.to)));
      for (const dsId of chosen) if (!S.state.edges.some(e => e.kind === 'ds' && e.from === tid && e.to === dsId)) S.state.edges.push({ id: uid(), kind: 'ds', from: tid, to: dsId, demo: false });
    }
    closeDrawer();
    if (!node) selectOnly(tid);
    renderAll(); save();
    toast(node ? 'Instancia actualizada' : 'Instancia creada');
  });
  form.name.focus();
}
/** P10: guardado acotado (viewer en su card): PATCH de campos propios; el servidor normaliza y devuelve la card. */
async function saveOwn(node, data) {
  const body = Object.fromEntries(Object.entries(data).filter(([k]) => OWN_FIELDS.includes(k)));
  try {
    const res = await api.patchNodeFields(S.pageId, node.id, body);
    Object.assign(node, res.node); S.version = res.version;
    closeDrawer(); renderAll(); toast('Instancia actualizada');
  } catch (err) { toast('No se pudo guardar: ' + err.message, 'error', 6000); }
}

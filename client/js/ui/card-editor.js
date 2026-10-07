/* =========================================================
   14. Editor de instancia (crear / editar) en el sidebar #nodeDrawer, por pestañas:
   General (tipo, nombre, contenedor, descripción, imagen, etiquetas, relaciones) · Staff · Documentación · Notas
   ========================================================= */
import { $, $$, uid, esc, TYPE_META, TAG_COLORS } from '../core/utils.js';
import {
  S, save, nodeById, tagById, isContainer, childrenOf, sourceEdgeOf, dsOf, defaultBranchType, parentOf,
  rootOf, isAncestor, worldPos,
} from '../core/state.js';
import { pushHistory } from '../core/history.js';
import { freeSpot } from '../canvas/render-nodes.js';
import { selectOnly, renderAll } from '../canvas/selection.js';
import { wouldCycle } from './connections.js';
import { deleteNodes } from './node-actions.js';
import { toast } from './theme.js';
import { docsSection, staffSection, teamSection, visibilitySection } from './card-editor-docs.js';
import { uploadImage, bindDropZone, imageSrc, canUpload } from './uploader.js'; // F5
import { drawerHTML, openDrawer, closeDrawer, showTab, tabOf, instanceLabel } from './node-drawer.js';
export const editorDialog = $('#editorDialog'); // modal: lo siguen usando #/me y el panel de versiones

export function processImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('El archivo no es una imagen'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Imagen demasiado grande (máx. 10 MB)'));
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const W = 320, H = 180, c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      const s = Math.max(W / img.width, H / img.height), dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      let q = .85, out = c.toDataURL('image/jpeg', q);
      while (out.length > 100 * 1024 && q > .3) { q -= .1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
/** Ruta legible de un contenedor: Raíz › Hijo › Nieto */
export function pathOf(n) { const parts = [n.name]; let p = parentOf(n), g = 0; while (p && g++ < 100) { parts.unshift(p.name); p = parentOf(p); } return parts.join(' › '); }

export function openEditor(id, preset = {}) {
  if (S.readonly) return; // F2: designer no edita
  const node = id ? nodeById(id) : null;
  if (id && !node) return;
  const draft = node
    ? { ...node, tags: [...node.tags], docs: (node.docs || []).map(d => ({ ...d })), staff: (node.staff || []).map(m => ({ ...m })) }
    : { id: null, type: preset.type || 'software', name: '', description: '', image: null, tags: [], owner: '', staff: [], parentId: preset.parentId || null, branchTypeId: null, x: preset.x ?? 0, y: preset.y ?? 0, notes: '', docs: [], ownerUserId: null, assigneeIds: [], visibility: 'org', cellIds: [], imageId: null };
  const docsSec = docsSection(draft), staffSec = staffSection(draft), teamSec = teamSection(draft), visSec = visibilitySection(draft); // F3
  draft.sourceId = node ? (sourceEdgeOf(node.id)?.to || '') : '';
  draft.dsIds = node ? new Set(dsOf(node.id).map(n => n.id)) : new Set();
  const hasKids = node ? childrenOf(node.id).length : 0;
  const title = parentId => `${node ? '' : 'Nueva '}${instanceLabel(parentId)}`;

  const panes = {
    general: `<div class="field"><label>Tipo</label><div class="type-picker" id="fType">${Object.entries(TYPE_META).map(([k, m]) => `<button type="button" data-v="${k}" class="${k === draft.type ? 'active' : ''}" title="${esc(m.desc)}"><span class="t"><span class="dot" style="background:${m.color}"></span>${m.label}</span><span class="d">${m.desc}</span></button>`).join('')}</div>
        ${hasKids ? `<div class="hint">Este contenedor tiene ${hasKids} elemento${hasKids > 1 ? 's' : ''} dentro; para cambiarlo de tipo primero muévelos o elimínalos.</div>` : ''}</div>
      <div class="field" id="fNameField"><label>Nombre *</label><input name="name" maxlength="80" value="${esc(draft.name)}" placeholder="Nombre del software, DS o kit" autocomplete="off"><div class="error" hidden>El nombre es obligatorio.</div></div>
      <div class="field-row">
        <div class="field" id="fParentField"><label id="fParentLabel">Contenedor padre</label><select name="parent"></select><div class="error" hidden>Un DS o UI Kit debe vivir dentro de un software.</div></div>
        <div class="field" id="fBranchField"><label>Tipo de ramificación</label><select name="branchType">${S.state.branchTypes.map(t => `<option value="${t.id}" ${t.id === (draft.branchTypeId || defaultBranchType()) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Descripción breve <span class="counter" id="fCounter">${draft.description.length}/140</span></label><textarea name="description" maxlength="140" rows="2" placeholder="¿Qué es y para qué sirve?">${esc(draft.description)}</textarea></div>
      <div class="field"><label>Imagen</label>
        <div class="img-field"><div class="img-preview" id="fImgPreview"></div>
          <div class="img-actions"><label class="btn">Subir imagen<input type="file" accept="image/*" hidden id="fImgInput"></label><button type="button" class="btn ghost" id="fImgRemove">Quitar</button></div></div>
        <div class="hint" id="fImgHint">${canUpload() ? 'PNG, JPEG, WebP o SVG hasta 5 MB. Arrastra, pega (Ctrl/⌘+V) o sube; se muestra como hero en la card.' : 'Sin servidor: se recorta a 16:9 (320×180) y se comprime para caber en localStorage.'}</div></div>
      <div class="field"><label>Etiquetas</label><div class="chips-select" id="fTags"></div></div>
      <h3 class="section" id="fRelHead">Relaciones</h3>
      <div class="field" id="fSourceField"><label>Fuente * (DS o software del que deriva)</label><select name="source"></select><div class="error" hidden>Un UI Kit debe tener fuente.</div></div>
      <div class="field" id="fDSField"><label>Sistemas de diseño que usa</label><div class="check-list" id="fDS"></div><div class="hint">Si el DS vive en otro software raíz, la línea se dibuja discontinua.</div></div>`,
    staff: `${staffSec.html}${teamSec.html}${visSec.html}`,
    docs: docsSec.html,
    notes: docsSec.notesHtml,
  };
  const footer = `${node ? '<button type="button" class="btn danger left" id="fDelete">Eliminar</button>' : ''}<button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn primary">${node ? 'Guardar cambios' : 'Crear'}</button>`;
  let unbindDrop = null;
  const form = openDrawer(drawerHTML({ title: title(draft.parentId), panes, footer, tag: 'form', id: 'editorForm' }), { onClose: () => unbindDrop && unbindDrop() });
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
    form.parent.innerHTML = (soft ? '<option value="">— Ninguno: Main instance (raíz) —</option>' : '<option value="">— Selecciona un software —</option>') +
      parents.map(n => `<option value="${n.id}" ${n.id === current ? 'selected' : ''}>${esc(pathOf(n))}</option>`).join('');
    refreshBranch();
    const srcSel = form.source;
    const candidates = S.state.nodes.filter(n => n.id !== draft.id && !(draft.id && wouldCycle('source', draft.id, n.id)))
      .sort((a, b) => (a.type === 'ds' ? 0 : a.type === 'uikit' ? 1 : 2) - (b.type === 'ds' ? 0 : b.type === 'uikit' ? 1 : 2) || a.name.localeCompare(b.name));
    srcSel.innerHTML = `<option value="">— Selecciona la fuente —</option>` + candidates.map(n => `<option value="${n.id}" ${n.id === draft.sourceId ? 'selected' : ''}>${esc(n.name)} · ${TYPE_META[n.type].label}${n.parentId ? ` (en ${esc(rootOf(n).name)})` : ''}</option>`).join('');
    const dsList = S.state.nodes.filter(n => (n.type === 'ds' || n.type === 'uikit') && n.id !== draft.id).sort((a, b) => a.name.localeCompare(b.name));
    $('#fDS').innerHTML = dsList.length ? dsList.map(n => `<label><input type="checkbox" value="${n.id}" ${draft.dsIds.has(n.id) ? 'checked' : ''}><span class="t-dot" style="background:${TYPE_META[n.type].color}"></span>${esc(n.name)}<span class="where">${TYPE_META[n.type].label} · en ${esc(rootOf(n).name)}</span></label>`).join('')
      : '<div class="empty">Aún no hay sistemas de diseño ni UI Kits.</div>';
  };
  const refreshBranch = () => {
    $('#fBranchField').hidden = !(draft.type === 'software' && form.parent.value); $('#fVisField').hidden = !(draft.type === 'software' && !form.parent.value);
    $('#drawerTitle').textContent = title(form.parent.value || null);
  };
  const refreshTags = () => {
    const box = $('#fTags');
    box.innerHTML = S.state.tags.map(t => `<span class="chip tag-${t.color} ${draft.tags.includes(t.id) ? 'on' : ''}" data-id="${t.id}">${esc(t.name)}</span>`).join('') +
      `<span class="add-tag"><input placeholder="＋ nueva etiqueta" id="fNewTag"></span>`;
    box.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { const i = draft.tags.indexOf(c.dataset.id); i >= 0 ? draft.tags.splice(i, 1) : draft.tags.push(c.dataset.id); refreshTags(); }));
    $('#fNewTag').addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return; ev.preventDefault();
      const name = ev.target.value.trim(); if (!name) return;
      let t = S.state.tags.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!t) { t = { id: uid(), name, color: TAG_COLORS[S.state.tags.length % TAG_COLORS.length] }; S.state.tags.push(t); save(); }
      if (!draft.tags.includes(t.id)) draft.tags.push(t.id);
      refreshTags(); $('#fNewTag').focus();
    });
  };
  const refreshImg = () => { const src = imageSrc(draft); $('#fImgPreview').innerHTML = src ? `<img src="${src}" alt="">` : 'Sin imagen'; $('#fImgRemove').hidden = !src; };
  const setImageFile = async f => { // F5: con servidor → upload (imageId); sin servidor → dataURL local
    $('#fImgPreview').textContent = 'Subiendo…';
    try { if (canUpload()) { const img = await uploadImage(f); draft.imageId = img.id; draft.image = null; } else { draft.image = await processImage(f); draft.imageId = null; } } catch (err) { toast(err.message, 'error', 5000); }
    refreshImg();
  };
  unbindDrop = bindDropZone($('#fImgPreview'), setImageFile);
  refreshType(); refreshTags(); refreshImg(); docsSec.bind(form); staffSec.bind(form); visSec.bind(form);

  $('#fType').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v !== 'software' && hasKids) return toast('Este contenedor tiene elementos dentro; muévelos o elimínalos antes de cambiar el tipo.', 'error', 3600);
    draft.type = b.dataset.v; refreshType();
  });
  form.parent.addEventListener('change', refreshBranch);
  form.description.addEventListener('input', () => { const c = $('#fCounter'); c.textContent = `${form.description.value.length}/140`; c.classList.toggle('over', form.description.value.length >= 140); });
  $('#fImgInput').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) await setImageFile(f); });
  $('#fImgRemove').addEventListener('click', () => { draft.image = null; draft.imageId = null; refreshImg(); });
  if (node) $('#fDelete').addEventListener('click', () => { closeDrawer(); deleteNodes([node.id]); });

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
    if (parentId && (parentId === draft.id || (draft.id && isAncestor(draft.id, parentId)))) return toast('No se puede anidar dentro de sí mismo', 'error');
    pushHistory();
    const isRoot = draft.type === 'software' && !parentId;
    const data = { type: draft.type, name, description: form.description.value.trim().slice(0, 140), image: draft.image, imageId: draft.imageId || null, tags: draft.tags.filter(tagById), ...staffSec.read(form), ...docsSec.read(form), ...teamSec.read(form), ...visSec.read(form, isRoot) };
    let target = node;
    if (node) {
      Object.assign(node, data);
      if (parentId !== (node.parentId || null)) {
        if (parentId) { const spot = freeSpot(parentId); node.x = spot.x; node.y = spot.y; }
        else { const w = worldPos(node); node.x = w.x; node.y = w.y; }
      }
    } else {
      target = { id: uid(), ...data, parentId: null, branchTypeId: null, x: Math.round(draft.x), y: Math.round(draft.y), w: 0, h: 0, demo: false, status: 'active', imageId: data.imageId, ownerUserId: data.ownerUserId ?? null, assigneeIds: data.assigneeIds || [] };
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

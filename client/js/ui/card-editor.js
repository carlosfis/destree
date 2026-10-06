'use strict';
/* =========================================================
   14. Editor de card (crear / editar)
   ========================================================= */
const editorDialog = $('#editorDialog');
const normalizeOwner = s => { s = String(s || '').trim().replace(/\s+/g, ''); return s ? (s.startsWith('@') ? s : '@' + s) : ''; };

function processImage(file) {
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
function pathOf(n) { const parts = [n.name]; let p = parentOf(n), g = 0; while (p && g++ < 100) { parts.unshift(p.name); p = parentOf(p); } return parts.join(' › '); }

function openEditor(id, preset = {}) {
  const node = id ? nodeById(id) : null;
  if (id && !node) return;
  const draft = node ? { ...node, tags: [...node.tags] } : { id: null, type: preset.type || 'software', name: '', description: '', image: null, tags: [], owner: '', parentId: preset.parentId || null, branchTypeId: null, x: preset.x ?? 0, y: preset.y ?? 0 };
  draft.sourceId = node ? (sourceEdgeOf(node.id)?.to || '') : '';
  draft.dsIds = node ? new Set(dsOf(node.id).map(n => n.id)) : new Set();
  const hasKids = node ? childrenOf(node.id).length : 0;

  editorDialog.innerHTML = `<form id="editorForm">
    <header><h2>${node ? 'Editar card' : 'Nueva card'}</h2><button type="button" class="icon-btn" data-cancel>✕</button></header>
    <div class="dialog-body">
      <div class="field"><label>Tipo</label><div class="type-picker" id="fType">${Object.entries(TYPE_META).map(([k, m]) => `<button type="button" data-v="${k}" class="${k === draft.type ? 'active' : ''}"><span class="t"><span class="dot" style="background:${m.color}"></span>${m.label}</span><span class="d">${m.desc}</span></button>`).join('')}</div>
        ${hasKids ? `<div class="hint">Este contenedor tiene ${hasKids} elemento${hasKids > 1 ? 's' : ''} dentro; para cambiarlo de tipo primero muévelos o elimínalos.</div>` : ''}</div>
      <div class="field" id="fNameField"><label>Nombre *</label><input name="name" maxlength="80" value="${esc(draft.name)}" placeholder="Nombre del software, DS o kit" autocomplete="off"><div class="error" hidden>El nombre es obligatorio.</div></div>
      <div class="field-row">
        <div class="field" id="fParentField"><label id="fParentLabel">Contenedor</label><select name="parent"></select><div class="error" hidden>Un DS o UI Kit debe vivir dentro de un software.</div></div>
        <div class="field" id="fBranchField"><label>Tipo de ramificación</label><select name="branchType">${state.edgeTypes.map(t => `<option value="${t.id}" ${t.id === (draft.branchTypeId || defaultBranchType()) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Descripción breve <span class="counter" id="fCounter">${draft.description.length}/140</span></label><textarea name="description" maxlength="140" rows="2" placeholder="¿Qué es y para qué sirve?">${esc(draft.description)}</textarea></div>
      <div class="field"><label>Imagen</label>
        <div class="img-field"><div class="img-preview" id="fImgPreview"></div>
          <div class="img-actions"><label class="btn">Subir imagen<input type="file" accept="image/*" hidden id="fImgInput"></label><button type="button" class="btn ghost" id="fImgRemove">Quitar</button></div></div>
        <div class="hint">Se recorta a 16:9 (320×180) y se comprime a ~100 KB para caber en localStorage.</div></div>
      <div class="field"><label>Etiquetas</label><div class="chips-select" id="fTags"></div></div>
      <div class="field"><label>Responsable</label><input name="owner" value="${esc(draft.owner)}" placeholder="@nombre" autocomplete="off"><div class="hint">Texto libre con formato @nombre; no se vincula a ningún usuario.</div></div>
      <div class="field" id="fSourceField"><label>Fuente * (DS o software del que deriva)</label><select name="source"></select><div class="error" hidden>Un UI Kit debe tener fuente.</div></div>
      <div class="field" id="fDSField"><label>Sistemas de diseño que usa</label><div class="check-list" id="fDS"></div><div class="hint">Si el DS vive en otro software raíz, la línea se dibuja discontinua.</div></div>
    </div>
    <footer>${node ? '<button type="button" class="btn danger left" id="fDelete">Eliminar</button>' : ''}<button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn primary">${node ? 'Guardar cambios' : 'Crear card'}</button></footer>
  </form>`;
  const form = $('#editorForm');
  const sortByPath = (a, b) => pathOf(a).localeCompare(pathOf(b));

  const refreshType = () => {
    $$('#fType button').forEach(b => b.classList.toggle('active', b.dataset.v === draft.type));
    const soft = draft.type === 'software';
    $('#fSourceField').hidden = draft.type !== 'uikit';
    $('#fDSField').hidden = !soft;
    $('#fParentLabel').textContent = soft ? 'Contenedor (vacío = raíz)' : 'Contenedor *';
    // Contenedores válidos: software que no sea el propio nodo ni un descendiente suyo
    const parents = state.nodes.filter(n => isContainer(n) && n.id !== draft.id && !(draft.id && isAncestor(draft.id, n.id))).sort(sortByPath);
    const current = form.parent.value !== undefined && form.parent.options.length ? form.parent.value : (draft.parentId || '');
    form.parent.innerHTML = (soft ? '<option value="">— Raíz (contenedor maestro) —</option>' : '<option value="">— Selecciona un software —</option>') +
      parents.map(n => `<option value="${n.id}" ${n.id === current ? 'selected' : ''}>${esc(pathOf(n))}</option>`).join('');
    refreshBranch();
    const srcSel = form.source;
    const candidates = state.nodes.filter(n => n.id !== draft.id && !(draft.id && wouldCycle('source', draft.id, n.id)))
      .sort((a, b) => (a.type === 'ds' ? 0 : a.type === 'uikit' ? 1 : 2) - (b.type === 'ds' ? 0 : b.type === 'uikit' ? 1 : 2) || a.name.localeCompare(b.name));
    srcSel.innerHTML = `<option value="">— Selecciona la fuente —</option>` + candidates.map(n => `<option value="${n.id}" ${n.id === draft.sourceId ? 'selected' : ''}>${esc(n.name)} · ${TYPE_META[n.type].label}${n.parentId ? ` (en ${esc(rootOf(n).name)})` : ''}</option>`).join('');
    const dsList = state.nodes.filter(n => (n.type === 'ds' || n.type === 'uikit') && n.id !== draft.id).sort((a, b) => a.name.localeCompare(b.name));
    $('#fDS').innerHTML = dsList.length ? dsList.map(n => `<label><input type="checkbox" value="${n.id}" ${draft.dsIds.has(n.id) ? 'checked' : ''}><span class="t-dot" style="background:${TYPE_META[n.type].color}"></span>${esc(n.name)}<span class="where">${TYPE_META[n.type].label} · en ${esc(rootOf(n).name)}</span></label>`).join('')
      : '<div class="empty">Aún no hay sistemas de diseño ni UI Kits.</div>';
  };
  const refreshBranch = () => { $('#fBranchField').hidden = !(draft.type === 'software' && form.parent.value); };
  const refreshTags = () => {
    const box = $('#fTags');
    box.innerHTML = state.tags.map(t => `<span class="chip tag-${t.color} ${draft.tags.includes(t.id) ? 'on' : ''}" data-id="${t.id}">${esc(t.name)}</span>`).join('') +
      `<span class="add-tag"><input placeholder="＋ nueva etiqueta" id="fNewTag"></span>`;
    box.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { const i = draft.tags.indexOf(c.dataset.id); i >= 0 ? draft.tags.splice(i, 1) : draft.tags.push(c.dataset.id); refreshTags(); }));
    $('#fNewTag').addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return; ev.preventDefault();
      const name = ev.target.value.trim(); if (!name) return;
      let t = state.tags.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!t) { t = { id: uid(), name, color: TAG_COLORS[state.tags.length % TAG_COLORS.length] }; state.tags.push(t); save(); }
      if (!draft.tags.includes(t.id)) draft.tags.push(t.id);
      refreshTags(); $('#fNewTag').focus();
    });
  };
  const refreshImg = () => { $('#fImgPreview').innerHTML = draft.image ? `<img src="${draft.image}" alt="">` : 'Sin imagen'; $('#fImgRemove').hidden = !draft.image; };
  refreshType(); refreshTags(); refreshImg();

  $('#fType').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v !== 'software' && hasKids) return toast('Este contenedor tiene elementos dentro; muévelos o elimínalos antes de cambiar el tipo.', 'error', 3600);
    draft.type = b.dataset.v; refreshType();
  });
  form.parent.addEventListener('change', refreshBranch);
  form.description.addEventListener('input', () => { const c = $('#fCounter'); c.textContent = `${form.description.value.length}/140`; c.classList.toggle('over', form.description.value.length >= 140); });
  form.owner.addEventListener('blur', () => form.owner.value = normalizeOwner(form.owner.value));
  $('#fImgInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { draft.image = await processImage(f); refreshImg(); } catch (err) { toast(err.message, 'error'); }
    e.target.value = '';
  });
  $('#fImgRemove').addEventListener('click', () => { draft.image = null; refreshImg(); });
  form.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => editorDialog.close()));
  if (node) $('#fDelete').addEventListener('click', () => { editorDialog.close(); deleteNodes([node.id]); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.name.value.trim();
    const sourceId = form.source.value;
    const parentId = form.parent.value || null;
    let ok = true;
    $('#fNameField').classList.toggle('invalid', !name); $('#fNameField .error').hidden = !!name; if (!name) ok = false;
    const needParent = draft.type !== 'software' && !parentId;
    $('#fParentField').classList.toggle('invalid', needParent); $('#fParentField .error').hidden = !needParent; if (needParent) ok = false;
    const needSource = draft.type === 'uikit' && !sourceId;
    $('#fSourceField').classList.toggle('invalid', needSource); $('#fSourceField .error').hidden = !needSource; if (needSource) ok = false;
    if (!ok) return;
    if (parentId && (parentId === draft.id || (draft.id && isAncestor(draft.id, parentId)))) return toast('No se puede anidar dentro de sí mismo', 'error');
    pushHistory();
    const data = { type: draft.type, name, description: form.description.value.trim().slice(0, 140), image: draft.image, tags: draft.tags.filter(tagById), owner: normalizeOwner(form.owner.value) };
    let target = node;
    if (node) {
      Object.assign(node, data);
      if (parentId !== (node.parentId || null)) {
        if (parentId) { const spot = freeSpot(parentId); node.x = spot.x; node.y = spot.y; }
        else { const w = worldPos(node); node.x = w.x; node.y = w.y; }
      }
    } else {
      target = { id: uid(), ...data, parentId: null, branchTypeId: null, x: Math.round(draft.x), y: Math.round(draft.y), w: 0, h: 0, demo: false };
      if (parentId) { const spot = freeSpot(parentId); target.x = spot.x; target.y = spot.y; }
      state.nodes.push(target);
    }
    target.parentId = parentId;
    target.branchTypeId = data.type === 'software' && parentId ? form.branchType.value : null;
    if (data.type !== 'software') { target.w = 0; target.h = 0; }
    // Sincroniza aristas derivadas del formulario
    const tid = target.id;
    if (data.type !== 'software') state.edges = state.edges.filter(e => !(e.kind === 'ds' && e.from === tid));
    if (data.type === 'software') state.edges = state.edges.filter(e => !(e.kind === 'ds' && e.to === tid));
    if (data.type !== 'uikit') state.edges = state.edges.filter(e => !(e.kind === 'source' && e.from === tid));
    if (data.type === 'uikit') {
      state.edges = state.edges.filter(e => !(e.kind === 'source' && e.from === tid));
      if (!wouldCycle('source', tid, sourceId)) state.edges.push({ id: uid(), kind: 'source', from: tid, to: sourceId, demo: false });
    }
    if (data.type === 'software') {
      const chosen = new Set($$('#fDS input:checked').map(i => i.value));
      state.edges = state.edges.filter(e => !(e.kind === 'ds' && e.from === tid && !chosen.has(e.to)));
      for (const dsId of chosen) if (!state.edges.some(e => e.kind === 'ds' && e.from === tid && e.to === dsId)) state.edges.push({ id: uid(), kind: 'ds', from: tid, to: dsId, demo: false });
    }
    editorDialog.close();
    if (!node) selectOnly(tid);
    renderAll(); save();
    toast(node ? 'Card actualizada' : 'Card creada');
  });
  editorDialog.showModal();
  form.name.focus();
}


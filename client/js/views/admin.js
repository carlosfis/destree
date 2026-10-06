'use strict';
/* =========================================================
   16. Panel de administración
   ========================================================= */
const adminPanel = $('#adminPanel');
let adminTab = 'tags';
function toggleAdmin(open) {
  const willOpen = open ?? !adminPanel.classList.contains('open');
  adminPanel.classList.toggle('open', willOpen);
  if (willOpen) renderAdmin();
}
$('#btnAdmin').addEventListener('click', () => toggleAdmin());
$('#closeAdmin').addEventListener('click', () => toggleAdmin(false));
$('#adminTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  adminTab = b.dataset.tab;
  $$('#adminTabs button').forEach(x => x.classList.toggle('active', x === b));
  renderAdmin();
});
function renderAdmin() {
  const body = $('#adminBody');
  body.innerHTML = '';
  ({ tags: renderTagsTab, edgeTypes: renderEdgeTypesTab, owners: renderOwnersTab, data: renderDataTab, settings: renderSettingsTab })[adminTab](body);
}
function colorPicker(x, y, current, onPick) {
  openPopover(x, y, el => {
    el.innerHTML = `<div class="color-grid">${TAG_COLORS.map(c => `<button class="tag-${c} ${c === current ? 'active' : ''}" data-c="${c}" title="${c}"></button>`).join('')}</div>`;
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { closePopover(); onPick(b.dataset.c); }));
  });
}

/* --- Etiquetas --- */
function renderTagsTab(body) {
  const usage = id => state.nodes.filter(n => n.tags.includes(id)).length;
  body.innerHTML = `<h3>Etiquetas (${state.tags.length})</h3><p>Clic en el color para cambiarlo; edita el nombre en línea.</p><div id="tagRows"></div>
    <h3>Nueva etiqueta</h3><form class="row" id="newTagForm"><input class="grow" placeholder="Nombre de la etiqueta" required><button class="btn primary" type="submit">Agregar</button></form>`;
  const rows = $('#tagRows', body);
  if (!state.tags.length) rows.innerHTML = '<div class="empty">No hay etiquetas.</div>';
  for (const t of state.tags) {
    const row = document.createElement('div'); row.className = 'row';
    const u = usage(t.id);
    row.innerHTML = `<button class="swatch tag-${t.color}" title="Cambiar color"></button><input class="inline grow" value="${esc(t.name)}"><span class="count">${u} card${u === 1 ? '' : 's'}</span><button class="icon-btn" title="Eliminar">🗑</button>`;
    const [sw, inp, , del] = row.children;
    sw.addEventListener('click', e => colorPicker(e.clientX, e.clientY, t.color, c => { pushHistory(); t.color = c; renderAll(); save(); }));
    inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v) { inp.value = t.name; return; } pushHistory(); t.name = v; renderAll(); save(); });
    del.addEventListener('click', async () => {
      if (u && !(await confirmBox({ title: 'Eliminar etiqueta', message: `"${t.name}" se usa en ${u} card${u > 1 ? 's' : ''}. Se quitará de todas.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] }))) return;
      pushHistory(); state.tags = state.tags.filter(x => x !== t); state.nodes.forEach(n => n.tags = n.tags.filter(x => x !== t.id)); renderAll(); save();
    });
    rows.appendChild(row);
  }
  $('#newTagForm', body).addEventListener('submit', e => {
    e.preventDefault(); const name = e.target.querySelector('input').value.trim(); if (!name) return;
    pushHistory(); state.tags.push({ id: uid(), name, color: TAG_COLORS[state.tags.length % TAG_COLORS.length] }); save(); renderAdmin();
  });
}

/* --- Tipos de ramificación --- */
function renderEdgeTypesTab(body) {
  const usage = id => state.nodes.filter(n => n.parentId && n.branchTypeId === id).length;
  body.innerHTML = `<h3>Tipos de ramificación (${state.edgeTypes.length})</h3><p>La ramificación es el anidamiento de un software dentro de otro. El tipo se muestra como chip en la cabecera del contenedor anidado.</p><div id="etRows"></div>
    <h3>Nuevo tipo</h3><form class="row" id="newEtForm"><input class="grow" placeholder="Nombre del tipo" required><button class="btn primary" type="submit">Agregar</button></form>`;
  const rows = $('#etRows', body);
  for (const t of state.edgeTypes) {
    const row = document.createElement('div'); row.className = 'row';
    const u = usage(t.id);
    row.innerHTML = `<button class="swatch tag-${t.color}" title="Cambiar color"></button><input class="inline grow" value="${esc(t.name)}"><span class="count">${u} anidado${u === 1 ? '' : 's'}</span><button class="icon-btn" title="Eliminar">🗑</button>`;
    const [sw, inp, , del] = row.children;
    sw.addEventListener('click', e => colorPicker(e.clientX, e.clientY, t.color, c => { pushHistory(); t.color = c; renderAll(); save(); }));
    inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v) { inp.value = t.name; return; } pushHistory(); t.name = v; renderAll(); save(); });
    del.addEventListener('click', async () => {
      if (state.edgeTypes.length === 1) return toast('Debe existir al menos un tipo', 'error');
      const fallback = state.edgeTypes.find(x => x !== t);
      if (u && !(await confirmBox({ title: 'Eliminar tipo', message: `"${t.name}" se usa en ${u} software anidado${u > 1 ? 's' : ''}. Pasarán a "${fallback.name}".`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] }))) return;
      pushHistory(); state.nodes.forEach(n => { if (n.branchTypeId === t.id) n.branchTypeId = fallback.id; }); state.edgeTypes = state.edgeTypes.filter(x => x !== t); renderAll(); save();
    });
    rows.appendChild(row);
  }
  $('#newEtForm', body).addEventListener('submit', e => {
    e.preventDefault(); const name = e.target.querySelector('input').value.trim(); if (!name) return;
    pushHistory(); state.edgeTypes.push({ id: uid(), name, color: TAG_COLORS[state.edgeTypes.length % TAG_COLORS.length] }); save(); renderAdmin();
  });
}

/* --- Responsables --- */
function renderOwnersTab(body) {
  const map = new Map();
  for (const n of state.nodes) if (n.owner) map.set(n.owner, (map.get(n.owner) || 0) + 1);
  const owners = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  body.innerHTML = `<h3>Responsables detectados (${owners.length})</h3><p>Se detectan a partir del campo @ de cada card. Renombrar reemplaza el valor en todas las cards.</p><div id="ownerRows"></div>`;
  const rows = $('#ownerRows', body);
  if (!owners.length) rows.innerHTML = '<div class="empty">Ninguna card tiene responsable.</div>';
  for (const [owner, count] of owners) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="owner chip tag-gray" style="font-family:var(--mono)">${esc(owner)}</span><span class="grow"></span><span class="count">${count} card${count === 1 ? '' : 's'}</span><button class="btn">Renombrar</button>`;
    row.querySelector('.btn').addEventListener('click', async () => {
      const v = await promptBox({ title: 'Renombrar responsable', label: `Nuevo nombre para ${owner} (${count} cards)`, value: owner, okLabel: 'Renombrar' });
      if (v === null) return; const nv = normalizeOwner(v);
      pushHistory(); state.nodes.forEach(n => { if (n.owner === owner) n.owner = nv; }); renderAll(); save();
      toast(nv ? `Renombrado a ${nv}` : 'Responsable eliminado de las cards');
    });
    rows.appendChild(row);
  }
}

/* --- Datos --- */
function renderDataTab(body) {
  const bytes = JSON.stringify(state).length;
  const demoCount = state.nodes.filter(n => n.demo).length;
  body.innerHTML = `<h3>Respaldo</h3><p>localStorage es frágil (se borra al limpiar el navegador). Exporta un JSON periódicamente. Importar reemplaza todo el estado actual.</p>
    <div class="inline-actions"><button class="btn primary" id="btnExport">⤓ Exportar JSON</button><button class="btn" id="btnCopy">Copiar JSON</button><button class="btn" id="btnImport">⤒ Importar JSON</button></div>
    <p style="margin-top:10px">Tamaño actual: <b>${(bytes / 1024).toFixed(1)} KB</b> · ${roots().length} raíces · ${state.nodes.length} cards · ${state.edges.length} conexiones · ${state.nodes.filter(n => n.image).length} con imagen.</p>
    <h3>Datos de ejemplo</h3><p>${demoCount ? `Hay ${demoCount} cards de ejemplo en el lienzo.` : 'No hay cards de ejemplo cargadas.'}</p>
    <div class="inline-actions"><button class="btn" id="btnLoadDemo">Cargar ejemplos</button><button class="btn danger" id="btnClearDemo" ${demoCount ? '' : 'disabled'}>Borrar ejemplos</button></div>
    <h3>Zona de peligro</h3><p>Elimina todas las cards, conexiones, etiquetas y tipos, y restaura los valores iniciales.</p>
    <button class="btn danger" id="btnClearAll">Borrar todo</button>`;
  $('#btnExport', body).addEventListener('click', exportJSON);
  $('#btnCopy', body).addEventListener('click', async () => { try { await navigator.clipboard.writeText(exportString()); toast('JSON copiado al portapapeles'); } catch { toast('No se pudo copiar', 'error'); } });
  $('#btnImport', body).addEventListener('click', () => $('#importFile').click());
  $('#btnLoadDemo', body).addEventListener('click', () => {
    pushHistory(); removeDemo(); const d = demoData();
    const bb = nodesBBox(); const offX = bb ? bb.x + bb.w + 120 : 0;
    state.nodes.push(...d.nodes); state.edges.push(...d.edges);
    renderAll();
    const target = computeLayout(d.nodes.filter(n => !n.parentId).map(n => n.id));
    for (const [id, p] of target) { const n = nodeById(id); n.x = p.x + (n.parentId ? 0 : offX); n.y = p.y; }
    renderAll(); save(); fitToScreen(); toast('Ejemplos cargados');
  });
  $('#btnClearDemo', body).addEventListener('click', () => { pushHistory(); removeDemo(); renderAll(); save(); toast('Ejemplos eliminados'); });
  $('#btnClearAll', body).addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'Borrar todo', message: 'Se eliminarán todas las cards, conexiones, etiquetas y tipos de ramificación. Esta acción se puede deshacer con Ctrl/⌘+Z mientras no recargues la página.', buttons: [{ label: 'Cancelar', value: '' }, { label: 'Borrar todo', value: 'ok', kind: 'danger' }] });
    if (!ok) return;
    pushHistory(); const d = defaultState(); state.nodes = []; state.edges = []; state.tags = d.tags; state.edgeTypes = d.edgeTypes; clearSelection(); renderAll(); save(); toast('Todo borrado');
  });
}
function removeDemo() {
  const demoIds = new Set(state.nodes.filter(n => n.demo).map(n => n.id));
  // Lo que viva dentro de un contenedor demo también se va (no puede quedar huérfano)
  for (const id of [...demoIds]) descendantsOf(id).forEach(d => demoIds.add(d));
  state.nodes = state.nodes.filter(n => !demoIds.has(n.id));
  state.edges = state.edges.filter(e => !demoIds.has(e.from) && !demoIds.has(e.to));
  demoIds.forEach(id => sel.nodes.delete(id));
}
function exportString() { state.camera = { ...cam }; return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2); }
function exportJSON() {
  const blob = new Blob([exportString()], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `arbol-sistemas-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('JSON exportado');
}
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('El archivo no tiene el formato esperado (nodes/edges).');
    const legacy = data.edges.some(e => e && e.kind === 'branch');
    const ok = await confirmBox({ title: 'Importar JSON', message: `El archivo contiene ${data.nodes.length} cards y ${data.edges.length} conexiones.${legacy ? '\nEs un respaldo del formato anterior: las ramificaciones se convertirán en contenedores anidados.' : ''}\nReemplazará el estado actual (puedes deshacerlo).`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Importar', value: 'ok', kind: 'primary' }] });
    if (!ok) return;
    pushHistory();
    const s = normalizeState(data);
    Object.assign(state, s);
    cam = { ...s.camera };
    clearSelection(); applyTheme(); applySettingsUI(); renderAll(); applyCamera(); save();
    toast('Estado importado');
  } catch (err) { toast('Importación fallida: ' + err.message, 'error', 6000); }
});

/* --- Ajustes --- */
function renderSettingsTab(body) {
  const sw = (key, label, hint) => `<div class="toggle-row"><div><div class="label">${label}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div><button class="switch ${state.settings[key] ? 'on' : ''}" data-key="${key}" role="switch" aria-checked="${!!state.settings[key]}"></button></div>`;
  body.innerHTML = `<h3>Tema</h3><div class="segmented" id="themeSeg"><button data-t="light">Claro</button><button data-t="dark">Oscuro</button><button data-t="">Sistema</button></div>
    <h3>Lienzo</h3>
    ${sw('snap', 'Ajuste a cuadrícula (8 px)', 'Mantén Alt al arrastrar para desactivarlo temporalmente.')}
    ${sw('grid', 'Fondo de puntos')}
    ${sw('minimap', 'Minimapa')}
    <h3>Cómo funciona</h3><p>Cada software es un contenedor. Arrastra una card dentro de otro contenedor para anidarla (ramificación), o fuera de todos para convertir un software en raíz. Los DS y UI Kits siempre viven dentro de un software. Arrastra desde un puerto de la cabecera para conectar o anidar.</p>
    <p>Rueda / dos dedos: pan · ${MOD} + rueda o pinch: zoom · Espacio + arrastrar, botón central o herramienta Mano (H): pan · Arrastrar en el fondo: selección por recuadro.</p>`;
  $$('#themeSeg button', body).forEach(b => { b.classList.toggle('active', (state.settings.theme || '') === b.dataset.t); b.addEventListener('click', () => { state.settings.theme = b.dataset.t || null; applyTheme(); save(); renderAdmin(); }); });
  body.querySelectorAll('.switch').forEach(b => b.addEventListener('click', () => { state.settings[b.dataset.key] = !state.settings[b.dataset.key]; applySettingsUI(); save(); renderAdmin(); }));
}
function applySettingsUI() {
  viewport.classList.toggle('no-grid', !state.settings.grid);
  drawMinimap();
  setTool(state.settings.tool || 'select');
}


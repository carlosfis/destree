/* =========================================================
   16. Ajustes de página (drawer): etiquetas, ramificaciones, responsables, datos, ajustes; F4b: pestaña Página (nombre, visibilidad, células)
   ========================================================= */
import { $, $$, uid, esc, MOD, TAG_COLORS, TYPE_META } from '../core/utils.js';
import { viewport } from '../core/dom.js';
import {
  S, defaultState, demoData, normalizeState, save, nodeById, roots, descendantsOf, typeName, typeNames,
} from '../core/state.js';
import { pushHistory } from '../core/history.js';
import { applyCamera, nodesBBox, fitToScreen } from '../canvas/camera.js';
import { sel } from '../canvas/render-nodes.js';
import { clearSelection, renderAll } from '../canvas/selection.js';
import { minimap, drawMinimap } from '../canvas/minimap.js';
import { setTool } from '../canvas/pointer-gestures.js';
import { openPopover, closePopover } from '../ui/popover.js';
import { confirmBox, promptBox } from '../ui/dialogs.js';
import { normalizeOwner } from '../ui/card-editor-docs.js';
import { computeLayout } from '../canvas/layout.js';
import { applyTheme, toast } from '../ui/theme.js';
import * as api from '../core/api.js';
export const adminPanel = $('#adminPanel');
export function toggleAdmin(open) {
  const willOpen = open ?? !adminPanel.classList.contains('open');
  adminPanel.classList.toggle('open', willOpen);
  if (willOpen) renderAdmin();
}
$('#btnAdmin').addEventListener('click', () => toggleAdmin());
$('#closeAdmin').addEventListener('click', () => toggleAdmin(false));
$('#adminTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.adminTab = b.dataset.tab;
  $$('#adminTabs button').forEach(x => x.classList.toggle('active', x === b));
  renderAdmin();
});
export function renderAdmin() {
  const body = $('#adminBody');
  body.innerHTML = '';
  ({ tags: renderTagsTab, types: renderTypesTab, edgeTypes: renderEdgeTypesTab, owners: renderOwnersTab, data: renderDataTab, settings: renderSettingsTab, page: renderPageTab })[S.adminTab](body);
}
/* --- Tipos: nombres visibles de software / ds / uikit por página (la semántica y las reglas de anidación no cambian) --- */
const typesTabBtn = document.createElement('button'); typesTabBtn.dataset.tab = 'types'; typesTabBtn.textContent = 'Tipos';
$('#adminTabs [data-tab="edgeTypes"]').before(typesTabBtn); // pestaña insertada por JS (markup legacy intacto)
export function renderTypesTab(body) {
  const rules = { software: 'Contenedor (Main instance si es raíz). Puede anidar otros elementos.', ds: `Vive dentro de ${esc(typeName('software'))}; lo usan uno o varios ${esc(typeName('software'))}.`, uikit: `Vive dentro de ${esc(typeName('software'))} y deriva de una fuente (${esc(typeName('ds'))} o ${esc(typeName('software'))}).` };
  body.innerHTML = `<h3>Nombres de tipo</h3><p>Renombra los tres tipos para adaptar la página a otros usos (p. ej. Producto / Librería / Plantilla). Cambia el nombre en cards, menús, editor y avisos; las reglas de anidación se mantienen.</p><div id="typeRows"></div>
    <div class="inline-actions"><button class="btn" id="typesReset">Restablecer nombres</button></div>`;
  const rows = $('#typeRows', body);
  for (const [k, m] of Object.entries(TYPE_META)) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="swatch" style="background:${m.color}"></span><div class="grow"><input class="inline" maxlength="40" value="${esc(typeName(k))}" placeholder="${esc(m.label)}" style="width:100%"><div class="hint">${rules[k]}</div></div>`;
    row.querySelector('input').addEventListener('change', e => { const v = e.target.value.trim().slice(0, 40) || m.label; e.target.value = v; pushHistory(); typeNames()[k] = v; applyTypeNames(); renderAll(); save(); renderAdmin(); toast(`Tipo renombrado a "${v}"`); });
    rows.appendChild(row);
  }
  $('#typesReset', body).addEventListener('click', () => { pushHistory(); for (const k of Object.keys(TYPE_META)) typeNames()[k] = TYPE_META[k].label; applyTypeNames(); renderAll(); save(); renderAdmin(); });
}
/** Leyenda del lienzo (markup legacy) con los nombres de tipo vigentes. */
export function applyTypeNames() {
  const sp = $$('#legend span');
  if (sp.length < 4) return;
  const ds = typeName('ds'), sw = typeName('software'), kit = typeName('uikit');
  sp[1].lastChild.textContent = ` usa su ${ds}`; sp[2].lastChild.textContent = ` usa ${ds} de otro ${sw}`; sp[3].lastChild.textContent = ` ${kit} deriva de`;
}
/** F4b: pestaña Página (metadatos/visibilidad) solo con pages.edit. Se inserta por JS para no tocar el markup legacy. Usuarios/células viven en #/admin. */
export function enablePageTab() {
  if (!S.session || !S.session.permissions.includes('pages.edit') || $('#adminTabs [data-tab="page"]')) return;
  const b = document.createElement('button'); b.dataset.tab = 'page'; b.textContent = 'Página';
  $('#adminTabs').prepend(b);
}
/* --- F4b: Página --- */
export function renderPageTab(body) {
  const p = S.state.page, cells = S.cellList || [];
  body.innerHTML = `<h3>Página</h3><form id="pageMetaForm">
    <div class="field"><label>Nombre</label><input name="name" maxlength="120" required value="${esc(p.name)}"></div>
    <div class="field"><label>Descripción</label><textarea name="description" maxlength="500" rows="2">${esc(p.description || '')}</textarea></div>
    <div class="field"><label>Visibilidad</label><div class="segmented" id="pageVis"><button type="button" data-v="org" class="${p.visibility !== 'cells' ? 'active' : ''}">Toda la organización</button><button type="button" data-v="cells" class="${p.visibility === 'cells' ? 'active' : ''}">Solo células</button></div>
      <div class="check-list" id="pageCells" ${p.visibility === 'cells' ? '' : 'hidden'}>${cells.length ? cells.map(c => `<label><input type="checkbox" value="${c.id}" ${(p.cellIds || []).includes(c.id) ? 'checked' : ''}><span class="t-dot tag-${esc(c.color)}"></span>${esc(c.name)}</label>`).join('') : '<div class="empty">No hay células (Administración → Células).</div>'}</div>
      <div class="hint">Una página solo-células la ven sus miembros y quienes tengan cards asignadas en ella. Admin y head la ven siempre.</div></div>
    <div class="inline-actions"><button class="btn primary" type="submit">Guardar</button>${S.session?.permissions.includes('pages.archive') ? '<button class="btn" type="button" id="pageArchive">Archivar página</button>' : ''}</div></form>
    <p style="margin-top:12px">Versión ${S.version} · ${roots().length} raíces · ${S.state.nodes.length} cards.</p>`;
  $('#pageVis', body).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#pageVis button', body).forEach(x => x.classList.toggle('active', x === b)); $('#pageCells', body).hidden = b.dataset.v !== 'cells'; });
  $('#pageMetaForm', body).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.currentTarget;
    const visibility = $('#pageVis button.active', body).dataset.v;
    const cellIds = visibility === 'cells' ? $$('#pageCells input:checked', body).map(i => i.value) : [];
    try {
      const r = await api.patchPage(S.pageId, { name: f.name.value.trim(), description: f.description.value.trim(), visibility, cellIds });
      S.state.page = { ...S.state.page, name: r.name, description: r.description, visibility: r.visibility, cellIds: r.cellIds }; S.version = r.version;
      document.dispatchEvent(new CustomEvent('destree:page-meta')); toast('Página guardada'); renderAdmin();
    } catch (err) { toast(err.message, 'error', 5000); }
  });
  $('#pageArchive', body)?.addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'Archivar página', message: `"${p.name}" dejará de aparecer en el lobby (pestaña Archivadas) y no se podrá editar hasta restaurarla.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Archivar', value: 'ok', kind: 'danger' }] });
    if (!ok) return;
    try { await api.archivePage(S.pageId); toggleAdmin(false); toast('Página archivada'); location.hash = '#/lobby'; } catch (err) { toast(err.message, 'error', 5000); }
  });
}
export function colorPicker(x, y, current, onPick) {
  openPopover(x, y, el => {
    el.innerHTML = `<div class="color-grid">${TAG_COLORS.map(c => `<button class="tag-${c} ${c === current ? 'active' : ''}" data-c="${c}" title="${c}"></button>`).join('')}</div>`;
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { closePopover(); onPick(b.dataset.c); }));
  });
}

/* --- Etiquetas --- */
export function renderTagsTab(body) {
  const usage = id => S.state.nodes.filter(n => n.tags.includes(id)).length;
  body.innerHTML = `<h3>Etiquetas (${S.state.tags.length})</h3><p>Clic en el color para cambiarlo; edita el nombre en línea.</p><div id="tagRows"></div>
    <h3>Nueva etiqueta</h3><form class="row" id="newTagForm"><input class="grow" placeholder="Nombre de la etiqueta" required><button class="btn primary" type="submit">Agregar</button></form>`;
  const rows = $('#tagRows', body);
  if (!S.state.tags.length) rows.innerHTML = '<div class="empty">No hay etiquetas.</div>';
  for (const t of S.state.tags) {
    const row = document.createElement('div'); row.className = 'row';
    const u = usage(t.id);
    row.innerHTML = `<button class="swatch tag-${t.color}" title="Cambiar color"></button><input class="inline grow" value="${esc(t.name)}"><span class="count">${u} card${u === 1 ? '' : 's'}</span><button class="icon-btn" title="Eliminar">🗑</button>`;
    const [sw, inp, , del] = row.children;
    sw.addEventListener('click', e => colorPicker(e.clientX, e.clientY, t.color, c => { pushHistory(); t.color = c; renderAll(); save(); }));
    inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v) { inp.value = t.name; return; } pushHistory(); t.name = v; renderAll(); save(); });
    del.addEventListener('click', async () => {
      if (u && !(await confirmBox({ title: 'Eliminar etiqueta', message: `"${t.name}" se usa en ${u} card${u > 1 ? 's' : ''}. Se quitará de todas.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] }))) return;
      pushHistory(); S.state.tags = S.state.tags.filter(x => x !== t); S.state.nodes.forEach(n => n.tags = n.tags.filter(x => x !== t.id)); renderAll(); save();
    });
    rows.appendChild(row);
  }
  $('#newTagForm', body).addEventListener('submit', e => {
    e.preventDefault(); const name = e.target.querySelector('input').value.trim(); if (!name) return;
    pushHistory(); S.state.tags.push({ id: uid(), name, color: TAG_COLORS[S.state.tags.length % TAG_COLORS.length] }); save(); renderAdmin();
  });
}

/* --- Tipos de ramificación --- */
export function renderEdgeTypesTab(body) {
  const usage = id => S.state.nodes.filter(n => n.parentId && n.branchTypeId === id).length;
  body.innerHTML = `<h3>Tipos de ramificación (${S.state.branchTypes.length})</h3><p>La ramificación es el anidamiento de ${esc(typeName('software'))} dentro de otro. El tipo se muestra como chip en la cabecera del contenedor anidado.</p><div id="etRows"></div>
    <h3>Nuevo tipo</h3><form class="row" id="newEtForm"><input class="grow" placeholder="Nombre del tipo" required><button class="btn primary" type="submit">Agregar</button></form>`;
  const rows = $('#etRows', body);
  for (const t of S.state.branchTypes) {
    const row = document.createElement('div'); row.className = 'row';
    const u = usage(t.id);
    row.innerHTML = `<button class="swatch tag-${t.color}" title="Cambiar color"></button><input class="inline grow" value="${esc(t.name)}"><span class="count">${u} anidado${u === 1 ? '' : 's'}</span><button class="icon-btn" title="Eliminar">🗑</button>`;
    const [sw, inp, , del] = row.children;
    sw.addEventListener('click', e => colorPicker(e.clientX, e.clientY, t.color, c => { pushHistory(); t.color = c; renderAll(); save(); }));
    inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v) { inp.value = t.name; return; } pushHistory(); t.name = v; renderAll(); save(); });
    del.addEventListener('click', async () => {
      if (S.state.branchTypes.length === 1) return toast('Debe existir al menos un tipo', 'error');
      const fallback = S.state.branchTypes.find(x => x !== t);
      if (u && !(await confirmBox({ title: 'Eliminar tipo', message: `"${t.name}" se usa en ${u} ${typeName('software')} anidado${u > 1 ? 's' : ''}. Pasarán a "${fallback.name}".`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] }))) return;
      pushHistory(); S.state.nodes.forEach(n => { if (n.branchTypeId === t.id) n.branchTypeId = fallback.id; }); S.state.branchTypes = S.state.branchTypes.filter(x => x !== t); renderAll(); save();
    });
    rows.appendChild(row);
  }
  $('#newEtForm', body).addEventListener('submit', e => {
    e.preventDefault(); const name = e.target.querySelector('input').value.trim(); if (!name) return;
    pushHistory(); S.state.branchTypes.push({ id: uid(), name, color: TAG_COLORS[S.state.branchTypes.length % TAG_COLORS.length] }); save(); renderAdmin();
  });
}

/* --- Responsables --- */
export function renderOwnersTab(body) {
  const map = new Map();
  for (const n of S.state.nodes) if (n.owner) map.set(n.owner, (map.get(n.owner) || 0) + 1);
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
      pushHistory(); S.state.nodes.forEach(n => { if (n.owner === owner) n.owner = nv; (n.staff || []).forEach(m => { if (m.name === owner) m.name = nv; }); n.staff = (n.staff || []).filter(m => m.name); }); renderAll(); save();
      toast(nv ? `Renombrado a ${nv}` : 'Responsable eliminado de las cards');
    });
    rows.appendChild(row);
  }
}

/* --- Datos --- */
export function renderDataTab(body) {
  const bytes = JSON.stringify(S.state).length;
  const demoCount = S.state.nodes.filter(n => n.demo).length;
  body.innerHTML = `<h3>Respaldo</h3><p>${S.offline ? 'localStorage es frágil (se borra al limpiar el navegador). Exporta un JSON periódicamente.' : 'El JSON exportado incrusta las imágenes (portable entre instalaciones).'} Importar reemplaza todo el estado actual.</p>
    <div class="inline-actions"><button class="btn primary" id="btnExport">⤓ Exportar JSON</button><button class="btn" id="btnCopy">Copiar JSON</button><button class="btn" id="btnImport">⤒ Importar JSON</button></div>
    <p style="margin-top:10px">Tamaño actual: <b>${(bytes / 1024).toFixed(1)} KB</b> · ${roots().length} raíces · ${S.state.nodes.length} cards · ${S.state.edges.length} conexiones · ${S.state.nodes.filter(n => n.image || n.imageId).length} con imagen.</p>
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
    S.state.nodes.push(...d.nodes); S.state.edges.push(...d.edges);
    renderAll();
    const target = computeLayout(d.nodes.filter(n => !n.parentId).map(n => n.id));
    for (const [id, p] of target) { const n = nodeById(id); n.x = p.x + (n.parentId ? 0 : offX); n.y = p.y; }
    renderAll(); save(); fitToScreen(); toast('Ejemplos cargados');
  });
  $('#btnClearDemo', body).addEventListener('click', () => { pushHistory(); removeDemo(); renderAll(); save(); toast('Ejemplos eliminados'); });
  $('#btnClearAll', body).addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'Borrar todo', message: 'Se eliminarán todas las cards, conexiones, etiquetas y tipos de ramificación. Esta acción se puede deshacer con Ctrl/⌘+Z mientras no recargues la página.', buttons: [{ label: 'Cancelar', value: '' }, { label: 'Borrar todo', value: 'ok', kind: 'danger' }] });
    if (!ok) return;
    pushHistory(); const d = defaultState(); S.state.nodes = []; S.state.edges = []; S.state.tags = d.tags; S.state.branchTypes = d.branchTypes; clearSelection(); renderAll(); save(); toast('Todo borrado');
  });
}
export function removeDemo() {
  const demoIds = new Set(S.state.nodes.filter(n => n.demo).map(n => n.id));
  // Lo que viva dentro de un contenedor demo también se va (no puede quedar huérfano)
  for (const id of [...demoIds]) descendantsOf(id).forEach(d => demoIds.add(d));
  S.state.nodes = S.state.nodes.filter(n => !demoIds.has(n.id));
  S.state.edges = S.state.edges.filter(e => !demoIds.has(e.from) && !demoIds.has(e.to));
  demoIds.forEach(id => sel.nodes.delete(id));
}
export function exportString() { S.state.camera = { ...S.cam }; return JSON.stringify({ ...S.state, exportedAt: new Date().toISOString() }, null, 2); }
/** F5: con servidor, exporta el documento con imágenes incrustadas (`?embedImages=1`). */
export async function exportJSON() {
  let text = exportString();
  if (!S.offline && S.pageId) { try { const doc = await api.getPage(S.pageId, { embedImages: true }); delete doc.refs; text = JSON.stringify({ ...doc, exportedAt: new Date().toISOString() }, null, 2); } catch (err) { toast('Exportando copia local: ' + err.message, 'error'); } }
  const blob = new Blob([text], { type: 'application/json' });
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
    Object.assign(S.state, s);
    S.cam = { ...s.camera };
    clearSelection(); applyTheme(); applySettingsUI(); renderAll(); applyCamera(); save();
    toast('Estado importado');
  } catch (err) { toast('Importación fallida: ' + err.message, 'error', 6000); }
});

/* --- Ajustes --- */
export function renderSettingsTab(body) {
  const sw = (key, label, hint) => `<div class="toggle-row"><div><div class="label">${label}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div><button class="switch ${S.state.settings[key] ? 'on' : ''}" data-key="${key}" role="switch" aria-checked="${!!S.state.settings[key]}"></button></div>`;
  body.innerHTML = `<h3>Tema</h3><div class="segmented" id="themeSeg"><button data-t="light">Claro</button><button data-t="dark">Oscuro</button><button data-t="">Sistema</button></div>
    <h3>Lienzo</h3>
    ${sw('snap', 'Ajuste a cuadrícula (8 px)', 'Mantén Alt al arrastrar para desactivarlo temporalmente.')}
    ${sw('grid', 'Fondo de puntos')}
    ${sw('minimap', 'Minimapa')}
    <h3>Cómo funciona</h3><p>Cada ${esc(typeName('software'))} es un contenedor. Arrastra una card dentro de otro contenedor para anidarla (ramificación), o fuera de todos para convertirla en Main instance (raíz). ${esc(typeName('ds'))} y ${esc(typeName('uikit'))} siempre viven dentro de ${esc(typeName('software'))}. Arrastra desde un puerto de la cabecera para conectar o anidar. Los nombres de los tipos se cambian en la pestaña Tipos.</p>
    <p>Rueda / dos dedos: pan · ${MOD} + rueda o pinch: zoom · Espacio + arrastrar, botón central o herramienta Mano (H): pan · Arrastrar en el fondo: selección por recuadro.</p>`;
  $$('#themeSeg button', body).forEach(b => { b.classList.toggle('active', (S.state.settings.theme || '') === b.dataset.t); b.addEventListener('click', () => { S.state.settings.theme = b.dataset.t || null; applyTheme(); save(); renderAdmin(); }); });
  body.querySelectorAll('.switch').forEach(b => b.addEventListener('click', () => { S.state.settings[b.dataset.key] = !S.state.settings[b.dataset.key]; applySettingsUI(); save(); renderAdmin(); }));
}
export function applySettingsUI() {
  viewport.classList.toggle('no-grid', !S.state.settings.grid);
  applyTypeNames();
  drawMinimap();
  setTool(S.state.settings.tool || 'select');
}


/* =========================================================
   16. Ajustes de página (drawer): etiquetas, ramificaciones, responsables, datos, ajustes; F4b: pestaña Página (nombre, visibilidad, células)
   ========================================================= */
import { $, $$, uid, esc, MOD, TAG_COLORS, TYPE_META, applyDataStyles } from '../core/utils.js';
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
import { has, roleLabel } from '../core/roles.js'; // P10
import { computeLayout } from '../canvas/layout.js';
import { applyTheme, toast } from '../ui/theme.js';
import * as api from '../core/api.js';
import { t } from '../core/i18n.js'; // P15
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
  const TN = { software: esc(typeName('software')), ds: esc(typeName('ds')), uikit: esc(typeName('uikit')) };
  const rules = { software: t('Contenedor (Main instance si es raíz). Puede anidar otros elementos.'), ds: t('Vive dentro de {software}; lo usan uno o varios {software}.', TN), uikit: t('Vive dentro de {software} y deriva de una fuente ({ds} o {software}).', TN) };
  body.innerHTML = `<h3>${t('Nombres de tipo')}</h3><p>${t('Renombra los tres tipos para adaptar la página a otros usos (p. ej. Producto / Librería / Plantilla). Cambia el nombre en cards, menús, editor y avisos; las reglas de anidación se mantienen.')}</p><div id="typeRows"></div>
    <div class="inline-actions"><button class="btn" id="typesReset">${t('Restablecer nombres')}</button></div>`;
  const rows = $('#typeRows', body);
  for (const [k, m] of Object.entries(TYPE_META)) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="swatch" data-style="background:${m.color}"></span><div class="grow"><input class="inline" maxlength="40" value="${esc(typeName(k))}" placeholder="${esc(m.label)}" data-style="width:100%"><div class="hint">${rules[k]}</div></div>`; applyDataStyles(row);
    row.querySelector('input').addEventListener('change', e => { const v = e.target.value.trim().slice(0, 40) || m.label; e.target.value = v; pushHistory(); typeNames()[k] = v; applyTypeNames(); renderAll(); save(); renderAdmin(); toast(t('Tipo renombrado a "{v}"', { v })); });
    rows.appendChild(row);
  }
  $('#typesReset', body).addEventListener('click', () => { pushHistory(); for (const k of Object.keys(TYPE_META)) typeNames()[k] = TYPE_META[k].label; applyTypeNames(); renderAll(); save(); renderAdmin(); });
}
/** Leyenda del lienzo (markup legacy) con los nombres de tipo vigentes. */
export function applyTypeNames() {
  const sp = $$('#legend span');
  if (sp.length < 4) return;
  const ds = typeName('ds'), sw = typeName('software'), kit = typeName('uikit');
  sp[1].lastChild.textContent = ' ' + t('usa su {ds}', { ds }); sp[2].lastChild.textContent = ' ' + t('usa {ds} de otro {software}', { ds, software: sw }); sp[3].lastChild.textContent = ' ' + t('{uikit} deriva de', { uikit: kit });
}
/** F4b: pestaña Página (metadatos/visibilidad). P10: con pages.meta (nombre/descripción) o pages.visibility (visibilidad/células). Se inserta por JS para no tocar el markup legacy. */
export function enablePageTab() {
  if (!S.session || !(has('pages.meta') || has('pages.visibility')) || $('#adminTabs [data-tab="page"]')) return;
  const b = document.createElement('button'); b.dataset.tab = 'page'; b.textContent = t('Página');
  $('#adminTabs').prepend(b);
}
/* --- F4b: Página --- */
export function renderPageTab(body) {
  const p = S.state.page, cells = S.cellList || [], meta = has('pages.meta'), vis = has('pages.visibility'); // P10
  body.innerHTML = `<h3>${t('Página')}</h3><form id="pageMetaForm">
    <div class="field"><label>${t('Nombre')}</label><input name="name" maxlength="120" required value="${esc(p.name)}" ${meta ? '' : 'disabled'}></div>
    <div class="field"><label>${t('Descripción')}</label><textarea name="description" maxlength="500" rows="2" ${meta ? '' : 'disabled'}>${esc(p.description || '')}</textarea></div>
    ${meta ? '' : `<div class="hint">${t('Renombrar la página es de nivel ≥4 ({ops}).', { ops: esc(roleLabel('ops')) })}</div>`}
    <div class="field"><label>${t('Visibilidad')}</label><div class="segmented" id="pageVis"><button type="button" data-v="org" class="${p.visibility !== 'cells' ? 'active' : ''}" ${vis ? '' : 'disabled'}>${t('Toda la organización')}</button><button type="button" data-v="cells" class="${p.visibility === 'cells' ? 'active' : ''}" ${vis ? '' : 'disabled'}>${t('Solo células')}</button></div>
      <div class="check-list" id="pageCells" ${p.visibility === 'cells' ? '' : 'hidden'}>${cells.length ? cells.map(c => `<label><input type="checkbox" value="${c.id}" ${(p.cellIds || []).includes(c.id) ? 'checked' : ''}><span class="t-dot tag-${esc(c.color)}"></span>${esc(c.name)}</label>`).join('') : `<div class="empty">${t('No hay células (Administración → Células).')}</div>`}</div>
      <div class="hint">${t('Una página solo-células la ven sus miembros y quienes tengan cards asignadas en ella. Los niveles 3 a 5 ({head}, {ops}, {admin}) la ven siempre.', { head: esc(roleLabel('head')), ops: esc(roleLabel('ops')), admin: esc(roleLabel('admin')) })}</div></div>
    <div class="inline-actions"><button class="btn primary" type="submit">${t('Guardar')}</button>${S.session?.permissions.includes('pages.archive') ? `<button class="btn" type="button" id="pageArchive">${t('Archivar página')}</button>` : ''}</div></form>
    <p data-style="margin-top:12px">${t('Versión {v} · {roots} raíces · {cards} cards.', { v: S.version, roots: roots().length, cards: S.state.nodes.length })}</p>`; applyDataStyles(body);
  $('#pageVis', body).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#pageVis button', body).forEach(x => x.classList.toggle('active', x === b)); $('#pageCells', body).hidden = b.dataset.v !== 'cells'; });
  $('#pageMetaForm', body).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.currentTarget;
    const visibility = $('#pageVis button.active', body).dataset.v;
    const cellIds = visibility === 'cells' ? $$('#pageCells input:checked', body).map(i => i.value) : [];
    try {
      const r = await api.patchPage(S.pageId, { ...(meta ? { name: f.name.value.trim(), description: f.description.value.trim() } : {}), ...(vis ? { visibility, cellIds } : {}) }); // P10: solo lo permitido
      S.state.page = { ...S.state.page, name: r.name, description: r.description, visibility: r.visibility, cellIds: r.cellIds }; S.version = r.version;
      document.dispatchEvent(new CustomEvent('destree:page-meta')); toast(t('Página guardada')); renderAdmin();
    } catch (err) { toast(err.message, 'error', 5000); }
  });
  $('#pageArchive', body)?.addEventListener('click', async () => {
    const ok = await confirmBox({ title: t('Archivar página'), message: t('"{name}" dejará de aparecer en el lobby (pestaña Archivadas) y no se podrá editar hasta restaurarla.', { name: p.name }), buttons: [{ label: t('Cancelar'), value: '' }, { label: t('Archivar'), value: 'ok', kind: 'danger' }] });
    if (!ok) return;
    try { await api.archivePage(S.pageId); toggleAdmin(false); toast(t('Página archivada')); location.hash = '#/lobby'; } catch (err) { toast(err.message, 'error', 5000); }
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
  body.innerHTML = `<h3>${t('Etiquetas')} (${S.state.tags.length})</h3><p>${t('Clic en el color para cambiarlo; edita el nombre en línea.')}</p><div id="tagRows"></div>
    <h3>${t('Nueva etiqueta')}</h3><form class="row" id="newTagForm"><input class="grow" placeholder="${t('Nombre de la etiqueta')}" required><button class="btn primary" type="submit">${t('Agregar')}</button></form>`;
  const rows = $('#tagRows', body);
  if (!S.state.tags.length) rows.innerHTML = `<div class="empty">${t('No hay etiquetas.')}</div>`;
  for (const tg of S.state.tags) {
    const row = document.createElement('div'); row.className = 'row';
    const u = usage(tg.id);
    row.innerHTML = `<button class="swatch tag-${tg.color}" title="${t('Cambiar color')}"></button><input class="inline grow" value="${esc(tg.name)}"><span class="count">${t(u === 1 ? '{n} card' : '{n} cards', { n: u })}</span><button class="icon-btn" title="${t('Eliminar')}">🗑</button>`;
    const [sw, inp, , del] = row.children;
    sw.addEventListener('click', e => colorPicker(e.clientX, e.clientY, tg.color, c => { pushHistory(); tg.color = c; renderAll(); save(); }));
    inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v) { inp.value = tg.name; return; } pushHistory(); tg.name = v; renderAll(); save(); });
    del.addEventListener('click', async () => {
      if (u && !(await confirmBox({ title: t('Eliminar etiqueta'), message: t(u > 1 ? '"{name}" se usa en {n} cards. Se quitará de todas.' : '"{name}" se usa en {n} card. Se quitará de todas.', { name: tg.name, n: u }), buttons: [{ label: t('Cancelar'), value: '' }, { label: t('Eliminar'), value: 'ok', kind: 'danger' }] }))) return;
      pushHistory(); S.state.tags = S.state.tags.filter(x => x !== tg); S.state.nodes.forEach(n => n.tags = n.tags.filter(x => x !== tg.id)); renderAll(); save();
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
  body.innerHTML = `<h3>${t('Tipos de ramificación')} (${S.state.branchTypes.length})</h3><p>${t('La ramificación es el anidamiento de {software} dentro de otro. El tipo se muestra como chip en la cabecera del contenedor anidado.', { software: esc(typeName('software')) })}</p><div id="etRows"></div>
    <h3>${t('Nuevo tipo')}</h3><form class="row" id="newEtForm"><input class="grow" placeholder="${t('Nombre del tipo')}" required><button class="btn primary" type="submit">${t('Agregar')}</button></form>`;
  const rows = $('#etRows', body);
  for (const bt of S.state.branchTypes) {
    const row = document.createElement('div'); row.className = 'row';
    const u = usage(bt.id);
    row.innerHTML = `<button class="swatch tag-${bt.color}" title="${t('Cambiar color')}"></button><input class="inline grow" value="${esc(bt.name)}"><span class="count">${t(u === 1 ? '{n} anidado' : '{n} anidados', { n: u })}</span><button class="icon-btn" title="${t('Eliminar')}">🗑</button>`;
    const [sw, inp, , del] = row.children;
    sw.addEventListener('click', e => colorPicker(e.clientX, e.clientY, bt.color, c => { pushHistory(); bt.color = c; renderAll(); save(); }));
    inp.addEventListener('change', () => { const v = inp.value.trim(); if (!v) { inp.value = bt.name; return; } pushHistory(); bt.name = v; renderAll(); save(); });
    del.addEventListener('click', async () => {
      if (S.state.branchTypes.length === 1) return toast(t('Debe existir al menos un tipo'), 'error');
      const fallback = S.state.branchTypes.find(x => x !== bt);
      if (u && !(await confirmBox({ title: t('Eliminar tipo'), message: t(u > 1 ? '"{name}" se usa en {n} {software} anidados. Pasarán a "{fallback}".' : '"{name}" se usa en {n} {software} anidado. Pasarán a "{fallback}".', { name: bt.name, n: u, software: typeName('software'), fallback: fallback.name }), buttons: [{ label: t('Cancelar'), value: '' }, { label: t('Eliminar'), value: 'ok', kind: 'danger' }] }))) return;
      pushHistory(); S.state.nodes.forEach(n => { if (n.branchTypeId === bt.id) n.branchTypeId = fallback.id; }); S.state.branchTypes = S.state.branchTypes.filter(x => x !== bt); renderAll(); save();
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
  body.innerHTML = `<h3>${t('Responsables detectados')} (${owners.length})</h3><p>${t('Se detectan a partir del campo @ de cada card. Renombrar reemplaza el valor en todas las cards.')}</p><div id="ownerRows"></div>`;
  const rows = $('#ownerRows', body);
  if (!owners.length) rows.innerHTML = `<div class="empty">${t('Ninguna card tiene responsable.')}</div>`;
  for (const [owner, count] of owners) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="owner chip tag-gray" data-style="font-family:var(--mono)">${esc(owner)}</span><span class="grow"></span><span class="count">${t(count === 1 ? '{n} card' : '{n} cards', { n: count })}</span><button class="btn">${t('Renombrar')}</button>`; applyDataStyles(row);
    row.querySelector('.btn').addEventListener('click', async () => {
      const v = await promptBox({ title: t('Renombrar responsable'), label: t('Nuevo nombre para {owner} ({n} cards)', { owner, n: count }), value: owner, okLabel: t('Renombrar') });
      if (v === null) return; const nv = normalizeOwner(v);
      pushHistory(); S.state.nodes.forEach(n => { if (n.owner === owner) n.owner = nv; (n.staff || []).forEach(m => { if (m.name === owner) m.name = nv; }); n.staff = (n.staff || []).filter(m => m.name); }); renderAll(); save();
      toast(nv ? t('Renombrado a {name}', { name: nv }) : t('Responsable eliminado de las cards'));
    });
    rows.appendChild(row);
  }
}

/* --- Datos --- */
export function renderDataTab(body) {
  const bytes = JSON.stringify(S.state).length;
  const demoCount = S.state.nodes.filter(n => n.demo).length;
  body.innerHTML = `<h3>${t('Respaldo')}</h3><p>${S.offline ? t('localStorage es frágil (se borra al limpiar el navegador). Exporta un JSON periódicamente.') : t('El JSON exportado incrusta las imágenes (portable entre instalaciones).')} ${t('Importar reemplaza todo el estado actual.')}</p>
    <div class="inline-actions"><button class="btn primary" id="btnExport">${t('⤓ Exportar JSON')}</button><button class="btn" id="btnCopy">${t('Copiar JSON')}</button><button class="btn" id="btnImport">${t('⤒ Importar JSON')}</button></div>
    <p data-style="margin-top:10px">${t('Tamaño actual: <b>{kb} KB</b> · {roots} raíces · {cards} cards · {edges} conexiones · {images} con imagen.', { kb: (bytes / 1024).toFixed(1), roots: roots().length, cards: S.state.nodes.length, edges: S.state.edges.length, images: S.state.nodes.filter(n => n.image || n.imageId).length })}</p>
    <h3>${t('Datos de ejemplo')}</h3><p>${demoCount ? t('Hay {n} cards de ejemplo en el lienzo.', { n: demoCount }) : t('No hay cards de ejemplo cargadas.')}</p>
    <div class="inline-actions"><button class="btn" id="btnLoadDemo">${t('Cargar ejemplos')}</button><button class="btn danger" id="btnClearDemo" ${demoCount ? '' : 'disabled'}>${t('Borrar ejemplos')}</button></div>
    <h3>${t('Zona de peligro')}</h3><p>${t('Elimina todas las cards, conexiones, etiquetas y tipos, y restaura los valores iniciales.')}</p>
    <button class="btn danger" id="btnClearAll">${t('Borrar todo')}</button>`; applyDataStyles(body);
  $('#btnExport', body).addEventListener('click', exportJSON);
  $('#btnCopy', body).addEventListener('click', async () => { try { await navigator.clipboard.writeText(exportString()); toast(t('JSON copiado al portapapeles')); } catch { toast(t('No se pudo copiar'), 'error'); } });
  $('#btnImport', body).addEventListener('click', () => $('#importFile').click());
  $('#btnLoadDemo', body).addEventListener('click', () => {
    pushHistory(); removeDemo(); const d = demoData();
    const bb = nodesBBox(); const offX = bb ? bb.x + bb.w + 120 : 0;
    S.state.nodes.push(...d.nodes); S.state.edges.push(...d.edges);
    renderAll();
    const target = computeLayout(d.nodes.filter(n => !n.parentId).map(n => n.id));
    for (const [id, p] of target) { const n = nodeById(id); n.x = p.x + (n.parentId ? 0 : offX); n.y = p.y; }
    renderAll(); save(); fitToScreen(); toast(t('Ejemplos cargados'));
  });
  $('#btnClearDemo', body).addEventListener('click', () => { pushHistory(); removeDemo(); renderAll(); save(); toast(t('Ejemplos eliminados')); });
  $('#btnClearAll', body).addEventListener('click', async () => {
    const ok = await confirmBox({ title: t('Borrar todo'), message: t('Se eliminarán todas las cards, conexiones, etiquetas y tipos de ramificación. Esta acción se puede deshacer con Ctrl/⌘+Z mientras no recargues la página.'), buttons: [{ label: t('Cancelar'), value: '' }, { label: t('Borrar todo'), value: 'ok', kind: 'danger' }] });
    if (!ok) return;
    pushHistory(); const d = defaultState(); S.state.nodes = []; S.state.edges = []; S.state.tags = d.tags; S.state.branchTypes = d.branchTypes; clearSelection(); renderAll(); save(); toast(t('Todo borrado'));
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
  if (!S.offline && S.pageId) { try { const doc = await api.getPage(S.pageId, { embedImages: true }); delete doc.refs; text = JSON.stringify({ ...doc, exportedAt: new Date().toISOString() }, null, 2); } catch (err) { toast(t('Exportando copia local: {msg}', { msg: err.message }), 'error'); } }
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `arbol-sistemas-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(t('JSON exportado'));
}
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error(t('El archivo no tiene el formato esperado (nodes/edges).'));
    const legacy = data.edges.some(e => e && e.kind === 'branch');
    const ok = await confirmBox({ title: t('Importar JSON'), message: t('El archivo contiene {n} cards y {e} conexiones.', { n: data.nodes.length, e: data.edges.length }) + (legacy ? '\n' + t('Es un respaldo del formato anterior: las ramificaciones se convertirán en contenedores anidados.') : '') + '\n' + t('Reemplazará el estado actual (puedes deshacerlo).'), buttons: [{ label: t('Cancelar'), value: '' }, { label: t('Importar'), value: 'ok', kind: 'primary' }] });
    if (!ok) return;
    pushHistory();
    const s = normalizeState(data);
    Object.assign(S.state, s);
    S.cam = { ...s.camera };
    clearSelection(); applyTheme(); applySettingsUI(); renderAll(); applyCamera(); save();
    toast(t('Estado importado'));
  } catch (err) { toast(t('Importación fallida: {msg}', { msg: err.message }), 'error', 6000); }
});

/* --- Ajustes --- */
export function renderSettingsTab(body) {
  const sw = (key, label, hint) => `<div class="toggle-row"><div><div class="label">${label}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div><button class="switch ${S.state.settings[key] ? 'on' : ''}" data-key="${key}" role="switch" aria-checked="${!!S.state.settings[key]}"></button></div>`;
  const TN = { software: esc(typeName('software')), ds: esc(typeName('ds')), uikit: esc(typeName('uikit')) };
  body.innerHTML = `<h3>${t('Tema')}</h3><div class="segmented" id="themeSeg"><button data-t="light">${t('Claro')}</button><button data-t="dark">${t('Oscuro')}</button><button data-t="">${t('Sistema')}</button></div>
    <h3>${t('Lienzo')}</h3>
    ${sw('snap', t('Ajuste a cuadrícula (8 px)'), t('Mantén Alt al arrastrar para desactivarlo temporalmente.'))}
    ${sw('grid', t('Fondo de puntos'))}
    ${sw('minimap', t('Minimapa'))}
    <h3>${t('Cómo funciona')}</h3><p>${t('Cada {software} es un contenedor. Arrastra una card dentro de otro contenedor para anidarla (ramificación), o fuera de todos para convertirla en Main instance (raíz). {ds} y {uikit} siempre viven dentro de {software}. Arrastra desde un puerto de la cabecera para conectar o anidar. Los nombres de los tipos se cambian en la pestaña Tipos.', TN)}</p>
    <p>${t('Rueda / dos dedos: pan · {mod} + rueda o pinch: zoom · Espacio + arrastrar, botón central o herramienta Mano (H): pan · Arrastrar en el fondo: selección por recuadro.', { mod: MOD })}</p>`;
  $$('#themeSeg button', body).forEach(b => { b.classList.toggle('active', (S.state.settings.theme || '') === b.dataset.t); b.addEventListener('click', () => { S.state.settings.theme = b.dataset.t || null; applyTheme(); save(); renderAdmin(); }); });
  body.querySelectorAll('.switch').forEach(b => b.addEventListener('click', () => { S.state.settings[b.dataset.key] = !S.state.settings[b.dataset.key]; applySettingsUI(); save(); renderAdmin(); }));
}
export function applySettingsUI() {
  viewport.classList.toggle('no-grid', !S.state.settings.grid);
  applyTypeNames();
  drawMinimap();
  setTool(S.state.settings.tool || 'select');
}


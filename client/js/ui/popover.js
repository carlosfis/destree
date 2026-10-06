'use strict';
/* =========================================================
   11. Popover y menús
   ========================================================= */
const popover = $('#popover');
let popoverOpen = false;
function openPopover(x, y, build) {
  popover.innerHTML = '';
  build(popover);
  popover.hidden = false; popoverOpen = true;
  popover.style.left = '0px'; popover.style.top = '0px';
  const r = popover.getBoundingClientRect();
  popover.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px';
  popover.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
}
function closePopover() { popover.hidden = true; popoverOpen = false; popover.innerHTML = ''; }
document.addEventListener('pointerdown', e => { if (popoverOpen && !popover.contains(e.target)) closePopover(); }, true);
window.addEventListener('resize', () => popoverOpen && closePopover());

/** items: [{label, ico, kbd, danger, action}] | {title} | {note} | '-' */
function menuPopover(x, y, items) {
  openPopover(x, y, el => {
    for (const it of items) {
      if (it === '-') { el.appendChild(document.createElement('hr')); continue; }
      if (it.title) { const d = document.createElement('div'); d.className = 'menu-title'; d.textContent = it.title; el.appendChild(d); continue; }
      if (it.note) { const d = document.createElement('div'); d.className = 'menu-note'; d.textContent = it.note; el.appendChild(d); continue; }
      const b = document.createElement('button');
      b.className = 'menu-item' + (it.danger ? ' danger' : '');
      b.innerHTML = `<span class="ico">${it.ico || ''}</span><span>${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}`;
      b.addEventListener('click', () => { closePopover(); it.action && it.action(); });
      el.appendChild(b);
    }
  });
}
function addItems(parentId) {
  const p = nodeById(parentId);
  return [
    { title: `Agregar dentro de ${p.name}` },
    { label: 'Feature / software anidado', ico: '▣', action: () => openEditor(null, { type: 'software', parentId }) },
    { label: 'Design System', ico: '◈', action: () => openEditor(null, { type: 'ds', parentId }) },
    { label: 'UI Kit', ico: '◧', action: () => openEditor(null, { type: 'uikit', parentId }) },
  ];
}
function showAddMenu(parentId, x, y) { menuPopover(x, y, addItems(parentId)); }
function showNewMenu(x, y) {
  const center = toWorld(vpRect.width / 2, vpRect.height / 2);
  const at = { x: center.x - 160 + (Math.random() * 40 - 20), y: center.y - 90 + (Math.random() * 40 - 20) };
  const items = [{ title: 'Nueva card' }, { label: 'Software raíz (contenedor maestro)', ico: '▣', action: () => openEditor(null, { type: 'software', ...at }) }];
  const selected = sel.nodes.size === 1 ? nodeById([...sel.nodes][0]) : null;
  if (selected && isContainer(selected)) items.push('-', ...addItems(selected.id));
  else items.push({ note: 'Los DS y UI Kits se crean dentro de un software: selecciona uno o usa su botón ＋.' });
  menuPopover(x, y, items);
}
function showNodeMenu(id, x, y) {
  const n = nodeById(id); if (!n) return;
  const multi = sel.nodes.size > 1 && sel.nodes.has(id);
  const items = [
    { label: 'Editar', ico: '✎', kbd: 'Enter', action: () => openEditor(id) },
  ];
  if (isContainer(n) && !multi) items.push('-', ...addItems(id).slice(1), '-');
  if (n.parentId && !multi) items.push({ label: 'Sacar a la raíz', ico: '⤴', action: () => moveToRoot(id) });
  items.push(
    { label: multi ? `Duplicar ${sel.nodes.size} cards` : 'Duplicar', ico: '⧉', kbd: `${MOD}+D`, action: duplicateSelection },
    { label: 'Ajustar a la selección', ico: '⤢', kbd: 'Shift+2', action: () => fitToScreen([...sel.nodes]) },
    '-',
    { label: multi ? `Eliminar ${sel.nodes.size} cards` : 'Eliminar', ico: '🗑', kbd: 'Supr', danger: true, action: deleteSelection },
  );
  menuPopover(x, y, items);
}
function showEdgePopover(id, x, y) {
  const e = state.edges.find(x => x.id === id); if (!e) return;
  openPopover(x, y, el => {
    const ext = e.kind === 'ds' && isExternalDs(e);
    el.innerHTML = `<div class="menu-title">${esc(KIND_LABEL[e.kind])}${ext ? ' · externa' : ''}</div><div class="menu-note">${esc(edgeTitle(e))}</div>`;
    const del = document.createElement('button'); del.className = 'menu-item danger'; del.innerHTML = '<span class="ico">🗑</span><span>Eliminar conexión</span><kbd>Supr</kbd>';
    del.addEventListener('click', () => { closePopover(); deleteEdge(id); });
    el.appendChild(del);
  });
}


// Smoke · F3: célula + editor de raíz (visibilidad, enlaces, notas, staff), Tipos renombrados, ficha con markdown escapado y #/me. Lo ejecuta scripts/smoke.js con el contexto CDP (ev, send, step…).
export default async function (c) {
  const { ev, send, sleep, mouse, drag, key, center, step, fill, META, SHIFT, ROOT } = c;
// F3: célula → editor de raíz (visibilidad solo-células, enlaces, notas, asignarse) → badges → ficha con markdown escapado → #/me.
const NOTES = '# Título\n\n- item <b>x</b>\n\n[link](https://ok.io) [mal](javascript:alert(1)) `code`';
await step('F3: célula + editor raíz (visibilidad, 2 enlaces, notas, asignado) → chips', async () => {
  const cell = await ev(`fetch('/api/cells', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Célula Smoke', color: 'green' }) }).then(r => r.json())`);
  await ev(`location.hash = '#/admin/cells'; true`); await sleep(500);
  const tab = await ev(`({ rows: document.querySelectorAll('#adminView #cellRows .cell-row').length, cells: S.cellList.length, dir: S.userDir.length, tabs: [...document.querySelectorAll('#orgTabs button')].map(b => b.dataset.tab) })`);
  await ev(`document.querySelector('#adminBack').click(); true`); await sleep(300);
  const rootId = await ev(`S.state.nodes.find(n => !n.parentId).id`);
  await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(rootId)}))`); await sleep(150);
  const r = await ev(`(() => { const f = document.querySelector('#editorForm');
    f.querySelector('#fVis [data-v=cells]').click(); f.querySelector('#fCells input').checked = true;
    f.querySelector('#fDocAdd').click(); f.querySelector('#fDocAdd').click();
    const rows = f.querySelectorAll('.doc-row'); rows[0].querySelector('.doc-label').value = 'Figma'; rows[0].querySelector('.doc-url').value = 'https://www.figma.com/design/x';
    rows[1].querySelector('.doc-url').value = 'https://notion.so/y';
    f.elements.notes.value = ${JSON.stringify(NOTES)};
    f.querySelector('#fAssignees input').checked = true; f.elements.ownerUserId.value = S.session.user.id;
    f.querySelector('#fStaffAdd').click(); const st = f.querySelector('.staff-row'); st.querySelector('.staff-name').value = 'lorena'; st.querySelector('.staff-role').value = 'UX Designer';
    const tabs = [...f.querySelectorAll('.drawer-tabs button')].map(b => b.dataset.tab), title = f.querySelector('#drawerTitle').textContent;
    f.requestSubmit(); return { visHidden: f.querySelector('#fVisField').hidden, tabs, title }; })()`); await sleep(1200);
  const n = await ev(`(() => { const n = S.state.nodes.find(n => n.id === ${JSON.stringify(rootId)}); const el = document.querySelector('.node[data-id="' + n.id + '"]');
    return { vis: n.visibility, cells: n.cellIds, docs: n.docs.length, notes: n.notes.length, ass: n.assigneeIds.length, owner: n.ownerUserId === S.session.user.id, staff: n.staff, ownerLegacy: n.owner, staffChip: el.querySelector('.card-foot .staff')?.textContent, chip: !!el.querySelector('.vis-cells'), person: el.querySelectorAll('.assignee, .owner.person').length, docsRef: el.querySelector('.docs-ref')?.textContent, status: document.querySelector('#saveStatus').textContent }; })()`);
  const server = await ev(`fetch('/api/pages/' + S.pageId).then(r => r.json()).then(d => { const n = d.nodes.find(n => n.id === ${JSON.stringify(rootId)}); return { vis: n.visibility, cells: n.cellIds.length, docs: n.docs.length, staff: n.staff, refs: d.refs.cells.map(c => c.name) }; })`);
  if (!tab.cells || !tab.dir || !tab.rows) throw new Error('pestaña Células vacía ' + JSON.stringify(tab));
  if (server.vis !== 'cells' || server.cells !== 1 || server.docs !== 2) throw new Error('servidor: ' + JSON.stringify(server));
  if (server.staff?.[0]?.name !== '@lorena' || server.staff[0].role !== 'UX Designer' || n.ownerLegacy !== '@lorena' || r.title !== 'Main instance') throw new Error('staff/título: ' + JSON.stringify({ server: server.staff, n, r }));
  return { ...n, cellName: cell.name, ...r, serverRefs: server.refs };
});
await step('Tipos: renombrar DS → "Librería" se refleja en cards, menú, editor, leyenda y servidor', async () => {
  await ev(`(async () => { S.state.settings.typeNames.ds = 'Librería'; const ps = await import('/js/ui/page-settings.js'); ps.applyTypeNames(); (await import('/js/canvas/selection.js')).renderAll(); (await import('/js/core/state.js')).persist(); return true; })()`); await sleep(1000);
  const dsId = await ev(`S.state.nodes.find(n => n.type === 'ds').id`);
  await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(dsId)}))`); await sleep(150);
  const r = await ev(`({ badge: document.querySelector('.node[data-id="' + ${JSON.stringify(dsId)} + '"] .type-badge').textContent, picker: document.querySelector('#fType [data-v=ds] .t').textContent.trim(), legend: document.querySelectorAll('#legend span')[1].textContent.trim(), empty: document.querySelector('.ctr-empty')?.textContent })`);
  await ev(`document.querySelector('#nodeDrawer [data-cancel]').click(); true`);
  const srv = await ev(`fetch('/api/pages/' + S.pageId).then(r => r.json()).then(d => d.settings.typeNames)`);
  await ev(`(async () => { S.state.settings.typeNames.ds = 'Design System'; (await import('/js/ui/page-settings.js')).applyTypeNames(); (await import('/js/canvas/selection.js')).renderAll(); (await import('/js/core/state.js')).persist(); return true; })()`); await sleep(1000);
  if (r.badge !== 'Librería' || r.picker !== 'Librería' || !/Librería/.test(r.legend) || !/Librería/.test(r.empty || 'Librería') || srv.ds !== 'Librería') throw new Error(JSON.stringify({ r, srv }));
  return { ...r, srv };
});
await step('F3: ficha (Ver ficha) con markdown escapado + #/me con deep-link', async () => {
  const rootId = await ev(`S.state.nodes.find(n => !n.parentId).id`);
  await ev(`import('/js/ui/node-view.js').then(m => m.openNodeView(${JSON.stringify(rootId)}))`); await sleep(100);
  const view = await ev(`(() => { const d = document.querySelector('#nodeDrawer'); const md = d.querySelector('.md'); return { open: d.classList.contains('open'), h3: md.querySelector('h3')?.textContent, li: md.querySelectorAll('li').length, rawB: !!md.querySelector('li b'), escaped: md.innerHTML.includes('&lt;b&gt;'), links: [...md.querySelectorAll('a')].map(a => a.getAttribute('href')), code: !!md.querySelector('code'), docs: d.querySelectorAll('.doc-list a').length, people: d.querySelectorAll('.person').length }; })()`);
  if (view.rawB || !view.escaped) throw new Error('HTML sin escapar en notas');
  if (view.links.some(h => !/^https:/.test(h))) throw new Error('enlace inseguro: ' + view.links);
  await ev(`document.querySelector('#nodeDrawer [data-cancel]').click(); true`);
  await ev(`location.hash = '#/me'; true`); await sleep(200);
  const me = await ev(`({ open: document.querySelector('#editorDialog').open, items: document.querySelectorAll('#editorDialog .me-list li').length, title: document.querySelector('#editorDialog h2')?.textContent })`);
  await ev(`document.querySelector('#editorDialog .me-list a').click(); true`); await sleep(600);
  const go = await ev(`({ hash: location.hash, selected: [...document.querySelectorAll('.node.selected')].map(e => e.dataset.id), open: document.querySelector('#nodeDrawer').classList.contains('open') })`);
  await ev(`document.querySelector('#nodeDrawer [data-cancel]').click(); location.hash = ''; true`); await sleep(100);
  return { view, me, go };
});
}

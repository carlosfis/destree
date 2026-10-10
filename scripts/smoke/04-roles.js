// Smoke · P1/F2/F3/P3/P7/P10/P11: estado vacío y responsive, invitación → viewer, Mi cuenta, login, Organización, restablecer, viewer con editor acotado y página de proyecto. Lo ejecuta scripts/smoke.js con el contexto CDP (ev, send, step…).
export default async function (c) {
  const { ev, send, sleep, mouse, drag, key, center, step, fill, META, SHIFT, ROOT } = c;
// F2: invitación (enlace copiable) → alta de viewer → modo lectura; PUT → 403; logout → login.
// P1: estado vacío del lienzo (guía + botón) y Escape en el lobby → vuelve al lienzo.
await step('P1: estado vacío del lienzo + Escape cierra el lobby', async () => {
  const page = await ev(`S.pageId`);
  const created = await ev(`fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Smoke vacía' }) }).then(r => r.json())`);
  await ev(`location.hash = '#/p/' + ${JSON.stringify(created.page.id)}; true`); await sleep(900);
  const empty = await ev(`({ nodes: S.state.nodes.length, hint: !document.querySelector('#emptyHint').hidden, btn: !!document.querySelector('#emptyNew'), title: document.title })`);
  await ev(`document.querySelector('#emptyNew').click(); true`); await sleep(100);
  const menu = await ev(`document.querySelectorAll('#popover .menu-item').length`);
  await ev(`document.querySelector('#popover .menu-item').click(); true`); await sleep(150);
  await ev(`(() => { const f = document.querySelector('#editorForm'); f.elements.name.value = 'Primera'; f.requestSubmit(); return true; })()`); await sleep(400);
  const after = await ev(`({ nodes: S.state.nodes.length, hintHidden: document.querySelector('#emptyHint').hidden })`);
  await ev(`location.hash = '#/lobby'; true`); await sleep(500);
  const lobby = await ev(`({ visible: !document.querySelector('#lobbyView').hidden, focus: document.activeElement?.dataset?.tab || document.activeElement?.tagName })`);
  await key('Escape', 'Escape'); await sleep(400);
  const esc = await ev(`({ lobbyHidden: document.querySelector('#lobbyView').hidden, hash: location.hash })`);
  await ev(`location.hash = '#/p/' + ${JSON.stringify(page)}; true`); await sleep(900);
  if (!empty.hint || !empty.btn || !menu || !after.hintHidden || after.nodes !== 1 || !esc.lobbyHidden) throw new Error(JSON.stringify({ empty, menu, after, lobby, esc }));
  return { empty, after, lobby, esc };
});
// P1: 360×740 sin desborde horizontal en lienzo, lobby y #/admin (usuarios, audit).
await step('P1: viewport 360×740 sin scroll horizontal (lienzo, lobby, admin)', async () => {
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true }); await sleep(400);
  const sw = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? { sw: el.scrollWidth, cw: el.clientWidth } : null; })()`);
  const canvas = { html: await sw('html'), topbar: await sw('.topbar') };
  await ev(`location.hash = '#/lobby'; true`); await sleep(500);
  const lobby = { html: await sw('html'), view: await sw('#lobbyView') };
  await ev(`location.hash = '#/admin/users'; true`); await sleep(900);
  const users = { view: await sw('#adminView') };
  await ev(`document.querySelector('#orgTabs [data-tab=audit]').click(); true`); await sleep(600);
  const audit = { view: await sw('#adminView') };
  await ev(`document.querySelector('#adminBack').click(); true`); await sleep(500);
  await send('Emulation.clearDeviceMetricsOverride'); await sleep(400);
  const all = { canvas, lobby, users, audit };
  const bad = Object.entries(all).flatMap(([k, o]) => Object.entries(o).filter(([, m]) => !m || m.sw > m.cw + 1).map(([n]) => `${k}.${n}`));
  if (bad.length) throw new Error('desborde horizontal: ' + bad.join(', ') + ' ' + JSON.stringify(all));
  return all;
});
await step('invitación → viewer en modo lectura (403 en PUT)', async () => {
  const link = await ev(`fetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'des@smoke.io', role: 'viewer' }) }).then(r => r.json()).then(j => j.link)`);
  if (!/#\/invite\//.test(link)) throw new Error('sin enlace: ' + link);
  await ev(`fetch('/api/auth/logout', { method: 'POST' }).then(r => r.status)`);
  await send('Page.navigate', { url: link }); await sleep(900);
  await fill([['name', 'Dani'], ['password', 'smoke-1234']]); await sleep(1200);
  const put = await ev(`fetch('/api/pages/' + S.pageId, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': String(S.version) }, body: '{}' }).then(r => r.status)`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 400, y: 300, button: 'right', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 300, button: 'right', clickCount: 1 }); await sleep(100);
  await key('n', 'KeyN'); await sleep(100);
  return ev(`({ role: S.session.role, ro: S.readonly, viewer: document.body.classList.contains('viewer'), nodes: S.state.nodes.length, newHidden: document.querySelector('#btnNew').hidden, adminHidden: document.querySelector('#btnAdmin').hidden, ports: getComputedStyle(document.querySelector('.port')).display, popover: document.querySelector('#popover').hidden, status: document.querySelector('#saveStatus').textContent, put: ${'${put}'} })`.replace('${put}', JSON.stringify(put)));
});
await step('F3: viewer → doble clic abre ficha; raíz solo-células oculta (no es miembro)', async () => {
  const roots = await ev(`S.state.nodes.filter(n => !n.parentId).map(n => n.visibility)`);
  if (roots.includes('cells')) throw new Error('el viewer recibió una raíz solo-células ajena');
  await ev(`document.querySelector('#zoomFit').click(); true`); await sleep(500);
  const c = await center('.node');
  const under = await ev(`document.elementFromPoint(${c.x}, ${c.y + 10})?.closest('.node')?.dataset.id || null`);
  await mouse('mousePressed', c.x, c.y + 10); await mouse('mouseReleased', c.x, c.y + 10); await mouse('mousePressed', c.x, c.y + 10, { clickCount: 2 }); await mouse('mouseReleased', c.x, c.y + 10, { clickCount: 2 }); await sleep(150);
  const r = await ev(`({ open: document.querySelector('#nodeDrawer').classList.contains('open'), isView: !!document.querySelector('#nodeDrawer .node-view'), isForm: !!document.querySelector('#editorForm'), under: ${JSON.stringify(under)}, roots: ${JSON.stringify(roots)}.length, mine: document.querySelector('#btnMe')?.textContent })`);
  await ev(`document.querySelector('#nodeDrawer [data-cancel]')?.click(); true`);
  return r;
});
await step('P3: chip de usuario → Mi cuenta → cambiar contraseña (viewer) → Escape cierra', async () => {
  await ev(`document.querySelector('#userChip').click(); true`); await sleep(150);
  const open = await ev(`document.querySelector('#confirmDialog').open && !!document.querySelector('#accPassword')`);
  if (!open) throw new Error('no se abrió Mi cuenta');
  await ev(`(() => { const f = document.querySelector('#accPassword'); f.currentPassword.value = 'smoke-1234'; f.newPassword.value = 'smoke-5678'; f.repeatPassword.value = 'smoke-9999'; f.requestSubmit(); return true; })()`); await sleep(150);
  const mismatch = await ev(`document.querySelector('#accPassword .form-error').textContent`);
  await ev(`(() => { const f = document.querySelector('#accPassword'); f.currentPassword.value = 'smoke-1234'; f.newPassword.value = 'smoke-5678'; f.repeatPassword.value = 'smoke-5678'; f.requestSubmit(); return true; })()`); await sleep(900);
  const err = await ev(`document.querySelector('#accPassword .form-error').textContent`);
  await key('Escape', 'Escape'); await sleep(150);
  const closed = await ev(`!document.querySelector('#confirmDialog').open`);
  const relogin = await ev(`fetch('/api/auth/login', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'des@smoke.io', password: 'smoke-5678' }) }).then(r => r.status)`);
  return { mismatch: !!mismatch, err, closed, relogin, chipIsButton: await ev(`document.querySelector('#userChip').tagName`) };
});
await step('logout → login (admin)', async () => {
  await ev(`document.querySelector('#btnLogout').click(); true`); await sleep(1200);
  const login = await ev(`!document.querySelector('#authView').hidden && !!document.querySelector('#authView [name=password]') && !document.querySelector('#authView [name=orgName]')`);
  if (!login) throw new Error('no apareció el login');
  if (await ev(`!!document.querySelector('#forgotLink')`)) throw new Error('sin SMTP no debe ofrecerse «¿Olvidaste tu contraseña?»');
  await fill([['email', 'ana@smoke.io'], ['password', 'smoke-1234']]); await sleep(1200);
  return ev(`({ role: S.session.role, ro: S.readonly, hash: location.hash, nodes: S.state.nodes.length })`);
});
await step('P3/P10: admin → Lobby → Organización → 🔑 restablecer contraseña de Dani → temporal visible una vez → entra con ella', async () => {
  await ev(`location.hash = '#/lobby/org'; true`); await sleep(900);
  const btn = await ev(`[...document.querySelectorAll('#staffRows .staff-row')].find(r => r.textContent.includes('des@smoke.io'))?.querySelector('[data-reset]') ? true : false`);
  if (!btn) throw new Error('sin botón 🔑 en la fila del viewer');
  await ev(`[...document.querySelectorAll('#staffRows .staff-row')].find(r => r.textContent.includes('des@smoke.io')).querySelector('[data-reset]').click(); true`); await sleep(150);
  await ev(`document.querySelector('#confirmDialog footer .btn.primary').click(); true`); await sleep(900);
  const pw = await ev(`document.querySelector('#confirmDialog .invite-link input')?.value || ''`);
  if (!/^[A-Za-z2-9]{14}$/.test(pw)) throw new Error('temporal inválida: ' + pw);
  await key('Escape', 'Escape'); await sleep(150);
  const login = await ev(`fetch('/api/auth/login', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'des@smoke.io', password: ${JSON.stringify(pw)} }) }).then(r => r.status)`);
  await ev(`location.hash = ''; true`); await sleep(300);
  return { login, closed: await ev(`!document.querySelector('#confirmDialog').open`), role: await ev(`S.session.role`) };
});
await step('P7: sin SMTP → /api/setup mail:false; Organización muestra estado de correo e invitación «pendiente»', async () => {
  const setup = await ev(`fetch('/api/setup').then(r => r.json())`);
  const inv = await ev(`fetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'p7@smoke.io', role: 'viewer' }) }).then(r => r.json())`);
  await ev(`location.hash = '#/lobby/org'; true`); await sleep(900);
  const r = await ev(`({ mailStatus: document.querySelector('#lobbyBody .mail-status')?.textContent.slice(0, 8), chips: [...document.querySelectorAll('#inviteRows .chip')].map(c => c.textContent), test: !!document.querySelector('#mailTest') })`);
  await ev(`document.querySelector('#lobbyBack').click(); true`); await sleep(300);
  await ev(`fetch('/api/invites/${'${inv.id}'}', { method: 'DELETE' }).then(r => r.status)`.replace('${inv.id}', inv.id));
  if (inv.emailSent !== false || !r.chips.includes('pendiente')) throw new Error('estado de invitación: ' + JSON.stringify({ inv, r }));
  return { mail: setup.mail, ...r };
});
await step('P10: Lobby → Organización (admin): datos, 5 niveles, capacidades, plantilla; renombrar Viewer → Designer se refleja; restablecer', async () => {
  await ev(`location.hash = '#/lobby/org'; true`); await sleep(900);
  const r = await ev(`({ tab: document.querySelector('#lobbyTabs .active')?.dataset.tab, org: !!document.querySelector('#orgForm'), levels: [...document.querySelectorAll('.roles-table tbody tr td:first-child')].map(t => t.textContent), caps: document.querySelectorAll('.caps-table tbody tr:not(.group)').length, groups: document.querySelectorAll('.caps-table tr.group').length, staff: document.querySelectorAll('#staffRows .staff-row').length, danger: !!document.querySelector('#orgDelete'), invite: !!document.querySelector('#inviteForm') })`);
  if (r.levels.join() !== 'Lev5,Lev4,Lev3,Lev2,Lev1' || r.caps < 20 || r.staff < 2 || !r.danger || !r.org) throw new Error('organización: ' + JSON.stringify(r));
  await ev(`(() => { const f = document.querySelector('#rolesForm'); f.viewer.value = 'Designer'; f.requestSubmit(); return true; })()`); await sleep(900);
  const renamed = await ev(`({ label: S.session.org.roleLabels.viewer, header: [...document.querySelectorAll('.caps-table thead th')].map(t => t.textContent).some(t => t.includes('Designer')), option: [...document.querySelectorAll('#staffRows select option')].some(o => o.textContent.startsWith('Designer')) })`);
  if (renamed.label !== 'Designer' || !renamed.header || !renamed.option) throw new Error('renombrar: ' + JSON.stringify(renamed));
  await ev(`document.querySelector('#rolesReset').click(); true`); await sleep(900);
  const reset = await ev(`S.session.org.roleLabels.viewer`);
  await ev(`document.querySelector('#lobbyBack').click(); true`); await sleep(400);
  return { ...r, renamed: renamed.label, reset };
});
await step('P10: viewer edita su card (asignada) con el editor acotado → PATCH; sin pestaña Organización', async () => {
  const users = await ev(`fetch('/api/users').then(r => r.json()).then(j => j.users)`);
  const dani = users.find(u => u.email === 'des@smoke.io'); if (!dani) throw new Error('sin Dani');
  const root = await ev(`S.state.nodes.find(n => !n.parentId && n.visibility !== 'cells').id`);
  const asg = await ev(`fetch('/api/pages/' + S.pageId + '/nodes/${'${root}'}/assignees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigneeIds: ['${'${dani}'}'] }) }).then(r => r.status)`.replace('${root}', root).replace('${dani}', dani.id));
  const pw = await ev(`fetch('/api/users/${'${id}'}', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'smoke-0000' }) }).then(r => r.status)`.replace('${id}', dani.id));
  if (asg !== 200 || pw !== 200) throw new Error('preparación: ' + JSON.stringify({ asg, pw }));
  await ev(`document.querySelector('#btnLogout').click(); true`); await sleep(1200);
  await fill([['email', 'des@smoke.io'], ['password', 'smoke-0000']]); await sleep(1400);
  const tabs = await ev(`(() => { location.hash = '#/lobby'; return true; })()`); await sleep(600);
  const noOrg = await ev(`![...document.querySelectorAll('#lobbyTabs button')].some(b => b.dataset.tab === 'org')`);
  await ev(`document.querySelector('#lobbyBack').click(); true`); await sleep(500);
  await ev(`document.querySelector('#zoomFit').click(); true`); await sleep(500);
  const c = await center(`.node[data-id="${root}"] .head-main`).catch(() => center(`.node[data-id="${root}"]`)); // la cabecera: el centro del contenedor caería sobre un hijo
  await mouse('mousePressed', c.x, c.y); await mouse('mouseReleased', c.x, c.y); await mouse('mousePressed', c.x, c.y, { clickCount: 2 }); await mouse('mouseReleased', c.x, c.y, { clickCount: 2 }); await sleep(200);
  const opened = await ev(`({ form: !!document.querySelector('#editorForm'), own: !!document.querySelector('#editorForm.own-mode'), typeHidden: !!document.querySelector('#fType') && getComputedStyle(document.querySelector('#fType').closest('.field')).display === 'none', del: !!document.querySelector('#fDelete'), newTag: !!document.querySelector('#fNewTag'), view: !!document.querySelector('#nodeDrawer .node-view'), title: document.querySelector('#drawerTitle')?.textContent })`);
  if (!opened.own || !opened.typeHidden || opened.del || opened.newTag) throw new Error('editor acotado: ' + JSON.stringify(opened));
  await ev(`(() => { const f = document.querySelector('#editorForm'); f.elements.name.value = 'Mi card'; f.elements.description.value = 'editada por viewer'; f.requestSubmit(); return true; })()`); await sleep(900);
  const after = await ev(`({ name: S.state.nodes.find(n => n.id === '${root}').name, drawer: document.querySelector('#nodeDrawer').classList.contains('open'), ro: S.readonly, status: document.querySelector('#saveStatus').textContent })`);
  const server = await ev(`fetch('/api/pages/' + S.pageId).then(r => r.json()).then(d => d.nodes.find(n => n.id === '${root}').description)`);
  if (after.name !== 'Mi card' || server !== 'editada por viewer' || after.drawer) throw new Error('PATCH propio: ' + JSON.stringify({ after, server }));
  return { noOrg, ...opened, ...after, server, tabs };
});
await step('P11: página de proyecto (viewer asignado): ▤ Proyecto → overview (plantilla) → editar sección → fase + actividad → cronograma → kanban (mover) → Escape', async () => {
  const root = await ev(`S.state.nodes.find(n => n.name === 'Mi card').id`); // la card asignada a Dani en el paso anterior
  const c = await center(`.node[data-id="${root}"] .head-main`).catch(() => center(`.node[data-id="${root}"]`));
  await mouse('mousePressed', c.x, c.y, { clickCount: 2 }); await mouse('mouseReleased', c.x, c.y, { clickCount: 2 }); await sleep(200);
  if (!(await ev(`!!document.querySelector('#fProject')`))) throw new Error('sin botón Proyecto en el editor acotado');
  await ev(`document.querySelector('#fProject').click(); true`); await sleep(1000);
  const ov = await ev(`({ hash: location.hash, open: !document.querySelector('#projectPage').hidden, tab: document.querySelector('#projectTabs .active')?.dataset.tab, sections: document.querySelectorAll('.pj-section').length, canEdit: S.projectView.canEdit, banner: document.querySelector('.pj-banner h1')?.textContent, add: !!document.querySelector('#pjAddSection') })`);
  if (!ov.open || ov.tab !== 'overview' || ov.sections !== 9 || !ov.canEdit || !ov.add || !/\/project\/overview$/.test(ov.hash)) throw new Error('overview: ' + JSON.stringify(ov));
  await ev(`document.querySelectorAll('.pj-tools [data-edit]')[1].click(); true`); await sleep(200);
  await ev(`(() => { const f = document.querySelector('#projectDialog form'); f.elements.text.value = 'Resumen smoke'; f.querySelector('[data-add="metrics"]').click(); const r = f.querySelector('[data-list="metrics"] .pj-row'); r.querySelector('[data-col="value"]').value = '3'; r.querySelector('[data-col="label"]').value = 'pasos'; f.requestSubmit(); return true; })()`); await sleep(900);
  const sec = await ev(`({ text: document.querySelector('.pj-text')?.textContent, metric: document.querySelector('.pj-metric b')?.textContent, dlg: document.querySelector('#projectDialog').open })`);
  if (sec.text !== 'Resumen smoke' || sec.metric !== '3' || sec.dlg) throw new Error('sección: ' + JSON.stringify(sec));
  await ev(`document.querySelector('#projectTabs [data-tab=cronograma]').click(); true`); await sleep(500);
  await ev(`document.querySelector('#schedAddPhase').click(); true`); await sleep(200);
  await ev(`(() => { const f = document.querySelector('#projectDialog form'); f.elements.name.value = 'Alineación'; f.requestSubmit(); return true; })()`); await sleep(900);
  await ev(`document.querySelector('#schedAddAct').click(); true`); await sleep(200);
  await ev(`(() => { const f = document.querySelector('#projectDialog form'); f.elements.title.value = 'Discovery'; f.elements.description.value = 'Shadowing'; f.elements.tag.value = 'ux'; f.elements.assignee.value = 'Adri'; f.elements.startDate.value = new Date().toISOString().slice(0, 10); f.requestSubmit(); return true; })()`); await sleep(900);
  const sch = await ev(`({ phases: document.querySelectorAll('.sched-row').length, acts: document.querySelectorAll('.act').length, tag: document.querySelector('.act-dot')?.textContent, weeks: document.querySelectorAll('.sched-week').length, today: !!document.querySelector('.sched-today'), sticky: getComputedStyle(document.querySelector('.sched-phase')).position, scroll: document.querySelector('.sched').scrollWidth >= document.querySelector('.sched').clientWidth })`);
  if (sch.phases !== 1 || sch.acts !== 1 || sch.tag !== 'UX' || sch.weeks < 6 || !sch.today || sch.sticky !== 'sticky') throw new Error('cronograma: ' + JSON.stringify(sch));
  await ev(`document.querySelector('#projectTabs [data-tab=kanban]').click(); true`); await sleep(500);
  const kb = await ev(`({ todo: document.querySelectorAll('.kb-todo .kb-card').length, cols: document.querySelectorAll('.kb-col').length, who: document.querySelector('.kb-who')?.textContent, draggable: document.querySelector('.kb-card')?.getAttribute('draggable') })`);
  if (kb.todo !== 1 || kb.cols !== 4 || kb.who !== '@Adri' || kb.draggable !== 'true') throw new Error('kanban: ' + JSON.stringify(kb));
  await ev(`document.querySelector('.pj-content').moveActivity(document.querySelector('.kb-card').dataset.id, 'doing')`); await sleep(900);
  const moved = await ev(`({ doing: document.querySelectorAll('.kb-doing .kb-card').length, todo: document.querySelectorAll('.kb-todo .kb-card').length })`);
  const server = await ev(`fetch('/api/pages/' + S.pageId + '/nodes/${root}/project').then(r => r.json()).then(d => ({ status: d.activities[0].status, phase: d.phases.length }))`);
  if (moved.doing !== 1 || moved.todo !== 0 || server.status !== 'doing' || server.phase !== 1) throw new Error('mover: ' + JSON.stringify({ moved, server }));
  await key('Escape', 'Escape'); await sleep(500);
  const back = await ev(`({ hidden: document.querySelector('#projectPage').hidden, hash: location.hash, pv: S.projectView })`);
  if (!back.hidden || back.pv) throw new Error('escape: ' + JSON.stringify(back));
  return { tab: ov.tab, sections: ov.sections, banner: ov.banner, sec, sch, kb, moved, server, hash: back.hash };
});
}

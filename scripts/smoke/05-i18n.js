// Smoke · P15: idioma. Logout → enlace «English» en el login → login en inglés → topbar, lobby, Organización, editor, página de proyecto y
// errores del servidor en inglés → botón de idioma → vuelta a español. Lo ejecuta scripts/smoke.js con el contexto CDP.
export default async function (c) {
  const { ev, sleep, step, fill } = c;
  const waitFor = async (expr, n = 40) => { for (let i = 0; i < n; i++) { if (await ev(expr).catch(() => false)) return true; await sleep(200); } return false; };
  await step('P15: ES → EN desde el login (enlace English) → UI en inglés (topbar, lobby, Organización, editor, proyecto, error del servidor) → botón ES → vuelta', async () => {
    await ev(`fetch('/api/auth/logout', { method: 'POST' }).then(r => r.status)`);
    await ev(`location.hash = '#/login'; location.reload(); true`); await sleep(800); await waitFor(`!!document.querySelector('#authView [data-lang]')`);
    const es = await ev(`({ lang: document.documentElement.lang, h1: document.querySelector('#authView h1')?.textContent, link: document.querySelector('#authView [data-lang]')?.textContent })`);
    if (es.lang !== 'es' || es.h1 !== 'Inicia sesión' || es.link !== 'English') throw new Error('login en español: ' + JSON.stringify(es));
    await ev(`document.querySelector('#authView [data-lang]').click(); true`); await sleep(800); await waitFor(`document.documentElement.lang === 'en' && !!document.querySelector('#authView [data-lang]')`);
    const en = await ev(`({ lang: document.documentElement.lang, h1: document.querySelector('#authView h1')?.textContent, label: document.querySelector('#authView label[for=f_email]')?.textContent, btn: document.querySelector('#authView button[type=submit]')?.textContent, link: document.querySelector('#authView [data-lang]')?.textContent })`);
    if (en.lang !== 'en' || en.h1 !== 'Sign in' || en.label !== 'Email' || en.btn !== 'Sign in' || en.link !== 'Español') throw new Error('login en inglés: ' + JSON.stringify(en));
    await fill([['email', 'ana@smoke.io'], ['password', 'smoke-1234']]); await sleep(800); await waitFor(`!!window.S && !!S.state && S.state.nodes.length > 0 && document.querySelector('#authView').hidden && !!document.querySelector('#btnLogout')`); await sleep(300);
    const top = await ev(`({ newCard: document.querySelector('#btnNew').textContent.trim(), layout: document.querySelector('#btnLayout').textContent.trim(), legend: document.querySelector('#legend span').textContent.trim(), status: document.querySelector('#saveStatus').textContent, page: document.querySelector('#btnAdmin').textContent.trim(), mine: document.querySelector('#btnMe')?.textContent.trim(), out: document.querySelector('#btnLogout')?.textContent, switch: document.querySelector('#langSwitch').textContent, bar: document.querySelector('#statusBar').textContent })`);
    if (top.newCard !== '＋ New card' || top.layout !== '⇅ Auto-layout' || top.legend !== 'nested = branch' || top.status !== 'Saved' || top.page !== '⚙ Page' || top.mine !== '★ Mine' || top.out !== 'Sign out' || top.switch !== 'ES' || !/roots/.test(top.bar)) throw new Error('topbar: ' + JSON.stringify(top));
    await ev(`location.hash = '#/lobby'; true`); await waitFor(`!!document.querySelector('#lobbyView [data-open]')`); await sleep(200);
    const lobby = await ev(`({ tabs: [...document.querySelectorAll('#lobbyTabs button')].map(b => b.textContent), back: document.querySelector('#lobbyBack')?.textContent, search: document.querySelector('#lobbySearch')?.placeholder, open: document.querySelector('#lobbyView [data-open]')?.textContent })`);
    if (lobby.tabs.join() !== 'Pages,Archived,Deleted,My assignments,Organization' || lobby.back !== '← Back to canvas' || lobby.search !== 'Search page…' || lobby.open !== 'Open') throw new Error('lobby: ' + JSON.stringify(lobby));
    await ev(`document.querySelector('#lobbyTabs [data-tab=org]').click(); true`); await waitFor(`!!document.querySelector('#staffRows [data-active]') && !!document.querySelector('.caps-table')`); await sleep(200);
    const org = await ev(`({ h3: [...document.querySelectorAll('#lobbyBody h3')].map(h => h.textContent), cap: document.querySelector('.caps-table thead th')?.textContent, group: document.querySelector('.caps-table tr.group th')?.textContent, invite: document.querySelector('#inviteForm button[type=submit]')?.textContent, staff: document.querySelector('#staffRows [data-active]')?.textContent })`);
    if (!org.h3.includes('Levels and roles') || !org.h3.includes('Staff') || org.cap !== 'Capability' || org.group !== 'Organization' || org.invite !== 'Invite' || org.staff !== 'Deactivate') throw new Error('organización: ' + JSON.stringify(org));
    await ev(`document.querySelector('#lobbyBack').click(); true`); await sleep(500);
    const rootId = await ev(`S.state.nodes.find(n => !n.parentId).id`);
    await ev(`import('/js/ui/card-editor.js').then(m => m.openEditor(${JSON.stringify(rootId)}))`); await waitFor(`!!document.querySelector('#editorForm button[type=submit]')`); await sleep(200);
    const editor = await ev(`({ tabs: [...document.querySelectorAll('#nodeDrawer .drawer-tabs button')].map(b => b.textContent), name: document.querySelector('#fNameField label')?.textContent, parent: document.querySelector('#fParentLabel')?.textContent, save: document.querySelector('#editorForm button[type=submit]')?.textContent, grad: document.querySelector('#fGradField label')?.textContent.trim(), geo: document.querySelector('[name=geo] option')?.textContent })`);
    if (editor.tabs.join() !== 'General,Staff,Documentation,Notes' || editor.name !== 'Name *' || editor.parent !== 'Parent container (empty = root)' || editor.save !== 'Save changes' || !/^Brand color/.test(editor.grad) || editor.geo !== '— No geography —') throw new Error('editor: ' + JSON.stringify(editor));
    await ev(`document.querySelector('#nodeDrawer [data-cancel]').click(); true`); await sleep(300);
    await ev(`location.hash = '#/p/' + S.pageId + '/n/' + ${JSON.stringify(rootId)} + '/project/overview'; true`); await waitFor(`!!document.querySelector('#pjAddSection')`); await sleep(300);
    const pj = await ev(`({ tabs: [...document.querySelectorAll('#projectTabs button')].map(b => b.textContent), back: document.querySelector('#projectBack')?.textContent, add: document.querySelector('#pjAddSection')?.textContent, first: document.querySelector('.pj-section h2')?.textContent, title: document.title })`);
    if (pj.tabs.join() !== 'Overview,Schedule,Activities' || pj.back !== '← Back to canvas' || pj.add !== '＋ Add section' || !/Overview$/.test(pj.title)) throw new Error('proyecto: ' + JSON.stringify(pj));
    await ev(`document.querySelector('#projectTabs [data-tab=cronograma]').click(); true`); await waitFor(`!!document.querySelector('#schedAddPhase')`); await sleep(200);
    const sched = await ev(`({ phase: document.querySelector('#schedAddPhase')?.textContent, week: document.querySelector('.sched-week b')?.textContent, empty: document.querySelector('.sched-empty')?.textContent })`);
    if (sched.phase !== '＋ New phase' || !/^Week \d+$/.test(sched.week || '')) throw new Error('cronograma: ' + JSON.stringify(sched));
    const server = await ev(`Promise.all([fetch('/api/pages/nope', { headers: { 'X-Lang': 'en' } }).then(r => r.json()).then(j => j.message), fetch('/api/pages/nope').then(r => r.json()).then(j => j.message), fetch('/api/nope', { headers: { 'X-Lang': 'en-US' } }).then(r => r.json()).then(j => j.message)])`);
    if (server[0] !== 'Page not found' || server[1] !== 'Página no encontrada' || server[2] !== 'Route not found') throw new Error('servidor: ' + JSON.stringify(server));
    await ev(`location.hash = ''; true`); await sleep(300);
    await ev(`document.querySelector('#langSwitch').click(); true`); await sleep(800); await waitFor(`document.documentElement.lang === 'es' && !!window.S && !!S.state && !!document.querySelector('#btnLogout')`); await sleep(300);
    const back = await ev(`({ lang: document.documentElement.lang, newCard: document.querySelector('#btnNew').textContent.trim(), switch: document.querySelector('#langSwitch').textContent, stored: localStorage.getItem('destree:lang') })`);
    if (back.lang !== 'es' || back.newCard !== '＋ Nueva card' || back.switch !== 'EN' || back.stored !== 'es') throw new Error('vuelta a español: ' + JSON.stringify(back));
    return { login: en.h1, top: top.newCard, lobby: lobby.tabs.length, org: org.cap, editor: editor.name, project: pj.tabs.join('/'), server, back: back.newCard };
  });
}

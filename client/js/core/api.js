/* =========================================================
   F1. Cliente HTTP de la API (fetch, JSON, errores con status)
   ========================================================= */
const BASE = '/api';
async function req(method, url, body, opts = {}) {
  const res = await fetch(BASE + url, {
    method, headers: { ...(body == null ? {} : { 'Content-Type': 'application/json' }), ...(opts.headers || {}) },
    body: body == null ? undefined : JSON.stringify(body), keepalive: !!opts.keepalive, cache: 'no-store',
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.message) || res.statusText); err.status = res.status; err.data = data;
    // F2: sesión caducada en una llamada de la app (no en login/setup/me) → main.js muestra el login
    if (res.status === 401 && !/^\/(auth|setup|me|invites)/.test(url)) document.dispatchEvent(new CustomEvent('destree:unauthorized'));
    throw err;
  }
  return data;
}
export const listPages = (status) => req('GET', '/pages' + (status ? '?status=' + status : '')).then(r => r.pages);
/* --- F4a: páginas --- */
export const createPage = body => req('POST', '/pages', body);
export const patchPage = (id, body) => req('PATCH', `/pages/${encodeURIComponent(id)}`, body);
export const archivePage = id => req('POST', `/pages/${encodeURIComponent(id)}/archive`);
export const unarchivePage = id => req('POST', `/pages/${encodeURIComponent(id)}/unarchive`);
export const deletePage = id => req('DELETE', `/pages/${encodeURIComponent(id)}`);
export const restorePage = id => req('POST', `/pages/${encodeURIComponent(id)}/restore-deleted`);
export const duplicatePage = (id, name) => req('POST', `/pages/${encodeURIComponent(id)}/duplicate`, name ? { name } : null);
export const myAssignments = () => req('GET', '/me/assignments').then(r => r.items);
/* --- F5: imágenes (cuerpo binario, no JSON) --- */
export async function uploadImage(file, { kind = 'node', filename = '' } = {}) {
  const res = await fetch(`${BASE}/images?` + new URLSearchParams({ kind, filename: filename.slice(0, 200) }), { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file, cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok) { const err = new Error((data && data.message) || res.statusText); err.status = res.status; if (res.status === 401) document.dispatchEvent(new CustomEvent('destree:unauthorized')); throw err; }
  return data;
}
export const deleteImage = id => req('DELETE', `/images/${encodeURIComponent(id)}`);
/* --- F6a: versiones --- */
export const listVersions = id => req('GET', `/pages/${encodeURIComponent(id)}/versions`).then(r => r.versions);
export const createVersion = (id, label) => req('POST', `/pages/${encodeURIComponent(id)}/versions`, label ? { label } : null);
export const getVersion = (id, n) => req('GET', `/pages/${encodeURIComponent(id)}/versions/${n}`);
export const diffVersions = (id, a, b) => req('GET', `/pages/${encodeURIComponent(id)}/versions/${a}/diff/${b}`);
export const restoreVersion = (id, n) => req('POST', `/pages/${encodeURIComponent(id)}/versions/${n}/restore`);
/* --- F6b: respaldos y export/import de org --- */
export const listBackups = () => req('GET', '/backups');
export const createBackup = () => req('POST', '/backups');
export const deleteBackup = id => req('DELETE', `/backups/${encodeURIComponent(id)}`);
export const importOrg = data => req('POST', '/org/import', data);
/* --- F4b --- */
export const listAudit = params => req('GET', '/audit?' + new URLSearchParams(Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v != null && v !== ''))));
export const getPage = (id, opts = {}) => req('GET', `/pages/${encodeURIComponent(id)}` + (opts.embedImages ? '?embedImages=1' : ''));
/** PUT del documento completo con If-Match; 409 si `ver` es vieja. */
export const putPage = (id, doc, ver, opts) => req('PUT', `/pages/${encodeURIComponent(id)}`, doc, { ...opts, headers: { 'If-Match': `"${ver}"` } });
export const importDocument = (raw, pid) => req('POST', '/import?' + new URLSearchParams({ pageId: pid }), raw);
export const health = () => req('GET', '/health');
/* --- F2: auth, invitaciones, usuarios --- */
export const setupStatus = () => req('GET', '/setup');
export const setup = body => req('POST', '/setup', body);
export const login = (email, password) => req('POST', '/auth/login', { email, password });
export const logout = () => req('POST', '/auth/logout');
export const getMe = () => req('GET', '/me');
export const patchMe = body => req('PATCH', '/me', body); // P3: { name? , currentPassword?, newPassword? }
export const closeOtherSessions = () => req('DELETE', '/me/sessions'); // P6
/* --- P10: organización y campos propios de una card --- */
export const getOrg = () => req('GET', '/org');
export const patchOrg = body => req('PATCH', '/org', body); // { name?, roleLabels? }
export const deleteOrg = body => req('DELETE', '/org', body); // { password, confirmName }
export const patchNodeFields = (pid, nid, body) => req('PATCH', `/pages/${encodeURIComponent(pid)}/nodes/${encodeURIComponent(nid)}`, body);
/* --- P7: correo --- */
export const forgotPassword = email => req('POST', '/auth/forgot', { email });
export const resetPassword = (token, password) => req('POST', '/auth/reset', { token, password });
export const mailTest = () => req('POST', '/mail/test');
export const getInvite = token => req('GET', `/invites/${encodeURIComponent(token)}`);
export const acceptInvite = body => req('POST', '/invites/accept', body);
export const createInvite = body => req('POST', '/invites', body);
export const listInvites = () => req('GET', '/invites').then(r => r.invites);
export const revokeInvite = id => req('DELETE', `/invites/${encodeURIComponent(id)}`);
export const listUsers = () => req('GET', '/users').then(r => r.users);
export const createUser = body => req('POST', '/users', body);
export const updateUser = (id, body) => req('PATCH', `/users/${encodeURIComponent(id)}`, body);
/* --- F3: células, directorio --- */
export const listCells = () => req('GET', '/cells').then(r => r.cells);
export const createCell = body => req('POST', '/cells', body);
export const updateCell = (id, body) => req('PATCH', `/cells/${encodeURIComponent(id)}`, body);
export const deleteCell = id => req('DELETE', `/cells/${encodeURIComponent(id)}`);
export const setCellMembers = (id, userIds) => req('PUT', `/cells/${encodeURIComponent(id)}/members`, { userIds });
export const directory = () => req('GET', '/users/directory').then(r => r.users);
/* --- P11: página de proyecto de una card (overview, cronograma, kanban) --- */
const PJ = (pid, nid) => `/pages/${encodeURIComponent(pid)}/nodes/${encodeURIComponent(nid)}/project`;
export const getProject = (pid, nid) => req('GET', PJ(pid, nid));
export const patchProject = (pid, nid, body) => req('PATCH', PJ(pid, nid), body); // { tagline?, sprintWeeks?, sprintOffset? }
export const createSection = (pid, nid, body) => req('POST', `${PJ(pid, nid)}/sections`, body);
export const updateSection = (pid, nid, id, body) => req('PATCH', `${PJ(pid, nid)}/sections/${encodeURIComponent(id)}`, body);
export const deleteSection = (pid, nid, id) => req('DELETE', `${PJ(pid, nid)}/sections/${encodeURIComponent(id)}`);
export const createPhase = (pid, nid, body) => req('POST', `${PJ(pid, nid)}/phases`, body);
export const updatePhase = (pid, nid, id, body) => req('PATCH', `${PJ(pid, nid)}/phases/${encodeURIComponent(id)}`, body);
export const deletePhase = (pid, nid, id) => req('DELETE', `${PJ(pid, nid)}/phases/${encodeURIComponent(id)}`);
export const createActivity = (pid, nid, body) => req('POST', `${PJ(pid, nid)}/activities`, body);
export const updateActivity = (pid, nid, id, body) => req('PATCH', `${PJ(pid, nid)}/activities/${encodeURIComponent(id)}`, body);
export const deleteActivity = (pid, nid, id) => req('DELETE', `${PJ(pid, nid)}/activities/${encodeURIComponent(id)}`);

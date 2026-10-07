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
export const listPages = () => req('GET', '/pages').then(r => r.pages);
export const getPage = id => req('GET', `/pages/${encodeURIComponent(id)}`);
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

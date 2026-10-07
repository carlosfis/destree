/* =========================================================
   F1. Cliente HTTP de la API (fetch, JSON, errores con status)
   ========================================================= */
const BASE = '/api';
async function req(method, url, body, opts = {}) {
  const res = await fetch(BASE + url, {
    method, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: body == null ? undefined : JSON.stringify(body), keepalive: !!opts.keepalive, cache: 'no-store',
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) { const err = new Error((data && data.message) || res.statusText); err.status = res.status; err.data = data; throw err; }
  return data;
}
export const listPages = () => req('GET', '/pages').then(r => r.pages);
export const getPage = id => req('GET', `/pages/${encodeURIComponent(id)}`);
/** PUT del documento completo con If-Match; 409 si `ver` es vieja. */
export const putPage = (id, doc, ver, opts) => req('PUT', `/pages/${encodeURIComponent(id)}`, doc, { ...opts, headers: { 'If-Match': `"${ver}"` } });
export const importDocument = (raw, pid) => req('POST', '/import?' + new URLSearchParams({ pageId: pid }), raw);
export const health = () => req('GET', '/health');

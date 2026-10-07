// F2: helpers de auth para tests sobre app.inject(): setup inicial, invitar+aceptar, login → cookie.
export const cookieOf = (res) => String(res.headers['set-cookie'] || '').split(';')[0];
export const PW = 'secret-123';
/** Primer arranque: org + admin. Devuelve la cookie del admin. */
export async function setupAdmin(app, email = 'admin@test.io') {
  const r = await app.inject({ method: 'POST', url: '/api/setup', payload: { orgName: 'Test org', name: 'Admin', email, password: PW } });
  if (r.statusCode !== 201) throw new Error('setup: ' + r.body);
  return cookieOf(r);
}
export async function login(app, email, password = PW) {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  if (r.statusCode !== 200) throw new Error('login: ' + r.body);
  return cookieOf(r);
}
/** Invita (como `byCookie`) y acepta; devuelve { cookie, token, link, user }. */
export async function inviteAndAccept(app, byCookie, email, role, name = 'U') {
  const inv = await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: byCookie }, payload: { email, role } });
  if (inv.statusCode !== 201) throw new Error('invite: ' + inv.body);
  const { link } = inv.json(); const token = link.split('/#/invite/')[1];
  const acc = await app.inject({ method: 'POST', url: '/api/invites/accept', payload: { token, name, password: PW } });
  if (acc.statusCode !== 201) throw new Error('accept: ' + acc.body);
  return { cookie: cookieOf(acc), token, link, user: acc.json().user };
}

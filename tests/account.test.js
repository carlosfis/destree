// P3: PATCH /api/me (contraseña propia con verificación de la actual, cierra las demás sesiones, name) y restablecimiento por admin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/index.js';
import { resetRateLimit } from '../server/lib/auth.js';
import { setupAdmin, login, inviteAndAccept, PW } from './helpers/auth.js';

test('PATCH /api/me: contraseña propia (actual incorrecta → 403, corta → 400), cierra las demás sesiones, name; audit user.password', async (t) => {
  resetRateLimit();
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(() => app.close());
  const admin = await setupAdmin(app);
  const { cookie: des1, user } = await inviteAndAccept(app, admin, 'des@test.io', 'designer', 'Des');
  const des2 = await login(app, 'des@test.io'); // segunda sesión (otro dispositivo)
  const patch = (cookie, payload) => app.inject({ method: 'PATCH', url: '/api/me', headers: { cookie }, payload });

  assert.equal((await patch('', { name: 'X' })).statusCode, 401);
  assert.equal((await patch(des1, {})).statusCode, 400, 'cuerpo vacío');
  assert.equal((await patch(des1, { newPassword: 'nueva-clave-1' })).statusCode, 400, 'falta la actual');
  assert.equal((await patch(des1, { currentPassword: PW })).statusCode, 400, 'falta la nueva');
  assert.equal((await patch(des1, { currentPassword: PW, newPassword: 'corta' })).statusCode, 400);
  const bad = await patch(des1, { currentPassword: 'equivocada', newPassword: 'nueva-clave-1' });
  assert.equal(bad.statusCode, 403); assert.equal(bad.json().error, 'forbidden');
  assert.equal((await login(app, 'des@test.io')) !== '', true, 'la contraseña no cambió tras el 403');

  const ok = await patch(des1, { currentPassword: PW, newPassword: 'nueva-clave-1' });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(ok.json().sessionsClosed, 2, 'cierra las otras dos sesiones (des2 + login de control)');
  assert.equal(ok.json().user.id, user.id);
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: des1 } })).statusCode, 200, 'la sesión actual sigue viva');
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: des2 } })).statusCode, 401, 'la otra sesión se cerró');
  resetRateLimit(); // el cupo (10/15 min por IP) es común a setup/login/accept/PATCH me
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'des@test.io', password: PW } })).statusCode, 401, 'la vieja ya no entra');
  const des3 = await login(app, 'des@test.io', 'nueva-clave-1');
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: des3 } })).json().role, 'designer');

  // name (opcional), sin tocar la contraseña
  const named = await patch(des3, { name: '  Desirée  ' });
  assert.equal(named.statusCode, 200); assert.equal(named.json().user.name, 'Desirée'); assert.equal(named.json().sessionsClosed, 0);
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: des1 } })).statusCode, 200, 'cambiar name no cierra sesiones');
  const esc = await patch(des3, { role: 'admin' }); // removeAdditional: la propiedad se descarta y nada cambia
  assert.equal(esc.statusCode, 200); assert.equal(esc.json().role, 'designer');

  const actions = app.db.prepare("SELECT action, meta_json FROM audit_log WHERE user_id = ? AND action IN ('user.password', 'user.update')").all(user.id);
  assert.ok(actions.some(a => a.action === 'user.password' && JSON.parse(a.meta_json).sessionsClosed === 2));
  assert.ok(actions.some(a => a.action === 'user.update' && JSON.parse(a.meta_json).name === 'Desirée'));
  assert.ok(!JSON.stringify(app.db.prepare('SELECT meta_json FROM audit_log').all()).includes('nueva-clave-1'), 'la contraseña nunca llega al audit');

  // Rate-limit (10 / 15 min por IP) también en PATCH /api/me
  resetRateLimit();
  let last; for (let i = 0; i < 12; i++) last = (await patch(des3, { name: 'D' })).statusCode;
  assert.equal(last, 429);
  resetRateLimit();
});

test('admin restablece la contraseña de otro usuario (PATCH /api/users/:id { password }): sesiones cerradas, entra con la nueva', async (t) => {
  resetRateLimit();
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(() => app.close());
  const admin = await setupAdmin(app);
  const { cookie: head, user } = await inviteAndAccept(app, admin, 'head@test.io', 'head', 'H');
  const r = await app.inject({ method: 'PATCH', url: `/api/users/${user.id}`, headers: { cookie: admin }, payload: { password: 'Temporal-9x' } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: head } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'head@test.io', password: PW } })).statusCode, 401);
  const fresh = await login(app, 'head@test.io', 'Temporal-9x');
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: fresh } })).json().role, 'head');
  // el head no puede restablecer a otros (users.manage es solo admin) y la contraseña no aparece en el audit
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/users/${user.id}`, headers: { cookie: fresh }, payload: { password: 'Otra-clave-1' } })).statusCode, 403);
  assert.ok(!JSON.stringify(app.db.prepare('SELECT meta_json FROM audit_log').all()).includes('Temporal-9x'));
  resetRateLimit();
});

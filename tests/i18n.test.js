// P15: idioma de los mensajes del servidor según X-Lang (inglés; español por defecto), correos bilingües y plantilla inicial del proyecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/index.js';
import { setupAdmin } from './helpers/auth.js';
import { inviteMail, resetMail, testMail } from '../server/lib/mailer.js';
import { defaultSections } from '../server/lib/project-template.js';
import { tr, langOf, EN } from '../server/lib/i18n.js';

test('P15: X-Lang: en traduce los errores del servidor; sin cabecera, español; correos y plantilla por idioma', async (t) => {
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(() => app.close());
  await setupAdmin(app);
  const es = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nadie@smoke.io', password: 'xxxxxxxx' } });
  assert.equal(es.statusCode, 401); assert.equal(es.json().message, 'Correo o contraseña incorrectos');
  const en = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-lang': 'en' }, payload: { email: 'nadie@smoke.io', password: 'xxxxxxxx' } });
  assert.equal(en.statusCode, 401); assert.equal(en.json().message, 'Wrong email or password');
  const nf = await app.inject({ method: 'GET', url: '/api/nope', headers: { 'x-lang': 'en-US' } });
  assert.equal(nf.statusCode, 404); assert.equal(nf.json().message, 'Route not found');
  const anon = await app.inject({ method: 'GET', url: '/api/pages', headers: { 'x-lang': 'en' } });
  assert.equal(anon.statusCode, 401); assert.equal(anon.json().message, EN['Inicia sesión']);
  assert.equal(tr('en', 'Versión obsoleta: el servidor tiene 7'), 'Stale version: the server has 7');
  assert.equal(tr('en', 'La imagen está en uso (2 card(s), 1 página(s))'), 'The image is in use (2 card(s), 1 page(s))');
  assert.equal(tr('en', 'texto sin traducción'), 'texto sin traducción');
  assert.equal(tr('es', 'Inicia sesión'), 'Inicia sesión');
  assert.equal(langOf({ headers: {} }), 'es'); assert.equal(langOf({ headers: { 'x-lang': 'EN' } }), 'en');
  assert.match(inviteMail({ orgName: 'Org', role: 'Lead', link: 'http://x', expiresAt: Date.now(), lang: 'en' }).subject, /^Invitation to Org/);
  assert.match(inviteMail({ orgName: 'Org', role: 'Lead', link: 'http://x', expiresAt: Date.now() }).subject, /^Invitación a Org/);
  assert.equal(resetMail({ link: 'x', lang: 'en' }).subject, 'Reset your DesTree password');
  assert.match(testMail({ orgName: 'Org', lang: 'en' }).text, /works/);
  assert.deepEqual(defaultSections({}, 'en').slice(0, 2).map(s => s.title), ['Project links', 'Project summary']);
  assert.equal(defaultSections({}).at(-1).title, 'Staff de diseño');
});

// P7: SMTP con un servidor falso en memoria (node:net): mailer, invitación por correo, forgot/reset y prueba de envío.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { buildApp } from '../server/index.js';
import { config } from '../server/config.js';
import { sendMail, parseSmtpUrl, mailConfigured } from '../server/lib/mailer.js';
import { resetRateLimit } from '../server/lib/auth.js';
import { setupAdmin, login, inviteAndAccept, PW } from './helpers/auth.js';

/** Servidor SMTP falso: EHLO/AUTH PLAIN/MAIL/RCPT/DATA/QUIT. Guarda { from, to, raw, auth } en `msgs`. */
function fakeSmtp() {
  const msgs = [], auths = [];
  const server = net.createServer(sock => {
    let buf = '', data = null, from = '', to = [];
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', chunk => {
      buf += chunk.toString('utf8');
      for (;;) {
        if (data !== null) { const end = buf.indexOf('\r\n.\r\n'); if (end < 0) return; const raw = buf.slice(0, end); buf = buf.slice(end + 5); msgs.push({ from, to, raw }); data = null; from = ''; to = []; sock.write('250 OK queued\r\n'); continue; }
        const i = buf.indexOf('\r\n'); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2);
        const [cmd, ...rest] = line.split(' '); const arg = rest.join(' ');
        if (/^EHLO$/i.test(cmd)) sock.write('250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (/^AUTH$/i.test(cmd)) { auths.push(Buffer.from(rest[1] || '', 'base64').toString('utf8')); sock.write('235 ok\r\n'); }
        else if (/^MAIL$/i.test(cmd)) { from = arg.match(/<([^>]*)>/)?.[1] || ''; sock.write('250 ok\r\n'); }
        else if (/^RCPT$/i.test(cmd)) { to.push(arg.match(/<([^>]*)>/)?.[1] || ''); sock.write('250 ok\r\n'); }
        else if (/^DATA$/i.test(cmd)) { data = ''; sock.write('354 go\r\n'); }
        else if (/^QUIT$/i.test(cmd)) { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('500 what\r\n');
      }
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, msgs, auths, close: () => new Promise(r => server.close(r)) })));
}
const bodyOf = m => Buffer.from(m.raw.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
const waitFor = async (fn, ms = 3000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 25)); } };
const saved = { smtpUrl: config.smtpUrl, mailFrom: config.mailFrom, publicUrl: config.publicUrl };
const useSmtp = (port) => { config.smtpUrl = `smtp://ana%40x.io:s3cret@127.0.0.1:${port}`; config.mailFrom = 'DesTree <no-reply@destree.test>'; config.publicUrl = 'https://destree.test'; };
const noSmtp = () => Object.assign(config, saved);

test('mailer: parseSmtpUrl, envío con AUTH PLAIN, cabeceras UTF-8 y cuerpo base64; error legible si el servidor no responde', async (t) => {
  assert.deepEqual(parseSmtpUrl('smtps://u:p@mail.x:465'), { host: 'mail.x', port: 465, secure: true, user: 'u', pass: 'p', starttls: true, rejectUnauthorized: true });
  assert.equal(parseSmtpUrl('smtp://mail.x').port, 587); assert.equal(parseSmtpUrl('smtp://mail.x?starttls=0&insecure=1').starttls, false);
  assert.throws(() => parseSmtpUrl('http://x'), /smtp/);
  assert.equal(mailConfigured({ smtpUrl: '', mailFrom: 'a@b' }), false);
  const smtp = await fakeSmtp(); t.after(() => { noSmtp(); return smtp.close(); });
  useSmtp(smtp.port);
  const r = await sendMail({ to: 'Lorena <lorena@x.io>', subject: 'Invitación · ñ', text: 'Hola\n.punto al inicio\nAdiós' });
  assert.equal(r.to, 'lorena@x.io'); assert.match(r.messageId, /^<.+@destree\.test>$/);
  assert.equal(smtp.msgs.length, 1); const m = smtp.msgs[0];
  assert.equal(m.from, 'no-reply@destree.test'); assert.deepEqual(m.to, ['lorena@x.io']);
  assert.ok(m.raw.includes('Subject: =?UTF-8?B?')); assert.ok(m.raw.includes('Content-Transfer-Encoding: base64'));
  assert.equal(bodyOf(m), 'Hola\r\n.punto al inicio\r\nAdiós');
  assert.equal(smtp.auths[0], '\0ana@x.io\0s3cret');
  await smtp.close();
  await assert.rejects(sendMail({ to: 'a@b.io', subject: 'x', text: 'y' }), /ECONNREFUSED|SMTP/);
});

test('invitación: con SMTP se envía (emailSent, emailSentAt) y el enlace usa PUBLIC_URL; sin SMTP emailSent:false; fallo SMTP → 201 con mailError', async (t) => {
  resetRateLimit();
  const smtp = await fakeSmtp();
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(async () => { noSmtp(); await app.close(); await smtp.close(); });
  const admin = await setupAdmin(app);
  noSmtp();
  const off = (await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'off@test.io', role: 'viewer' } })).json();
  assert.equal(off.emailSent, false); assert.equal(smtp.msgs.length, 0);
  assert.equal((await app.inject({ method: 'GET', url: '/api/setup' })).json().mail, false);
  useSmtp(smtp.port);
  assert.equal((await app.inject({ method: 'GET', url: '/api/setup' })).json().mail, true);
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: admin } })).json().mail, true);
  const on = (await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'on@test.io', role: 'head' } })).json();
  assert.equal(on.emailSent, true); assert.ok(on.link.startsWith('https://destree.test/#/invite/'));
  assert.equal(smtp.msgs.length, 1); assert.deepEqual(smtp.msgs[0].to, ['on@test.io']);
  assert.ok(bodyOf(smtp.msgs[0]).includes(on.link), 'el correo lleva el enlace'); assert.ok(bodyOf(smtp.msgs[0]).includes('Test org'));
  const list = (await app.inject({ method: 'GET', url: '/api/invites', headers: { cookie: admin } })).json().invites;
  assert.ok(list.find(i => i.email === 'on@test.io').emailSentAt); assert.equal(list.find(i => i.email === 'off@test.io').emailSentAt, null);
  await smtp.close();
  const fail = await app.inject({ method: 'POST', url: '/api/invites', headers: { cookie: admin }, payload: { email: 'fail@test.io', role: 'viewer' } });
  assert.equal(fail.statusCode, 201); assert.equal(fail.json().emailSent, false); assert.ok(fail.json().mailError);
});

test('olvidé mi contraseña: forgot siempre 204; correo con enlace; reset cambia la contraseña, cierra sesiones y el token es de un solo uso; caducado → 410', async (t) => {
  resetRateLimit();
  const smtp = await fakeSmtp();
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(async () => { noSmtp(); await app.close(); await smtp.close(); });
  const admin = await setupAdmin(app);
  const des = await inviteAndAccept(app, admin, 'des@test.io', 'viewer', 'Des');
  const forgot = email => app.inject({ method: 'POST', url: '/api/auth/forgot', payload: { email } });
  noSmtp();
  assert.equal((await forgot('des@test.io')).statusCode, 204, 'sin SMTP también 204');
  useSmtp(smtp.port);
  assert.equal((await forgot('nadie@test.io')).statusCode, 204);
  assert.equal((await forgot('no-es-correo')).statusCode, 400);
  assert.equal((await forgot('des@test.io')).statusCode, 204);
  await waitFor(() => smtp.msgs.length === 1);
  assert.equal(smtp.msgs.length, 1, 'solo el correo existente recibe mensaje');
  const link = bodyOf(smtp.msgs[0]).match(/https:\/\/destree\.test\/#\/reset\/([A-Za-z0-9_-]+)/);
  assert.ok(link, 'enlace de reset en el correo'); const token = link[1];
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token: 'x'.repeat(43), password: 'nueva-clave-1' } })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'corta' } })).statusCode, 400);
  const ok = await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'nueva-clave-1' } });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: des.cookie } })).statusCode, 401, 'sesiones cerradas');
  resetRateLimit();
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'des@test.io', password: PW } })).statusCode, 401);
  assert.ok(await login(app, 'des@test.io', 'nueva-clave-1'));
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'otra-clave-1' } })).statusCode, 410, 'un solo uso');
  // caducado
  await forgot('des@test.io'); await waitFor(() => smtp.msgs.length === 2);
  const token2 = bodyOf(smtp.msgs[1]).match(/reset\/([A-Za-z0-9_-]+)/)[1];
  app.db.prepare("UPDATE password_resets SET expires_at = '2000-01-01T00:00:00.000Z' WHERE used_at IS NULL").run();
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token: token2, password: 'otra-clave-1' } })).statusCode, 410);
  // usuario desactivado no recibe correo
  const uid = des.user.id; await app.inject({ method: 'DELETE', url: `/api/users/${uid}`, headers: { cookie: admin } });
  resetRateLimit(); await forgot('des@test.io'); await new Promise(r => setTimeout(r, 150)); assert.equal(smtp.msgs.length, 2);
  const actions = app.db.prepare("SELECT DISTINCT action FROM audit_log").all().map(r => r.action);
  assert.ok(actions.includes('user.reset_request') && actions.includes('user.password'));
  assert.ok(!JSON.stringify(app.db.prepare('SELECT meta_json FROM audit_log').all()).includes('nueva-clave-1'));
  resetRateLimit();
});

test('POST /api/mail/test: admin recibe un correo de prueba; head 403; sin SMTP 409', async (t) => {
  resetRateLimit();
  const smtp = await fakeSmtp();
  const app = await buildApp({ dbPath: ':memory:', logger: false });
  t.after(async () => { noSmtp(); await app.close(); await smtp.close(); });
  const admin = await setupAdmin(app);
  const head = (await inviteAndAccept(app, admin, 'head@test.io', 'head')).cookie;
  noSmtp();
  assert.equal((await app.inject({ method: 'POST', url: '/api/mail/test', headers: { cookie: admin } })).statusCode, 409);
  useSmtp(smtp.port);
  assert.equal((await app.inject({ method: 'POST', url: '/api/mail/test', headers: { cookie: head } })).statusCode, 403);
  const r = await app.inject({ method: 'POST', url: '/api/mail/test', headers: { cookie: admin } });
  assert.equal(r.statusCode, 200); assert.equal(r.json().to, 'admin@test.io');
  assert.equal(smtp.msgs.length, 1); assert.ok(bodyOf(smtp.msgs[0]).includes('funciona'));
  await smtp.close();
  assert.equal((await app.inject({ method: 'POST', url: '/api/mail/test', headers: { cookie: admin } })).statusCode, 502);
});

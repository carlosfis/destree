// P7: cliente SMTP mínimo sin dependencias (node:net / node:tls): EHLO → STARTTLS → AUTH PLAIN|LOGIN → MAIL/RCPT/DATA → QUIT.
// Config: SMTP_URL (smtp://user:pass@host:587 con STARTTLS, smtps://…:465 TLS implícito; ?starttls=0 lo desactiva, ?insecure=1 no verifica el certificado),
// MAIL_FROM ("DesTree <no-reply@dominio>"), PUBLIC_URL (base de los enlaces; si falta se deduce de la petición).
import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';

export const TIMEOUT_MS = 15e3;
export function parseSmtpUrl(url) {
  if (!url) return null;
  let u; try { u = new URL(url); } catch { throw new Error('SMTP_URL no es una URL válida'); }
  if (!['smtp:', 'smtps:'].includes(u.protocol)) throw new Error('SMTP_URL debe empezar por smtp:// o smtps://');
  const secure = u.protocol === 'smtps:';
  return { host: u.hostname, port: Number(u.port) || (secure ? 465 : 587), secure, user: decodeURIComponent(u.username || ''), pass: decodeURIComponent(u.password || ''), starttls: u.searchParams.get('starttls') !== '0', rejectUnauthorized: u.searchParams.get('insecure') !== '1' };
}
export const mailConfigured = (cfg = config) => !!(cfg.smtpUrl && cfg.mailFrom);
/** Base pública para enlaces: PUBLIC_URL o, en su defecto, protocolo/host de la petición (respeta X-Forwarded-*). */
export const publicBase = (req, cfg = config) => cfg.publicUrl || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host}`;
const addressOf = s => (String(s).match(/<([^>]+)>/) || [, String(s).trim()])[1];
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const encodeHeader = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

/* --- Conexión con lector de respuestas (multilínea "250-… / 250 …") --- */
class Conn {
  constructor(socket) { this.ready = []; this.waiters = []; this.lines = []; this.buf = ''; this.bind(socket); }
  bind(socket) {
    this.sock = socket; this.buf = ''; this.lines = [];
    socket.setTimeout(TIMEOUT_MS, () => this.fail(new Error('SMTP: tiempo de espera agotado')));
    socket.on('data', d => { this.buf += d.toString('utf8'); this.flush(); });
    socket.on('error', e => this.fail(e));
    socket.on('close', () => this.fail(new Error('SMTP: conexión cerrada por el servidor')));
  }
  fail(err) { this.closed = err; for (const w of this.waiters.splice(0)) w.reject(err); }
  flush() {
    for (;;) {
      const i = this.buf.indexOf('\n'); if (i < 0) return;
      const line = this.buf.slice(0, i).replace(/\r$/, ''); this.buf = this.buf.slice(i + 1);
      this.lines.push(line);
      if (/^\d{3}( |$)/.test(line)) { const res = { code: Number(line.slice(0, 3)), text: this.lines.join('\n') }; this.lines = []; const w = this.waiters.shift(); if (w) w.resolve(res); else this.ready.push(res); }
    }
  }
  read() { return new Promise((resolve, reject) => { if (this.closed) return reject(this.closed); if (this.ready.length) return resolve(this.ready.shift()); this.waiters.push({ resolve, reject }); }); }
  async cmd(line, ok) {
    if (line != null) this.sock.write(line + '\r\n');
    const r = await this.read();
    if (!ok.includes(r.code)) throw new Error(`SMTP ${line ? line.split(' ')[0] : 'saludo'} → ${r.text.split('\n').pop()}`);
    return r;
  }
  end() { try { this.sock.end(); } catch { /* ya cerrado */ } }
}
const connect = (o) => new Promise((resolve, reject) => {
  const s = o.secure ? tls.connect({ host: o.host, port: o.port, servername: o.host, rejectUnauthorized: o.rejectUnauthorized }) : net.connect({ host: o.host, port: o.port });
  s.once(o.secure ? 'secureConnect' : 'connect', () => resolve(s)); s.once('error', reject);
});
const upgrade = (sock, o) => new Promise((resolve, reject) => {
  const t = tls.connect({ socket: sock, servername: o.host, rejectUnauthorized: o.rejectUnauthorized });
  t.once('secureConnect', () => resolve(t)); t.once('error', reject);
});

/** Envía un correo de texto plano. Devuelve { to, messageId }. Lanza con mensaje legible si algo falla. */
export async function sendMail({ to, subject, text }, cfg = config) {
  if (!mailConfigured(cfg)) throw new Error('Correo no configurado: define SMTP_URL y MAIL_FROM');
  const o = parseSmtpUrl(cfg.smtpUrl);
  const from = addressOf(cfg.mailFrom), rcpt = addressOf(to);
  const messageId = `<${randomBytes(12).toString('hex')}@${from.split('@')[1] || 'destree'}>`;
  const body = b64(text.replace(/\r?\n/g, '\r\n')).replace(/(.{76})/g, '$1\r\n');
  const msg = [`From: ${encodeHeader(cfg.mailFrom)}`, `To: ${rcpt}`, `Subject: ${encodeHeader(subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: ${messageId}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', body].join('\r\n');
  const conn = new Conn(await connect(o));
  try {
    await conn.cmd(null, [220]);
    let ehlo = await conn.cmd('EHLO destree.local', [250]);
    if (!o.secure && o.starttls && /STARTTLS/i.test(ehlo.text)) {
      await conn.cmd('STARTTLS', [220]);
      conn.sock.removeAllListeners('data'); conn.sock.removeAllListeners('close'); conn.sock.removeAllListeners('error');
      conn.bind(await upgrade(conn.sock, o));
      ehlo = await conn.cmd('EHLO destree.local', [250]);
    }
    if (o.user) {
      const plain = await conn.cmd(`AUTH PLAIN ${b64(`\0${o.user}\0${o.pass}`)}`, [235, 500, 502, 504, 535]);
      if (plain.code !== 235) {
        if (plain.code === 535) throw new Error('SMTP: usuario o contraseña rechazados');
        await conn.cmd('AUTH LOGIN', [334]); await conn.cmd(b64(o.user), [334]); await conn.cmd(b64(o.pass), [235]);
      }
    }
    await conn.cmd(`MAIL FROM:<${from}>`, [250]);
    await conn.cmd(`RCPT TO:<${rcpt}>`, [250, 251]);
    await conn.cmd('DATA', [354]);
    await conn.cmd(msg.replace(/\r\n\./g, '\r\n..') + '\r\n.', [250]);
    try { await conn.cmd('QUIT', [221]); } catch { /* algunos servidores cierran sin 221 */ }
    return { to: rcpt, messageId };
  } finally { conn.end(); }
}

/* --- Plantillas (texto plano; español por defecto, inglés con lang:'en' · P15) --- */
export const inviteMail = ({ orgName, role, link, expiresAt, lang }) => lang === 'en' ? {
  subject: `Invitation to ${orgName} on DesTree`,
  text: `You have been invited to ${orgName} on DesTree with the role ${role}.\n\nCreate your password and sign in from this link (valid until ${new Date(expiresAt).toLocaleDateString('en')}):\n${link}\n\nIf you were not expecting this invitation, ignore this email.`,
} : {
  subject: `Invitación a ${orgName} en DesTree`,
  text: `Te han invitado a ${orgName} en DesTree con el rol ${role}.\n\nCrea tu contraseña y entra desde este enlace (válido hasta ${new Date(expiresAt).toLocaleDateString('es')}):\n${link}\n\nSi no esperabas esta invitación, ignora este correo.`,
};
export const resetMail = ({ link, lang }) => lang === 'en' ? {
  subject: 'Reset your DesTree password',
  text: `We received a request to reset your password.\n\nOpen this link within the next hour to choose a new one:\n${link}\n\nIf you did not request it, ignore this email: your password stays the same.`,
} : {
  subject: 'Restablecer tu contraseña de DesTree',
  text: `Hemos recibido una solicitud para restablecer tu contraseña.\n\nAbre este enlace en la próxima hora para elegir una nueva:\n${link}\n\nSi no la pediste, ignora este correo: tu contraseña no cambia.`,
};
export const testMail = ({ orgName, lang }) => lang === 'en'
  ? { subject: `DesTree test email (${orgName})`, text: 'DesTree email delivery works. An admin requested this message from Organization → Mail.' }
  : { subject: `Prueba de correo de DesTree (${orgName})`, text: `El envío de correo de DesTree funciona. Este mensaje lo pidió un admin desde Administración → Usuarios.` };

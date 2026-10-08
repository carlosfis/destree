// F2: contraseñas (scrypt), sesiones (token aleatorio, sha256 en BD), invitaciones (token hash) y rate-limit en memoria.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { ulid, nowIso } from './ids.js';
import { HttpError } from './pages.js';
import { DEFAULT_ORG_ID } from '../db/sqlite.js';

export const SESSION_COOKIE = 'destree_sid';
export const SESSION_DAYS = 30;
export const INVITE_DAYS = 7;
const SCRYPT_N = 16384;

export function hashPassword(pw) {
  const salt = randomBytes(16).toString('base64url');
  return `scrypt$${SCRYPT_N}$${salt}$${scryptSync(pw, salt, 32, { N: SCRYPT_N }).toString('base64url')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, n, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const a = scryptSync(pw, salt, 32, { N: Number(n) }), b = Buffer.from(hash, 'base64url');
  return a.length === b.length && timingSafeEqual(a, b);
}
export const sha256 = s => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const normalizeEmail = e => String(e || '').trim().toLowerCase();
const addDays = d => new Date(Date.now() + d * 86400e3).toISOString();

/* --- Usuarios --- */
export function userCount(db) { return db.prepare('SELECT COUNT(*) AS n FROM users').get().n; }
export function findUserByEmail(db, email) { return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) || null; }
export function createUser(db, { email, name, password, role, orgId = DEFAULT_ORG_ID }) {
  email = normalizeEmail(email);
  if (findUserByEmail(db, email)) throw new HttpError(409, 'Ya existe un usuario con ese correo');
  const id = ulid();
  db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run(id, email, String(name || '').trim(), hashPassword(password));
  db.prepare('INSERT INTO memberships (user_id, org_id, role) VALUES (?, ?, ?)').run(id, orgId, role);
  return getUser(db, id, orgId);
}
export function getUser(db, id, orgId = DEFAULT_ORG_ID) {
  const r = db.prepare('SELECT u.id, u.email, u.name, u.is_active, u.last_login_at, u.created_at, m.role FROM users u JOIN memberships m ON m.user_id = u.id AND m.org_id = ? WHERE u.id = ?').get(orgId, id);
  return r ? publicUser(r) : null;
}
export function listUsers(db, orgId = DEFAULT_ORG_ID) {
  return db.prepare('SELECT u.id, u.email, u.name, u.is_active, u.last_login_at, u.created_at, m.role FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.org_id = ? ORDER BY u.created_at').all(orgId).map(publicUser);
}
export const publicUser = r => ({ id: r.id, email: r.email, name: r.name, role: r.role, isActive: !!r.is_active, lastLoginAt: r.last_login_at, createdAt: r.created_at });
export function adminCount(db, orgId = DEFAULT_ORG_ID) {
  return db.prepare("SELECT COUNT(*) AS n FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role = 'admin' AND u.is_active = 1").get(orgId).n;
}

/* --- Sesiones --- */
export function createSession(db, { userId, orgId = DEFAULT_ORG_ID, ua = '', ip = '' }) {
  const token = newToken();
  db.prepare('INSERT INTO sessions (id, user_id, org_id, expires_at, ua, ip) VALUES (?, ?, ?, ?, ?, ?)').run(sha256(token), userId, orgId, addDays(SESSION_DAYS), String(ua).slice(0, 300), String(ip).slice(0, 64));
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), userId);
  return token;
}
/** Devuelve { session, user } o null (caducada/inexistente/usuario inactivo). Limpia caducadas de forma oportunista. */
export function resolveSession(db, token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sha256(token));
  if (!s) return null;
  if (s.expires_at <= nowIso()) { db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id); return null; }
  const user = getUser(db, s.user_id, s.org_id);
  if (!user || !user.isActive) return null;
  return { session: s, user };
}
export function deleteSession(db, token) { if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token)); }
export function deleteUserSessions(db, userId) { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }
/** P3: cierra las demás sesiones del usuario (conserva la del token actual). Devuelve cuántas cerró. */
export function deleteOtherSessions(db, userId, keepToken) { return db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(userId, sha256(String(keepToken || ''))).changes; }
export function setPassword(db, userId, password) { db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId); }

/* --- Invitaciones --- */
export function createInvite(db, { orgId = DEFAULT_ORG_ID, email, role, cellIds = [], invitedBy }) {
  email = normalizeEmail(email);
  if (findUserByEmail(db, email)) throw new HttpError(409, 'Ese correo ya tiene cuenta');
  db.prepare('DELETE FROM invites WHERE org_id = ? AND email = ? AND used_at IS NULL').run(orgId, email);
  const token = newToken(), id = ulid();
  db.prepare('INSERT INTO invites (id, org_id, email, role, cell_ids_json, token_hash, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, orgId, email, role, JSON.stringify(cellIds), sha256(token), invitedBy, addDays(INVITE_DAYS));
  return { id, token, email, role, expiresAt: addDays(INVITE_DAYS) };
}
export const publicInvite = r => ({ id: r.id, email: r.email, role: r.role, cellIds: JSON.parse(r.cell_ids_json || '[]'), invitedBy: r.invited_by, expiresAt: r.expires_at, usedAt: r.used_at, createdAt: r.created_at });
export function listInvites(db, orgId = DEFAULT_ORG_ID) {
  return db.prepare('SELECT * FROM invites WHERE org_id = ? AND used_at IS NULL ORDER BY created_at DESC').all(orgId).map(publicInvite);
}
/** Invitación válida por token; 404 si no existe, 410 si caducada o usada. */
export function getInviteByToken(db, token) {
  const r = db.prepare('SELECT * FROM invites WHERE token_hash = ?').get(sha256(String(token || '')));
  if (!r) throw new HttpError(404, 'Invitación no encontrada');
  if (r.used_at) throw new HttpError(410, 'Esta invitación ya se usó');
  if (r.expires_at <= nowIso()) throw new HttpError(410, 'Esta invitación ha caducado');
  return r;
}
export function acceptInvite(db, { token, name, password, ua, ip }) {
  const inv = getInviteByToken(db, token);
  const user = createUser(db, { email: inv.email, name, password, role: inv.role, orgId: inv.org_id });
  db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(nowIso(), inv.id);
  return { invite: inv, user, token: createSession(db, { userId: user.id, orgId: inv.org_id, ua, ip }) };
}

/* --- Rate-limit en memoria (por IP; /api/setup, /api/auth/login, /api/invites/accept) --- */
const hits = new Map();
export function rateLimit(ip, { max = 10, windowMs = 15 * 60e3 } = {}) {
  const now = Date.now();
  const e = hits.get(ip) || { n: 0, reset: now + windowMs };
  if (e.reset <= now) { e.n = 0; e.reset = now + windowMs; }
  e.n++; hits.set(ip, e);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  if (e.n > max) throw new HttpError(429, 'Demasiados intentos; espera unos minutos');
}
export const resetRateLimit = () => hits.clear();

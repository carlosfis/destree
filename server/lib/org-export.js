// F6b: export/import completo de la org (schema/org-export.schema.json). Import pensado para instancia limpia; ids se conservan.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { DEFAULT_ORG_ID, transaction } from '../db/sqlite.js';
import { nowIso, ulid } from './ids.js';
import { listCells } from './cells.js';
import { listUsers, hashPassword, newToken } from './auth.js';
import { getDocument, saveDocument, HttpError } from './pages.js';
import { filesOf } from './images.js';
import { exportProjects, importProjects } from './projects.js'; // P11
import { ROLES, LEGACY_ROLES, sanitizeRoleLabels } from './permissions.js';

const strip = doc => { const { refs, ...d } = doc; return d; };
export function exportOrg(db, uploadsDir, { orgId = DEFAULT_ORG_ID, images = 'manifest' } = {}) {
  const org = db.prepare('SELECT id, name, slug, settings_json FROM orgs WHERE id = ?').get(orgId);
  const pages = db.prepare('SELECT id, status FROM pages WHERE org_id = ? ORDER BY created_at').all(orgId).map(p => ({
    status: p.status, document: strip(getDocument(db, p.id)), projects: exportProjects(db, p.id),
    versions: db.prepare('SELECT number, label, reason, created_by, created_at, snapshot_gz FROM page_versions WHERE page_id = ? ORDER BY number').all(p.id)
      .map(v => ({ number: v.number, label: v.label, reason: v.reason, createdBy: v.created_by, createdAt: v.created_at, document: JSON.parse(gunzipSync(v.snapshot_gz).toString('utf8')) })),
  }));
  const imgs = db.prepare('SELECT * FROM images WHERE org_id = ? ORDER BY created_at').all(orgId).map(i => {
    const row = { id: i.id, kind: i.kind, filename: i.filename, mime: i.mime, width: i.width, height: i.height, bytes: i.bytes, sha256: i.sha256, createdAt: i.created_at };
    if (images === 'embed') { const f = filesOf(uploadsDir, orgId, i.id); try { row.data = fs.readFileSync(f.full).toString('base64'); row.thumb = fs.readFileSync(f.thumb).toString('base64'); } catch { /* archivo ausente */ } }
    return row;
  });
  return {
    version: 3, exportedAt: nowIso(), org: { id: org.id, name: org.name, slug: org.slug, settings: JSON.parse(org.settings_json || '{}') },
    cells: listCells(db, orgId).map(c => ({ id: c.id, name: c.name, color: c.color, description: c.description, leadUserId: c.leadUserId, memberIds: c.memberIds })),
    users: listUsers(db, orgId).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt })),
    pages, images: imgs,
  };
}
/** Importa en la org por defecto. Usuarios nuevos reciben contraseña aleatoria (admin la fija con PATCH /api/users/:id). Páginas con id existente se sustituyen. */
export function importOrg(db, uploadsDir, data, { orgId = DEFAULT_ORG_ID, importedBy = null } = {}) {
  const stats = { cells: 0, users: 0, pages: 0, versions: 0, images: 0, skippedImages: 0, projects: 0 };
  return transaction(db, () => {
    const settings = { ...(data.org.settings || {}) }; if (settings.roleLabels) settings.roleLabels = sanitizeRoleLabels(settings.roleLabels); // P10
    db.prepare('UPDATE orgs SET name = ?, settings_json = ? WHERE id = ?').run(String(data.org.name).slice(0, 120), JSON.stringify(settings), orgId);
    const userIds = new Set(db.prepare('SELECT user_id FROM memberships WHERE org_id = ?').all(orgId).map(r => r.user_id));
    for (const u of data.users) {
      const email = String(u.email).trim().toLowerCase();
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      const id = existing ? existing.id : u.id;
      if (!existing) { db.prepare('INSERT OR IGNORE INTO users (id, email, name, password_hash, is_active) VALUES (?, ?, ?, ?, ?)').run(id, email, u.name || '', hashPassword(newToken()), u.isActive === false ? 0 : 1); stats.users++; }
      db.prepare('INSERT OR IGNORE INTO memberships (user_id, org_id, role) VALUES (?, ?, ?)').run(id, orgId, ROLES.includes(u.role) ? u.role : LEGACY_ROLES[u.role] || 'viewer'); // P10: exports antiguos (designer)
      userIds.add(id); u._id = id;
    }
    const mapUser = id => (data.users.find(u => u.id === id) || {})._id || (userIds.has(id) ? id : null);
    for (const c of data.cells) {
      db.prepare('INSERT OR REPLACE INTO cells (id, org_id, name, color, description, lead_user_id) VALUES (?, ?, ?, ?, ?, ?)').run(c.id, orgId, c.name, c.color || 'gray', c.description || '', mapUser(c.leadUserId));
      db.prepare('DELETE FROM cell_members WHERE cell_id = ?').run(c.id);
      for (const m of c.memberIds || []) { const uid = mapUser(m); if (uid) db.prepare('INSERT OR IGNORE INTO cell_members (cell_id, user_id) VALUES (?, ?)').run(c.id, uid); }
      stats.cells++;
    }
    for (const i of data.images) {
      if (!i.data) { stats.skippedImages++; continue; }
      const f = filesOf(uploadsDir, orgId, i.id); fs.mkdirSync(path.dirname(f.full), { recursive: true });
      const buf = Buffer.from(i.data, 'base64'); fs.writeFileSync(f.full, buf); if (i.thumb) fs.writeFileSync(f.thumb, Buffer.from(i.thumb, 'base64'));
      db.prepare('INSERT OR REPLACE INTO images (id, org_id, kind, filename, mime, width, height, bytes, sha256, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(i.id, orgId, i.kind || 'node', i.filename || '', i.mime || 'image/webp', i.width || 0, i.height || 0, i.bytes || buf.length, i.sha256 || createHash('sha256').update(buf).digest('hex'), importedBy, i.createdAt || nowIso());
      stats.images++;
    }
    for (const p of data.pages) {
      const pg = p.document.page, id = pg.id || ulid();
      const exists = db.prepare('SELECT 1 FROM pages WHERE id = ?').get(id);
      if (!exists) db.prepare('INSERT INTO pages (id, org_id, name, description, visibility, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(id, orgId, pg.name, pg.description || '', pg.visibility === 'cells' ? 'cells' : 'org', importedBy);
      else db.prepare('UPDATE pages SET name = ?, description = ?, visibility = ? WHERE id = ?').run(pg.name, pg.description || '', pg.visibility === 'cells' ? 'cells' : 'org', id);
      db.prepare('DELETE FROM page_cells WHERE page_id = ?').run(id);
      for (const c of pg.cellIds || []) db.prepare('INSERT OR IGNORE INTO page_cells (page_id, cell_id) SELECT ?, id FROM cells WHERE id = ?').run(id, c);
      db.prepare("UPDATE pages SET status = 'active' WHERE id = ?").run(id); // saveDocument exige página activa; el estado final se fija abajo
      const { page, ...content } = p.document;
      for (const n of content.nodes) { if (n.ownerUserId) n.ownerUserId = mapUser(n.ownerUserId); n.assigneeIds = (n.assigneeIds || []).map(mapUser).filter(Boolean); }
      saveDocument(db, id, content, null);
      if (p.projects) { db.prepare('DELETE FROM projects WHERE page_id = ?').run(id); stats.projects += importProjects(db, id, p.projects); } // P11
      db.prepare('DELETE FROM page_versions WHERE page_id = ?').run(id);
      for (const v of p.versions || []) {
        const json = JSON.stringify(v.document);
        db.prepare('INSERT INTO page_versions (id, page_id, number, label, reason, snapshot_gz, hash, size, image_ids_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(ulid(), id, v.number, v.label || '', v.reason, gzipSync(json), createHash('sha256').update(json).digest('hex'), json.length, JSON.stringify([...new Set((v.document.nodes || []).flatMap(n => [n.imageId, n.thumbIconId]).filter(Boolean))]), mapUser(v.createdBy), v.createdAt || nowIso());
        stats.versions++;
      }
      const status = ['archived', 'deleted'].includes(p.status) ? p.status : 'active';
      db.prepare('UPDATE pages SET status = ?, archived_at = ?, deleted_at = ? WHERE id = ?').run(status, status === 'archived' ? nowIso() : null, status === 'deleted' ? nowIso() : null, id);
      stats.pages++;
    }
    if (!db.prepare("SELECT 1 FROM pages WHERE org_id = ? AND status = 'active'").get(orgId)) throw new HttpError(400, 'El export no deja ninguna página activa');
    return stats;
  });
}

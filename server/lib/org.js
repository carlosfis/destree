// P10: datos de la organización (nombre, etiquetas de roles en orgs.settings_json.roleLabels) y borrado completo (vuelve al asistente inicial).
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ORG_ID, transaction, seed } from '../db/sqlite.js';
import { HttpError } from './pages.js';
import { roleLabels, sanitizeRoleLabels } from './permissions.js';

const pj = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };
export function orgSettings(db, orgId = DEFAULT_ORG_ID) {
  const r = db.prepare('SELECT settings_json FROM orgs WHERE id = ?').get(orgId);
  return r ? pj(r.settings_json, {}) : {};
}
/** { id, name, slug, roleLabels } con las etiquetas ya fusionadas con las de defecto. */
export function getOrg(db, orgId = DEFAULT_ORG_ID) {
  const r = db.prepare('SELECT id, name, slug, settings_json FROM orgs WHERE id = ?').get(orgId);
  if (!r) throw new HttpError(404, 'Organización no encontrada');
  return { id: r.id, name: r.name, slug: r.slug, roleLabels: roleLabels(pj(r.settings_json, {}).roleLabels) };
}
export const orgRoleLabels = (db, orgId = DEFAULT_ORG_ID) => roleLabels(orgSettings(db, orgId).roleLabels);
/** `name` y/o `roleLabels` (mapa rol → etiqueta; vacío o igual al defecto = sin personalizar; Admin no cambia). */
export function updateOrg(db, { name, roleLabels: labels }, orgId = DEFAULT_ORG_ID) {
  return transaction(db, () => {
    const cur = getOrg(db, orgId);
    const next = name != null ? String(name).trim().slice(0, 120) : cur.name;
    if (!next) throw new HttpError(400, 'El nombre es obligatorio');
    const settings = orgSettings(db, orgId);
    if (labels !== undefined) settings.roleLabels = sanitizeRoleLabels(labels);
    db.prepare('UPDATE orgs SET name = ?, settings_json = ? WHERE id = ?').run(next, JSON.stringify(settings), orgId);
    return getOrg(db, orgId);
  });
}
/** Borra todo el contenido de la organización (páginas, versiones, células, usuarios, sesiones, invitaciones, imágenes, audit) y la deja como recién instalada.
    Los respaldos en disco y sus filas se conservan. Devuelve cuántas filas principales se eliminaron. */
export function wipeOrg(db, { uploadsDir } = {}, orgId = DEFAULT_ORG_ID) {
  const count = (sql) => db.prepare(sql).get(orgId).n;
  const stats = transaction(db, () => {
    const s = { pages: count('SELECT COUNT(*) AS n FROM pages WHERE org_id = ?'), cells: count('SELECT COUNT(*) AS n FROM cells WHERE org_id = ?'), images: count('SELECT COUNT(*) AS n FROM images WHERE org_id = ?'), users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n };
    for (const [sql, args] of [['DELETE FROM pages WHERE org_id = ?', [orgId]], ['DELETE FROM cells WHERE org_id = ?', [orgId]], ['DELETE FROM invites WHERE org_id = ?', [orgId]], ['DELETE FROM images WHERE org_id = ?', [orgId]], ['DELETE FROM users', []], ['DELETE FROM audit_log', []]]) db.prepare(sql).run(...args);
    db.prepare("UPDATE orgs SET name = 'Mi organización', settings_json = '{}' WHERE id = ?").run(orgId);
    return s;
  });
  if (uploadsDir) fs.rmSync(path.join(uploadsDir, orgId), { recursive: true, force: true });
  seed(db); // página por defecto de nuevo
  return stats;
}

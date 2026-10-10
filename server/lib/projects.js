// Página de proyecto de una card: settings, secciones del Overview, fases y actividades (cronograma + kanban). Tablas de la migración 013.
import { transaction } from '../db/sqlite.js';
import { ulid, nowIso } from './ids.js';
import { HttpError } from './pages.js';
import { SECTION_KINDS, STATUSES, PHASE_COLORS, sanitizeSectionData, sanitizeSettings, defaultSections, normalizeAssignee, isDate } from './project-template.js';

const j = v => JSON.stringify(v);
const pj = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };
const section = r => ({ id: r.id, position: r.position, kind: r.kind, title: r.title, data: sanitizeSectionData(r.kind, pj(r.data_json, {})) });
const phase = r => ({ id: r.id, position: r.position, name: r.name, color: r.color });
const activity = r => ({ id: r.id, position: r.position, phaseId: r.phase_id, title: r.title, description: r.description, tag: r.tag, assignee: r.assignee, startDate: r.start_date, endDate: r.end_date, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });
const TABLE = { section: 'project_sections', phase: 'project_phases', activity: 'project_activities' };

/** Crea la fila del proyecto (y la plantilla del Overview) si no existe. `node` = la card tal como la ve el usuario. */
export function ensureProject(db, pageId, nodeId, node = {}, lang = 'es') {
  const cur = db.prepare('SELECT * FROM projects WHERE page_id = ? AND node_id = ?').get(pageId, nodeId);
  if (cur) return cur;
  return transaction(db, () => {
    db.prepare('INSERT INTO projects (page_id, node_id, settings_json) VALUES (?, ?, ?)').run(pageId, nodeId, j(sanitizeSettings({})));
    const ins = db.prepare('INSERT INTO project_sections (id, page_id, node_id, position, kind, title, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
    defaultSections(node, lang).forEach((s, i) => ins.run(ulid(), pageId, nodeId, i, s.kind, s.title, j(s.data)));
    return db.prepare('SELECT * FROM projects WHERE page_id = ? AND node_id = ?').get(pageId, nodeId);
  });
}
export function getProject(db, pageId, nodeId, node = {}, lang = 'es') {
  const p = ensureProject(db, pageId, nodeId, node, lang);
  const rows = t => db.prepare(`SELECT * FROM ${t} WHERE page_id = ? AND node_id = ? ORDER BY position, rowid`).all(pageId, nodeId);
  return { settings: sanitizeSettings(pj(p.settings_json, {})), sections: rows('project_sections').map(section), phases: rows('project_phases').map(phase), activities: rows('project_activities').map(activity), updatedAt: p.updated_at };
}
const touch = (db, pageId, nodeId) => db.prepare('UPDATE projects SET updated_at = ? WHERE page_id = ? AND node_id = ?').run(nowIso(), pageId, nodeId);
export function updateSettings(db, pageId, nodeId, patch) {
  const p = ensureProject(db, pageId, nodeId);
  const next = sanitizeSettings({ ...sanitizeSettings(pj(p.settings_json, {})), ...patch });
  db.prepare('UPDATE projects SET settings_json = ?, updated_at = ? WHERE page_id = ? AND node_id = ?').run(j(next), nowIso(), pageId, nodeId);
  return next;
}
/** Posición: nueva fila al final; `position` explícita reordena el resto (0 = primera). */
function place(db, table, pageId, nodeId, id, position) {
  const ids = db.prepare(`SELECT id FROM ${table} WHERE page_id = ? AND node_id = ? ORDER BY position, rowid`).all(pageId, nodeId).map(r => r.id).filter(x => x !== id);
  const at = position == null ? ids.length : Math.max(0, Math.min(ids.length, Math.round(position)));
  ids.splice(at, 0, id);
  const upd = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
  ids.forEach((x, i) => upd.run(i, x));
}
const own = (db, table, pageId, nodeId, id) => { const r = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND page_id = ? AND node_id = ?`).get(id, pageId, nodeId); if (!r) throw new HttpError(404, 'No encontrado'); return r; };

/* --- Overview: secciones --- */
export function createSection(db, pageId, nodeId, { kind, title = '', data = {}, position = null }) {
  if (!SECTION_KINDS.includes(kind)) throw new HttpError(400, 'Tipo de sección desconocido');
  if (db.prepare('SELECT COUNT(*) AS n FROM project_sections WHERE page_id = ? AND node_id = ?').get(pageId, nodeId).n >= 40) throw new HttpError(400, 'Máximo 40 secciones');
  return transaction(db, () => {
    ensureProject(db, pageId, nodeId);
    const id = ulid();
    db.prepare('INSERT INTO project_sections (id, page_id, node_id, position, kind, title, data_json) VALUES (?, ?, ?, 0, ?, ?, ?)').run(id, pageId, nodeId, kind, String(title).trim().slice(0, 80), j(sanitizeSectionData(kind, data)));
    place(db, TABLE.section, pageId, nodeId, id, position); touch(db, pageId, nodeId);
    return section(own(db, TABLE.section, pageId, nodeId, id));
  });
}
export function updateSection(db, pageId, nodeId, id, patch) {
  return transaction(db, () => {
    const cur = own(db, TABLE.section, pageId, nodeId, id);
    const title = patch.title != null ? String(patch.title).trim().slice(0, 80) : cur.title;
    const data = patch.data !== undefined ? sanitizeSectionData(cur.kind, patch.data) : pj(cur.data_json, {});
    db.prepare('UPDATE project_sections SET title = ?, data_json = ? WHERE id = ?').run(title, j(data), id);
    if (patch.position != null) place(db, TABLE.section, pageId, nodeId, id, patch.position);
    touch(db, pageId, nodeId);
    return section(own(db, TABLE.section, pageId, nodeId, id));
  });
}
export function deleteSection(db, pageId, nodeId, id) { own(db, TABLE.section, pageId, nodeId, id); db.prepare('DELETE FROM project_sections WHERE id = ?').run(id); touch(db, pageId, nodeId); }

/* --- Cronograma: fases --- */
const phaseColor = (db, pageId, nodeId, color) => (/^#[0-9a-f]{6}$/i.test(color || '') ? color.toLowerCase() : PHASE_COLORS[db.prepare('SELECT COUNT(*) AS n FROM project_phases WHERE page_id = ? AND node_id = ?').get(pageId, nodeId).n % PHASE_COLORS.length]);
export function createPhase(db, pageId, nodeId, { name, color, position = null }) {
  const nm = String(name || '').trim().slice(0, 80); if (!nm) throw new HttpError(400, 'El nombre de la fase es obligatorio');
  if (db.prepare('SELECT COUNT(*) AS n FROM project_phases WHERE page_id = ? AND node_id = ?').get(pageId, nodeId).n >= 30) throw new HttpError(400, 'Máximo 30 fases');
  return transaction(db, () => {
    ensureProject(db, pageId, nodeId);
    const id = ulid();
    db.prepare('INSERT INTO project_phases (id, page_id, node_id, position, name, color) VALUES (?, ?, ?, 0, ?, ?)').run(id, pageId, nodeId, nm, phaseColor(db, pageId, nodeId, color));
    place(db, TABLE.phase, pageId, nodeId, id, position); touch(db, pageId, nodeId);
    return phase(own(db, TABLE.phase, pageId, nodeId, id));
  });
}
export function updatePhase(db, pageId, nodeId, id, patch) {
  return transaction(db, () => {
    const cur = own(db, TABLE.phase, pageId, nodeId, id);
    const nm = patch.name != null ? String(patch.name).trim().slice(0, 80) : cur.name; if (!nm) throw new HttpError(400, 'El nombre de la fase es obligatorio');
    db.prepare('UPDATE project_phases SET name = ?, color = ? WHERE id = ?').run(nm, patch.color != null ? phaseColor(db, pageId, nodeId, patch.color) : cur.color, id);
    if (patch.position != null) place(db, TABLE.phase, pageId, nodeId, id, patch.position);
    touch(db, pageId, nodeId);
    return phase(own(db, TABLE.phase, pageId, nodeId, id));
  });
}
/** Las actividades de la fase quedan sin fase (solo kanban). */
export function deletePhase(db, pageId, nodeId, id) { own(db, TABLE.phase, pageId, nodeId, id); db.prepare('DELETE FROM project_phases WHERE id = ?').run(id); touch(db, pageId, nodeId); }

/* --- Actividades (cronograma + kanban) --- */
function activityFields(db, pageId, nodeId, cur, patch) {
  const pick = (k, cv) => (patch[k] !== undefined ? patch[k] : cv);
  const title = String(pick('title', cur.title) || '').trim().slice(0, 120); if (!title) throw new HttpError(400, 'El título es obligatorio');
  const phaseId = pick('phaseId', cur.phase_id) || null;
  if (phaseId && !db.prepare('SELECT 1 FROM project_phases WHERE id = ? AND page_id = ? AND node_id = ?').get(phaseId, pageId, nodeId)) throw new HttpError(400, 'Fase desconocida');
  const startDate = pick('startDate', cur.start_date) || null, endDate = pick('endDate', cur.end_date) || null;
  if ((startDate && !isDate(startDate)) || (endDate && !isDate(endDate))) throw new HttpError(400, 'Fecha inválida (YYYY-MM-DD)');
  if (startDate && endDate && endDate < startDate) throw new HttpError(400, 'La fecha de fin es anterior a la de inicio');
  const status = pick('status', cur.status); if (!STATUSES.includes(status)) throw new HttpError(400, 'Estado desconocido');
  return { title, description: String(pick('description', cur.description) || '').replace(/\r\n?/g, '\n').slice(0, 600), tag: String(pick('tag', cur.tag) || '').trim().toUpperCase().slice(0, 4), assignee: normalizeAssignee(pick('assignee', cur.assignee)).slice(0, 80), phaseId, startDate, endDate: endDate && startDate ? endDate : null, status };
}
export function createActivity(db, pageId, nodeId, body) {
  if (db.prepare('SELECT COUNT(*) AS n FROM project_activities WHERE page_id = ? AND node_id = ?').get(pageId, nodeId).n >= 500) throw new HttpError(400, 'Máximo 500 actividades');
  return transaction(db, () => {
    ensureProject(db, pageId, nodeId);
    const f = activityFields(db, pageId, nodeId, { title: '', description: '', tag: '', assignee: '', phase_id: null, start_date: null, end_date: null, status: 'todo' }, body);
    const id = ulid(), now = nowIso();
    db.prepare('INSERT INTO project_activities (id, page_id, node_id, phase_id, position, title, description, tag, assignee, start_date, end_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, pageId, nodeId, f.phaseId, f.title, f.description, f.tag, f.assignee, f.startDate, f.endDate, f.status, now, now);
    place(db, TABLE.activity, pageId, nodeId, id, body.position); touch(db, pageId, nodeId);
    return activity(own(db, TABLE.activity, pageId, nodeId, id));
  });
}
export function updateActivity(db, pageId, nodeId, id, patch) {
  return transaction(db, () => {
    const cur = own(db, TABLE.activity, pageId, nodeId, id);
    const f = activityFields(db, pageId, nodeId, cur, patch);
    db.prepare('UPDATE project_activities SET phase_id = ?, title = ?, description = ?, tag = ?, assignee = ?, start_date = ?, end_date = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(f.phaseId, f.title, f.description, f.tag, f.assignee, f.startDate, f.endDate, f.status, nowIso(), id);
    if (patch.position != null) place(db, TABLE.activity, pageId, nodeId, id, patch.position);
    touch(db, pageId, nodeId);
    return activity(own(db, TABLE.activity, pageId, nodeId, id));
  });
}
export function deleteActivity(db, pageId, nodeId, id) { own(db, TABLE.activity, pageId, nodeId, id); db.prepare('DELETE FROM project_activities WHERE id = ?').run(id); touch(db, pageId, nodeId); }

/* --- Export / import / duplicar (ids nuevos; `nodeId` se conserva porque duplicar e importar mantienen los ids de las cards) --- */
export function exportProjects(db, pageId) {
  return db.prepare('SELECT node_id FROM projects WHERE page_id = ? ORDER BY rowid').all(pageId).map(r => { const { updatedAt, ...p } = getProject(db, pageId, r.node_id); return { nodeId: r.node_id, ...p }; });
}
export function importProjects(db, pageId, list, { replace = true } = {}) {
  let n = 0;
  transaction(db, () => {
    for (const p of list || []) {
      if (!p || !p.nodeId) continue;
      if (replace) db.prepare('DELETE FROM projects WHERE page_id = ? AND node_id = ?').run(pageId, p.nodeId);
      else if (db.prepare('SELECT 1 FROM projects WHERE page_id = ? AND node_id = ?').get(pageId, p.nodeId)) continue;
      db.prepare('INSERT INTO projects (page_id, node_id, settings_json) VALUES (?, ?, ?)').run(pageId, p.nodeId, j(sanitizeSettings(p.settings)));
      (p.sections || []).forEach((s, i) => { if (SECTION_KINDS.includes(s.kind)) db.prepare('INSERT INTO project_sections (id, page_id, node_id, position, kind, title, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(ulid(), pageId, p.nodeId, i, s.kind, String(s.title || '').slice(0, 80), j(sanitizeSectionData(s.kind, s.data))); });
      const phaseIds = new Map();
      (p.phases || []).forEach((ph, i) => { const id = ulid(); phaseIds.set(ph.id, id); db.prepare('INSERT INTO project_phases (id, page_id, node_id, position, name, color) VALUES (?, ?, ?, ?, ?, ?)').run(id, pageId, p.nodeId, i, String(ph.name || 'Fase').slice(0, 80), phaseColor(db, pageId, p.nodeId, ph.color)); });
      (p.activities || []).forEach((a, i) => { try { createActivity(db, pageId, p.nodeId, { ...a, phaseId: phaseIds.get(a.phaseId) || null, position: i }); } catch (err) { if (!(err instanceof HttpError)) throw err; } });
      n++;
    }
  });
  return n;
}
export const copyProjects = (db, fromPageId, toPageId) => importProjects(db, toPageId, exportProjects(db, fromPageId));

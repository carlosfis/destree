// Datos demo: células, cuentas por nivel y dos páginas completas («Ecosistema Elektra» y «Plataforma Tecnológica») con portadas, relaciones y páginas de proyecto.
// Uso: node scripts/seed-demo.js [--password=<común para las cuentas demo>] [--reset]   (SEED_PASSWORD como alternativa; sin contraseña se genera una por cuenta y se imprime)
// Escribe directamente en la BD (DATABASE_PATH o data/destree.db); el servidor puede estar corriendo (WAL). --reset borra y recrea las páginas demo (las cuentas se conservan).
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { openReady, DEFAULT_ORG_ID, transaction } from '../server/db/sqlite.js';
import { config } from '../server/config.js';
import { saveDocument } from '../server/lib/pages.js';
import { createVersion } from '../server/lib/versions.js';
import { importProjects } from '../server/lib/projects.js';
import { createUser, findUserByEmail } from '../server/lib/auth.js';
import { createCell, updateCell, setCellMembers, listCells } from '../server/lib/cells.js';
import { storeImage } from '../server/lib/images.js';
import { coverSVG } from './seed/covers.js';
import * as U from './seed/users.js';
import * as T1 from './seed/elektra-tree.js';
import * as T2 from './seed/plataforma-tree.js';
import { projects as P1 } from './seed/elektra-projects.js';
import { projects as P2 } from './seed/plataforma-projects.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const db = openReady(config.dbPath);
const uploadsDir = config.uploadsDir || path.join(path.dirname(config.dbPath), 'uploads');
const orgId = DEFAULT_ORG_ID;
const admin = db.prepare("SELECT user_id FROM memberships WHERE org_id = ? AND role = 'admin' ORDER BY rowid LIMIT 1").get(orgId);
if (!admin) { console.error('No hay admin: completa el asistente (POST /api/setup) antes de sembrar.'); process.exit(1); }

/* --- Cuentas y células --- */
const userIds = {}, cellIds = {}, created = [];
const pw = args.password || process.env.SEED_PASSWORD || null;
for (const u of U.users) {
  const existing = findUserByEmail(db, u.email);
  if (existing) { userIds[u.key] = existing.id; continue; }
  const password = pw || randomBytes(9).toString('base64url');
  userIds[u.key] = createUser(db, { email: u.email, name: u.name, password, role: u.role, orgId }).id;
  created.push({ email: u.email, role: u.role, password: pw ? '(la indicada)' : password });
}
const byName = new Map(listCells(db, orgId).map(c => [c.name, c]));
for (const c of U.cells) {
  const cell = byName.get(c.name) || createCell(db, { name: c.name, color: c.color, description: c.description }, orgId);
  cellIds[c.key] = cell.id;
  updateCell(db, cell.id, { leadUserId: userIds[c.lead] || null }, orgId);
  setCellMembers(db, cell.id, U.users.filter(u => u.cells.includes(c.key)).map(u => userIds[u.key]), orgId);
}

/* --- Layout: misma heurística que el auto-layout del cliente (fila de sub-contenedores y luego fila de hojas; raíces en filas) con alturas estimadas
       a partir de lo que pinta cada card (descripción, etiquetas, chips de staff/responsable/asignados/docs/DS, consumidores externos, portada). Calibrado contra el DOM real. --- */
const CARD_W = 220, CTR_MIN_W = 300, PAD = 16, HEAD_GAP = 12, GAP = 24, MIN_BODY = 96;
const L = s => String(s || '').length;
function layout(nodes, edges, users) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const rootOf = n => { let g = 0; while (n.parentId && byId.has(n.parentId) && g++ < 100) n = byId.get(n.parentId); return n; };
  const consumers = id => edges.filter(([k, from, to]) => k === 'ds' && to === id).map(([, from]) => byId.get(from)).filter(Boolean);
  const dsRefs = id => edges.filter(([k, from]) => k === 'ds' && from === id).map(([, , to]) => byId.get(to)?.name || '');
  const kidsOf = id => nodes.filter(n => n.parentId === id);
  const uname = k => users[k] || '';
  const chips = n => [...n.staff.map(m => `${m.name} · ${m.role}`), ...(n.owner ? [uname(n.owner)] : []), ...n.assignees.map(uname), ...(n.docs.length ? ['⎘ 9'] : [])];
  const leafH = n => {
    const ext = consumers(n.id).filter(c => rootOf(c).id !== rootOf(n).id).map(c => rootOf(c).name).join(', ');
    const chipLines = chips(n).reduce((a, c) => a + Math.ceil((L(c) + 2) / 26), 0) + 1 + (ext ? Math.ceil((L(ext) + 2) / 28) : 0);
    return 68 + Math.ceil(L(n.description) / 28) * 17 + (n.tags.length ? 24 : 0) + chipLines * 22 + 16;
  };
  const headH = (n, w) => {
    const inner = w - 32, perLine = Math.max(20, inner / 8);
    const all = [...chips(n), ...dsRefs(n.id).map(x => '• ' + x), ...(kidsOf(n.id).length ? ['9 elementos'] : [])];
    const chipLines = Math.ceil(all.reduce((a, c) => a + L(c) + 3, 0) / perLine);
    return 68 + Math.ceil(L(n.description) / Math.max(20, inner / 7)) * 18 + (n.tags.length ? 24 : 0) + chipLines * 22 + (n.cover ? 124 : 0) + 20;
  };
  const order = { software: 0, ds: 1, uikit: 2 };
  const size = new Map();
  const place = n => {
    if (n.type !== 'software') { const s = { w: CARD_W, h: leafH(n) }; size.set(n.id, s); return s; }
    const kids = kidsOf(n.id).sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name));
    kids.forEach(place);
    let x = PAD, y = 0, rowH = 0, maxR = 0, bottom = 0;
    const row = list => { for (const k of list) { const s = size.get(k.id); if (x > PAD && x + s.w > (n.parentId ? 1100 : 1400)) { x = PAD; y += rowH + GAP; rowH = 0; } k.x = x; k.y = y; x += s.w + GAP; rowH = Math.max(rowH, s.h); maxR = Math.max(maxR, x - GAP); bottom = Math.max(bottom, y + s.h); } if (list.length) { y += rowH + GAP; x = PAD; rowH = 0; } };
    row(kids.filter(k => k.type === 'software')); row(kids.filter(k => k.type !== 'software'));
    const w = Math.max(CTR_MIN_W, maxR + PAD), hh = headH(n, w);
    for (const k of kids) k.y += hh + HEAD_GAP; // la cabecera se conoce una vez calculado el ancho
    const s = { w, h: Math.max(hh + MIN_BODY, kids.length ? bottom + hh + HEAD_GAP + PAD : 0) }; size.set(n.id, s); return s;
  };
  const roots = nodes.filter(n => !n.parentId); roots.forEach(place);
  let x = 0, y = 0, rowH = 0;
  for (const r of roots) { const s = size.get(r.id); if (x > 0 && x + s.w > 3400) { x = 0; y += rowH + 120; rowH = 0; } r.x = x; r.y = y; x += s.w + 100; rowH = Math.max(rowH, s.h); }
}

/* --- Páginas --- */
async function seedPage(T, projects) {
  const exists = db.prepare('SELECT 1 FROM pages WHERE id = ?').get(T.page.id);
  if (exists) { if (!args.reset) { console.log(`· ${T.page.name}: ya existe (usa --reset para recrearla)`); return; } db.prepare('DELETE FROM pages WHERE id = ?').run(T.page.id); }
  const nodes = [];
  for (const n of T.nodes) {
    let imageId = null;
    if (n.cover) imageId = (await storeImage(db, uploadsDir, { buffer: coverSVG(n.cover), orgId, createdBy: admin.user_id, kind: 'node', filename: `${n.id}-cover.svg` })).id;
    nodes.push({ ...n, x: 0, y: 0, w: 0, h: 0, imageId, cellIds: (n.cells || []).map(k => cellIds[k]).filter(Boolean), ownerUserId: n.owner ? userIds[n.owner] || null : null, assigneeIds: (n.assignees || []).map(k => userIds[k]).filter(Boolean), owner: n.staff[0]?.name || '' });
  }
  layout(nodes, T.edges, Object.fromEntries(U.users.map(u => [u.key, u.name])));
  const edges = T.edges.map(([kind, from, to], i) => ({ id: `${T.page.id}_e${i}`, kind, from, to }));
  transaction(db, () => {
    db.prepare('INSERT INTO pages (id, org_id, name, description, visibility, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(T.page.id, orgId, T.page.name, T.page.description, T.page.visibility, admin.user_id);
    for (const k of T.page.cellIds || []) db.prepare('INSERT OR IGNORE INTO page_cells (page_id, cell_id) VALUES (?, ?)').run(T.page.id, cellIds[k]);
    saveDocument(db, T.page.id, { version: 3, page: { id: T.page.id, name: T.page.name, description: T.page.description, visibility: T.page.visibility }, nodes, edges, tags: T.tags, branchTypes: T.branchTypes, settings: { typeNames: T.page.typeNames }, camera: { x: 60, y: 40, z: 0.55 } }, 0);
    createVersion(db, T.page.id, { reason: 'import', label: 'Datos demo', userId: admin.user_id });
    importProjects(db, T.page.id, projects);
  });
  console.log(`· ${T.page.name}: ${nodes.length} cards (${nodes.filter(n => !n.parentId).length} Main instances), ${edges.length} conexiones, ${projects.length} páginas de proyecto`);
}
await seedPage(T1, P1);
await seedPage(T2, P2);
console.log(`· Células: ${U.cells.map(c => c.name).join(', ')}`);
if (created.length) { console.log('· Cuentas creadas:'); for (const c of created) console.log(`  ${c.role.padEnd(6)} ${c.email}  contraseña: ${c.password}`); } else console.log('· Cuentas demo: ya existían');
db.close();

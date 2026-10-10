// P11: scripts/seed-demo.js siembra cuentas, células y las dos páginas demo (con proyectos y portadas) en una BD con admin; es idempotente y --reset recrea las páginas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildApp } from '../server/index.js';
import { setupAdmin, login } from './helpers/auth.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'destree-seed-'));
const dbPath = path.join(tmp, 's.db');
const seed = (...args) => execFileSync(process.execPath, ['scripts/seed-demo.js', ...args], { cwd: ROOT, env: { ...process.env, DATABASE_PATH: dbPath, UPLOADS_DIR: path.join(tmp, 'uploads') } }).toString();

test('seed-demo: páginas, proyectos, portadas, cuentas y células; idempotente; viewer ve solo lo suyo', async (t) => {
  let app = await buildApp({ dbPath, logger: false });
  t.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
  await setupAdmin(app); await app.close();
  const out = seed('--password=Demo-2026');
  assert.match(out, /Ecosistema Elektra: 44 cards \(11 Main instances\), 40 conexiones, 4 páginas de proyecto/);
  assert.match(out, /Plataforma Tecnológica: 39 cards \(10 Main instances\), 46 conexiones, 2 páginas de proyecto/);
  assert.match(out, /viewer diego.torres@grupo.demo/);
  assert.match(seed('--password=Demo-2026'), /ya existe/); // sin --reset no duplica
  assert.match(seed('--password=Demo-2026', '--reset'), /Cuentas demo: ya existían/);
  app = await buildApp({ dbPath, logger: false });
  const j = async (o, cookie) => { const r = await app.inject({ ...o, headers: { cookie } }); return { status: r.statusCode, body: r.json() }; };
  const admin = await login(app, 'admin@test.io');
  const pages = (await j({ method: 'GET', url: '/api/pages' }, admin)).body.pages;
  assert.deepEqual(pages.map(p => p.name).slice(1), ['Ecosistema Elektra', 'Plataforma Tecnológica']);
  const eco = (await j({ method: 'GET', url: '/api/pages/pg_eco_elektra' }, admin)).body;
  assert.equal(eco.nodes.length, 44); assert.equal(eco.nodes.filter(n => !n.parentId).length, 11); assert.equal(eco.edges.length, 40);
  assert.ok(eco.nodes.filter(n => !n.parentId).every(n => n.gradient && !n.imageId), 'degradado en todas las Main instances'); assert.ok(eco.nodes.filter(n => n.parentId).every(n => n.gradient === ''), 'sin degradado en cards anidadas');
  assert.equal(eco.nodes.find(n => n.id === 'ek_lideres').visibility, 'cells');
  assert.ok(eco.nodes.every(n => n.x >= 0 && n.y >= 0));
  const pl = (await j({ method: 'GET', url: '/api/pages/pg_plataforma' }, admin)).body;
  assert.deepEqual(pl.settings.typeNames, { software: 'Servicio', ds: 'Librería core', uikit: 'SDK' }); assert.equal(pl.page.visibility, 'cells');
  const pj = (await j({ method: 'GET', url: '/api/pages/pg_eco_elektra/nodes/ek_asig/project' }, admin)).body;
  assert.equal(pj.sections.length, 9); assert.equal(pj.phases.length, 5); assert.equal(pj.activities.length, 21); assert.ok(pj.activities.some(a => a.status === 'cancelled'));
  assert.equal((await j({ method: 'GET', url: '/api/users' }, admin)).body.users.length, 8);
  assert.equal((await j({ method: 'GET', url: '/api/cells' }, admin)).body.cells.length, 4);
  // Diego (viewer, célula Cobranza, asignado en ek_asig): ve App Líderes pero no Backoffice ni la Plataforma; edita el proyecto de su card
  const diego = await login(app, 'diego.torres@grupo.demo', 'Demo-2026');
  assert.deepEqual((await j({ method: 'GET', url: '/api/pages' }, diego)).body.pages.map(p => p.id).filter(id => id.startsWith('pg_')), ['pg_eco_elektra']);
  const seen = (await j({ method: 'GET', url: '/api/pages/pg_eco_elektra' }, diego)).body.nodes.filter(n => !n.parentId).map(n => n.id);
  assert.ok(seen.includes('ek_lideres') && !seen.includes('ek_bo'));
  assert.equal((await j({ method: 'GET', url: '/api/pages/pg_eco_elektra/nodes/ek_asig/project' }, diego)).body.canEdit, true);
  assert.equal((await j({ method: 'GET', url: '/api/pages/pg_eco_elektra/nodes/ek_portal/project' }, diego)).body.canEdit, false);
});

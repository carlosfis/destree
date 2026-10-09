// F1: los JSON Schema de /schema validan documentos normalizados; rechazan nodos inválidos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createValidator } from '../server/lib/schemas.js';
import { normalizeDocument, defaultDocument, isLegacyV1 } from '../server/lib/normalize.js';

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/legacy-v2.json'), 'utf8'));
const { validate } = createValidator();
const DOC = 'page-document.schema.json';

test('fixture legacy-v2: válida tras normalizar (v2 → v3), no antes', () => {
  assert.equal(fixture.version, 2);
  assert.ok(!isLegacyV1(fixture));
  assert.equal(validate(DOC, fixture).ok, false, 'un v2 crudo no es un page-document v3');
  const doc = normalizeDocument(fixture, { id: 'p_test', name: 'Test' });
  const r = validate(DOC, doc);
  assert.deepEqual(r.errors, []);
  assert.equal(doc.version, 3);
  assert.equal(doc.nodes.length, fixture.nodes.length);
  assert.equal(doc.branchTypes.length, fixture.edgeTypes.length, 'edgeTypes → branchTypes');
  assert.ok(doc.nodes.every(n => n.parentId ? n.visibility === 'inherit' : ['org', 'cells'].includes(n.visibility)));
  assert.ok(doc.nodes.filter(n => n.type !== 'software').every(n => n.parentId), 'DS/UI Kit siempre dentro de un software');
});

test('documento vacío por defecto valida; defaults de página', () => {
  const doc = defaultDocument({ id: 'p1', name: 'Vacía' });
  assert.deepEqual(validate(DOC, doc).errors, []);
  assert.equal(doc.page.visibility, 'org');
  assert.equal(doc.branchTypes[0].id, 'et_feature');
});

test('nodo inválido falla: type desconocido, name vacío, id ausente, x no numérico, propiedad extra', () => {
  const base = normalizeDocument(fixture, { id: 'p' });
  const mut = (f) => { const d = structuredClone(base); f(d); return validate(DOC, d); };
  const cases = [
    ['type', d => { d.nodes[0].type = 'foo'; }, '/nodes/0/type'],
    ['name', d => { d.nodes[0].name = ''; }, '/nodes/0/name'],
    ['id', d => { delete d.nodes[1].id; }, '/nodes/1'],
    ['x', d => { d.nodes[2].x = 'a'; }, '/nodes/2/x'],
    ['extra', d => { d.nodes[0].foo = 1; }, '/nodes/0'],
    ['image', d => { d.nodes[0].image = 'http://x'; }, '/nodes/0/image'],
    ['docs.url', d => { d.nodes[0].docs = [{ label: 'a', url: 'no es uri' }]; }, '/nodes/0/docs/0/url'],
    ['edge.kind', d => { d.edges[0].kind = 'branch'; }, '/edges/0/kind'],
    ['tag.color', d => { d.tags[0].color = 'cyan'; }, '/tags/0/color'],
    ['version', d => { d.version = 2; }, '/version'],
    ['camera.z', d => { d.camera.z = 99; }, '/camera/z'],
  ];
  for (const [name, f, p] of cases) {
    const r = mut(f);
    assert.equal(r.ok, false, name);
    assert.ok(r.errors.some(e => e.instancePath === p), `${name}: ${JSON.stringify(r.errors.map(e => e.instancePath))}`);
  }
});

test('normalize: migración v1 (aristas branch → anidamiento) e integridad', () => {
  const v1 = {
    version: 1,
    nodes: [
      { id: 'a', type: 'software', name: 'A', x: 0, y: 0 }, { id: 'b', type: 'software', name: 'B', x: 400, y: 300 },
      { id: 'ds', type: 'ds', name: 'DS', x: 500, y: 400 }, { id: 'huérfano', type: 'uikit', name: 'K', x: 1, y: 1 },
    ],
    edges: [
      { id: 'e1', kind: 'branch', from: 'a', to: 'b', typeId: 'et_fork' }, { id: 'e2', kind: 'ds', from: 'b', to: 'ds' },
      { id: 'e3', kind: 'ds', from: 'b', to: 'ds' }, { id: 'e4', kind: 'ds', from: 'a', to: 'zzz' }, { id: 'e5', kind: 'source', from: 'huérfano', to: 'ds' },
    ],
  };
  const d = normalizeDocument(v1);
  assert.deepEqual(validate(DOC, d).errors, []);
  const by = id => d.nodes.find(n => n.id === id);
  assert.equal(by('b').parentId, 'a'); assert.equal(by('b').branchTypeId, 'et_fork');
  assert.deepEqual([by('b').x, by('b').y], [400, 300], 'posición de mundo → local');
  assert.equal(by('ds').parentId, 'b');
  assert.equal(by('huérfano').parentId, 'b', 'UI Kit se aloja donde vive su fuente');
  assert.deepEqual(d.edges.map(e => e.id), ['e2', 'e5'], 'duplicadas y colgantes fuera');
  assert.equal(normalizeDocument(null).nodes.length, 0);
});

test('normalize: geo (ISO alfa-2 en mayúsculas) y thumbIconId del thumbnail (P9)', () => {
  const d = normalizeDocument({ nodes: [{ id: 'a', type: 'software', name: 'A', geo: 'mx', thumbIconId: 'img1' }, { id: 'b', type: 'software', name: 'B', geo: 'México', thumbIconId: '' }, { id: 'c', type: 'software', name: 'C' }] });
  assert.deepEqual(d.nodes.map(n => [n.geo, n.thumbIconId]), [['MX', 'img1'], ['', null], ['', null]]);
  assert.deepEqual(validate(DOC, d).errors, []);
});

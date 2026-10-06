'use strict';
// F0a: paridad del split. Cada archivo de client/ debe ser idéntico a su rango de legacy/arbol.html
// (los .js llevan además `'use strict';` en la primera línea). Mapa sección → archivo → rango.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const legacy = fs.readFileSync(path.join(ROOT, 'legacy/arbol.html'), 'utf8').split('\n');
const range = (a, b) => legacy.slice(a - 1, b).join('\n') + '\n';
const read = (f) => fs.readFileSync(path.join(ROOT, 'client', f), 'utf8');

const CSS = [
  ['css/01-theme.css', 9, 92], ['css/02-base.css', 93, 156], ['css/03-topbar.css', 157, 191],
  ['css/04-canvas.css', 192, 237], ['css/05-nodes.css', 238, 340], ['css/06-floating.css', 341, 375],
  ['css/07-popover.css', 376, 401], ['css/08-admin.css', 402, 439], ['css/09-dialogs.css', 440, 489],
  ['css/10-responsive.css', 490, 501],
];
const JS = [
  ['js/core/utils.js', 590, 623], ['js/core/state.js', 624, 838], ['js/core/history.js', 839, 874],
  ['js/canvas/camera.js', 875, 943], ['js/canvas/render-nodes.js', 944, 1108], ['js/canvas/render-edges.js', 1109, 1192],
  ['js/canvas/selection.js', 1193, 1244], ['js/canvas/minimap.js', 1245, 1304],
  ['js/canvas/pointer-gestures.js', 1305, 1535], ['js/canvas/pointer-drag.js', 1536, 1727],
  ['js/canvas/keyboard.js', 1728, 1785], ['js/ui/popover.js', 1786, 1864], ['js/ui/connections.js', 1865, 1953],
  ['js/ui/dialogs.js', 1954, 1984], ['js/ui/card-editor.js', 1985, 2153], ['js/ui/node-actions.js', 2154, 2217],
  ['js/views/admin.js', 2218, 2404], ['js/canvas/layout.js', 2405, 2464], ['js/ui/theme.js', 2465, 2510],
  ['js/main.js', 2511, 2542],
];

test('CSS: concatenación de css/01..10 == <style> original (líneas 9-501)', () => {
  for (const [f, a, b] of CSS) assert.equal(read(f), range(a, b), f);
  assert.equal(CSS.map(([f]) => read(f)).join(''), range(9, 501));
});

test("JS: cada archivo (sin 'use strict') == su sección; concatenación == <script> original (590-2542)", () => {
  const strip = (s) => s.replace(/^'use strict';\n/, '');
  for (const [f, a, b] of JS) {
    assert.ok(read(f).startsWith("'use strict';\n"), `${f} sin 'use strict'`);
    assert.equal(strip(read(f)), range(a, b), f);
  }
  assert.equal(JS.map(([f]) => strip(read(f))).join(''), range(590, 2542));
  assert.equal(legacy[588], "'use strict';");
});

test('Rangos contiguos y completos', () => {
  for (let i = 1; i < CSS.length; i++) assert.equal(CSS[i][1], CSS[i - 1][2] + 1, CSS[i][0]);
  for (let i = 1; i < JS.length; i++) assert.equal(JS[i][1], JS[i - 1][2] + 1, JS[i][0]);
});

test('index.html: markup == original y scripts clásicos en el orden de las secciones', () => {
  const html = read('index.html');
  assert.ok(html.startsWith(range(1, 7)), 'cabecera');
  assert.ok(html.includes(range(503, 587)), 'body');
  assert.ok(html.endsWith(range(2544, 2545)), 'cierre');
  assert.ok(!html.includes('type="module"'), 'sin ESM en F0a');
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(links, CSS.map(([f]) => f));
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(scripts, JS.map(([f]) => f));
});

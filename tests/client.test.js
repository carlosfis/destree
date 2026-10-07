// F0b: estructura ESM del cliente + paridad CSS con legacy/arbol.html. F1: +api.js, normalize.js (symlink), claves S de persistencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const read = (f) => fs.readFileSync(path.join(CLIENT, f), 'utf8');
const legacy = fs.readFileSync(path.join(ROOT, 'legacy/arbol.html'), 'utf8').split('\n');
const range = (a, b) => legacy.slice(a - 1, b).join('\n') + '\n';

const CSS = [
  ['css/01-theme.css', 9, 92], ['css/02-base.css', 93, 156], ['css/03-topbar.css', 157, 191],
  ['css/04-canvas.css', 192, 237], ['css/05-nodes.css', 238, 340], ['css/06-floating.css', 341, 375],
  ['css/07-popover.css', 376, 401], ['css/08-admin.css', 402, 439], ['css/09-dialogs.css', 440, 489],
  ['css/10-responsive.css', 490, 501],
];
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : e.name.endsWith('.js') && out.push(p);
  }
  return out;
};
const JS = walk(path.join(CLIENT, 'js')).map((p) => path.relative(CLIENT, p)).sort();
const S_KEYS = ['firstRun', 'state', 'cam', 'vpRect', 'camRaf', 'mmScale', 'ptr', 'spaceDown', 'altDown', 'rafPending', 'nudgeTimer', 'popoverOpen', 'adminTab', 'pageId', 'version', 'offline', 'saving', 'dirty', 'session', 'readonly', 'cellList', 'userDir', 'docRefs', 'pageList', 'lobbyTab'];
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const exportsOf = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/^export (?:async )?(?:function|const|let|class)\s+(.*)$/gm)) {
    const head = m[1].replace(/\/\/.*$/, '');
    names.add(head.match(/^[\w$]+/)[0]);
    // const a = 1, b = 2;  (separadores de nivel 0)
    let lvl = 0;
    for (let i = 0; i < head.length; i++) {
      const c = head[i];
      if ('{(['.includes(c)) lvl++; else if ('})]'.includes(c)) lvl--;
      else if (c === ',' && lvl === 0) { const n = head.slice(i + 1).match(/^\s*([\w$]+)\s*=(?![=>])/); if (n) names.add(n[1]); }
    }
  }
  return names;
};

test('CSS: concatenación de css/01..10 == <style> original (líneas 9-501)', () => {
  for (const [f, a, b] of CSS) assert.equal(read(f), range(a, b), f);
  assert.equal(CSS.map(([f]) => read(f)).join(''), range(9, 501));
});

test('index.html: markup original y un único <script type="module" src="js/main.js">', () => {
  const html = read('index.html');
  assert.ok(html.startsWith(range(1, 7)), 'cabecera');
  assert.ok(html.includes(range(503, 587)), 'body');
  const scripts = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(scripts, ['<script type="module" src="js/main.js">']);
  assert.deepEqual([...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]), [...CSS.map(([f]) => f), 'css/11-auth.css', 'css/12-cells.css', 'css/13-lobby.css']); // F2: +auth · F3: +cells · F4a: +lobby
});

test('ESM: sin use strict, sin let/var top-level, sin globales window.* salvo S en main.js', () => {
  assert.equal(JS.length, 32, JS.join(','));
  for (const f of JS) {
    const src = read(f);
    assert.ok(!src.includes("'use strict'"), `${f}: 'use strict' sobra en ESM`);
    assert.ok(!/^(let|var)\s/m.test(src), `${f}: binding top-level reasignable; debe vivir en S`);
    const globals = [...stripComments(src).matchAll(/\bwindow\.(\w+)\s*=/g)].map((m) => m[1]);
    assert.deepEqual(globals, f === 'js/main.js' ? ['S'] : [], `${f}: asignación a window.*`);
  }
});

test('S: core/state.js exporta S con las claves migradas; ningún módulo usa esos símbolos sueltos', () => {
  const state = read('js/core/state.js');
  const def = state.match(/^export const S = \{([\s\S]*?)^\};/m);
  assert.ok(def, 'export const S = {…}');
  const keys = [...def[1].matchAll(/^\s+([\w$]+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, S_KEYS);
  const bare = new RegExp(`(?<![\\w$])(?<!(?<!\\.\\.)\\.)(${S_KEYS.join('|')})(?![\\w$:])`, 'g');
  for (const f of JS) {
    const code = stripComments(read(f)).replace(/^export const S = \{[\s\S]*?^\};/m, '').replace(/^import[\s\S]*?from '[^']+';/gm, '');
    const hits = [...code.matchAll(bare)].map((m) => m[1]);
    assert.deepEqual(hits, [], `${f}: símbolos sin S.`);
  }
});

test('Imports: cada ruta existe y cada nombre importado lo exporta el módulo destino', () => {
  for (const f of JS) {
    const src = read(f);
    for (const m of src.matchAll(/^import\s*(?:\{([\s\S]*?)\}\s*from\s*)?'([^']+)';/gm)) {
      const target = path.normalize(path.join(path.dirname(f), m[2]));
      assert.ok(fs.existsSync(path.join(CLIENT, target)), `${f}: import ${m[2]} no existe`);
      if (!m[1]) continue;
      const exp = exportsOf(read(target));
      for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) assert.ok(exp.has(n), `${f}: '${n}' no lo exporta ${target}`);
    }
  }
});

test('normalize.js del cliente es symlink a server/lib/normalize.js (una sola fuente)', () => {
  const link = path.join(CLIENT, 'js/core/normalize.js');
  assert.ok(fs.lstatSync(link).isSymbolicLink(), 'symlink');
  assert.equal(fs.realpathSync(link), path.join(ROOT, 'server/lib/normalize.js'));
  assert.ok(!/^import\s/m.test(read('js/core/normalize.js')), 'normalize.js no debe importar nada (compartido)');
});

test('main.js alcanza todos los módulos (imports estáticos)', () => {
  const seen = new Set();
  (function visit(f) {
    if (seen.has(f)) return; seen.add(f);
    for (const m of read(f).matchAll(/^import[\s\S]*?'([^']+)';/gm)) visit(path.normalize(path.join(path.dirname(f), m[1])));
  })('js/main.js');
  assert.deepEqual([...seen].sort(), JS);
});

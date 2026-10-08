// Estructura del cliente: index.html (estilos en orden, un único módulo, sin inline), ESM sin globales, claves de S, imports↔exports, symlink normalize.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const read = (f) => fs.readFileSync(path.join(CLIENT, f), 'utf8');

const CSS = ["01-theme", "02-base", "03-topbar", "04-canvas", "05-nodes", "06-floating", "07-popover", "08-admin", "09-dialogs", "10-responsive", "11-auth", "12-cells", "13-lobby", "14-admin", "15-overrides", "16-drawer"].map((n) => `css/${n}.css`);
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : e.name.endsWith('.js') && out.push(p);
  }
  return out;
};
const JS = walk(path.join(CLIENT, 'js')).map((p) => path.relative(CLIENT, p)).sort();
const S_KEYS = ['firstRun', 'state', 'cam', 'vpRect', 'camRaf', 'mmScale', 'ptr', 'spaceDown', 'altDown', 'rafPending', 'nudgeTimer', 'popoverOpen', 'adminTab', 'pageId', 'version', 'offline', 'saving', 'dirty', 'session', 'readonly', 'cellList', 'userDir', 'docRefs', 'pageList', 'lobbyTab', 'orgTab'];
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

test('index.html: estilos css/01..16 en orden, un único <script type="module" src="js/main.js">, sin manejadores inline', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(scripts, ['<script type="module" src="js/main.js">']);
  assert.ok(!/\son[a-z]+="/i.test(html), 'sin manejadores inline (compatible con CSP)');
  assert.deepEqual([...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]), CSS);
  for (const f of CSS) assert.ok(fs.existsSync(path.join(CLIENT, f)), f);
});

test('ESM: sin use strict, sin let/var top-level, sin globales window.* salvo S en main.js', () => {
  assert.equal(JS.length, 37, JS.join(','));
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

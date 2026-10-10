/* =========================================================
   P15. i18n mínima: la clave es el texto en español (idioma de referencia); `t()` devuelve la traducción
   del idioma activo o la propia clave. `{var}` se interpola. El idioma vive en <html lang> (única fuente).
   ========================================================= */
import { EN_UI } from '../i18n/en-ui.js';
import { EN_VIEWS } from '../i18n/en-views.js';
import { EN_PROJECT } from '../i18n/en-project.js';
import { EN_EDITOR } from '../i18n/en-editor.js';
const LANG_KEY = 'destree:lang';
const DICT = { en: { ...EN_UI, ...EN_VIEWS, ...EN_PROJECT, ...EN_EDITOR } };
export const LANGS = ['es', 'en'];
export const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'es');
/** Traduce `key` al idioma activo; sin entrada devuelve la clave. `vars` sustituye `{nombre}` (también en español). */
export function t(key, vars) {
  const d = DICT[lang()]; let s = d && Object.hasOwn(d, key) ? d[key] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  return s;
}
/** Idioma guardado por navegador o, si no hay, el del navegador (en → inglés; resto → español). Fija <html lang>. */
export function initLang() {
  const saved = (() => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } })();
  const l = LANGS.includes(saved) ? saved : (/^en\b/i.test(navigator.language || '') ? 'en' : 'es');
  document.documentElement.lang = l; return l;
}
export function setLang(l) { if (!LANGS.includes(l)) return; try { localStorage.setItem(LANG_KEY, l); } catch { /* sin almacenamiento */ } document.documentElement.lang = l; }
/** Cambia al otro idioma y recarga: todo se vuelve a pintar en el idioma nuevo. */
export function toggleLang() { setLang(lang() === 'en' ? 'es' : 'en'); location.reload(); }
/** Traduce el marcado estático de index.html (texto, title, placeholder, aria-label). En español no hace nada. */
export function translateStatic(root = document.body) {
  if (lang() === 'es') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { const s = n.nodeValue.trim(); if (!s) continue; const tr = t(s); if (tr !== s) n.nodeValue = n.nodeValue.replace(s, tr); }
  for (const el of root.querySelectorAll('[title], [placeholder], [aria-label]')) for (const a of ['title', 'placeholder', 'aria-label']) { const v = el.getAttribute(a); if (!v) continue; const tr = t(v); if (tr !== v) el.setAttribute(a, tr); }
}

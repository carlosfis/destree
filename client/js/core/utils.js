/* =========================================================
   1. Utilidades y constantes
   ========================================================= */
import * as N from './normalize.js'; // constantes compartidas con el servidor
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

export const STORAGE_KEY = 'systree:v2';  // copia local cuando no hay servidor
export const LEGACY_KEY = 'systree:v1';
export const PREFS_KEY = 'destree:prefs';   // { theme, tool } por navegador
export const CARD_W = 220;          // ancho fijo de card hoja (DS / UI Kit)
export const CTR_MIN_W = 300;       // ancho mínimo de contenedor
export const CTR_MIN_BODY = 96;     // alto mínimo del cuerpo de un contenedor
export const PAD = N.PAD;              // margen interno de los contenedores (normalize.js)
export const HEAD_GAP = 12;         // espacio entre cabecera y primer hijo
export const GAP = 24;              // separación en auto-layout
export const GRID = 8;              // cuadrícula de ajuste
export const SNAP_DIST = 6;         // magnetismo de guías (px pantalla)
export const DRAG_THRESHOLD = 4;    // px antes de iniciar arrastre
export const MIN_Z = N.MIN_Z, MAX_Z = N.MAX_Z;
export const HISTORY_MAX = 60;

export const TYPE_META = {
  software: { label: N.DEFAULT_TYPE_NAMES.software, desc: 'Contenedor: puede anidar otros elementos', color: 'var(--c-software)' },
  ds:       { label: N.DEFAULT_TYPE_NAMES.ds, desc: 'Vive dentro de un contenedor', color: 'var(--c-ds)' },
  uikit:    { label: N.DEFAULT_TYPE_NAMES.uikit, desc: 'Deriva de una fuente; vive dentro de un contenedor', color: 'var(--c-uikit)' },
}; // label = nombre por defecto; el visible por página sale de typeName() (settings.typeNames)
export const TAG_COLORS = N.TAG_COLORS;


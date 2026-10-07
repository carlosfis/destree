/* =========================================================
   1. Utilidades y constantes
   ========================================================= */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

export const STORAGE_KEY = 'systree:v2';
export const LEGACY_KEY = 'systree:v1';
export const CARD_W = 220;          // ancho fijo de card hoja (DS / UI Kit)
export const CTR_MIN_W = 300;       // ancho mínimo de contenedor
export const CTR_MIN_BODY = 96;     // alto mínimo del cuerpo de un contenedor
export const PAD = 16;              // margen interno de los contenedores
export const HEAD_GAP = 12;         // espacio entre cabecera y primer hijo
export const GAP = 24;              // separación en auto-layout
export const GRID = 8;              // cuadrícula de ajuste
export const SNAP_DIST = 6;         // magnetismo de guías (px pantalla)
export const DRAG_THRESHOLD = 4;    // px antes de iniciar arrastre
export const MIN_Z = 0.1, MAX_Z = 4;
export const HISTORY_MAX = 60;

export const TYPE_META = {
  software: { label: 'Software', desc: 'Contenedor: app, módulo o feature', color: 'var(--c-software)' },
  ds:       { label: 'Design System', desc: 'Vive dentro de un software', color: 'var(--c-ds)' },
  uikit:    { label: 'UI Kit', desc: 'Derivado de una fuente; vive dentro de un software', color: 'var(--c-uikit)' },
};
export const TAG_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
export const KIND_LABEL = { ds: 'Dependencia de sistema de diseño', source: 'Fuente de UI Kit' };


'use strict';
/* =========================================================
   1. Utilidades y constantes
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const STORAGE_KEY = 'systree:v2';
const LEGACY_KEY = 'systree:v1';
const CARD_W = 220;          // ancho fijo de card hoja (DS / UI Kit)
const CTR_MIN_W = 300;       // ancho mínimo de contenedor
const CTR_MIN_BODY = 96;     // alto mínimo del cuerpo de un contenedor
const PAD = 16;              // margen interno de los contenedores
const HEAD_GAP = 12;         // espacio entre cabecera y primer hijo
const GAP = 24;              // separación en auto-layout
const GRID = 8;              // cuadrícula de ajuste
const SNAP_DIST = 6;         // magnetismo de guías (px pantalla)
const DRAG_THRESHOLD = 4;    // px antes de iniciar arrastre
const MIN_Z = 0.1, MAX_Z = 4;
const HISTORY_MAX = 60;

const TYPE_META = {
  software: { label: 'Software', desc: 'Contenedor: app, módulo o feature', color: 'var(--c-software)' },
  ds:       { label: 'Design System', desc: 'Vive dentro de un software', color: 'var(--c-ds)' },
  uikit:    { label: 'UI Kit', desc: 'Derivado de una fuente; vive dentro de un software', color: 'var(--c-uikit)' },
};
const TAG_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
const KIND_LABEL = { ds: 'Dependencia de sistema de diseño', source: 'Fuente de UI Kit' };


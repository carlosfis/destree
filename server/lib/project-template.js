// Página de proyecto: tipos de sección del Overview (forma de `data`), saneado y plantilla inicial. Sin dependencias (lo reutiliza el cliente por symlink).
export const SECTION_KINDS = ['links', 'text', 'timeline', 'cards', 'quote', 'goals', 'checklist', 'people'];
export const KIND_LABEL = { links: 'Enlaces (ficha)', text: 'Texto + métricas', timeline: 'Línea de tiempo', cards: 'Tarjetas', quote: 'Cita destacada', goals: 'Objetivos con valor', checklist: 'Lista de entregables', people: 'Personas' };
export const STATUSES = ['todo', 'doing', 'done', 'cancelled'];
export const STATUS_META = { todo: { label: 'To Do', desc: 'Actividad pendiente o por hacer' }, doing: { label: 'Doing', desc: 'Actividad realizándose actualmente' }, done: { label: 'Done', desc: 'Actividad realizada o finalizada' }, cancelled: { label: 'Cancelled', desc: 'Actividad descartada o rechazada (No se borran)' } };
export const PHASE_COLORS = ['#f0a331', '#0f8fa6', '#12a9c9', '#8b6cf0', '#f2516e', '#3fbf6a', '#e95fd1', '#6b7bf7'];
export const MAX_ITEMS = 50;
/** Forma de `data` por tipo: número = longitud máxima de texto; 'bool'; objeto = lista de ítems con esas claves. */
export const SPEC = {
  links: { items: { emoji: 4, label: 80, url: 2048 } },
  text: { text: 4000, metrics: { value: 24, label: 60 } },
  timeline: { items: { label: 24, text: 500 } },
  cards: { items: { code: 12, title: 80, text: 300 } },
  quote: { quote: 500, highlight: 120, items: { title: 80, text: 300 } },
  goals: { items: { text: 160, value: 40 } },
  checklist: { items: { text: 160, done: 'bool', status: 40 } },
  people: { items: { name: 80, role: 80 } },
};
const str = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').slice(0, max);
const isHttp = u => /^https?:\/\/[^\s<>"']+$/i.test(u);
/** Devuelve un `data` limpio con exactamente las claves del tipo (claves ajenas fuera, textos recortados, ≤ MAX_ITEMS). */
export function sanitizeSectionData(kind, data) {
  const spec = SPEC[kind]; if (!spec) return {};
  const src = data && typeof data === 'object' ? data : {};
  const out = {};
  for (const [key, rule] of Object.entries(spec)) {
    if (typeof rule === 'number') out[key] = str(src[key], rule);
    else if (rule === 'bool') out[key] = !!src[key];
    else {
      const items = Array.isArray(src[key]) ? src[key] : [];
      out[key] = items.slice(0, MAX_ITEMS).map(it => { const o = {}; const s = it && typeof it === 'object' ? it : {}; for (const [k, r] of Object.entries(rule)) o[k] = r === 'bool' ? !!s[k] : str(s[k], r).trim(); return o; })
        .filter(it => Object.values(it).some(v => v === true || (typeof v === 'string' && v)))
        .filter(it => kind !== 'links' || isHttp(it.url));
    }
  }
  return out;
}
export const emptySectionData = kind => sanitizeSectionData(kind, {});
export function sanitizeSettings(s) {
  const src = s && typeof s === 'object' ? s : {};
  const weeks = Math.round(Number(src.sprintWeeks)); const offset = Math.round(Number(src.sprintOffset));
  return { tagline: str(src.tagline, 300), sprintWeeks: weeks >= 1 && weeks <= 8 ? weeks : 2, sprintOffset: Number.isFinite(offset) && Math.abs(offset) <= 999 ? offset : 0 };
}
/** Normaliza `@usuario` (sin espacios internos; vacío si no hay nada). */
export const normalizeAssignee = s => { s = String(s || '').trim().replace(/\s+/g, ' '); return s ? (s.startsWith('@') ? s : '@' + s) : ''; };
/** Plantilla inicial del Overview (las 9 secciones de la ficha): se rellena con lo que ya tiene la card. */
export function defaultSections(node = {}) {
  const docs = (node.docs || []).map(d => ({ emoji: '', label: d.label || d.url, url: d.url }));
  const staff = (node.staff || []).map(m => ({ name: m.name, role: m.role || '' }));
  return [
    { kind: 'links', title: 'Ficha de proyecto', data: { items: docs } },
    { kind: 'text', title: 'Resumen del proyecto', data: { text: node.description || '', metrics: [] } },
    { kind: 'timeline', title: 'Antecedentes', data: { items: [] } },
    { kind: 'cards', title: 'Usuarios identificados', data: { items: [] } },
    { kind: 'quote', title: 'Problemática', data: { quote: '', highlight: '', items: [] } },
    { kind: 'goals', title: 'Objetivos de negocio', data: { items: [] } },
    { kind: 'checklist', title: 'Entregables', data: { items: [] } },
    { kind: 'people', title: 'Scrum team', data: { items: [] } },
    { kind: 'people', title: 'Staff de diseño', data: { items: staff } },
  ].map(s => ({ ...s, data: sanitizeSectionData(s.kind, s.data) }));
}
/** Semana ISO 8601 de una fecha YYYY-MM-DD → { year, week, monday (Date UTC) }. Compartido con el cliente para pintar las columnas. */
export function isoWeek(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  const monday = new Date(date); monday.setUTCDate(date.getUTCDate() - day + 1);
  const thu = new Date(date); thu.setUTCDate(date.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  return { year: thu.getUTCFullYear(), week: Math.ceil(((thu - jan1) / 864e5 + 1) / 7), monday };
}
export const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
/** Número de sprint de una semana ISO: bloques de `sprintWeeks` semanas desde la semana 1, desplazados `sprintOffset`. */
export const sprintOf = (week, { sprintWeeks = 2, sprintOffset = 0 } = {}) => Math.floor((week - 1) / Math.max(1, sprintWeeks)) + 1 + sprintOffset;

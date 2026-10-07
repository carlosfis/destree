/* =========================================================
   F3. Markdown mínimo y seguro: escape total, luego títulos, listas, enlaces, código, negrita.
   Nunca se interpreta HTML del usuario; solo http(s) en enlaces.
   ========================================================= */
import { esc } from '../core/utils.js';

const SAFE_URL = /^https?:\/\/[^\s<>"']+$/i;
const inline = s => esc(s)
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, t, u) => (SAFE_URL.test(u) ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>` : m));

/** Devuelve HTML seguro. Soporta: # ## ### títulos, - * listas, 1. listas numeradas, ```código```, `inline`, **negrita**, [texto](https://…). */
export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = []; let list = null, para = [], code = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    if (code !== null) { if (/^```/.test(raw)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; } else code.push(raw); continue; }
    const line = raw.trimEnd();
    if (/^```/.test(line)) { flushPara(); flushList(); code = []; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushPara(); flushList(); out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); continue; }
    const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (li) { flushPara(); const kind = /^\s*\d/.test(line) ? 'ol' : 'ul'; if (list !== kind) { flushList(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList(); para.push(line);
  }
  if (code !== null) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flushPara(); flushList();
  return out.join('');
}

// Portadas SVG (1600×900) para las cards demo: fondo de marca, cinta y nombre. sharp las convierte a WebP al guardarlas (lib/images.js).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
/** `{ title, label, bg, accent, fg }` → Buffer SVG. */
export function coverSVG({ title, label = '', bg = '#0f2a24', accent = '#c8ff00', fg = '#ffffff', emoji = '' }) {
  const size = title.length > 18 ? 84 : title.length > 12 ? 104 : 124;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg}" stop-opacity=".78"/></linearGradient></defs>
  <rect width="1600" height="900" fill="${bg}"/><rect width="1600" height="900" fill="url(#g)"/>
  <path d="M-80,620 C280,640 420,180 760,250 C1040,310 1140,620 1700,520" fill="none" stroke="${accent}" stroke-width="150" stroke-linecap="round" opacity=".92"/>
  <path d="M900,980 C1120,860 1300,920 1700,820" fill="none" stroke="${accent}" stroke-width="80" stroke-linecap="round" opacity=".55"/>
  <circle cx="1330" cy="250" r="150" fill="${accent}" opacity=".16"/>
  ${emoji ? `<text x="1330" y="300" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="150" text-anchor="middle">${esc(emoji)}</text>` : ''}
  <rect x="80" y="520" width="${Math.min(1440, 260 + title.length * size * .58)}" height="300" rx="40" fill="#071411" opacity=".82"/>
  ${label ? `<rect x="128" y="566" width="${label.length * 15 + 44}" height="44" rx="22" fill="${accent}"/><text x="${150 + (label.length * 15) / 2}" y="596" font-family="${FONT}" font-size="24" font-weight="700" fill="${bg}" text-anchor="middle">${esc(label)}</text>` : ''}
  <text x="128" y="${label ? 720 : 700}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${fg}">${esc(title)}</text>
</svg>`);
}

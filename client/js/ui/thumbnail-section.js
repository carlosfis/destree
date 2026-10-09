/* =========================================================
   P9. Sección «Thumbnail» de la pestaña General del editor: geografía (ISO alfa-2), icono propio (imagen subida;
   por defecto la imagen de la instancia), vista previa en vivo y botones Copiar / Descargar PNG.
   ========================================================= */
import { $, esc, debounce } from '../core/utils.js';
import { uploadImage, bindDropZone, imageSrc, canUpload } from './uploader.js';
import { toast } from './theme.js';
import { renderThumbnail, copyThumbnail, downloadThumbnail, flagEmoji, iconSrcOf } from './thumbnail.js';

/** Países disponibles (ISO 3166-1 alfa-2 → nombre). Se ordenan por nombre al pintar el select. */
export const GEO = Object.entries({
  AR: 'Argentina', BO: 'Bolivia', BR: 'Brasil', CL: 'Chile', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', DO: 'República Dominicana', EC: 'Ecuador', SV: 'El Salvador',
  GT: 'Guatemala', HN: 'Honduras', MX: 'México', NI: 'Nicaragua', PA: 'Panamá', PY: 'Paraguay', PE: 'Perú', PR: 'Puerto Rico', UY: 'Uruguay', VE: 'Venezuela',
  US: 'Estados Unidos', CA: 'Canadá', ES: 'España', PT: 'Portugal', FR: 'Francia', DE: 'Alemania', IT: 'Italia', GB: 'Reino Unido', IE: 'Irlanda', NL: 'Países Bajos',
  BE: 'Bélgica', CH: 'Suiza', AT: 'Austria', SE: 'Suecia', NO: 'Noruega', DK: 'Dinamarca', FI: 'Finlandia', PL: 'Polonia', CZ: 'Chequia', GR: 'Grecia',
  RO: 'Rumanía', HU: 'Hungría', UA: 'Ucrania', TR: 'Turquía', IL: 'Israel', AE: 'Emiratos Árabes Unidos', SA: 'Arabia Saudita', EG: 'Egipto', MA: 'Marruecos', ZA: 'Sudáfrica',
  NG: 'Nigeria', KE: 'Kenia', IN: 'India', CN: 'China', JP: 'Japón', KR: 'Corea del Sur', SG: 'Singapur', PH: 'Filipinas', ID: 'Indonesia', VN: 'Vietnam',
  TH: 'Tailandia', MY: 'Malasia', AU: 'Australia', NZ: 'Nueva Zelanda',
}).sort((a, b) => a[1].localeCompare(b[1]));

const copyAndToast = d => copyThumbnail(d).then(() => toast('Thumbnail copiado: pégalo en Figma (⌘/Ctrl+V)'), err => toast(err.message || 'No se pudo copiar', 'error', 5000));
const downloadAndToast = d => downloadThumbnail(d).catch(err => toast(err.message || 'No se pudo generar el PNG', 'error', 5000));
export const thumbActionsHTML = (prefix, primary = true) => `<div class="thumb-actions"><button type="button" class="btn ${primary ? 'primary' : ''}" id="${prefix}Copy">Copiar thumbnail</button><button type="button" class="btn ghost" id="${prefix}Download">Descargar PNG</button></div>`;
/** Conecta Copiar/Descargar a `data()` (datos en el momento del clic). */
export function bindThumbActions(root, prefix, data) {
  $(`#${prefix}Copy`, root).addEventListener('click', () => copyAndToast(data()));
  $(`#${prefix}Download`, root).addEventListener('click', () => downloadAndToast(data()));
}

/** `bind(form, base)`: `base()` devuelve { name, type, path, tags, staff } del formulario; la sección añade geo e icono. `read(form)` → { geo, thumbIconId }. */
export function thumbnailSection(draft) {
  const html = `<h3 class="section">Thumbnail</h3>
    <div class="field-row">
      <div class="field"><label>Geografía</label><select name="geo"><option value="">— Sin geografía —</option>${GEO.map(([c, n]) => `<option value="${c}" ${c === draft.geo ? 'selected' : ''}>${flagEmoji(c)} ${esc(n)}</option>`).join('')}</select></div>
      <div class="field"><label>Icono</label>
        <div class="img-field"><div class="img-preview thumb-icon-preview" id="fThumbIcon"></div>
          <div class="img-actions"><label class="btn">Cambiar icono<input type="file" accept="image/*" hidden id="fThumbIconInput"></label><button type="button" class="btn ghost" id="fThumbIconRemove">Usar imagen de la instancia</button></div></div></div>
    </div>
    <div class="hint">${canUpload() ? 'Mejor un PNG con fondo transparente (dispositivo, logotipo…). Si no eliges icono se usa la imagen de la instancia.' : 'Sin servidor no se puede subir un icono propio: se usa la imagen de la instancia.'}</div>
    <div class="field"><label>Vista previa <span class="counter">1920×1080</span></label>
      <div class="thumb-preview"><canvas id="fThumbCanvas" width="1920" height="1080"></canvas></div>
      ${thumbActionsHTML('fThumb')}
      <div class="hint">Se genera con los datos actuales del formulario (nombre, contenedor, etiquetas, staff, geografía e icono). En Figma: pega la imagen en un frame y usa «Set as thumbnail».</div></div>`;
  let unbindDrop = null, onImage = null;
  const bind = (form, base) => {
    const canvas = $('#fThumbCanvas', form);
    const data = () => ({ ...base(), geo: form.geo.value, iconSrc: iconSrcOf(draft), year: new Date().getFullYear() });
    let seq = 0;
    const refresh = debounce(() => { const n = ++seq; renderThumbnail(data(), canvas).catch(() => {}).then(() => { if (n !== seq) refresh(); }); }, 250);
    const refreshIcon = () => {
      const own = draft.thumbIconId ? imageSrc({ imageId: draft.thumbIconId }) : null, src = own || imageSrc(draft);
      $('#fThumbIcon', form).innerHTML = src ? `<img src="${src}" alt="">` : 'Sin icono';
      $('#fThumbIconRemove', form).hidden = !own; refresh();
    };
    const setIconFile = async f => {
      if (!canUpload()) return toast('Sin servidor no se puede subir un icono propio.', 'error', 4000);
      $('#fThumbIcon', form).textContent = 'Subiendo…';
      try { draft.thumbIconId = (await uploadImage(f)).id; } catch (err) { toast(err.message, 'error', 5000); }
      refreshIcon();
    };
    $('#fThumbIconInput', form).addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) await setIconFile(f); });
    $('#fThumbIconRemove', form).addEventListener('click', () => { draft.thumbIconId = null; refreshIcon(); });
    unbindDrop = bindDropZone($('#fThumbIcon', form), setIconFile);
    bindThumbActions(form, 'fThumb', data);
    for (const ev of ['input', 'change', 'click']) form.addEventListener(ev, refresh); // cualquier cambio del borrador repinta la vista previa
    onImage = refreshIcon; document.addEventListener('destree:image', onImage); // la imagen de la instancia cambió en el editor
    refreshIcon();
  };
  const unbind = () => { if (unbindDrop) unbindDrop(); unbindDrop = null; if (onImage) document.removeEventListener('destree:image', onImage); onImage = null; };
  const read = form => ({ geo: form.geo.value || '', thumbIconId: draft.thumbIconId || null });
  return { html, bind, unbind, read };
}

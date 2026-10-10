/* =========================================================
   F5. Subida de imágenes: POST /api/images (cuerpo binario), drag&drop / pegar, src de miniaturas
   ========================================================= */
import { S } from '../core/state.js';
import { t } from '../core/i18n.js'; // P15
import * as api from '../core/api.js';

export const MAX_UPLOAD = 5 * 1024 * 1024;
/** src para <img>: archivo subido (thumb o completo) o dataURL legado/offline. */
export const imageSrc = (n, variant = 'thumb') => (n && n.imageId ? `/uploads/${encodeURIComponent(n.imageId)}${variant === 'thumb' ? '/thumb' : ''}` : (n && n.image) || null);

/** Sube un File. Devuelve { id, thumbUrl, url, width, height, bytes }. Lanza con mensaje legible. */
export async function uploadImage(file, kind = 'node') {
  if (!file.type.startsWith('image/')) throw new Error(t('El archivo no es una imagen'));
  if (file.size > MAX_UPLOAD) throw new Error(t('Imagen demasiado grande (máx. 5 MB)'));
  return api.uploadImage(file, { kind, filename: file.name });
}
/** Zona de arrastre + pegado desde el portapapeles. `onFile(file)`. Devuelve función para quitar listeners. */
export function bindDropZone(el, onFile) {
  const over = e => { e.preventDefault(); el.classList.add('drop-over'); };
  const leave = () => el.classList.remove('drop-over');
  const drop = e => { e.preventDefault(); leave(); const f = e.dataTransfer?.files?.[0]; if (f) onFile(f); };
  const paste = e => { const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); if (item) { e.preventDefault(); onFile(item.getAsFile()); } };
  el.addEventListener('dragover', over); el.addEventListener('dragleave', leave); el.addEventListener('drop', drop);
  document.addEventListener('paste', paste);
  return () => { el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop); document.removeEventListener('paste', paste); };
}
/** ¿Se sube al servidor (online) o se guarda dataURL local (offline)? */
export const canUpload = () => !S.offline && !!S.pageId;

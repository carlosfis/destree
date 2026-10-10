// P15: mensajes del servidor en inglés. Clave = texto español (referencia); se aplica en el error handler y en los correos según `req.lang` (cabecera X-Lang del cliente).
export const EN = {
  'Error interno': 'Internal error', 'Ruta no encontrada': 'Route not found', 'No encontrado': 'Not found', 'Inicia sesión': 'Sign in', 'Sin pertenencia a la organización': 'Not a member of the organization', 'Sin permisos para esta acción': 'No permission for this action',
  'Origen no permitido': 'Origin not allowed', 'Demasiados intentos; espera unos minutos': 'Too many attempts; wait a few minutes', 'Correo o contraseña incorrectos': 'Wrong email or password', 'Cuenta desactivada': 'Account deactivated', 'La instalación ya está configurada': 'The installation is already set up',
  'Ese correo ya tiene cuenta': 'That email already has an account', 'Ya existe un usuario con ese correo': 'A user with that email already exists', 'Usuario no encontrado': 'User not found', 'Indica la contraseña actual y la nueva': 'Provide the current and the new password',
  'La contraseña actual no es correcta': 'The current password is incorrect', 'La contraseña no es correcta': 'The password is incorrect', 'No puedes cambiar tu propio rol': 'You cannot change your own role', 'No puedes dar un rol por encima del tuyo': 'You cannot grant a role above your own',
  'No puedes desactivar tu propia cuenta': 'You cannot deactivate your own account', 'No puedes gestionar una cuenta de nivel superior al tuyo': 'You cannot manage an account above your level', 'No se puede degradar ni desactivar al último admin': 'The last admin cannot be downgraded or deactivated',
  'No se puede desactivar al último admin': 'The last admin cannot be deactivated', 'Solo puedes invitar roles por debajo del tuyo': 'You can only invite roles below your own', 'Solo puedes invitar a tus células': 'You can only invite to your own cells', 'Invitación no encontrada': 'Invitation not found',
  'Esta invitación ha caducado': 'This invitation has expired', 'Esta invitación ya se usó': 'This invitation was already used', 'Enlace de restablecimiento no válido': 'Invalid reset link', 'Este enlace ha caducado; pide uno nuevo': 'This link has expired; request a new one', 'Este enlace ya se usó': 'This link was already used',
  'Correo no configurado: define SMTP_URL y MAIL_FROM': 'Mail not configured: set SMTP_URL and MAIL_FROM', 'Organización no encontrada': 'Organization not found', 'Escribe el nombre exacto de la organización para confirmar': 'Type the exact organization name to confirm',
  'Célula desconocida': 'Unknown cell', 'Célula no encontrada': 'Cell not found', 'Solo puedes gestionar miembros de tus células': 'You can only manage members of your own cells', 'Usuario responsable desconocido': 'Unknown owner user',
  'Página no encontrada': 'Page not found', 'La página está borrada': 'The page is deleted', 'La página no está activa': 'The page is not active', 'Restaura la página antes de archivarla': 'Restore the page before archiving it', 'No se puede borrar la única página activa': 'The only active page cannot be deleted',
  'Sin acceso a esta página': 'No access to this page', 'Sin permisos para listar páginas borradas': 'No permission to list deleted pages', 'Sin permisos para renombrar la página': 'No permission to rename the page', 'Estado desconocido': 'Unknown status',
  'Falta la cabecera If-Match con la versión de la página': 'Missing If-Match header with the page version', 'If-Match inválido: se espera la versión numérica': 'Invalid If-Match: a numeric version is expected', 'El JSON no tiene el formato esperado (nodes/edges).': 'The JSON does not have the expected format (nodes/edges).',
  'Nodo no encontrado': 'Node not found', 'Card no encontrada': 'Card not found', 'Solo una raíz tiene visibilidad propia (los hijos heredan)': 'Only a root has its own visibility (children inherit)', 'Solo puedes editar las cards asignadas a ti': 'You can only edit cards assigned to you',
  'Solo puedes editar el proyecto de las cards asignadas a ti': 'You can only edit the project of cards assigned to you', 'El nombre es obligatorio': 'Name is required', 'El título es obligatorio': 'Title is required', 'El nombre de la fase es obligatorio': 'Phase name is required',
  'Fase desconocida': 'Unknown phase', 'Tipo de sección desconocido': 'Unknown section kind', 'Fecha inválida (YYYY-MM-DD)': 'Invalid date (YYYY-MM-DD)', 'La fecha de fin es anterior a la de inicio': 'End date is before start date', 'Máximo 30 fases': 'Maximum 30 phases', 'Máximo 40 secciones': 'Maximum 40 sections', 'Máximo 500 actividades': 'Maximum 500 activities',
  'Versión no encontrada': 'Version not found', 'Motivo de versión desconocido': 'Unknown version reason', 'Respaldo no encontrado': 'Backup not found', 'Archivo de respaldo no disponible': 'Backup file not available', 'El export no deja ninguna página activa': 'The export leaves no active page',
  'Imagen no encontrada': 'Image not found', 'Sin acceso a esta imagen': 'No access to this image', 'Archivo no encontrado': 'File not found', 'Archivo vacío': 'Empty file', 'Imagen demasiado grande (máx. 5 MB)': 'Image too large (max. 5 MB)', 'Formato no admitido: solo PNG, JPEG, WebP o SVG': 'Unsupported format: only PNG, JPEG, WebP or SVG',
  'Envía la imagen como cuerpo binario con su Content-Type (image/png, image/jpeg, image/webp o image/svg+xml)': 'Send the image as a binary body with its Content-Type (image/png, image/jpeg, image/webp or image/svg+xml)', 'dataURL inválida': 'Invalid dataURL',
};
const PATTERNS = [
  [/^La imagen está en uso \((\d+) card\(s\), (\d+) página\(s\)\)$/, 'The image is in use ($1 card(s), $2 page(s))'], [/^La página ya está en estado (\w+)$/, 'The page is already $1'],
  [/^Versión obsoleta: el servidor tiene (\d+)$/, 'Stale version: the server has $1'], [/^La imagen no se pudo procesar: ([\s\S]*)$/, 'The image could not be processed: $1'], [/^No se pudo enviar: ([\s\S]*)$/, 'Could not send: $1'],
];
export const langOf = req => (/^en/i.test(String(req.headers['x-lang'] || '')) ? 'en' : 'es');
/** Traduce un mensaje de error al idioma pedido; sin entrada devuelve el original. */
export function tr(lang, msg) {
  if (lang !== 'en' || typeof msg !== 'string') return msg;
  if (Object.hasOwn(EN, msg)) return EN[msg];
  for (const [re, rep] of PATTERNS) if (re.test(msg)) return msg.replace(re, rep);
  return msg;
}

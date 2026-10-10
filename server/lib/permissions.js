// P10: roles por nivel (5 = admin … 1 = viewer) y matriz única de permisos. Sin imports: se comparte con el cliente vía symlink client/js/core/permissions.js.
// Los códigos de rol son fijos (código, BD, API); la etiqueta visible se cambia por organización (orgs.settings_json.roleLabels), salvo Admin.
export const ROLES = ['admin', 'ops', 'head', 'lead', 'viewer']; // de mayor a menor nivel
export const ROLE_LEVEL = { admin: 5, ops: 4, head: 3, lead: 2, viewer: 1 };
export const ROLE_DEFAULT_LABEL = { admin: 'Admin', ops: 'Ops', head: 'Head', lead: 'Lead', viewer: 'Viewer' };
export const FIXED_LABEL_ROLES = ['admin'];
export const LEGACY_ROLES = { designer: 'viewer' }; // roles anteriores a la migración 012 (exports antiguos)
export const LABEL_MAX = 24;
export const levelOf = role => ROLE_LEVEL[role] || 0;

// Acción → [nivel mínimo, grupo, descripción visible]. Todo rol de nivel ≥ mínimo tiene la acción (jerarquía estricta).
const DEFS = {
  'org.settings':    [5, 'Organización', 'Modificar la organización: nombre y etiquetas de los roles'],
  'org.delete':      [5, 'Organización', 'Eliminar la organización (vuelve al asistente inicial)'],
  'org.import':      [5, 'Organización', 'Importar una organización completa (JSON)'],
  'backups':         [4, 'Organización', 'Respaldos y exportación de la organización'],
  'audit.read':      [4, 'Organización', 'Audit log'],
  'users.read':      [4, 'Plantilla', 'Ver la plantilla: correos, roles, células y asignaciones'],
  'users.manage':    [4, 'Plantilla', 'Cambiar roles, desactivar cuentas y restablecer contraseñas (hasta su propio nivel)'],
  'invite':          [2, 'Plantilla', 'Invitar personas (solo roles por debajo del propio; Lead: solo a sus células)'],
  'cells.manage':    [3, 'Plantilla', 'Crear, editar y eliminar células'],
  'cells.members':   [2, 'Plantilla', 'Gestionar miembros de células (Lead: solo de las suyas)'],
  'cells.read':      [2, 'Plantilla', 'Ver las células'],
  'directory.read':  [2, 'Plantilla', 'Directorio de usuarios para asignar'],
  'pages.all':       [3, 'Páginas', 'Ver todas las páginas y raíces (por debajo: solo las asignadas o de sus células)'],
  'pages.read':      [1, 'Páginas', 'Ver páginas'],
  'pages.create':    [4, 'Páginas', 'Crear y duplicar páginas'],
  'pages.meta':      [4, 'Páginas', 'Renombrar páginas y cambiar su descripción'],
  'pages.visibility':[3, 'Páginas', 'Visibilidad de páginas y raíces (organización o células)'],
  'pages.archive':   [4, 'Páginas', 'Archivar y desarchivar páginas'],
  'pages.delete':    [4, 'Páginas', 'Borrar páginas y recuperarlas'],
  'pages.import':    [4, 'Páginas', 'Importar un JSON en una página'],
  'pages.export':    [1, 'Páginas', 'Exportar JSON (solo lo visible)'],
  'pages.edit':      [2, 'Contenido', 'Editar el interior de las páginas visibles: cards, conexiones, etiquetas, tipos'],
  'nodes.assign':    [2, 'Contenido', 'Asignar responsable y asignados a una card'],
  'nodes.own':       [1, 'Contenido', 'Editar las cards donde uno es responsable o asignado'],
  'projects.edit':   [1, 'Contenido', 'Página de proyecto (overview, cronograma, kanban) de las cards donde uno es responsable o asignado; con edición de páginas, de todas las visibles'],
  'versions.read':   [1, 'Contenido', 'Ver el historial de versiones'],
  'versions.write':  [3, 'Contenido', 'Crear versiones manuales y restaurar'],
};
export const ACTIONS = Object.keys(DEFS);
export const CAPABILITIES = ACTIONS.map(a => ({ action: a, level: DEFS[a][0], group: DEFS[a][1], label: DEFS[a][2] }));
export const GROUPS = [...new Set(CAPABILITIES.map(c => c.group))];

export function can(ctx, action) {
  const def = DEFS[action];
  if (!def) throw new Error(`Acción desconocida: ${action}`);
  return !!ctx && levelOf(ctx.role) >= def[0];
}
export const permissionsFor = role => ACTIONS.filter(a => levelOf(role) >= DEFS[a][0]);
/** ¿Puede `ctx` dar el rol `role` (invitar, crear, cambiar)? Por debajo del propio nivel; quien gestiona usuarios también su propio nivel. Solo un admin da admin. */
export function canAssignRole(ctx, role) {
  if (!ctx || !ROLE_LEVEL[role]) return false;
  return levelOf(role) < levelOf(ctx.role) || (can(ctx, 'users.manage') && levelOf(role) <= levelOf(ctx.role));
}
export const assignableRoles = role => ROLES.filter(r => canAssignRole({ role }, r));
/** ¿Puede `ctx` tocar la cuenta de alguien con `targetRole`? (nunca a alguien por encima). */
export const canManageUser = (ctx, targetRole) => !!ctx && can(ctx, 'users.manage') && levelOf(targetRole) <= levelOf(ctx.role);
/** Etiquetas visibles: defaults + personalizadas saneadas (Admin no se cambia). */
export function sanitizeRoleLabels(custom) {
  const out = {};
  for (const r of ROLES) {
    if (FIXED_LABEL_ROLES.includes(r)) continue;
    const v = custom && typeof custom[r] === 'string' ? custom[r].trim().slice(0, LABEL_MAX) : '';
    if (v && v !== ROLE_DEFAULT_LABEL[r]) out[r] = v;
  }
  return out;
}
export const roleLabels = custom => ({ ...ROLE_DEFAULT_LABEL, ...sanitizeRoleLabels(custom) });

// Matriz única de permisos. can(ctx, action) → boolean. ctx = { role }.
export const ROLES = ['admin', 'head', 'designer'];
// acción → roles que la tienen. Rol por org; la visibilidad por células vive en lib/visibility.js.
const MATRIX = {
  'users.manage': ['admin'],
  'invite': ['admin', 'head'],            // head: solo designer (regla extra en routes/invites.js)
  'cells.manage': ['admin'],
  'cells.read': ['admin', 'head'],
  'cells.members': ['admin', 'head'],   // head: solo sus células (regla extra en routes/cells.js)
  'directory.read': ['admin', 'head'],  // listado mínimo de usuarios para asignar
  'org.settings': ['admin'],
  'backups': ['admin'],
  'pages.read': ['admin', 'head', 'designer'],
  'pages.create': ['admin', 'head'],
  'pages.edit': ['admin', 'head'],
  'pages.archive': ['admin', 'head'],
  'pages.delete': ['admin'],
  'pages.import': ['admin', 'head'],
  'pages.export': ['admin', 'head', 'designer'],   // designer: solo lo visible (F3)
  'versions.read': ['admin', 'head', 'designer'],
  'versions.write': ['admin', 'head'],
  'audit.read': ['admin'],
};
export const ACTIONS = Object.keys(MATRIX);
export function can(ctx, action) {
  const roles = MATRIX[action];
  if (!roles) throw new Error(`Acción desconocida: ${action}`);
  return !!ctx && roles.includes(ctx.role);
}
export const permissionsFor = role => ACTIONS.filter(a => MATRIX[a].includes(role));

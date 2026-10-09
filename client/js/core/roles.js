/* =========================================================
   P10. Roles por nivel en el cliente: etiqueta visible (personalizable por organización) y helper de permisos
   ========================================================= */
import { S } from './state.js';
import { roleLabels, levelOf } from './permissions.js';

/** Etiqueta visible del rol según `S.session.org.roleLabels` (Admin siempre «Admin»). */
export const roleLabel = role => roleLabels(S.session?.org?.roleLabels)[role] || role || '';
export const has = p => !!S.session && S.session.permissions.includes(p);
export const myLevel = () => levelOf(S.session?.role);

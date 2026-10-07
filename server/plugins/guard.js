// F2: app.guard('action') → hook onRequest (antes de validar el body): 401 sin sesión, 403 si el rol no tiene la acción (lib/permissions.js).
import { can } from '../lib/permissions.js';
import { HttpError } from '../lib/pages.js';
import { userCount } from '../lib/auth.js';

function guardPlugin(app, opts, done) {
  app.decorate('guard', (action) => {
    can({ role: 'admin' }, action); // valida el nombre de la acción al registrar la ruta
    return async (req) => {
      if (!req.user) throw new HttpError(401, 'Inicia sesión', { setup: userCount(app.db) === 0 });
      if (!can({ role: req.role }, action)) throw new HttpError(403, 'Sin permisos para esta acción');
    };
  });
  done();
}
guardPlugin[Symbol.for('skip-override')] = true;
export default guardPlugin;

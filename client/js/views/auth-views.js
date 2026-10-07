/* =========================================================
   F2. Vistas de acceso: setup inicial, login, invitación (overlay #authView)
   ========================================================= */
import { $, esc } from '../core/utils.js';
import * as api from '../core/api.js';

const view = () => $('#authView');
export const ROLE_LABEL = { admin: 'Admin', head: 'Head', designer: 'Designer' };
const field = (name, label, type = 'text', extra = '') => `<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${type}" ${extra}></div>`;

function show(title, subtitle, inner) {
  const v = view();
  v.innerHTML = `<div class="auth-card"><div class="brand"><span>DesTree</span></div><h1>${esc(title)}</h1>${subtitle ? `<p class="hint">${subtitle}</p>` : ''}${inner}</div>`;
  v.hidden = false;
  return v;
}
export function hideAuth() { const v = view(); v.hidden = true; v.innerHTML = ''; }

/** Monta un formulario; `submit(data)` devuelve el resultado o lanza (se muestra el mensaje). Resuelve con el resultado. */
function form(v, submit) {
  return new Promise(resolve => {
    const f = $('form', v), err = $('.form-error', v), btn = $('button[type=submit]', v);
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { resolve(await submit(Object.fromEntries(new FormData(f)))); } catch (ex) { err.textContent = ex.message || 'Error'; btn.disabled = false; }
    });
    const first = $('input:not([disabled])', f); if (first) first.focus();
  });
}

export function showSetup() {
  const v = show('Configura tu instalación', 'Primer arranque: crea la organización y la cuenta de administración.', `<form>
    ${field('orgName', 'Organización', 'text', 'required maxlength="120" autocomplete="organization"')}
    ${field('name', 'Tu nombre', 'text', 'required maxlength="120" autocomplete="name"')}
    ${field('email', 'Correo', 'email', 'required autocomplete="username"')}
    ${field('password', 'Contraseña (mín. 8)', 'password', 'required minlength="8" autocomplete="new-password"')}
    <div class="form-error"></div><button class="btn primary" type="submit">Crear organización</button></form>`);
  return form(v, d => api.setup(d));
}

export function showLogin(message = '') {
  const v = show('Inicia sesión', message, `<form>
    ${field('email', 'Correo', 'email', 'required autocomplete="username"')}
    ${field('password', 'Contraseña', 'password', 'required autocomplete="current-password"')}
    <div class="form-error"></div><button class="btn primary" type="submit">Entrar</button></form>`);
  return form(v, d => api.login(d.email, d.password));
}

/** Pantalla de alta por invitación. Resuelve con el usuario creado (ya con sesión) o null si el token no vale. */
export async function showInvite(token) {
  let inv;
  try { inv = await api.getInvite(token); } catch (err) {
    const msg = err.status === 410 ? err.message : err.status === 404 ? 'Esta invitación no existe.' : 'No se pudo comprobar la invitación: ' + err.message;
    show('Invitación no válida', esc(msg), `<p><a href="#/login" class="btn">Ir al inicio de sesión</a></p>`);
    return null;
  }
  const v = show(`Únete a ${esc(inv.orgName)}`, `Te han invitado como <b>${esc(ROLE_LABEL[inv.role] || inv.role)}</b>. Crea tu contraseña para entrar.`, `<form>
    ${field('email', 'Correo', 'email', `value="${esc(inv.email)}" disabled`)}
    ${field('name', 'Tu nombre', 'text', 'required maxlength="120" autocomplete="name"')}
    ${field('password', 'Contraseña (mín. 8)', 'password', 'required minlength="8" autocomplete="new-password"')}
    <div class="form-error"></div><button class="btn primary" type="submit">Crear cuenta</button></form>`);
  return form(v, d => api.acceptInvite({ token, name: d.name, password: d.password }));
}

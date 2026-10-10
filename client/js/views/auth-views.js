/* =========================================================
   F2. Vistas de acceso: setup inicial, login, invitación (overlay #authView) · P7: olvidé mi contraseña / restablecer
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { t, toggleLang } from '../core/i18n.js'; // P15
import * as api from '../core/api.js';

const view = () => $('#authView');
const field = (name, label, type = 'text', extra = '') => `<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${type}" ${extra}></div>`;

function show(title, subtitle, inner) {
  const v = view();
  v.innerHTML = `<div class="auth-card"><div class="brand"><span>DesTree</span></div><h1>${esc(title)}</h1>${subtitle ? `<p class="hint">${subtitle}</p>` : ''}${inner}<p class="hint auth-lang"><button type="button" class="linkish" data-lang>${t('English')}</button></p></div>`;
  v.hidden = false;
  $('[data-lang]', v).addEventListener('click', toggleLang);
  return v;
}
export function hideAuth() { const v = view(); v.hidden = true; v.innerHTML = ''; }

/** Monta un formulario; `submit(data)` devuelve el resultado o lanza (se muestra el mensaje). Resuelve con el resultado. */
function form(v, submit) {
  return new Promise(resolve => {
    const f = $('form', v), err = $('.form-error', v), btn = $('button[type=submit]', v);
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { resolve(await submit(Object.fromEntries(new FormData(f)))); } catch (ex) { err.textContent = ex.message || t('Error'); btn.disabled = false; }
    });
    const first = $('input:not([disabled])', f); if (first) first.focus();
  });
}

export function showSetup() {
  const v = show(t('Configura tu instalación'), t('Primer arranque: crea la organización y la cuenta de administración.'), `<form>
    ${field('orgName', t('Organización'), 'text', 'required maxlength="120" autocomplete="organization"')}
    ${field('name', t('Tu nombre'), 'text', 'required maxlength="120" autocomplete="name"')}
    ${field('email', t('Correo'), 'email', 'required autocomplete="username"')}
    ${field('password', t('Contraseña (mín. 8)'), 'password', 'required minlength="8" autocomplete="new-password"')}
    <div class="form-error"></div><button class="btn primary" type="submit">${t('Crear organización')}</button></form>`);
  return form(v, d => api.setup(d));
}

/** `mail`: el servidor tiene SMTP → se ofrece «¿Olvidaste tu contraseña?» (resuelve con 'forgot'). */
export function showLogin(message = '', { mail = false } = {}) {
  const v = show(t('Inicia sesión'), message, `<form>
    ${field('email', t('Correo'), 'email', 'required autocomplete="username"')}
    ${field('password', t('Contraseña'), 'password', 'required autocomplete="current-password"')}
    <div class="form-error"></div><button class="btn primary" type="submit">${t('Entrar')}</button></form>
    ${mail ? `<p class="hint"><button type="button" class="linkish" id="forgotLink">${t('¿Olvidaste tu contraseña?')}</button></p>` : ''}`);
  return new Promise(resolve => {
    form(v, d => api.login(d.email, d.password)).then(resolve);
    $('#forgotLink', v)?.addEventListener('click', () => resolve('forgot'));
  });
}

/** P7: pide el correo; el servidor siempre responde 204. Resuelve cuando el usuario vuelve al login. */
export function showForgot() {
  const v = show(t('Recuperar contraseña'), t('Escribe tu correo: si existe una cuenta activa, recibirás un enlace válido durante una hora.'), `<form>
    ${field('email', t('Correo'), 'email', 'required autocomplete="username"')}
    <div class="form-error"></div><button class="btn primary" type="submit">${t('Enviar enlace')}</button></form>
    <p class="hint"><button type="button" class="linkish" data-back>${t('Volver al inicio de sesión')}</button></p>`);
  return new Promise(resolve => {
    $('[data-back]', v).addEventListener('click', () => resolve());
    form(v, async d => {
      await api.forgotPassword(d.email);
      const w = show(t('Revisa tu correo'), t('Si <b>{email}</b> tiene cuenta, en unos minutos llegará un enlace para elegir una contraseña nueva. Mira también la carpeta de spam.', { email: esc(d.email) }), `<p><button type="button" class="btn primary" data-back>${t('Volver al inicio de sesión')}</button></p>`);
      $('[data-back]', w).addEventListener('click', () => resolve());
    });
  });
}

/** P7: `#/reset/<token>`: nueva contraseña + repetir. Resuelve al terminar (o al volver). */
export function showReset(token) {
  const v = show(t('Nueva contraseña'), t('Elige una contraseña nueva (mínimo 8 caracteres). Se cerrarán todas tus sesiones.'), `<form>
    ${field('password', t('Nueva contraseña'), 'password', 'required minlength="8" maxlength="200" autocomplete="new-password"')}
    ${field('repeat', t('Repite la contraseña'), 'password', 'required minlength="8" maxlength="200" autocomplete="new-password"')}
    <div class="form-error"></div><button class="btn primary" type="submit">${t('Guardar y entrar')}</button></form>
    <p class="hint"><button type="button" class="linkish" data-back>${t('Volver al inicio de sesión')}</button></p>`);
  return new Promise(resolve => {
    $('[data-back]', v).addEventListener('click', () => resolve());
    form(v, async d => {
      if (d.password !== d.repeat) throw new Error(t('Las contraseñas no coinciden'));
      await api.resetPassword(token, d.password);
      const w = show(t('Contraseña actualizada'), t('Ya puedes entrar con la nueva contraseña.'), `<p><button type="button" class="btn primary" data-back>${t('Ir al inicio de sesión')}</button></p>`);
      $('[data-back]', w).addEventListener('click', () => resolve());
    });
  });
}

/** Pantalla de alta por invitación. Resuelve con el usuario creado (ya con sesión) o null si el token no vale. */
export async function showInvite(token) {
  let inv;
  try { inv = await api.getInvite(token); } catch (err) {
    const msg = err.status === 410 ? err.message : err.status === 404 ? t('Esta invitación no existe.') : t('No se pudo comprobar la invitación: {msg}', { msg: err.message });
    show(t('Invitación no válida'), esc(msg), `<p><a href="#/login" class="btn">${t('Ir al inicio de sesión')}</a></p>`);
    return null;
  }
  const v = show(t('Únete a {org}', { org: esc(inv.orgName) }), t('Te han invitado como <b>{role}</b>. Crea tu contraseña para entrar.', { role: esc(inv.roleLabel || inv.role) }), `<form>
    ${field('email', t('Correo'), 'email', `value="${esc(inv.email)}" disabled`)}
    ${field('name', t('Tu nombre'), 'text', 'required maxlength="120" autocomplete="name"')}
    ${field('password', t('Contraseña (mín. 8)'), 'password', 'required minlength="8" autocomplete="new-password"')}
    <div class="form-error"></div><button class="btn primary" type="submit">${t('Crear cuenta')}</button></form>`);
  return form(v, d => api.acceptInvite({ token, name: d.name, password: d.password }));
}

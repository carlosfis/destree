'use strict';
/* =========================================================
   13. Diálogos genéricos (confirmar / pedir texto)
   ========================================================= */
const confirmDialog = $('#confirmDialog');
function confirmBox({ title, message, buttons }) {
  return new Promise(resolve => {
    confirmDialog.innerHTML = `<div class="dialog-inner"><header><h2>${esc(title)}</h2><button class="icon-btn" data-v="">✕</button></header>
      <div class="dialog-body"><div class="confirm-msg">${esc(message)}</div></div>
      <footer>${buttons.map(b => `<button class="btn ${b.kind || ''}" data-v="${esc(b.value ?? '')}">${esc(b.label)}</button>`).join('')}</footer></div>`;
    const done = v => { confirmDialog.close(); resolve(v || null); };
    confirmDialog.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => done(b.dataset.v)));
    confirmDialog.oncancel = ev => { ev.preventDefault(); done(null); };
    confirmDialog.showModal();
    const primary = confirmDialog.querySelector('footer .btn.primary, footer .btn.danger'); if (primary) primary.focus();
  });
}
function promptBox({ title, label, value = '', okLabel = 'Guardar' }) {
  return new Promise(resolve => {
    confirmDialog.innerHTML = `<form class="dialog-inner"><header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-cancel>✕</button></header>
      <div class="dialog-body"><div class="field"><label>${esc(label)}</label><input name="v" value="${esc(value)}" autocomplete="off"></div></div>
      <footer><button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn primary">${esc(okLabel)}</button></footer></form>`;
    const form = confirmDialog.querySelector('form');
    const done = v => { confirmDialog.close(); resolve(v); };
    form.addEventListener('submit', ev => { ev.preventDefault(); done(form.v.value.trim()); });
    confirmDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => done(null)));
    confirmDialog.oncancel = ev => { ev.preventDefault(); done(null); };
    confirmDialog.showModal();
    form.v.focus(); form.v.select();
  });
}


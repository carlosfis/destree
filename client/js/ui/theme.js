'use strict';
/* =========================================================
   18. Tema, toasts, atajos
   ========================================================= */
const mql = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = state.settings.theme ? state.settings.theme === 'dark' : mql.matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  drawMinimap();
}
mql.addEventListener('change', () => { if (!state.settings.theme) applyTheme(); });
$('#themeSwitch').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  state.settings.theme = dark ? 'light' : 'dark'; applyTheme(); save();
  if (adminPanel.classList.contains('open') && adminTab === 'settings') renderAdmin();
});

function toast(msg, kind = 'info', ms = 2600) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
  while (box.children.length > 4) box.firstChild.remove();
}

function openShortcuts() {
  const K = (...ks) => ks.map(k => `<kbd>${esc(k)}</kbd>`).join('');
  const row = (l, ...ks) => `<div class="sc"><span>${l}</span><span>${K(...ks)}</span></div>`;
  $('#shortcutsDialog').innerHTML = `<div class="dialog-inner"><header><h2>Atajos de teclado</h2><button class="icon-btn" id="closeSc">✕</button></header>
    <div class="dialog-body"><div class="shortcuts">
      <h4>Lienzo</h4>
      ${row('Pan', 'Rueda', 'Espacio + arrastrar', 'Botón central')}${row('Zoom al cursor', MOD + ' + rueda', 'Pinch')}
      ${row('Acercar / alejar', '+', '−')}${row('Zoom 100%', MOD + '+0')}${row('Ajustar a pantalla', 'Shift+1')}${row('Ajustar a selección', 'Shift+2')}
      ${row('Herramienta mover / mano', 'V', 'H')}
      <h4>Cards y contenedores</h4>
      ${row('Nueva card', 'N')}${row('Editar card', 'Enter', 'Doble clic')}${row('Seleccionar / sumar', 'Clic', 'Shift+clic')}
      ${row('Selección por recuadro', 'Arrastrar fondo')}${row('Seleccionar raíces', MOD + '+A')}${row('Mover 1 px / 10 px', '←↑→↓', 'Shift+flechas')}
      ${row('Anidar / sacar', 'Soltar dentro / fuera')}${row('Desactivar snap al arrastrar', 'Alt')}${row('Duplicar', MOD + '+D')}${row('Eliminar', 'Supr', 'Backspace')}
      ${row('Conectar o anidar', 'Arrastrar desde un puerto')}${row('Redimensionar contenedor', 'Esquina inferior derecha')}
      <h4>Historial</h4>
      ${row('Deshacer', MOD + '+Z')}${row('Rehacer', MOD + '+Shift+Z', MOD + '+Y')}${row('Cancelar / deseleccionar', 'Esc')}${row('Este panel', '?')}
    </div></div><footer><button class="btn primary" id="closeSc2">Cerrar</button></footer></div>`;
  const d = $('#shortcutsDialog');
  $('#closeSc').onclick = $('#closeSc2').onclick = () => d.close();
  d.showModal();
}


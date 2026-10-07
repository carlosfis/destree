// Reproductor: escala el escenario al viewport; controles play/pause + scrub; modo render (?render=1) expone __seek/__ready.
(() => {
  const tl = window.TL, stage = document.getElementById('stage'), play = document.getElementById('play'), scrub = document.getElementById('scrub'), tc = document.getElementById('tc');
  if (!tl) { document.getElementById('controls').textContent = 'No se pudo cargar GSAP desde cdnjs.cloudflare.com (sin red o bloqueado). Revisa la conexión y recarga la página.'; return; }
  const render = new URLSearchParams(location.search).has('render');
  if (render) document.body.classList.add('render');
  const fit = () => { const h = innerHeight - (render ? 0 : 56); const s = Math.min(innerWidth / 1920, h / 1080); stage.style.transform = `scale(${s})`; stage.style.marginBottom = render ? '0' : '56px'; };
  addEventListener('resize', fit); fit();
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const dur = tl.duration();
  const sync = () => { tc.textContent = `${fmt(tl.time())} / ${fmt(dur)}`; scrub.value = Math.round(tl.progress() * 1000); play.textContent = tl.isActive() ? '❚❚ Pausa' : '▶ Reproducir'; };
  tl.eventCallback('onUpdate', sync);
  tl.eventCallback('onComplete', () => { tl.pause(); sync(); });
  const toggle = () => { if (tl.progress() >= 1) tl.seek(0); tl.isActive() ? tl.pause() : tl.play(); sync(); };
  play.addEventListener('click', toggle);
  scrub.addEventListener('input', () => { tl.pause(); tl.progress(scrub.value / 1000); sync(); });
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); toggle(); } if (e.code === 'ArrowRight') { tl.pause(); tl.seek(Math.min(dur, tl.time() + 2)); sync(); } if (e.code === 'ArrowLeft') { tl.pause(); tl.seek(Math.max(0, tl.time() - 2)); sync(); } });
  window.__seek = (t) => { tl.pause(); tl.seek(t, false); };
  window.__duration = dur;
  tl.seek(0); sync();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.fonts.ready.then(() => { window.__ready = true; if (!render && !reduced) tl.play(); });
})();

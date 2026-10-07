// Línea de tiempo determinista (GSAP, pausada). window.TL expone seek/duration para el reproductor y el render.
(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  const show = (sel, at, d = .5) => tl.to(sel, { autoAlpha: 1, duration: d, ease: 'power2.out' }, at);
  const hide = (sel, at, d = .45) => tl.to(sel, { autoAlpha: 0, duration: d, ease: 'power2.in' }, at);
  const words = (sel, at, y = 60) => tl.from(sel, { y, opacity: 0, rotateX: -35, duration: 1, stagger: .09, ease: 'expo.out' }, at);
  const rise = (sel, at, stagger = .08, y = 36) => tl.from(sel, { y, opacity: 0, duration: .8, stagger, ease: 'expo.out' }, at);
  const pop = (sel, at, d = .6) => tl.from(sel, { scale: .86, opacity: 0, duration: d, ease: 'back.out(1.6)' }, at);
  const draw = (sel, at, d = .7) => tl.to(sel, { strokeDashoffset: 0, duration: d, ease: 'power2.inOut' }, at);
  const typeIn = (el, text, at, dur) => { const o = { p: 0 }; tl.to(o, { p: 1, duration: dur, ease: 'none', onUpdate() { el.textContent = text.slice(0, Math.round(o.p * text.length)); } }, at); };
  const kicker = (n, label, at) => { tl.call(() => { $('#kicker b').textContent = n; $('#kicker span').textContent = label; }, null, at); hide('#kicker', at - .01, .3); show('#kicker', at + .3, .5); };
  const cursor = (x, y, at, d = .8) => tl.to('#cursor', { x, y, duration: d, ease: 'power2.inOut' }, at);
  const click = (at) => { tl.to('#cursor', { scale: .82, duration: .08, yoyo: true, repeat: 1 }, at); tl.fromTo('#ripple', { opacity: .9, scale: .3 }, { opacity: 0, scale: 2.2, duration: .5, ease: 'power2.out' }, at); };
  const headline = (scene, at) => { show(scene, at, .4); words(`${scene} .big`, at + .05, 70); tl.from(`${scene} .lead`, { y: 24, opacity: 0, duration: .9, ease: 'expo.out' }, at + .45); };
  gsap.set('.title .w', { transformOrigin: '50% 100%' });
  gsap.set('#ripple', { x: 0, y: 0 });

  // 00 · Intro (0–6)
  show('#s0', 0, .2);
  tl.from('.grid', { opacity: 0, duration: 1.4, ease: 'power2.out' }, 0);
  tl.set('#s0 .logo circle, #s0 .logo path', { strokeDasharray: 1, strokeDashoffset: 1 }, 0);
  tl.to('#s0 .logo path', { strokeDashoffset: 0, duration: .9, ease: 'power2.inOut', stagger: .12 }, .2);
  tl.to('#s0 .logo circle', { strokeDashoffset: 0, duration: .7, ease: 'power2.inOut', stagger: .1 }, .5);
  words('#s0 .title .w', 1.1, 90);
  tl.from('#s0 .tagline', { y: 24, opacity: 0, duration: 1, ease: 'expo.out' }, 1.8);
  tl.to('#s0 .center', { scale: 1.06, duration: 3.2, ease: 'none' }, 2.4);
  hide('#s0', 5.4, .5);

  // 01 · El árbol (5.8–17)
  const T1 = 5.8;
  show('#s1', T1, .3);
  tl.set('#edges path, #cursor, .callout, #mm, #legend, #n-portal, #n-portalkit, #drawer, #n-pagos, #n-aurora, #n-mobile, #n-web, #n-checkout', { autoAlpha: 0 }, T1);
  tl.set('#edges path.far', { strokeDashoffset: 0 }, T1);
  tl.from('.topbar', { y: -56, duration: .7, ease: 'expo.out' }, T1);
  kicker('01', 'El árbol', T1 + .2);
  tl.set('#n-banca', { height: 200 }, T1);
  pop('#n-banca', T1 + .3, .8);
  tl.to('#n-banca', { height: 740, duration: .9, ease: 'expo.inOut' }, T1 + 1.3);
  tl.to('#n-aurora, #n-mobile, #n-web', { autoAlpha: 1, duration: .01 }, T1 + 1.7);
  tl.from('#n-aurora, #n-mobile, #n-web', { y: 40, scale: .9, duration: .9, stagger: .14, ease: 'back.out(1.5)' }, T1 + 1.7);
  tl.to('#n-pagos', { autoAlpha: 1, duration: .01 }, T1 + 2.5);
  tl.from('#n-pagos', { y: 40, scale: .95, duration: .9, ease: 'back.out(1.4)' }, T1 + 2.5);
  tl.to('#n-checkout', { autoAlpha: 1, duration: .01 }, T1 + 3);
  tl.from('#n-checkout', { y: 30, scale: .9, duration: .8, ease: 'back.out(1.5)' }, T1 + 3);
  tl.to('#e1, #e2, #e3, #e4', { autoAlpha: 1, duration: .01 }, T1 + 3.6);
  draw('#e2', T1 + 3.6, .6); draw('#e3', T1 + 3.8, .9); draw('#e4', T1 + 4.1, .7); draw('#e1', T1 + 4.4, .7);
  pop('#c2', T1 + 4.2); tl.to('#c2', { autoAlpha: 1, duration: .3 }, T1 + 4.2);
  pop('#c1', T1 + 5.3); tl.to('#c1', { autoAlpha: 1, duration: .3 }, T1 + 5.3);
  show('#legend', T1 + 5.6); show('#mm', T1 + 5.6);
  hide('#c2', T1 + 8.2); hide('#c1', T1 + 8.4);

  // 02 · Conexiones entre raíces (14.5–22)
  const T2 = T1 + 8.7;
  kicker('02', 'Conexiones entre raíces', T2);
  tl.to('#n-portal, #n-portalkit', { autoAlpha: 1, duration: .01 }, T2 + .2);
  tl.from('#n-portal', { x: 120, scale: .95, duration: .9, ease: 'expo.out' }, T2 + .2);
  tl.from('#n-portalkit', { x: 120, y: 20, scale: .9, duration: .9, ease: 'back.out(1.4)' }, T2 + .5);
  tl.to('#e5', { autoAlpha: 1, duration: .6 }, T2 + 1.2);
  tl.fromTo('#e5', { strokeDashoffset: .4 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.out' }, T2 + 1.2);
  tl.to('#e6', { autoAlpha: 1, duration: .5 }, T2 + 1.8);
  pop('#c3', T2 + 2.2); tl.to('#c3', { autoAlpha: 1, duration: .3 }, T2 + 2.2);
  tl.to('#btnLayout', { backgroundColor: '#529cca', color: '#0e1b26', duration: .25, yoyo: true, repeat: 1, repeatDelay: .2 }, T2 + 4.2);
  tl.to('#cv', { scale: .9, x: -20, y: 30, duration: 1.3, ease: 'expo.inOut' }, T2 + 4.3);
  tl.to('#mm .view', { left: 22, top: 14, width: 180, height: 100, duration: 1.3, ease: 'expo.inOut' }, T2 + 4.3);
  hide('#c3', T2 + 5.6);

  // 03 · Ficha / sidebar (21–36)
  const T3 = T2 + 6.4;
  kicker('03', 'Ficha de cada instancia', T3);
  tl.to('#cv', { scale: 1, x: 0, y: 0, duration: 1, ease: 'expo.inOut' }, T3);
  tl.set('#cursor', { x: 1100, y: 760 }, T3);
  show('#cursor', T3 + .3, .3);
  cursor(360, 430, T3 + .5, 1);
  click(T3 + 1.6); click(T3 + 1.78);
  tl.to('#n-aurora', { className: 'node leaf ds selected', duration: .01 }, T3 + 1.7);
  tl.set('#drawer', { autoAlpha: 1, x: 480 }, T3 + 1.9);
  tl.to('#drawer', { x: 0, duration: .8, ease: 'expo.out' }, T3 + 1.9);
  tl.to('#cv', { x: -230, duration: .8, ease: 'expo.out' }, T3 + 1.9);
  hide('#cursor', T3 + 2, .3);
  show('#p1', T3 + 2.3, .3); rise('#p1 .field', T3 + 2.3, .08, 18);
  const tab = (n, at) => { tl.call(() => { $$('.tab').forEach((t, i) => t.classList.toggle('on', i === n - 1)); }, null, at); hide(`.pane:not(#p${n})`, at, .2); show(`#p${n}`, at + .15, .3); };
  tab(2, T3 + 5.2); rise('#p2 .staff, #p2 .field', T3 + 5.3, .1, 22);
  tab(3, T3 + 8.4); rise('#p3 .link, #p3 .field', T3 + 8.5, .08, 18);
  tab(4, T3 + 10.9);
  tl.call(() => { $('#md').innerHTML = ''; }, null, T3 + 10.9);
  const MD = [['h4', 'Cómo usar Aurora'], ['', 'Los kits '], ['b', 'nunca'], ['', ' sobreescriben tokens.\nUsa '], ['code', 'aurora/tokens.css'], ['', ' desde el paquete.\n\n• Revisión en '], ['b', 'Design Crit'], ['', ' los jueves\n• Cambios mayores: versión manual antes']];
  const mdEl = $('#md'); const mdFull = MD.map(([, t]) => t).join('');
  const om = { p: 0 }; tl.to(om, { p: 1, duration: 3.2, ease: 'none', onUpdate() { let n = Math.round(om.p * mdFull.length); mdEl.innerHTML = ''; for (const [tag, t] of MD) { if (n <= 0) break; const s = t.slice(0, n); n -= t.length; if (tag) { const e = document.createElement(tag); e.textContent = s; mdEl.appendChild(e); } else mdEl.appendChild(document.createTextNode(s)); } } }, T3 + 11.1);
  hide('#s1', T3 + 15.2, .5);

  // 04 · Roles (36.5–45)
  const T4 = T3 + 15.6;
  kicker('04', 'Equipo y permisos', T4);
  headline('#s4', T4);
  rise('#s4 .col', T4 + .9, .14, 50);
  tl.from('#s4 .perm', { x: -14, opacity: 0, duration: .5, stagger: .05, ease: 'power2.out' }, T4 + 1.6);
  hide('#s4', T4 + 7.4, .4);
  // 05 · Visibilidad (44.5–51)
  const T5 = T4 + 7.7;
  kicker('05', 'Visibilidad por célula', T5);
  headline('#s5', T5);
  rise('#s5 .vis-row', T5 + .8, .12, 40);
  tl.to('#s5 .vis-row:nth-child(4)', { className: 'vis-row vr hidden-row', duration: .6 }, T5 + 3);
  hide('#s5', T5 + 6.4, .4);

  // 06 · Historial (51.5–61)
  const T6 = T5 + 6.7;
  kicker('06', 'Historial y respaldos', T6);
  headline('#s6', T6);
  tl.from('.tline', { scaleX: 0, transformOrigin: 'left', duration: 1, ease: 'expo.inOut' }, T6 + .8);
  tl.to('#tfill', { width: '99.5%', duration: 1.4, ease: 'power2.inOut' }, T6 + 1.5);
  tl.to('.vd', { scale: 1, duration: .5, stagger: .25, ease: 'back.out(2)' }, T6 + 1.6);
  tl.from('.vlab', { y: 10, opacity: 0, duration: .5, stagger: .25, ease: 'power2.out' }, T6 + 1.7);
  pop('#diff', T6 + 3.2, .7);
  tl.from('#diff .dl', { x: -12, opacity: 0, duration: .4, stagger: .12 }, T6 + 3.6);
  tl.to('#restore', { scale: .94, duration: .12, yoyo: true, repeat: 1 }, T6 + 5.2);
  tl.to('#tfill', { width: '52%', duration: .8, ease: 'expo.inOut' }, T6 + 5.5);
  tl.to('#vnow', { className: 'vdot manual vd', duration: .3 }, T6 + 5.7);
  rise('.bkr', T6 + 6.2, .18, 30);
  hide('#s6', T6 + 9.6, .4);

  // 07 · Páginas y tipos (61.5–69)
  const T7 = T6 + 9.9;
  kicker('07', 'Páginas y nombres de tipo', T7);
  headline('#s7', T7);
  pop('#pages', T7 + .9, .6);
  rise('.pg', T7 + 1, .08, 14);
  tl.call(() => { $$('.pg').forEach((p, i) => p.classList.toggle('on', i === 1)); }, null, T7 + 2.6);
  rise('.ty', T7 + 2.9, .14, 30);
  typeIn($('#ty1'), 'Producto', T7 + 3.6, .7); typeIn($('#ty2'), 'Librería', T7 + 4.3, .7); typeIn($('#ty3'), 'Plantilla', T7 + 5, .7);
  hide('#s7', T7 + 7.6, .4);

  // 08 · Stack (69.5–79)
  const T8 = T7 + 7.9;
  kicker('08', 'Stack e instalación', T8);
  headline('#s8', T8);
  rise('.sl', T8 + .9, .12, 30);
  pop('.term', T8 + 1.2, .6);
  tl.set('.tl1, .tl2', { autoAlpha: 0 }, T8);
  typeIn($('#cmd'), 'docker compose up -d', T8 + 1.9, 1.3);
  tl.to('#cur', { opacity: 0, duration: .15, repeat: 9, yoyo: true, ease: 'none' }, T8 + 1.9);
  tl.to('.tl1', { autoAlpha: 1, duration: .25, stagger: .35 }, T8 + 3.6);
  tl.to('.tl2', { autoAlpha: 1, duration: .4 }, T8 + 5);
  hide('#s8', T8 + 8, .5);

  // 09 · Outro (78–85)
  const T9 = T8 + 8.3;
  hide('#kicker', T9 - .3, .3);
  show('#s9', T9, .4);
  words('#s9 .title .w', T9 + .1, 70);
  tl.from('#s9 .logo', { scale: .6, opacity: 0, duration: 1, ease: 'back.out(1.6)' }, T9 + .1);
  tl.from('#outro', { y: 20, opacity: 0, duration: .9, ease: 'expo.out' }, T9 + .8);
  tl.from('#url', { y: 14, opacity: 0, duration: .9, ease: 'expo.out' }, T9 + 1.3);
  tl.to('#s9 .center', { scale: 1.04, duration: 4, ease: 'none' }, T9 + 1);
  tl.to('.grid', { opacity: 0, duration: 1 }, T9 + 5);
  hide('#s9', T9 + 5.6, .8);
  tl.to({}, { duration: .2 }, T9 + 6.4);

  tl.to('#prog', { scaleX: 1, duration: tl.duration(), ease: 'none' }, 0);
  window.TL = tl;
})();

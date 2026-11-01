// AOI: alles, was beide Seiten ohne 3D brauchen. Navigation, sanftes Scrollen, Einblendungen.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// „Bewegung reduzieren“ im System: 3D und alles, was vom Scrollen kommt, bleibt, aber nichts bewegt sich mehr von selbst.
// Beim lokalen Testen, in der GitHub-Vorschau und mit ?motion immer die volle Fassung, mit ?calm die ruhige.
const q = location.search;
export const calm = q.includes('calm') || (matchMedia('(prefers-reduced-motion:reduce)').matches && !q.includes('motion') && !/^(localhost|127\.)|\.github\.io$/.test(location.hostname));
document.documentElement.classList.toggle('calm', calm);

/* ---------- Sanftes Scrollen ---------- */
let raf = 0, auto = false;
export function scrollToY(y, dur = 1100) {
  cancelAnimationFrame(raf);
  const s0 = scrollY, d = y - s0;
  if (Math.abs(d) < 2) return;
  if (calm) { scrollTo(0, y); return; }
  const t0 = performance.now(); auto = true;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    scrollTo(0, s0 + d * e);
    if (k < 1) raf = requestAnimationFrame(step); else auto = false;
  };
  raf = requestAnimationFrame(step);
}
const stop = () => { if (auto) { cancelAnimationFrame(raf); auto = false; } };
addEventListener('wheel', stop, { passive: true });
addEventListener('touchstart', stop, { passive: true });
addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) stop(); });

/* ---------- Navigation, Menü, Sprungmarken ---------- */
const nav = document.querySelector('.nav');
const onNav = () => nav.classList.toggle('top', scrollY < 24);
addEventListener('scroll', onNav, { passive: true }); onNav();

const burger = document.querySelector('.burger');
if (burger) burger.addEventListener('click', () => {
  const open = document.documentElement.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded', open);
});
const closeMenu = () => { document.documentElement.classList.remove('menu-open'); burger && burger.setAttribute('aria-expanded', 'false'); };

const ds = document.getElementById('ds-details');
function openDs() { if (ds) ds.open = true; }
if (location.hash === '#datenschutz') openDs();
addEventListener('hashchange', () => { if (location.hash === '#datenschutz') openDs(); });
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  closeMenu();
  if (id === 'datenschutz') openDs();
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const y = id === 'start' ? 0 : el.getBoundingClientRect().top + scrollY - 40;
  scrollToY(y, 1250);
  history.replaceState(null, '', '#' + id);
});

/* ---------- Einblendungen ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
document.querySelectorAll('[data-rv]').forEach(el => io.observe(el));

/* ---------- Kontaktkarte kippt leicht mit der Maus ---------- */
if (matchMedia('(hover:hover)').matches) document.querySelectorAll('.mailcard').forEach(c => {
  c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 7 + 'deg');
    c.style.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 7 + 'deg');
  });
  c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
});

/* ---------- Auf den echten Domains bleibt die volle Adresse, überall sonst zeigen Querverweise auf die Schwesterseite im selben Projekt ---------- */
if (!/(^|\.)aoi-(netsource|digital-products)\.com$/.test(location.hostname)) document.querySelectorAll('a[data-local]').forEach(a => { a.href = a.dataset.local; });

/* ---------- Empfehlung: Karten drehen (wischen, ziehen, Pfeile, Stufen-Knöpfe) ---------- */
document.querySelectorAll('[data-spin]').forEach(root => {
  const stage = root.querySelector('.spin-stage'), cards = [...stage.querySelectorAll('.pc-card')];
  const tabs = [...root.querySelectorAll('.spin-tabs button')], N = cards.length;
  const mod = n => ((n % N) + N) % N;
  let rot = calm ? 0 : -.42, target = 0, raf = 0, last = 0, drag = null, shown = calm;
  function render() {
    const cw = cards[0].offsetWidth;
    cards.forEach((c, i) => {
      const d = mod(i - rot + N / 2) - N / 2, a = d * 2 * Math.PI / N, k = Math.cos(a);
      const x = Math.sin(a) * cw * .74, z = (k - 1) * cw * .62;
      c.style.transform = `translateX(${x.toFixed(1)}px) translateZ(${z.toFixed(1)}px) rotateY(${(a * 24).toFixed(2)}deg)`;
      c.style.zIndex = Math.round(k * 100) + 100;
      c.style.setProperty('--dim', ((1 - k) * .3).toFixed(3));
      const front = Math.abs(d) < .5;
      c.classList.toggle('front', front);
      c.setAttribute('aria-hidden', front ? 'false' : 'true');
    });
    const cur = mod(Math.round(target));
    tabs.forEach((t, i) => t.setAttribute('aria-selected', i === cur ? 'true' : 'false'));
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60; last = now;
    if (!drag) rot += (target - rot) * (1 - Math.exp(-dt * 9));
    render();
    if (drag || Math.abs(target - rot) > .0008) raf = requestAnimationFrame(tick);
    else { rot = target; render(); raf = 0; last = 0; }
  }
  const go = () => { if (calm) { rot = target; render(); return; } if (!raf) raf = requestAnimationFrame(tick); };
  const to = i => { const base = Math.round(target); let d = mod(i - base); if (d > N / 2) d -= N; target = base + d; go(); };
  tabs.forEach((t, i) => t.addEventListener('click', () => to(i)));
  root.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { target = Math.round(target) + +b.dataset.step; go(); }));
  stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { target = Math.round(target) + 1; go(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { target = Math.round(target) - 1; go(); e.preventDefault(); }
  });
  // Ziehen mit Maus oder Finger; ein Tipp auf eine hintere Karte holt sie nach vorne
  stage.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    // Am 3D-Modell der vorderen Karte zu ziehen dreht den PC, nicht die Karten
    if (e.target.closest('.pc-card.front canvas')) return;
    drag = { x: e.clientX, y: e.clientY, r: rot, t: performance.now(), lx: e.clientX, v: 0, moved: false, id: e.pointerId, card: e.target.closest('.pc-card') };
  });
  stage.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y) > 10 && Math.abs(dx) < 10) { drag = null; return; }
      if (Math.abs(dx) < 6) return;
      drag.moved = true; stage.classList.add('drag');
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      if (!raf) raf = requestAnimationFrame(tick);
    }
    const now = performance.now(), cw = cards[0].offsetWidth;
    drag.v = -(e.clientX - drag.lx) / cw / Math.max((now - drag.t) / 1000, .008); drag.lx = e.clientX; drag.t = now;
    rot = drag.r - dx / (cw * 1.05);
  });
  const end = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null; stage.classList.remove('drag');
    if (d.moved) { target = Math.round(rot + Math.max(-.6, Math.min(.6, d.v * .12))); go(); }
    else if (d.card && !d.card.classList.contains('front')) to(cards.indexOf(d.card));
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  addEventListener('resize', render);
  render();
  // Beim ersten Erscheinen schwingen die Karten kurz ein, damit man sieht, dass sie sich drehen
  if (!shown) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); setTimeout(go, 250); } }, { threshold: .35 }).observe(stage);
});

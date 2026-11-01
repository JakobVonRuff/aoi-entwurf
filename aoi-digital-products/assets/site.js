// AOI: alles, was beide Seiten ohne 3D brauchen. Navigation, sanftes Scrollen, Einblendungen.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// „Bewegung reduzieren“ im System: 3D bleibt, aber nichts bewegt sich mehr von selbst.
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

/* ---------- Bühne: Scrollen rastet sauber am nächsten Kapitel ein ----------
   Der Bildlauf bleibt der normale des Browsers. Erst wenn er kurz ruht, läuft die Seite
   in Scrollrichtung zum nächsten Halt. Ein kleiner Schubs reicht also für einen ganzen Wechsel. */
export function pinnedStage(stageEl, steps) {
  const len = () => stageEl.offsetHeight - innerHeight;
  const top = () => stageEl.getBoundingClientRect().top + scrollY;
  const yOf = i => top() + len() * i / steps;
  let last = scrollY, dir = 1, timer = 0, touching = false;
  function settle() {
    if (touching || auto || calm || location.search.includes('nosnap')) return;
    const y = scrollY, t = top(), L = len();
    if (y <= t + 1 || y >= t + L - 1) return;
    const s = (y - t) / L * steps, i = Math.floor(s), f = s - i;
    if (f < .004 || f > .996) return;
    const target = dir > 0 ? (f > .05 ? i + 1 : i) : (f < .95 ? i : i + 1);
    scrollToY(yOf(target), 620 + 760 * Math.abs(target - s));
  }
  addEventListener('scroll', () => {
    if (auto) return;
    const y = scrollY;
    if (y !== last) dir = Math.sign(y - last);
    last = y;
    clearTimeout(timer); timer = setTimeout(settle, 110);
  }, { passive: true });
  addEventListener('touchstart', () => { touching = true; }, { passive: true });
  addEventListener('touchend', () => { touching = false; clearTimeout(timer); timer = setTimeout(settle, 180); }, { passive: true });
  return {
    progress: () => clamp((scrollY - top()) / len()),
    goto: i => scrollToY(yOf(i), 900 + 500 * Math.min(2, Math.abs(i - (scrollY - top()) / len() * steps))),
  };
}

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

// Sprungziele innerhalb der Bühne meldet die jeweilige Seite an
export const anchors = new Map();
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
  if (anchors.has(id)) { e.preventDefault(); anchors.get(id)(); history.replaceState(null, '', '#' + id); return; }
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  if (a.closest('.static-off')) return;
  const y = id === 'start' ? 0 : el.getBoundingClientRect().top + scrollY - 40;
  scrollToY(y, 1250);
  history.replaceState(null, '', '#' + id);
});

/* ---------- Einblendungen ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
document.querySelectorAll('[data-rv]').forEach(el => io.observe(el));

/* ---------- Satz, der beim Scrollen Wort für Wort aufleuchtet ---------- */
const lits = [...document.querySelectorAll('.lit')].map(el => {
  const words = [];
  const walk = (node, accent) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if (!w.trim()) { frag.append(w); return; }
          const s = document.createElement('span'); s.textContent = w;
          if (accent) s.classList.add('a');
          frag.append(s); words.push(s);
        });
        n.replaceWith(frag);
      } else walk(n, accent || n.tagName === 'EM');
    });
  };
  walk(el, false);
  el.querySelectorAll('em').forEach(e => { e.style.fontStyle = 'normal'; });
  return { el, words };
});
function onLit() {
  for (const { el, words } of lits) {
    const r = el.getBoundingClientRect(), vh = innerHeight;
    const p = clamp((vh * .86 - r.top) / (r.height + vh * .42));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  }
}
addEventListener('scroll', onLit, { passive: true }); addEventListener('resize', onLit); onLit();

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

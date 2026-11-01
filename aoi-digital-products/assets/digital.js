// AOI Digital Products: die Vermittlung als 3D-Geschichte.
// Halte: 0 Frage → 1 Alles von Büro bis Gaming → 2 Netzwerk PC + Lizenz → NetSource → du
//        3 Privat und geschäftlich → 4 Bereich AOI NetSource mit Link zum Katalog
import { THREE, ACCENT, SIGNAL, createStage, hasWebGL, buildAlltag, buildBuero, buildGaming, buildLicense, createNetwork, networkCams, contactShadow, floorSpot, seg, smooth, outBack, mix, damp } from './aoi3d.js';
import { pinnedStage, anchors, calm } from './site.js';

const html = document.documentElement;
const stageEl = document.getElementById('produkte');
const pin = stageEl.querySelector('.pin');
const canvas = pin.querySelector('.gl');

if (!hasWebGL() || location.search.includes('static')) {
  html.classList.add('static');
  throw 0;
}

const STEPS = 4;
const flow = pinnedStage(stageEl, STEPS);
const stage = createStage(canvas);
const { scene, camera, root } = stage;

/* ---------- Objekte ---------- */
function place(obj, shadow) {
  const wrap = new THREE.Group(), spin = new THREE.Group();
  spin.add(obj); wrap.add(spin);
  if (shadow) wrap.add(contactShadow(shadow[0], shadow[1]));
  root.add(wrap);
  return { wrap, spin, obj, rotors: obj.userData.rotors || [] };
}
const alltag = place(buildAlltag(), [2, 2.5]);
const buero = place(buildBuero(), [1.9, 4]);
const gaming = place(buildGaming(), [3, 5]);
const lic = place(buildLicense('programm'));
let net = null;
const pool = floorSpot(ACCENT, 15, .14); root.add(pool);

/* ---------- Halte: x, y, z, Größe, Drehung ---------- */
let tab, cams, port = false, Xs = 1;
function applyLayout() {
  port = stage.aspect < .8; Xs = port ? .46 : 1;
  const a = stage.aspect, k = port ? 1.5 : Math.min(1.45, Math.max(1, 1.6 / a)), X = Xs;
  const gap = stage.visH(15 * k) * a / 3, rs = port ? gap / 2.05 : Math.min(1.05, gap / 2.9);
  const rx = port ? [-1.06, -.08, .8] : [-1, 0, 1];
  tab = {
    alltag: [[-9, 0, -4, 0, -.6], [port ? -1.4 : -2.5, 0, .5, port ? .9 : 1.2, -.42], [X * -4.6, 0, -1.7, 0, -.45], [X * -4.6, 0, -1.7, 0, -.45], [rx[0] * gap, 0, 0, rs * 1.1, -.36]],
    buero: [[port ? -.9 : 3.15, 0, -.2, port ? 1 : 1.3, -.55], [port ? -.15 : -.1, 0, -.4, port ? .86 : 1.08, -.5], [X * -4.6, 0, -1.7, port ? .56 : .72, -.45], [X * -4.6, 0, -1.7, 0, -.45], [rx[1] * gap, 0, 0, rs, -.5]],
    gaming: [[9, 0, -4, 0, -.6], [port ? 1.25 : 2.4, 0, 0, port ? .8 : 1.04, -.62], [9, 0, -4, 0, -.6], [9, 0, -4, 0, -.6], [rx[2] * gap, 0, 0, rs, -.64]],
    lic: [[port ? .95 : 5.05, port ? 1.72 : 2.1, .9, port ? .78 : 1, -.34], [port ? .95 : 5.05, 2.2, 0, 0, -.34], [X * -4.6, .95, 1.7, port ? .62 : .85, .4], [X * -4.6, .95, 1.7, 0, .4], [0, 2, 0, 0, 0]],
  };
  const [plan, planRight] = networkCams(stage);
  cams = [
    { p: [port ? 0 : 1.6, 2.2, 13 * k], t: [port ? 0 : 1.6, port ? 3.5 : 1.65, 0] },
    { p: [0, 2.4, 15.5 * k], t: [0, port ? 2.9 : 2, 0] },
    plan, planRight,
    { p: [0, 2.2, 15 * k], t: [0, stage.visH(15 * k) * .2, 0] },
  ];
  net && net.layout(port);
}
stage.onResize = applyLayout; applyLayout();

/* ---------- Texte ---------- */
const beats = [...pin.querySelectorAll('.beat')].map(el => ({ el, i: +el.dataset.i }));
const hint = pin.querySelector('.hint');
const areaLabels = pin.querySelector('.area-labels');
const glowEl = pin.querySelector('.glow');
{
  // Die Frage erscheint beim Laden Wort für Wort
  const h = pin.querySelector('.q'); let n = 0;
  const walk = (node, acc) => [...node.childNodes].forEach(c => {
    if (c.nodeType === 3) {
      const f = document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach(w => {
        if (!w.trim()) { f.append(w); return; }
        const s = document.createElement('span'); s.className = 'qw' + (acc ? ' a' : ''); s.textContent = w;
        s.style.setProperty('--n', n++); f.append(s);
      });
      c.replaceWith(f);
    } else walk(c, acc || c.tagName === 'EM');
  });
  walk(h, false);
}
const tags = [...pin.querySelectorAll('.tag')].map(el => ({ el, k: el.dataset.t }));
function tagAlpha(k) {
  const out = 1 - seg(c, 3.04, 3.26);
  if (k === 'pc' || k === 'lic') return seg(c, 1.55, 1.9) * (1 - seg(c, 2.14, 2.4));
  if (k === 'du') return seg(c, 1.82, 2) * out;
  return seg(c, 2.72, 2.96) * out;
}

/* ---------- Eingaben ---------- */
let px = 0, py = 0, tx = 0, ty = 0;
addEventListener('pointermove', e => { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
anchors.set('produkte', () => flow.goto(4));

/* ---------- Ein Bild ---------- */
let c = flow.progress() * STEPS, first = true, intro = 0;
const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), look = new THREE.Vector3();
const stepPos = v => { const i = Math.min(STEPS - 1, Math.floor(v)), f = v - i; return i + smooth(seg(f, .1, .9)); };
const lerpRow = (row, r) => {
  const i = Math.min(row.length - 2, Math.floor(r)), f = r - i, a = row[i], b = row[i + 1];
  return a.map((n, k) => mix(n, b[k], f));
};
function apply(o, row, r, t, i, dt) {
  const [x, y, z, s, yaw] = lerpRow(row, r);
  o.wrap.visible = s > .004;
  if (!o.wrap.visible) return;
  o.wrap.position.set(x, y, z);
  o.wrap.scale.setScalar(s);
  o.spin.rotation.y = yaw + Math.sin(t * .42 + i) * .035 + px * .1;
  if (!calm) o.rotors.forEach((ro, n) => { ro.rotation.z -= dt * (n % 2 ? 7.5 : 9); });
}

const CA = new THREE.Color(ACCENT), CO = new THREE.Color(SIGNAL), col = new THREE.Color(), rgb = {};

stage.tick = (dt, now) => {
  const t = calm ? 0 : now;
  if (calm) intro = 1;
  const goal = flow.progress() * STEPS;
  c = first ? goal : damp(c, goal, 8.5, dt); first = false;
  if (Math.abs(c - goal) < .0004) c = goal;
  intro = Math.min(1, intro + dt / 1.5);
  const eI = 1 - Math.pow(1 - intro, 4);
  px = damp(px, tx, 3, dt); py = damp(py, ty, 3, dt);
  const r = stepPos(c);

  // Kamera
  const i = Math.min(cams.length - 2, Math.floor(r)), f = r - i, A = cams[i], B = cams[i + 1];
  v0.set(...A.p).lerp(v1.set(...B.p), f);
  look.set(...A.t).lerp(v1.set(...B.t), f);
  camera.position.set(v0.x + px * .3, v0.y + Math.sin(f * Math.PI) * .6 - py * .12, v0.z + (1 - eI) * 2.4);
  camera.lookAt(look);
  const dist = camera.position.distanceTo(look);
  scene.fog.near = dist + 7; scene.fog.far = dist + 18;

  // Modelle
  apply(alltag, tab.alltag, r, t, 0, dt);
  apply(buero, tab.buero, r, t, 1, dt);
  apply(gaming, tab.gaming, r, t, 2, dt);
  apply(lic, tab.lic, r, t, 3, dt);
  if (lic.wrap.visible) lic.wrap.position.y += Math.sin(t * .9) * .05;
  lic.obj.userData.badge.scale.setScalar(Math.max(.001, outBack(seg(eI, .55, 1))));

  // Netzwerk: Leitungen zeichnen sich beim Scrollen
  const netOut = 1 - smooth(seg(c, 3.04, 3.5));
  net.update({
    now, t, calm, px,
    w1: smooth(seg(c, 1.4, 1.9)) * netOut, w2: smooth(seg(c, 1.72, 2)) * netOut, w3: smooth(seg(c, 2.5, 2.94)) * netOut,
    coreS: outBack(seg(c, 1.46, 1.92)) * netOut, clientS: outBack(seg(c, 1.82, 2)) * netOut, houseS: outBack(seg(c, 2.62, 2.96)) * netOut,
  });

  // Farbe
  const warm = smooth(seg(c, 1.9, 2.5)) * netOut;
  col.copy(CA).lerp(CO, warm * .55);
  stage.rimA.color.copy(col); stage.rimB.color.copy(CA);
  pool.material.color.copy(col);
  pool.position.x = mix(0, Xs * 2.8, seg(c, 2, 3));
  col.getRGB(rgb, THREE.SRGBColorSpace);
  glowEl.style.setProperty('--g', `${rgb.r * 255 | 0} ${rgb.g * 255 | 0} ${rgb.b * 255 | 0}`);

  // Texte
  beats.forEach(({ el, i: n }) => {
    const iA = n === 0 ? 1 : smooth(seg(c, n - .32, n - .04));
    const oA = n === STEPS ? 0 : smooth(seg(c, n + .04, n + .26));
    const a = iA * (1 - oA), on = a > .002;
    el.style.visibility = on ? 'visible' : 'hidden';
    if (el.inert !== !(a > .5)) el.inert = !(a > .5);
    if (on) { el.style.opacity = a; el.style.transform = `translateY(${((1 - iA) * 34 - oA * 34).toFixed(1)}px)`; }
  });
  hint.style.opacity = (1 - seg(c, 0, .05)) * seg(intro, .5, 1);
  const lab = seg(c, 3.62, 3.95);
  areaLabels.style.opacity = lab;
  areaLabels.style.visibility = lab > .002 ? 'visible' : 'hidden';

  net.tags(tags, camera, stage, tagAlpha);
};

const fonts = document.fonts ? Promise.race([document.fonts.load('800 170px Archivo'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fonts.then(() => {
  net = createNetwork(root);
  net.layout(port);
  stage.start();
  requestAnimationFrame(() => canvas.classList.add('on'));
  if (location.hash === '#produkte') anchors.get('produkte')();
});

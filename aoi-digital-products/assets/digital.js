// AOI Digital Products: die Vermittlung als 3D-Geschichte.
// Halte: 0 Frage → 1 Alles von Büro bis Gaming → 2 Netzwerk PC + Lizenz → NetSource → du
//        3 Privat und geschäftlich → 4 Bereich AOI NetSource mit Link zum Katalog
import { THREE, ACCENT, SIGNAL, createStage, hasWebGL, buildAlltag, buildBuero, buildGaming, buildLicense, buildCore, buildHouse, buildOffice, contactShadow, floorSpot, glow, M, seg, smooth, outBack, mix, damp } from './aoi3d.js';
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
let core, house, office, client;

// Beschriftung für den Glaswürfel
function coreLabel() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  x.textBaseline = 'middle';
  x.font = '800 170px Archivo, Arial, sans-serif';
  const w1 = x.measureText('Net').width, w2 = x.measureText('Source').width, xs = 512 - (w1 + w2) / 2;
  x.fillStyle = '#9db1ff'; x.fillText('Net', xs, 256);
  x.fillStyle = '#ffffff'; x.fillText('Source', xs + w1, 256);
  return c;
}

/* ---------- Leitungen ---------- */
const V = (x, z) => new THREE.Vector3(x, .03, z);
const WIRES = {
  pc: new THREE.CubicBezierCurve3(V(-4.6, -1.7), V(-2.6, -1.7), V(-2.6, 0), V(-.8, 0)),
  lic: new THREE.CubicBezierCurve3(V(-4.6, 1.7), V(-2.6, 1.7), V(-2.6, 0), V(-.8, 0)),
  out: new THREE.LineCurve3(V(.8, 0), V(3.5, 0)),
  home: new THREE.CubicBezierCurve3(V(3.5, 0), V(4.6, 0), V(4.6, -1.7), V(6, -1.7)),
  biz: new THREE.CubicBezierCurve3(V(3.5, 0), V(4.6, 0), V(4.6, 1.7), V(6, 1.7)),
};
function wire(curve, mat, r = .024) {
  const geo = new THREE.TubeGeometry(curve, 60, r, 8, false);
  const m = new THREE.Mesh(geo, mat); root.add(m);
  m.userData.count = geo.index.count; geo.setDrawRange(0, 0);
  return m;
}
const wires = { pc: wire(WIRES.pc, M.led), lic: wire(WIRES.lic, M.led), out: wire(WIRES.out, M.ledO, .03), home: wire(WIRES.home, M.ledO), biz: wire(WIRES.biz, M.ledO) };

// Lichtpunkte, die durch die Leitungen laufen
const pulses = [['pc', 0], ['pc', .33], ['pc', .66], ['lic', .16], ['lic', .5], ['lic', .83], ['out', 0], ['out', .33], ['out', .66], ['home', 0], ['home', .5], ['biz', .25], ['biz', .75]].map(([k, o]) => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), M.white));
  g.add(glow(k === 'pc' || k === 'lic' ? ACCENT : SIGNAL, .85, .8));
  root.add(g);
  return { k, o, g };
});
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
  // Halt 2 und 3 schauen von oben wie auf einen Netzwerkplan
  cams = [
    { p: [port ? 0 : 1.6, 2.2, 13 * k], t: [port ? 0 : 1.6, port ? 3.5 : 1.65, 0] },
    { p: [0, 2.4, 15.5 * k], t: [0, port ? 2.9 : 2, 0] },
    { p: [port ? -.25 : -.45, 10 * k, 13.6 * k], t: [port ? -.25 : -.45, port ? 1.1 : 1.6, port ? .3 : 0] },
    { p: [port ? 1.6 : 3.3, 9.6 * k, 13 * k], t: [port ? 1.6 : 3.3, port ? 1.2 : 1.25, port ? .3 : 0] },
    { p: [0, 2.2, 15 * k], t: [0, stage.visH(15 * k) * (port ? .2 : .2), 0] },
  ];
  Object.values(wires).forEach(w => { w.scale.x = Xs; });
  if (core) placeNetwork();
}
function placeNetwork() {
  client.position.set(Xs * 3.5, 0, 0);
  house.wrap.position.set(Xs * 6.95, 0, -1.7);
  office.wrap.position.set(Xs * 6.95, 0, 1.7);
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
// Kleine Schilder im Netzwerk, die an 3D-Punkten hängen
const tags = [...pin.querySelectorAll('.tag')].map(el => ({ el, k: el.dataset.t }));
function tagWorld(k, out) {
  if (k === 'pc') return out.set(Xs * -4.6, 2.05, -1.7);
  if (k === 'lic') return out.set(Xs * -4.6, 1.75, 1.7);
  if (k === 'du') return out.set(Xs * 3.5, .75, 0);
  if (k === 'privat') return out.set(Xs * 6.95, port ? 1.2 : 1.6, -1.7);
  return out.set(Xs * 6.95, port ? 1.8 : 2.45, 1.7);
}
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
function drawWire(k, p) { const m = wires[k]; m.visible = p > .001; m.geometry.setDrawRange(0, Math.floor(m.userData.count * p / 3) * 3); }

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
  const w1 = smooth(seg(c, 1.4, 1.9)) * netOut, w2 = smooth(seg(c, 1.72, 2)) * netOut, w3 = smooth(seg(c, 2.5, 2.94)) * netOut;
  drawWire('pc', w1); drawWire('lic', w1); drawWire('out', w2); drawWire('home', w3); drawWire('biz', w3);

  if (core) {
    const cs = outBack(seg(c, 1.46, 1.92)) * netOut;
    core.visible = cs > .004;
    core.scale.setScalar(Math.max(.001, cs));
    core.rotation.y = Math.sin(t * .35) * .05 + px * .06;
    const cl = outBack(seg(c, 1.82, 2)) * netOut;
    client.visible = cl > .004;
    client.scale.setScalar(Math.max(.001, cl));
    const hs = outBack(seg(c, 2.62, 2.96)) * netOut * (port ? .62 : .86);
    house.wrap.visible = office.wrap.visible = hs > .004;
    house.wrap.scale.setScalar(Math.max(.001, hs)); office.wrap.scale.setScalar(Math.max(.001, hs));
    house.spin.rotation.y = -.5 + px * .08; office.spin.rotation.y = -.5 + px * .08;
  }

  // Lichtpunkte laufen erst, wenn die Leitung fertig ist
  pulses.forEach(p => {
    const w = wires[p.k], shown = w.visible && w.geometry.drawRange.count >= w.userData.count * .96;
    p.g.visible = shown;
    if (!shown) return;
    const u = calm ? p.o : (now * .34 + p.o) % 1;
    WIRES[p.k].getPointAt(u, v0);
    p.g.position.set(v0.x * Xs, .06, v0.z);
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

  // Schilder
  camera.updateMatrixWorld();
  tags.forEach(({ el, k }) => {
    const a = tagAlpha(k);
    el.style.visibility = a > .01 ? 'visible' : 'hidden';
    if (a <= .01) return;
    tagWorld(k, v0).project(camera);
    el.style.opacity = a;
    el.style.transform = `translate(-50%,-100%) translate(${((v0.x + 1) / 2 * stage.w).toFixed(1)}px,${((1 - v0.y) / 2 * stage.h).toFixed(1)}px)`;
  });
};

const fonts = document.fonts ? Promise.race([document.fonts.load('800 170px Archivo'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fonts.then(() => {
  core = buildCore(coreLabel()); root.add(core);
  core.visible = false;
  // Kunde: Ring mit Punkt, wie im Schema der bisherigen Seite
  client = new THREE.Group();
  client.add(new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 14, 56).rotateX(Math.PI / 2), M.ledO));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 16), M.ledO); dot.position.y = .14; client.add(dot);
  const gl = glow(SIGNAL, 2, .35); gl.position.y = .2; client.add(gl);
  root.add(client);
  house = place(buildHouse(), [2.6, 2.4]);
  office = place(buildOffice(), [2.4, 2.4]);
  placeNetwork();
  stage.start();
  requestAnimationFrame(() => canvas.classList.add('on'));
  if (location.hash === '#produkte') anchors.get('produkte')();
});

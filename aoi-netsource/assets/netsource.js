// NetSource: die Auswahl als 3D-Bühne.
// Ablauf beim Scrollen: Start (alle drei) → Alltag → Büro → Gaming → Überblick → Netzwerk → Privat und geschäftlich.
// Jeder Wechsel läuft in fester Reihenfolge: Lizenz zieht sich zurück, Modell tritt nach hinten,
// das nächste Modell kommt nach vorne, dann fliegt seine Lizenz heraus und der Text erscheint.
import { THREE, createStage, hasWebGL, buildAlltag, buildBuero, buildGaming, buildLicense, createNetwork, networkCams, contactShadow, floorSpot, clamp, seg, smooth, outBack, mix, damp } from './aoi3d.js';
import { pinnedStage, anchors, calm } from './site.js';

const html = document.documentElement;
const stageEl = document.getElementById('produkte');
const pin = stageEl.querySelector('.pin');
const canvas = pin.querySelector('.gl');

if (!hasWebGL() || location.search.includes('static')) {
  html.classList.add('static');
  throw 0;
}

const STEPS = 6;
const flow = pinnedStage(stageEl, STEPS);
const stage = createStage(canvas);
const { scene, camera, root } = stage;

const TINT = { start: new THREE.Color('#7d97ff'), alltag: new THREE.Color('#b9cbff'), buero: new THREE.Color('#7d97ff'), gaming: new THREE.Color('#f2994a') };
const CH = [
  { build: buildAlltag, lic: 'programm', tint: TINT.alltag, s: 1.44, yaw: -.6, L: { x: 1.72, y: 1.62, z: .5, s: .8, ry: -.34, rx: .04 } },
  { build: buildBuero, lic: 'office', tint: TINT.buero, s: 1.08, yaw: -.6, L: { x: 1.72, y: 1.72, z: .55, s: .8, ry: -.34, rx: .04 } },
  { build: buildGaming, lic: 'spiel', tint: TINT.gaming, s: 1, yaw: -.64, L: { x: -1.95, y: 1.72, z: .6, s: .88, ry: .36, rx: .05 } },
];
const items = CH.map(c => {
  const pc = c.build(), wrap = new THREE.Group(), body = new THREE.Group();
  body.add(pc); wrap.add(body);
  const shadow = contactShadow(pc.userData.w * 2.2, pc.userData.d * 2.1);
  wrap.add(shadow);
  const lic = buildLicense(c.lic);
  lic.visible = false;
  root.add(wrap); root.add(lic);
  return { ...c, pc, wrap, body, lic, hov: 0, rotors: pc.userData.rotors || [], badge: lic.userData.badge, h: pc.userData.h };
});
const pool = floorSpot(0x7d97ff, 13, .16);
root.add(pool);
let net = null;

/* ---------- Text-Elemente ---------- */
const chaps = [...pin.querySelectorAll('.chap')].map(el => ({ el, l: el.querySelector('.chap-l'), r: el.querySelector('.chap-r') }));
const wordsBox = pin.querySelector('.words');
const words = chaps.map(({ el }) => {
  const w = document.createElement('div'); w.className = 'word';
  const letters = [...el.querySelector('h2').textContent].map(ch => { const i = document.createElement('i'); i.textContent = ch; w.append(i); return i; });
  wordsBox.append(w);
  return { w, letters };
});
const hero = pin.querySelector('.hero-copy'), hint = pin.querySelector('.hint');
const over = pin.querySelector('.over'), overCols = [...over.querySelectorAll('.over-col')];
const segEl = pin.querySelector('.seg'), segLinks = [...segEl.querySelectorAll('a')], thumb = segEl.querySelector('.thumb');
const glowEl = pin.querySelector('.glow');
const beats = [...pin.querySelectorAll('.beat')].map(el => ({ el, i: +el.dataset.i }));
const tags = [...pin.querySelectorAll('.tag')].map(el => ({ el, k: el.dataset.t }));

function show(el, a, y = 0, s) {
  const on = a > .002;
  el.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  el.style.opacity = a;
  el.style.transform = `translateY(${y.toFixed(1)}px)` + (s ? ` scale(${s.toFixed(3)})` : '');
}
const setInert = (el, on) => { if (el.inert !== !on) el.inert = !on; };

/* ---------- Layout je nach Fenster ---------- */
let L = {};
function layout() {
  const a = stage.aspect, port = a < .8;
  const k = port ? clamp(.66 / a, 1, 1.75) : clamp(1.5 / a, 1, 1.28);
  const dChap = 10.8 * k, dRow = 15.5 * (port ? clamp(.8 / a, 1, 1.5) : 1);
  const visW = stage.visH(dRow) * a;
  const gap = visW / 3 * (port ? .98 : 1);
  L = {
    port, dChap, dRow, gap,
    rowS: port ? gap / 1.95 : Math.min(1.14, gap / 2.8),
    rowX: port ? [-1.06, -.08, .8] : [-1, 0, 1],
    floorChap: port ? .135 : .295, floorHero: port ? .3 : .36, floorOver: port ? .19 : .185,
    lic: port ? .78 : 1, licX: port ? .56 : 1,
    Xs: port ? .46 : 1, netCam: networkCams(stage),
  };
  glowEl.style.setProperty('--gy', port ? '48%' : '60%');
  net && net.layout(port);
}
stage.onResize = layout; layout();

/* ---------- Eingaben ---------- */
let px = 0, py = 0, tx = 0, ty = 0, drag = false, dragX = 0, dragYaw = 0, hovered = -1;
addEventListener('pointermove', e => {
  tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1;
  if (drag) { dragYaw += (e.clientX - dragX) * .0085; dragX = e.clientX; }
}, { passive: true });
pin.addEventListener('pointerdown', e => {
  if (e.target.closest('a,button')) return;
  drag = true; dragX = e.clientX; pin.classList.add('drag');
});
const endDrag = () => { if (drag) { drag = false; dragYaw = ((dragYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; } };
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);

overCols.forEach((c, i) => {
  c.addEventListener('pointerenter', () => { hovered = i; });
  c.addEventListener('pointerleave', () => { if (hovered === i) hovered = -1; });
  c.addEventListener('focus', () => { hovered = i; });
  c.addEventListener('blur', () => { if (hovered === i) hovered = -1; });
});
anchors.set('produkte', () => flow.goto(1));
['alltag', 'buero', 'gaming'].forEach((id, i) => anchors.set(id, () => flow.goto(i + 1)));

/* ---------- Ein Bild berechnen ---------- */
let c = flow.progress() * STEPS, intro = 0, segX = 0, segW = 60, first = true;
const col = new THREE.Color(), tmp = new THREE.Color(), rgb = {};
const target = new THREE.Vector3(), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();

// Wechsel-Stelle: das Modell bewegt sich nur im mittleren Teil des Scrollwegs
function ringPos(v) { const i = Math.floor(v), f = v - i; return i + smooth(seg(f, .17, .83)); }
// Erst tritt das alte Modell ins Dunkel zurück, dann kommt das neue nach vorne
function chapterD(n, v) {
  const i = Math.floor(v), f = v - i;
  if (n < i) return -1;
  if (n > i + 1) return 1;
  return n === i ? -smooth(seg(f, .08, .6)) : 1 - smooth(seg(f, .3, .88));
}
function tagAlpha(k) {
  if (k === 'pc' || k === 'lic') return seg(c, 4.55, 4.9) * (1 - seg(c, 5.14, 5.4));
  if (k === 'du') return seg(c, 4.82, 5);
  return seg(c, 5.72, 5.96);
}

stage.tick = (dt, now) => {
  const t = calm ? 0 : now;
  if (calm) intro = 1;
  const goal = flow.progress() * STEPS;
  c = first ? goal : damp(c, goal, 8.5, dt); first = false;
  if (Math.abs(c - goal) < .0004) c = goal;
  intro = Math.min(1, intro + dt / 1.5);
  const eIntro = 1 - Math.pow(1 - intro, 4);
  px = damp(px, tx, 3, dt); py = damp(py, ty, 3, dt);
  if (!drag) dragYaw = damp(dragYaw, 0, 2.4, dt);

  const rc = Math.min(4, ringPos(c));
  const wStart = 1 - smooth(seg(c, .1, .84));
  const wEnd = smooth(seg(c, 3.16, 3.86));
  const w = Math.max(wStart, wEnd);
  const toNet = smooth(seg(c, 4.06, 4.82)), along = smooth(seg(c, 5.1, 5.9));

  // Kamera
  const dRow = L.dRow, dist = mix(L.dChap, dRow, w) + (1 - eIntro) * 2.2;
  const floor = wEnd > 0 ? mix(L.floorChap, L.floorOver, wEnd) : mix(L.floorChap, L.floorHero, wStart);
  const lookY = floor * stage.visH(dist);
  camera.position.set(px * .22, lookY + mix(.72, 1.05, w) - py * .1, dist);
  target.set(px * .03, lookY, 0);
  // Vom Überblick hoch auf den Netzwerkplan
  if (toNet > 0) {
    const [A, B] = L.netCam;
    v0.set(...A.p).lerp(v1.set(...B.p), along);
    v0.x += px * .3; v0.y -= py * .12;
    camera.position.lerp(v0, toNet);
    v0.set(...A.t).lerp(v1.set(...B.t), along);
    target.lerp(v0, toNet);
  }
  camera.lookAt(target);
  const dNet = camera.position.distanceTo(target);
  scene.fog.near = mix(dist + 1.2, dNet + 7, toNet); scene.fog.far = mix(dist + 6.4, dNet + 18, toNet);

  // Modelle
  const nodeX = L.Xs * -4.6;
  items.forEach((it, i) => {
    const raw = chapterD(i + 1, c), d = raw, a = d * 1.9;
    const ringX = Math.sin(a) * 3.1 * (L.port ? .62 : 1), ringZ = (Math.cos(a) - 1) * 5;
    const rowX = L.rowX[i] * L.gap;
    it.hov = damp(it.hov, hovered === i && wEnd > .9 && c < 4.1 ? 1 : 0, 7, dt);
    const rowZ = L.port ? (i === 1 ? -.9 : .15) : 0;
    let x = mix(ringX, rowX, w), z = mix(ringZ, rowZ, w) + it.hov * 1.1;
    let s = mix(it.s * (L.port ? .96 : 1), L.rowS * (i === 0 ? 1.1 : 1), w) * (.95 + .05 * eIntro) * (1 + it.hov * .03);
    const drift = Math.sin(t * .42 + i) * .035;
    let yaw = mix(it.yaw + d * .72 + drift, -.5 + (i - 1) * -.14 + Math.sin(t * .34 + i * 1.7) * .05, w);
    // Zum Netzwerk: Der Büro-PC wird zum Knoten, die anderen beiden gehen weg
    if (toNet > 0) {
      if (i === 1) { x = mix(x, nodeX, toNet); z = mix(z, -1.7, toNet); s = mix(s, L.port ? .56 : .72, toNet); yaw = mix(yaw, -.45, toNet); }
      else { x = mix(x, i === 0 ? nodeX : 9, toNet); z = mix(z, i === 0 ? -1.7 : -4, toNet); s *= 1 - toNet; }
    }
    const active = 1 - Math.min(1, Math.abs(raw));
    const shown = (w > .001 || Math.abs(raw) < .995) && s > .004;
    it.wrap.visible = shown;
    it.wrap.position.set(x, 0, z);
    it.wrap.scale.setScalar(Math.max(.001, s));
    it.body.rotation.y = yaw + active * (1 - w) * (dragYaw + px * .14);
    if (!calm) it.rotors.forEach((ro, n) => { if (shown) ro.rotation.z -= dt * (n % 2 ? 7.5 : 9); });

    // Lizenz: kommt nach dem PC und geht vor ihm
    const n = i + 1;
    const lIn = seg(c, n - .36, n - .05), lOut = seg(c, n + .05, n + .25);
    const chapV = outBack(lIn) * (1 - smooth(lOut)) * (1 - wEnd);
    const rowV = smooth(seg(c, 3.5, 3.95));
    const v = Math.max(chapV, rowV);
    it.lic.visible = v > .004 && (i === 1 || toNet < .995);
    if (it.lic.visible) {
      const o = it.L, lk = L.lic, bob = Math.sin(t * .9 + i * 2) * .045;
      const cx = o.x * L.licX * lk, cy = (L.port ? o.y * .92 + .85 : o.y) + bob, cz = o.z + (L.port ? .8 : 0);
      // Im Überblick schwebt die Lizenz oben neben dem PC, beim Gaming-PC unten vor dem Glas
      const rowLx = x + (i === 2 ? -.62 : 1.02) * L.rowS, rowLy = (i === 2 ? it.h * .3 : it.h * .84) * s + bob * .6, rowLz = z + L.rowS * (i === 2 ? 1.6 : 1.3);
      const inv = clamp(chapV), rw = rowV > chapV ? 1 : 0;
      let lx = rw ? rowLx : x + cx * inv;
      let ly = rw ? mix(it.h * s * .5, rowLy, rowV) : mix(it.h * s * .5, cy, inv);
      let lz = rw ? rowLz : z + cz * inv;
      let ls = rw ? L.rowS * .46 * rowV : o.s * lk * Math.max(.001, chapV), lry = rw ? -.22 : o.ry;
      if (toNet > 0) {
        if (i === 1) { lx = mix(lx, nodeX, toNet); ly = mix(ly, .95 + bob, toNet); lz = mix(lz, 1.7, toNet); ls = mix(ls, L.port ? .62 : .85, toNet); lry = mix(lry, .4, toNet); }
        else ls *= 1 - toNet;
      }
      it.lic.position.set(lx, ly, lz);
      it.lic.scale.setScalar(Math.max(.001, ls));
      it.lic.rotation.set(o.rx, lry + Math.sin(t * .55 + i) * .05 + active * px * .1, Math.sin(t * .7 + i) * .012);
      const b = seg(rw ? rowV : lIn, .62, 1);
      it.badge.scale.setScalar(Math.max(.001, outBack(b)));
    }
  });

  // Netzwerk: Leitungen zeichnen sich beim Scrollen
  net.update({
    now, t, calm, px,
    w1: smooth(seg(c, 4.4, 4.9)), w2: smooth(seg(c, 4.72, 5)), w3: smooth(seg(c, 5.5, 5.94)),
    coreS: outBack(seg(c, 4.46, 4.92)), clientS: outBack(seg(c, 4.82, 5)), houseS: outBack(seg(c, 5.62, 5.96)),
  });

  // Farbe
  const seq = [TINT.start, TINT.alltag, TINT.buero, TINT.gaming, TINT.start];
  const ci = Math.min(3, Math.floor(rc)); col.copy(seq[ci]).lerp(tmp.copy(seq[ci + 1]), rc - ci);
  col.lerp(TINT.gaming, smooth(seg(c, 4.9, 5.5)) * .55);
  stage.rimA.color.copy(col); stage.rimB.color.copy(col);
  pool.material.color.copy(col);
  pool.position.set(mix(0, L.Xs * 2.8, seg(c, 5, 6)), 0, -.6);
  col.getRGB(rgb, THREE.SRGBColorSpace);
  glowEl.style.setProperty('--g', `${rgb.r * 255 | 0} ${rgb.g * 255 | 0} ${rgb.b * 255 | 0}`);

  // Texte
  show(hero, 1 - seg(c, .03, .3), -seg(c, 0, .3) * 90, 1 - seg(c, 0, .3) * .05);
  show(hint, (1 - seg(c, 0, .05)) * seg(intro, .5, 1));
  chaps.forEach((ch, i) => {
    const n = i + 1, iA = smooth(seg(c, n - .26, n - .02)), oA = smooth(seg(c, n + .02, n + .2));
    const a = iA * (1 - oA);
    ch.el.style.visibility = a > .002 ? 'visible' : 'hidden';
    setInert(ch.el, a > .5);
    show(ch.l, a, (1 - iA) * 30 - oA * 20);
    show(ch.r, a, (1 - seg(iA, .15, 1)) * 30 - oA * 20);

    const wd = words[i], N = wd.letters.length, wI = seg(c, n - .3, n - .03), wO = seg(c, n + .02, n + .2);
    const vis = wI > 0 && wO < 1;
    wd.w.style.visibility = vis ? 'visible' : 'hidden';
    if (vis) wd.letters.forEach((el, j) => {
      const st = .55 / N, tI = smooth(clamp((wI - j * st) / .45)), tO = smooth(clamp((wO - j * st * .6) / .6));
      el.style.transform = `translateY(${((1 - tI) * 108 - tO * 108).toFixed(2)}%)`;
    });
  });
  const oV = seg(c, 3.56, 3.94) * (1 - seg(c, 4.03, 4.22));
  show(over, oV);
  setInert(over, oV > .5);
  over.querySelector('.over-head').style.transform = `translateY(${(1 - oV) * 24}px)`;
  beats.forEach(({ el, i: n }) => {
    const iA = smooth(seg(c, n - .32, n - .04)), oA = n === STEPS ? 0 : smooth(seg(c, n + .04, n + .26));
    const a = iA * (1 - oA);
    show(el, a, (1 - iA) * 34 - oA * 34);
    setInert(el, a > .5);
  });
  net.tags(tags, camera, stage, tagAlpha);

  // Umschalter
  const sV = seg(c, .55, .86) * (1 - seg(c, 3.2, 3.5));
  segEl.style.visibility = sV > .002 ? 'visible' : 'hidden';
  segEl.style.opacity = sV;
  const si = clamp(rc - 1, 0, 2), a0 = Math.floor(si), a1 = Math.min(2, a0 + 1), f = si - a0;
  const l0 = segLinks[a0], l1 = segLinks[a1];
  segX = mix(l0.offsetLeft, l1.offsetLeft, f); segW = mix(l0.offsetWidth, l1.offsetWidth, f);
  thumb.style.transform = `translateX(${segX.toFixed(1)}px)`; thumb.style.width = segW.toFixed(1) + 'px';
  const cur = Math.round(si);
  segLinks.forEach((a, i) => { const on = i === cur; if (a.classList.contains('on') !== on) { a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); } });
  setInert(segEl, sV > .5);

  // Griff-Zeiger nur, wenn ein Modell vorne steht
  pin.style.cursor = drag ? 'grabbing' : (w < .05 ? 'grab' : '');
};

const fonts = document.fonts ? Promise.race([document.fonts.load('800 170px Archivo'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fonts.then(() => {
  net = createNetwork(root);
  net.layout(L.port);
  stage.start();
  requestAnimationFrame(() => canvas.classList.add('on'));
  // Direktlink wie #gaming: zum passenden Kapitel laufen
  const id = location.hash.slice(1);
  if (anchors.has(id)) anchors.get(id)();
});

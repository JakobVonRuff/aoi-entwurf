// AOI: die beweglichen 3D-Module. Sie liegen im normalen Seitenfluss, nichts bleibt beim Scrollen hängen.
// Scrollen treibt die Animation an (Zusammenbau, Auffächern, Drehen), Ziehen bewegt das Modell mit Schwung.
import { THREE, ACCENT, SIGNAL, buildBolts, buildBuero, buildLicense, createNetwork, networkCams, contactShadow, floorSpot, assemble, clamp, seg, smooth, outBack, mix, damp } from './aoi3d.js';
import { calm } from './site.js';

const BLUE = new THREE.Color(ACCENT), ORANGE = new THREE.Color(SIGNAL);
const TAU = Math.PI * 2;

// Feder mit leichtem Überschwingen, macht Bewegungen organisch
const spring = (s, target, k, d, dt) => { s.v += (target - s.x) * k * dt; s.v *= Math.exp(-d * dt); s.x += s.v * dt; };
const easeIn = t => 1 - Math.pow(1 - t, 3);

function setGlow(el, col) {
  const rgb = {}; col.getRGB(rgb, THREE.SRGBColorSpace);
  el.style.setProperty('--g', `${rgb.r * 255 | 0} ${rgb.g * 255 | 0} ${rgb.b * 255 | 0}`);
}
function makeWord(box, text) {
  const w = document.createElement('div'); w.className = 'word';
  const letters = [...text].map(ch => { const s = document.createElement('i'); s.textContent = ch; w.append(s); return s; });
  box.append(w);
  let last = -1;
  return (p, y) => {
    w.style.transform = `translateY(${y.toFixed(1)}px)`;
    if (Math.abs(p - last) < .001) return;
    last = p;
    const st = .55 / letters.length;
    letters.forEach((s, j) => { s.style.transform = `translateY(${((1 - smooth(clamp((p - j * st) / .45))) * 108).toFixed(2)}%)`; });
  };
}
function mount(root, model, withShadow = true) {
  const wrap = new THREE.Group(), body = new THREE.Group();
  body.add(model); wrap.add(body);
  if (withShadow) wrap.add(contactShadow(model.userData.w * 2.2, model.userData.d * 2.1));
  root.add(wrap);
  return { model, wrap, body, h: model.userData.h, rotors: model.userData.rotors || [] };
}
// Drehen mit Schwung: Beim Loslassen läuft der PC aus und findet dann zurück in seine Grundstellung
function spinState() { return { yaw: 0, vel: 0, held: false, idle: 0 }; }
function spinStep(s, dt) {
  if (s.held) return;
  s.yaw += s.vel * dt; s.vel *= Math.exp(-2.1 * dt); s.idle += dt;
  if (Math.abs(s.vel) < .35 && s.idle > .7) s.yaw = damp(s.yaw, Math.round(s.yaw / TAU) * TAU, 1.9, dt);
}
function lightGaming(studio, o, x, z, s, k = 1) {
  const u = o.model.userData;
  if (!u.lightA) return;
  studio.pa.position.set(x + u.lightA[0] * s, u.lightA[1] * s, z + u.lightA[2] * s); studio.pa.intensity = 5 * k * (u.lightK || 1);
  studio.pb.position.set(x + u.lightB[0] * s, u.lightB[1] * s, z + u.lightB[2] * s); studio.pb.intensity = 1.6 * k * (u.lightK || 1);
}

/* ---------- Modul mit einem oder mehreren PCs auf einem Drehkranz ----------
   Mitte ziehen dreht den PC, Seiten ziehen dreht den Kranz, ein Tipp auf einen seitlichen PC holt ihn nach vorne. */
const catLayout = v => {
  const a = v.aspect, port = a < .8, k = port ? clamp(.72 / a, 1, 1.6) : clamp(1.5 / a, 1, 1.28);
  const dist = 10.8 * k, lookY = (port ? .2 : .295) * v.visH(dist);
  return { port, dist, lookY, camY: lookY + .72, camX: 0, x0: 0, z0: 0, k: port ? .96 : 1, Rx: port ? 1.7 : 4.7, Rz: port ? 3 : 3.3, center: port ? .34 : .2, licX: port ? .56 : 1, licK: port ? .78 : 1, licY: port ? .85 : 0, licZ: port ? .8 : 0 };
};

export function ringModule(studio, section, { build, lic: licKind, tiers = [1, 2, 3], scale = 1, licPose, tint = BLUE, word, layout = catLayout, intro = false, assembleOnEnter = true, labelAll = true }) {
  const stageEl = section.matches('.mod') ? section : section.querySelector('.mod');
  const canvas = stageEl.querySelector('canvas');
  const N = tiers.length;
  const cards = [...section.querySelectorAll('.pc-card')];
  const tabs = [...section.querySelectorAll('.spin-tabs button')], thumb = section.querySelector('.spin-tabs .thumb');
  const setWord = word ? makeWord(stageEl.querySelector('.words'), word) : null;
  let L = {};
  const v = studio.view(canvas, { el: stageEl, tick, onResize: () => { L = layout(v); }, mirror: on => { pcs.forEach((o, i) => { if (i !== frontIdx) o.wrap.visible = !on; }); } });

  const pcs = tiers.map(t => {
    const o = mount(v.root, build(t));
    o.k = N > 1 ? [.9, 1, 1.08][t - 1] : 1;
    if (N > 1) { o.bolts = buildBolts(t); v.root.add(o.bolts); }
    return o;
  });
  const lic = buildLicense(licKind); lic.visible = false; v.root.add(lic);
  const pool = floorSpot(tint.getHex(), 13, .16); pool.position.z = -.6; v.root.add(pool);

  let frontIdx = 0, c = null, target = 0, rot = { x: 0, v: 0 }, licS = { x: 0, v: 0 }, drag = null, t0 = null, thumbX = -1;
  const spin = spinState(), col = new THREE.Color(), tmp = new THREE.Color();
  const mod = n => ((n % N) + N) % N;

  function tick(dt, now) {
    const t = calm ? 0 : now;
    c = c === null ? v.p : damp(c, v.p, 7.5, dt);
    if (t0 === null) t0 = now;
    // Hereinkommen: beim Start nach der Zeit, sonst nach dem Scrollweg
    const e = intro ? (calm ? 1 : easeIn(clamp((now - t0) / 1.5))) : smooth(seg(c, .05, .38));
    const out = seg(c, intro ? .5 : .66, 1);
    const built = intro ? 1 : seg(c, .03, .34);

    if (!drag || drag.mode !== 'ring') spring(rot, target, 75, 11.5, dt);
    const r = rot.x;
    frontIdx = mod(Math.round(r));
    spinStep(spin, dt);

    pcs.forEach((o, i) => {
      const d = N > 1 ? mod(i - r + N / 2) - N / 2 : 0, a = d * TAU / N, ck = Math.cos(a);
      // Die Seiten fächern sich erst auf, wenn der vordere PC schon steht
      const fan = smooth(seg(e, .3, 1));
      const x = L.x0 + Math.sin(a) * L.Rx * fan;
      const z = L.z0 + (ck - 1) * L.Rz * fan - (1 - e) * 5 - out * 1.2;
      const s = scale * L.k * o.k * mix(.86, 1, clamp((ck + .5) / 1.5)) * (.94 + .06 * e);
      const isFront = i === frontIdx;
      if (assembleOnEnter) assemble(o.model, isFront ? built : seg(built, .55, 1));
      o.x = x; o.z = z; o.s = s;
      o.wrap.position.set(x, 0, z);
      o.wrap.scale.setScalar(Math.max(.001, s));
      o.body.rotation.y = -.58 + a * .62 + (isFront ? spin.yaw : 0) + (c - .5) * .95 + (1 - e) * -.7 + out * .4 + Math.sin(t * .42 + i) * .035 + studio.px * .1;
      if (!calm) { const sp = isFront ? 1 : .35; o.rotors.forEach((ro, m) => { ro.rotation.z -= dt * (m % 2 ? 7.5 : 9) * sp; }); }
      if (o.bolts) {
        const pop = outBack(seg(e, .55, 1)) * mix(.62, 1, clamp((ck + .5) / 1.5));
        o.bolts.position.set(x, o.h * s + .52 * s, z);
        o.bolts.scale.setScalar(Math.max(.001, pop * (isFront ? 1 : .86)));
        o.bolts.userData.items.forEach((b, n) => {
          b.position.y = Math.sin(t * 1.5 + n * .9 + i) * .05;
          b.rotation.y = Math.sin(t * .8 + n) * .5 + (i === frontIdx ? -rot.v * .2 : 0);
        });
      }
    });
    const f = pcs[frontIdx];
    lightGaming(studio, f, f.x, f.z, f.s, clamp(1 - Math.abs(r - Math.round(r)) * 1.4));

    // Lizenz: fliegt aus dem PC heraus, wenn er steht, und zieht sich vor jedem Wechsel zurück
    const settled = N > 1 ? clamp(1 - Math.abs(r - Math.round(r)) * 5) > .5 : true;
    spring(licS, settled && built > .92 ? 1 : 0, 130, 13, dt);
    const lv = Math.max(0, licS.x);
    lic.visible = lv > .01;
    if (lic.visible && licPose) {
      const o = licPose, bob = Math.sin(t * .9 + 2) * .045, midY = f.h * f.s * .5, q = clamp(lv);
      lic.position.set(mix(f.x, f.x + o.x * L.licX * L.licK, q), mix(midY, (L.port ? o.y * .92 + L.licY : o.y) + bob, q), mix(f.z, f.z + o.z + L.licZ, q));
      lic.scale.setScalar(Math.max(.001, o.s * L.licK * lv));
      lic.rotation.set(.04, o.ry + Math.sin(t * .55) * .05 + studio.px * .1 - rot.v * .3, Math.sin(t * .7) * .012 + rot.v * .05);
      lic.userData.badge.scale.setScalar(Math.max(.001, outBack(seg(lv, .62, 1))));
    }

    // Kamera fährt beim Scrollen ganz leicht mit, Glanzlichter wandern über das Metall
    const dist = L.dist * (1 + (.5 - c) * .12) + (intro ? (1 - e) * 2.2 : 0);
    v.camera.position.set(L.camX + studio.px * .22, L.camY - studio.py * .1 + (.5 - c) * .5, dist);
    v.camera.lookAt(L.camX + studio.px * .03, L.lookY, 0);
    const rimTier = N > 1 ? clamp(1 - Math.abs(mod(r - 2 + N / 2) - N / 2)) : 0;
    col.copy(tint).lerp(tmp.copy(ORANGE), rimTier * .6);
    studio.rimA.color.copy(col); studio.rimB.color.copy(col);
    studio.key.position.set(-4 + (c - .5) * 9 + studio.px * 2, 7, 7);
    studio.scene.fog.near = dist + 1.2; studio.scene.fog.far = dist + 8.2;
    pool.material.color.copy(col); pool.position.x = L.x0;
    setGlow(stageEl, col);

    // Texte und Stufen-Knöpfe
    if (setWord) setWord(seg(c, .12, .4), (c - .5) * -70);
    cards.forEach((card, i) => {
      const d = N > 1 ? Math.abs(mod(i - r + N / 2) - N / 2) : 0, a = clamp(1 - d * 2.6);
      card.style.opacity = a.toFixed(3);
      card.style.transform = `translateY(${((1 - a) * (mod(i - r + N / 2) - N / 2 > 0 ? 14 : -14)).toFixed(1)}px)`;
      const on = i === frontIdx;
      if (card.classList.contains('front') !== on) { card.classList.toggle('front', on); card.setAttribute('aria-hidden', on ? 'false' : 'true'); }
    });
    if (tabs.length && frontIdx !== tabs.cur) {
      tabs.cur = mod(Math.round(target));
      tabs.forEach((b, i) => b.setAttribute('aria-selected', i === tabs.cur ? 'true' : 'false'));
    }
    if (thumb) {
      const si = Math.round(target), base = mod(Math.floor(r)), nxt = mod(base + 1), fr = r - Math.floor(r);
      const x0 = tabs[base].offsetLeft, x1 = tabs[nxt].offsetLeft, w0 = tabs[base].offsetWidth, w1 = tabs[nxt].offsetWidth;
      // Beim Sprung von der letzten zur ersten Stufe läuft der Daumen außen herum nicht, sondern wechselt direkt
      const wrap = Math.abs(x1 - x0) > w0 * 1.6, cur = wrap ? (fr < .5 ? 0 : 1) : fr;
      const tx = mix(x0, x1, cur), tw = mix(w0, w1, cur);
      if (Math.abs(tx - thumbX) > .05) { thumb.style.transform = `translateX(${tx.toFixed(1)}px)`; thumb.style.width = tw.toFixed(1) + 'px'; thumbX = tx; }
    }
    canvas.style.cursor = drag && drag.moved ? 'grabbing' : 'grab';
  }

  /* ---------- Ziehen ---------- */
  const to = i => { const base = Math.round(target); let d = mod(i - base); if (d > N / 2) d -= N; target = base + d; };
  tabs.forEach((b, i) => b.addEventListener('click', () => to(i)));
  section.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { target = Math.round(target) + +b.dataset.step; }));
  canvas.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' && N > 1) { target = Math.round(target) + 1; e.preventDefault(); }
    if (e.key === 'ArrowLeft' && N > 1) { target = Math.round(target) - 1; e.preventDefault(); }
  });
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const b = canvas.getBoundingClientRect(), fx = (e.clientX - b.left) / b.width;
    const mode = N === 1 || Math.abs(fx - .5) < L.center ? 'spin' : 'ring';
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now(), r0: rot.x, v: 0, moved: false, mode, side: fx < .5 ? -1 : 1 };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y) > 10 && Math.abs(dx) < 10) { drag = null; return; }
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      if (drag.mode === 'spin') { spin.held = true; spin.idle = 0; }
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Zeiger schon weg */ }
    }
    const now = performance.now(), mdt = Math.max((now - drag.t) / 1000, .008), step = e.clientX - drag.lx;
    drag.lx = e.clientX; drag.t = now;
    if (drag.mode === 'spin') { spin.yaw += step * .011; spin.vel = mix(spin.vel, step * .011 / mdt, .4); }
    else { const w = canvas.clientWidth * .42; rot.x = drag.r0 - dx / w; rot.v = 0; drag.v = mix(drag.v, -step / w / mdt, .4); }
  });
  const end = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (d.mode === 'spin') { spin.held = false; spin.idle = 0; return; }
    if (d.moved) { target = Math.round(rot.x + clamp(d.v * .16, -.7, .7)); rot.v = d.v * .5; }
    else target = Math.round(target) + d.side;
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  return v;
}

/* ---------- Reihe aus drei PCs: Maus holt den PC nach vorne, ziehen dreht ihn, Klick führt zum Bereich ---------- */
export function rowModule(studio, el, { models, licKinds, links, intro = false, floor = [.36, .3], far = 1, showLic = false, tint = BLUE }) {
  const canvas = el.querySelector('canvas');
  const items = [];
  let L = {};
  const onResize = () => {
    const a = v.aspect, port = a < .8, dRow = 15.5 * far * (port ? clamp(.8 / a, 1, 1.5) : a < 1.25 ? 1.25 / a : 1);
    const gap = v.visH(dRow) * a / 3 * (port ? .98 : 1);
    L = { port, dRow, gap, rowS: port ? gap / 1.95 : Math.min(1.14, gap / 2.8), rowX: port ? [-1.06, -.08, .8] : [-1, 0, 1], lookY: (port ? floor[1] : floor[0]) * v.visH(dRow) };
  };
  const v = studio.view(canvas, { el, tick, onResize, mirror: () => {} });
  models.forEach((m, i) => {
    const o = mount(v.root, m); o.hov = { x: 0, v: 0 }; o.spin = spinState(); o.licS = { x: 0, v: 0 };
    o.lic = buildLicense(licKinds[i]); o.lic.visible = false; v.root.add(o.lic);
    items.push(o);
  });
  const pool = floorSpot(tint.getHex(), 15, .15); pool.position.z = -.6; v.root.add(pool);
  let c = null, hovered = -1, drag = null, t0 = null;

  function tick(dt, now) {
    const t = calm ? 0 : now;
    c = c === null ? v.p : damp(c, v.p, 7.5, dt);
    if (t0 === null) t0 = now;
    const clock = calm ? 1 : clamp((now - t0) / 1.9), out = seg(c, intro ? .5 : .68, 1), scrollE = seg(c, .06, .42);
    items.forEach((o, i) => {
      // Die Modelle kommen nacheinander aus dem Dunkel: von der Mitte nach außen
      const order = i === 1 ? 0 : i === 0 ? 1 : 2, st = order * .14;
      const e = smooth(seg(intro ? clock : scrollE, st, st + .62));
      const s0 = L.rowS * (i === 0 ? 1.1 : 1);
      spring(o.hov, hovered === i ? 1 : 0, 110, 14, dt);
      spinStep(o.spin, dt);
      const x = L.rowX[i] * L.gap * mix(.55, 1, e) * (1 + out * .06);
      const z = (L.port && i === 1 ? -.9 : L.port ? .15 : 0) - (1 - e) * 6 + o.hov.x * 1.2 - out * 1.6;
      const s = s0 * (1 + o.hov.x * .04);
      o.x = x; o.z = z; o.s = s;
      o.wrap.position.set(x, 0, z);
      o.wrap.scale.setScalar(Math.max(.001, s));
      o.body.rotation.y = -.5 + (i - 1) * -.14 + o.spin.yaw + (1 - e) * -1 + (c - .5) * .8 + Math.sin(t * .34 + i * 1.7) * .05 + studio.px * .1 + o.hov.x * .22;
      if (!calm) o.rotors.forEach((ro, m) => { ro.rotation.z -= dt * (m % 2 ? 7.5 : 9) * (hovered === i ? 1.5 : 1); });
      assemble(o.model, 1);

      const want = (showLic ? e > .9 : false) || hovered === i;
      spring(o.licS, want ? 1 : 0, 130, 13, dt);
      const lv = Math.max(0, o.licS.x);
      o.lic.visible = lv > .01;
      if (o.lic.visible) {
        const q = clamp(lv), bob = Math.sin(t * .9 + i * 2) * .045, mid = o.h * s * .5;
        const lx = x + (i === 2 ? -.62 : 1.02) * L.rowS, ly = (i === 2 ? o.h * .3 : o.h * .84) * s + bob * .6, lz = z + L.rowS * (i === 2 ? 1.6 : 1.3);
        o.lic.position.set(mix(x, lx, q), mix(mid, ly, q), mix(z, lz, q));
        o.lic.scale.setScalar(Math.max(.001, L.rowS * .46 * lv));
        o.lic.rotation.set(.04, -.22 + Math.sin(t * .55 + i) * .05, Math.sin(t * .7 + i) * .012);
        o.lic.userData.badge.scale.setScalar(Math.max(.001, outBack(seg(lv, .62, 1))));
      }
    });
    const g = items[2];
    if (g.model.userData.lightA) lightGaming(studio, g, g.x, g.z, g.s);

    const lift = out * 1.1 + (intro ? (1 - easeIn(clock)) * .4 : 0);
    const dist = L.dRow + (intro ? (1 - easeIn(clock)) * 2.4 : (.5 - c) * 1.2);
    v.camera.position.set(studio.px * .22, L.lookY + 1.05 + lift - studio.py * .1, dist);
    v.camera.lookAt(studio.px * .03, L.lookY + lift * .3, 0);
    studio.rimA.color.copy(tint); studio.rimB.color.copy(tint);
    studio.key.position.set(-4 + (c - .5) * 9 + studio.px * 2, 7, 7);
    studio.scene.fog.near = dist + 1.2; studio.scene.fog.far = dist + 7.4;
    setGlow(el, tint);
    canvas.style.cursor = drag && drag.moved ? 'grabbing' : hovered >= 0 ? 'pointer' : '';
  }

  const third = x => { const b = canvas.getBoundingClientRect(); return clamp(Math.floor((x - b.left) / b.width * 3), 0, 2); };
  // Der Bereich direkt über den Beschriftungen und den Knöpfen gehört der Seite, nicht dem Modell
  const onHover = e => { if (e.pointerType !== 'touch' && !drag) hovered = third(e.clientX); };
  canvas.addEventListener('pointermove', onHover);
  canvas.addEventListener('pointerleave', () => { if (!drag) hovered = -1; });
  links.forEach((a, i) => {
    a.addEventListener('pointerenter', () => { hovered = i; }); a.addEventListener('pointerleave', () => { if (hovered === i) hovered = -1; });
    a.addEventListener('focus', () => { hovered = i; }); a.addEventListener('blur', () => { if (hovered === i) hovered = -1; });
  });
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now(), i: third(e.clientX), moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y) > 10 && Math.abs(dx) < 10) { drag = null; return; }
      if (Math.abs(dx) < 6) return;
      drag.moved = true; items[drag.i].spin.held = true; items[drag.i].spin.idle = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Zeiger schon weg */ }
    }
    const o = items[drag.i].spin, now = performance.now(), mdt = Math.max((now - drag.t) / 1000, .008), step = e.clientX - drag.lx;
    drag.lx = e.clientX; drag.t = now;
    o.yaw += step * .011; o.vel = mix(o.vel, step * .011 / mdt, .4);
  });
  const end = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (d.moved) { items[d.i].spin.held = false; items[d.i].spin.idle = 0; }
    else if (e.type === 'pointerup') links[d.i].click();
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  return v;
}

/* ---------- Netzwerk als Diorama in zwei Abschnitten: Leitungen zeichnen sich beim Scrollen, ziehen schwenkt das Ganze ---------- */
export function networkModules(studio, elA, elB) {
  const holder = new THREE.Group();
  const net = createNetwork(holder);
  const pc = mount(holder, buildBuero(2));
  const lic = buildLicense('office'); holder.add(lic);
  let port = null;
  function setup(el, stage) {
    const canvas = el.querySelector('canvas');
    const tags = [...el.querySelectorAll('.tag')].map(t => ({ el: t, k: t.dataset.t }));
    const st = { c: null, cams: null, orbit: { x: 0, v: 0 }, drag: null };
    const v = studio.view(canvas, { el, tick: (dt, now) => tick(dt, now, v, stage, st, tags), onResize: () => { st.cams = networkCams(v); const isPort = v.aspect < .8; if (isPort !== port) { port = isPort; net.layout(port); } } });
    canvas.addEventListener('pointerdown', e => { if (e.button > 0) return; st.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, r0: st.orbit.x, moved: false }; });
    canvas.addEventListener('pointermove', e => {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      if (!d.moved) {
        if (Math.abs(e.clientY - d.y) > 10 && Math.abs(dx) < 10) { st.drag = null; return; }
        if (Math.abs(dx) < 6) return;
        d.moved = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Zeiger schon weg */ }
      }
      st.orbit.x = clamp(d.r0 + dx * .0032, -.62, .62); st.orbit.v = 0;
    });
    const end = e => { if (st.drag && (!e || e.pointerId === st.drag.id)) st.drag = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    return v;
  }
  function tick(dt, now, v, stage, st, tags) {
    const t = calm ? 0 : now;
    st.c = st.c === null ? v.p : damp(st.c, v.p, 7.5, dt);
    const c = st.c;
    if (holder.parent !== v.root) v.root.add(holder);
    if (!st.drag) spring(st.orbit, 0, 22, 6.5, dt);
    const isPort = v.aspect < .8, Xs = isPort ? .46 : 1, nodeX = Xs * -4.6;
    // Beide Abschnitte zeigen dasselbe Modell, nur der Stand der Leitungen ist anders
    const a = stage === 0 ? c : 1, b = stage === 1 ? c : 0;
    const node = stage === 0 ? smooth(seg(a, .06, .3)) : 1;
    net.update({
      now, t, calm, px: studio.px,
      w1: stage === 0 ? smooth(seg(a, .24, .42)) : 1, w2: stage === 0 ? smooth(seg(a, .38, .5)) : 1, w3: stage === 1 ? smooth(seg(b, .22, .46)) : 0,
      coreS: stage === 0 ? outBack(seg(a, .16, .38)) : 1, clientS: stage === 0 ? outBack(seg(a, .4, .5)) : 1, houseS: stage === 1 ? outBack(seg(b, .34, .5)) : 0,
    });
    pc.wrap.position.set(nodeX, 0, -1.7 - (1 - node) * 4);
    pc.wrap.scale.setScalar(Math.max(.001, (isPort ? .56 : .72) * mix(.8, 1, node)));
    pc.body.rotation.y = -.45 - (1 - node) * .9 + Math.sin(t * .42) * .03;
    assemble(pc.model, stage === 0 ? seg(a, .06, .3) : 1);
    const lv = stage === 0 ? outBack(seg(a, .18, .36)) : 1, bob = Math.sin(t * .9) * .05;
    lic.visible = lv > .01;
    lic.position.set(nodeX, .95 + bob, 1.7);
    lic.scale.setScalar(Math.max(.001, (isPort ? .62 : .85) * lv));
    lic.rotation.set(.04, .4 + Math.sin(t * .55) * .05, 0);
    lic.userData.badge.scale.setScalar(Math.max(.001, outBack(seg(lv, .62, 1))));

    holder.rotation.y = st.orbit.x;
    const cam = st.cams[stage], sway = (.5 - c);
    v.camera.position.set(cam.p[0] + studio.px * .3, cam.p[1] - studio.py * .12 + sway * .8, cam.p[2]);
    v.camera.lookAt(cam.t[0], cam.t[1], cam.t[2]);
    const dist = v.camera.position.distanceTo(new THREE.Vector3(...cam.t));
    studio.scene.fog.near = dist + 7; studio.scene.fog.far = dist + 18;
    const warm = stage === 1 ? .55 : .2;
    studio.rimA.color.copy(BLUE).lerp(ORANGE, warm); studio.rimB.color.copy(BLUE);
    studio.key.position.set(-4 + (c - .5) * 8 + studio.px * 2, 7, 7);
    setGlow(v.el, studio.rimA.color);
    const out = 1 - seg(c, .84, .94);
    net.tags(tags, v.camera, v, k => {
      if (k === 'pc' || k === 'lic') return stage === 0 ? seg(a, .3, .44) * out : 0;
      if (k === 'du') return (stage === 0 ? seg(a, .42, .5) : 1) * out;
      return stage === 1 ? seg(b, .38, .5) * out : 0;
    });
  }
  const views = [setup(elA, 0), setup(elB, 1)];
  views[0].root.add(holder);
  return views;
}

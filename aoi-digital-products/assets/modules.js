// AOI: bewegliche 3D-Module. Sie stehen nur dort, wo vorher ein flaches Bild war, der Rest der Seite bleibt normal.
// Ziehen dreht das Modell mit Schwung, beim Scrollen dreht es sich leicht mit.
import { THREE, ACCENT, SIGNAL, buildBolts, buildBuero, buildLicense, createNetwork, networkCam, contactShadow, floorSpot, assemble, clamp, seg, smooth, outBack, mix, damp } from './aoi3d.js';
import { calm } from './site.js';

export const BLUE = new THREE.Color(ACCENT), ORANGE = new THREE.Color(SIGNAL);
const TAU = Math.PI * 2;

// Feder mit leichtem Überschwingen, macht Bewegungen organisch
const spring = (s, target, k, d, dt) => { s.v += (target - s.x) * k * dt; s.v *= Math.exp(-d * dt); s.x += s.v * dt; };

function addCanvas(el) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  el.append(canvas);
  return canvas;
}

/* ---------- PC mit Lizenz und Blitzen, füllt eine Bildfläche ----------
   In einer Karte zeichnet nur die vordere Karte laufend, die seitlichen behalten ihr letztes Bild. */
export function artModule(studio, el, { model, licKind, bolts = 0, scale = 1, card = null, tint = BLUE, width = 4.7, height = 3.4, pcX = -.9, lic: L = { x: 1.25, y: 1.2, z: .7, s: .72, ry: -.3 } }) {
  const canvas = addCanvas(el);
  let dist = 8, lookY = 1.2, c = null, seen = 0, done = false;
  const v = studio.view(canvas, { el, tick, onResize: () => { dist = Math.max(width / (v.visH(1) * v.aspect), height / v.visH(1)); lookY = height * .32; done = false; } });

  const wrap = new THREE.Group(), body = new THREE.Group();
  body.add(model); wrap.add(body);
  wrap.add(contactShadow(model.userData.w * 2.2, model.userData.d * 2.1));
  v.root.add(wrap);
  const licObj = buildLicense(licKind); licObj.visible = false; v.root.add(licObj);
  const boltObj = bolts ? buildBolts(bolts) : null;
  if (boltObj) v.root.add(boltObj);
  const pool = floorSpot(tint.getHex(), 7, .14); pool.position.set(pcX * .4, 0, -.4); v.root.add(pool);
  const rotors = model.userData.rotors || [], u = model.userData;

  const licS = { x: 0, v: 0 }, pop = { x: 0, v: 0 };
  let yaw = 0, vel = 0, held = false, idle = 0, drag = null;

  function tick(dt, now) {
    const t = calm ? 0 : now, front = !card || card.classList.contains('front');
    c = c === null ? v.p : damp(c, v.p, 7.5, dt);
    if (v.p > .1) seen = calm ? 1 : Math.min(1, seen + dt / 1.1);
    spring(licS, front && seen > .68 ? 1 : 0, 130, 13, dt);
    spring(pop, front && seen > .5 ? 1 : 0, 110, 12, dt);
    if (!front && seen >= 1 && Math.abs(licS.x) < .004 && Math.abs(licS.v) < .01 && Math.abs(pop.x) < .004 && done) return false;
    done = true;

    // Beim ersten Erscheinen kommt das Modell einmal nach vorne und setzt sich zusammen
    const e = smooth(seen);
    assemble(model, front ? e : 1);
    if (!held) {
      yaw += vel * dt; vel *= Math.exp(-2.1 * dt); idle += dt;
      if (Math.abs(vel) < .35 && idle > .7) yaw = damp(yaw, Math.round(yaw / TAU) * TAU, 1.9, dt);
    }
    const z = -(1 - e) * 3, s = scale * (.9 + .1 * e);
    wrap.position.set(pcX, 0, z);
    wrap.scale.setScalar(s);
    body.rotation.y = -.55 + yaw + (c - .5) * .7 - (1 - e) * .8 + Math.sin(t * .42) * .04 + studio.px * .12;
    if (!calm && front) rotors.forEach((ro, m) => { ro.rotation.z -= dt * (m % 2 ? 7.5 : 9); });

    const lv = Math.max(0, licS.x);
    licObj.visible = lv > .01;
    if (licObj.visible) {
      const q = clamp(lv), bob = Math.sin(t * .9) * .04;
      licObj.position.set(mix(pcX, L.x, q), mix(u.h * s * .5, L.y + bob, q), mix(z, L.z, q));
      licObj.scale.setScalar(Math.max(.001, L.s * lv));
      licObj.rotation.set(.04, L.ry + Math.sin(t * .55) * .05 + studio.px * .1, Math.sin(t * .7) * .012);
      licObj.userData.badge.scale.setScalar(Math.max(.001, outBack(seg(lv, .62, 1))));
    }
    if (boltObj) {
      const k = Math.max(.001, Math.max(0, pop.x) * .8);
      boltObj.position.set(0, Math.min(u.h * s + .34, height * .78), 0);
      boltObj.scale.setScalar(k);
      boltObj.userData.items.forEach((b, n) => { b.position.y = Math.sin(t * 1.5 + n * .9) * .05; b.rotation.y = Math.sin(t * .8 + n) * .5; });
    }
    if (u.lightA && front) {
      studio.pa.position.set(pcX + u.lightA[0] * s, u.lightA[1] * s, z + u.lightA[2] * s); studio.pa.intensity = 5 * (u.lightK || 1);
      studio.pb.position.set(pcX + u.lightB[0] * s, u.lightB[1] * s, z + u.lightB[2] * s); studio.pb.intensity = 1.6 * (u.lightK || 1);
    }

    v.camera.position.set(studio.px * .12, lookY + .62 - studio.py * .06, dist);
    v.camera.lookAt(studio.px * .02, lookY, 0);
    studio.rimA.color.copy(tint); studio.rimB.color.copy(tint);
    studio.key.position.set(-4 + (c - .5) * 8 + studio.px * 2, 7, 7);
    studio.scene.fog.near = dist + 6; studio.scene.fog.far = dist + 16;
    canvas.style.cursor = !front ? 'pointer' : drag && drag.moved ? 'grabbing' : 'grab';
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0 || (card && !card.classList.contains('front'))) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now(), moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y) > 10 && Math.abs(dx) < 10) { drag = null; return; }
      if (Math.abs(dx) < 6) return;
      drag.moved = true; held = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Zeiger schon weg */ }
    }
    const now = performance.now(), mdt = Math.max((now - drag.t) / 1000, .008), step = e.clientX - drag.lx;
    drag.lx = e.clientX; drag.t = now;
    yaw += step * .012; vel = mix(vel, step * .012 / mdt, .4);
  });
  const end = e => { if (drag && (!e || e.pointerId === drag.id)) { drag = null; held = false; idle = 0; } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  return v;
}

/* ---------- Das Schema als 3D-Modell: PC und Lizenz laufen über die Quelle zum Kunden ---------- */
export function networkModule(studio, el) {
  const canvas = addCanvas(el);
  const tags = [...el.querySelectorAll('.tag')].map(t => ({ el: t, k: t.dataset.t }));
  let cam = null, c = null, drag = null;
  const orbit = { x: 0, v: 0 };
  const v = studio.view(canvas, { el, tick, onResize: () => { cam = networkCam(v); } });
  const net = createNetwork(v.root);
  const pc = new THREE.Group(), model = buildBuero(2);
  pc.add(model, contactShadow(model.userData.w * 2.2, model.userData.d * 2.1)); v.root.add(pc);
  const lic = buildLicense('office'); v.root.add(lic);
  const look = new THREE.Vector3();

  function tick(dt, now) {
    const t = calm ? 0 : now;
    c = c === null ? v.p : damp(c, v.p, 7.5, dt);
    if (!drag) spring(orbit, 0, 22, 6.5, dt);
    net.update({
      now, t, calm, px: studio.px,
      w1: smooth(seg(c, .16, .36)), w2: smooth(seg(c, .32, .46)),
      coreS: outBack(seg(c, .1, .3)), clientS: outBack(seg(c, .38, .48)),
    });
    pc.position.set(-4.6, 0, -1.7);
    pc.scale.setScalar(.72);
    pc.rotation.y = -.45 + Math.sin(t * .42) * .03;
    const lv = outBack(seg(c, .12, .3)), bob = Math.sin(t * .9) * .05;
    lic.visible = lv > .01;
    lic.position.set(-4.6, .95 + bob, 1.7);
    lic.scale.setScalar(Math.max(.001, .85 * lv));
    lic.rotation.set(.04, .4 + Math.sin(t * .55) * .05, 0);
    lic.userData.badge.scale.setScalar(Math.max(.001, outBack(seg(lv, .62, 1))));

    v.root.rotation.y = orbit.x;
    v.camera.position.set(cam.p[0] + studio.px * .3, cam.p[1] - studio.py * .12, cam.p[2]);
    look.set(...cam.t);
    v.camera.lookAt(look);
    const dist = v.camera.position.distanceTo(look);
    studio.scene.fog.near = dist + 7; studio.scene.fog.far = dist + 18;
    studio.rimA.color.copy(BLUE).lerp(ORANGE, .2); studio.rimB.color.copy(BLUE);
    studio.key.position.set(-4 + (c - .5) * 8 + studio.px * 2, 7, 7);
    net.tags(tags, v.camera, v, k => (k === 'du' ? seg(c, .4, .48) : seg(c, .22, .34)));
    canvas.style.cursor = drag && drag.moved ? 'grabbing' : 'grab';
  }

  canvas.addEventListener('pointerdown', e => { if (e.button === 0) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, r0: orbit.x, moved: false }; });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y) > 10 && Math.abs(dx) < 10) { drag = null; return; }
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Zeiger schon weg */ }
    }
    orbit.x = clamp(drag.r0 + dx * .0032, -.62, .62); orbit.v = 0;
  });
  const end = e => { if (drag && (!e || e.pointerId === drag.id)) drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  return v;
}

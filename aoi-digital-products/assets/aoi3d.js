// AOI 3D-Baukasten: Renderer, Studio-Licht, Spiegelboden und alle Modelle.
// Alles ist selbst aus Grundformen gebaut und folgt den Icons der bestehenden Seite.
import * as THREE from 'three';

export { THREE };
export const BG = 0x05070b, ACCENT = 0x7d97ff, SIGNAL = 0xf2994a;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (v, a, b) => clamp((v - a) / (b - a));
export const smooth = t => t * t * t * (t * (6 * t - 15) + 10);
export const outCubic = t => 1 - Math.pow(1 - t, 3);
export const outBack = t => { const c = 1.5, x = t - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
export const mix = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/* ---------- Spiegelung: zweiter Durchgang mit gespiegelter Szene, nach unten ausgeblendet ---------- */
const mirrorU = { value: 0 };
function patch(m) {
  m.onBeforeCompile = s => {
    s.uniforms.uMirror = mirrorU;
    s.vertexShader = 'varying float vWY;\n' + s.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n#ifdef USE_INSTANCING\nvWY=(modelMatrix*instanceMatrix*vec4(transformed,1.)).y;\n#else\nvWY=(modelMatrix*vec4(transformed,1.)).y;\n#endif');
    s.fragmentShader = 'varying float vWY;uniform float uMirror;\n' + s.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\nif(uMirror>.5){float f=smoothstep(-1.5,0.,vWY);gl_FragColor.rgb*=.34*f;gl_FragColor.a*=f;}');
  };
  return m;
}
const std = o => patch(new THREE.MeshStandardMaterial(o));
const phy = o => patch(new THREE.MeshPhysicalMaterial(o));
const bas = o => patch(new THREE.MeshBasicMaterial(o));

export const M = {
  alu: std({ color: 0xc2c6cd, metalness: 1, roughness: .32, envMapIntensity: 1.1 }),
  aluDark: std({ color: 0x8e949e, metalness: 1, roughness: .36 }),
  gun: std({ color: 0x626a78, metalness: .95, roughness: .4, envMapIntensity: 1.5 }),
  gunSoft: std({ color: 0x2c313a, metalness: .9, roughness: .46, envMapIntensity: 1.3 }),
  black: std({ color: 0x0c0e13, metalness: .85, roughness: .4 }),
  pcb: std({ color: 0x121821, metalness: .5, roughness: .55 }),
  rubber: std({ color: 0x050608, metalness: 0, roughness: .85 }),
  hole: bas({ color: 0x020305 }),
  blade: std({ color: 0x14181f, metalness: .4, roughness: .4 }),
  slab: phy({ color: 0x1a2336, metalness: .6, roughness: .26, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.5 }),
  white: bas({ color: 0xf2f5f8, toneMapped: false }),
  whiteDim: bas({ color: 0x77808f, toneMapped: false }),
  led: bas({ color: ACCENT, toneMapped: false }),
  ledO: bas({ color: SIGNAL, toneMapped: false }),
  orange: std({ color: SIGNAL, metalness: .15, roughness: .32, emissive: 0xa8560f, emissiveIntensity: .55 }),
  bolt: std({ color: SIGNAL, metalness: .2, roughness: .3, emissive: 0xd8701a, emissiveIntensity: 1.25 }),
  window: bas({ color: 0xc7d4ff, toneMapped: false }),
  // Glas legt nur Spiegelungen obendrauf und dunkelt das Innere nicht ab
  glass: std({ color: 0xffffff, metalness: 1, roughness: .05, transparent: true, opacity: .26, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1.6 }),
};

/* ---------- Geometrie-Helfer ---------- */
const boxCache = new Map();
export function rbox(w, h, d, r = .04, s = 3) {
  const key = [w, h, d, r, s].join();
  if (boxCache.has(key)) return boxCache.get(key);
  const n = s * 2 + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n).toNonIndexed();
  const pos = g.attributes.position, nor = g.attributes.normal, half = .5 / n;
  const rr = Math.min(w / 2, h / 2, d / 2, r), v = new THREE.Vector3();
  const bx = w / 2 - rr, by = h / 2 - rr, bz = d / 2 - rr;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const sx = Math.sign(v.x), sy = Math.sign(v.y), sz = Math.sign(v.z);
    v.set(v.x - sx * half, v.y - sy * half, v.z - sz * half).normalize();
    pos.setXYZ(i, bx * sx + v.x * rr, by * sy + v.y * rr, bz * sz + v.z * rr);
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  boxCache.set(key, g);
  return g;
}
function add(p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  p.add(m); return m;
}
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function extr(shape, depth, bevel = .015, curve = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: curve });
  g.center(); return g;
}
const disc = (r, h = .006, n = 24) => new THREE.CylinderGeometry(r, r, h, n).rotateX(Math.PI / 2);

// Lochblech als Instanzen. Zeigt in lokale +Z-Richtung.
function holes(parent, w, h, gap, r, x, y, z, ry = 0, rx = 0, circle = false) {
  const pts = [], rowH = gap * .866;
  for (let j = -Math.floor(h / 2 / rowH); j <= Math.floor(h / 2 / rowH); j++)
    for (let i = -Math.floor(w / 2 / gap); i <= Math.floor(w / 2 / gap); i++) {
      const px = (i + (j & 1 ? .5 : 0)) * gap, py = j * rowH;
      if (Math.abs(px) > w / 2) continue;
      if (circle && Math.hypot(px, py) > w / 2) continue;
      pts.push(px, py);
    }
  const im = new THREE.InstancedMesh(disc(r, .004, 8), M.hole, pts.length / 2);
  const o = new THREE.Object3D();
  for (let k = 0; k < pts.length / 2; k++) { o.position.set(pts[k * 2], pts[k * 2 + 1], 0); o.updateMatrix(); im.setMatrixAt(k, o.matrix); }
  im.position.set(x, y, z); im.rotation.set(rx, ry, 0);
  parent.add(im); return im;
}

/* ---------- Glühen ohne teuren Nachbearbeitungs-Effekt ---------- */
let glowTex;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.55)');
  g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function glow(color, size, opacity = .6, sy = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  s.scale.set(size, size * sy, 1); s.layers.set(1); return s;
}
// Liegende Flächen für Lichtpfütze und Kontaktschatten
function floorSpot(color, size, opacity, additive = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, toneMapped: false }));
  m.scale.set(size, 1, size); m.layers.set(1); return m;
}
export function contactShadow(w, d, opacity = .85) {
  const m = floorSpot(0x000000, 1, opacity, false);
  m.scale.set(w, 1, d); m.position.y = .003; return m;
}

/* ---------- Bühne ---------- */
function studioEnv(renderer) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x03040a);
  const pan = (w, h, x, y, z, i, c = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  pan(10, 2.6, 0, 8, 1, 7);               // Softbox oben
  pan(1.3, 11, -9, 1, 4, 11);             // Lichtstreifen links
  pan(1, 11, 9, 1, 3, 6, 0xc4d2ff);       // Lichtstreifen rechts, kühl
  pan(.5, 9, -3, 2, 10, 3);               // schmale Kante vorne
  pan(8, .7, 0, -1.5, 10, 1.6);           // Boden-Aufheller
  pan(9, 6, 0, 2, -10, .9, 0x7d97ff);     // Blau von hinten
  pan(9, 9, 9, 3, 9, .55, 0xdbe3ff);      // weiche Fläche vorne rechts, damit dunkle Seiten nicht absaufen
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(s, .03);
  pm.dispose(); return rt.texture;
}

/* ---------- Studio: ein Renderer für alle Module ----------
   Jedes Modul hat eine eigene Leinwand im normalen Seitenfluss. Gezeichnet wird zentral in einem Kontext und dann
   kopiert. So scrollt das 3D exakt mit der Seite, und Handys brauchen nur einen WebGL-Kontext. */
export function createStudio({ fov = 28 } = {}) {
  const local = /^(localhost|127\.)/.test(location.hostname);
  const gl = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.setScissorTest(true);
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.fog = new THREE.Fog(BG, 20, 40);

  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-4, 7, 7); scene.add(key);
  const fill = new THREE.DirectionalLight(0xa9bcff, .5); fill.position.set(6, 2, 5); scene.add(fill);
  const rimA = new THREE.DirectionalLight(ACCENT, 2.4); rimA.position.set(4, 4, -6); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(ACCENT, 1.8); rimB.position.set(-6, 2, -5); scene.add(rimB);
  // Licht im Gaming-PC. Die Anzahl der Lichter bleibt immer gleich, sonst baut three.js beim Wechsel die Shader neu.
  const pa = new THREE.PointLight(ACCENT, 0, 3.4, 2); scene.add(pa);
  const pb = new THREE.PointLight(SIGNAL, 0, 2.4, 2); scene.add(pb);

  const views = [];
  const studio = { renderer, scene, views, key, rimA, rimB, pa, pb, reflect: true, quality: 1, px: 0, py: 0, drawn: 0 };
  if (local) window.__studio = studio;
  let tx = 0, ty = 0;
  addEventListener('pointermove', e => { if (e.pointerType !== 'touch') { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; } }, { passive: true });

  studio.view = (canvas, { tick, onResize, mirror, el = canvas.parentElement }) => {
    const v = { canvas, ctx: canvas.getContext('2d'), el, root: new THREE.Group(), camera: new THREE.PerspectiveCamera(fov, 1, .1, 140),
      w: 0, h: 0, pw: 0, ph: 0, q: 0, aspect: 1, p: 0, active: false, tick, onResize, mirror };
    v.camera.layers.enable(1);
    v.root.visible = false; scene.add(v.root);
    v.visH = d => 2 * d * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    views.push(v);
    return v;
  };

  function measure(v, vh) {
    const r = v.el.getBoundingClientRect();
    // Größe aus dem Layout: Karten sind per CSS gedreht, ihr Rechteck ändert sich dabei
    const w = v.el.offsetWidth, h = v.el.offsetHeight;
    v.active = w > 0 && h > 0 && r.bottom > -40 && r.top < vh + 40;
    // 0 = Oberkante erreicht den unteren Fensterrand, 1 = Unterkante verlässt den oberen
    v.p = clamp((vh - r.top) / (vh + r.height || 1));
    if (!w || !h || (w === v.w && h === v.h && v.q === studio.quality)) return;
    v.w = w; v.h = h; v.q = studio.quality; v.aspect = w / h;
    // Nie mehr als etwa 1,7 Megapixel je Modul, sonst wird es auf großen Bildschirmen zäh
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 800 ? 1.7 : 2, Math.sqrt(1.7e6 / (w * h))) * studio.quality;
    v.pw = Math.max(1, Math.round(w * dpr)); v.ph = Math.max(1, Math.round(h * dpr));
    v.canvas.width = v.pw; v.canvas.height = v.ph;
    v.camera.aspect = v.aspect; v.camera.updateProjectionMatrix();
    v.onResize && v.onResize(v);
  }

  function draw(v) {
    if (gl.width < v.pw || gl.height < v.ph) renderer.setSize(Math.max(gl.width, v.pw), Math.max(gl.height, v.ph), false);
    renderer.setViewport(0, 0, v.pw, v.ph); renderer.setScissor(0, 0, v.pw, v.ph);
    renderer.clear();
    v.root.visible = true;
    if (studio.reflect) {
      v.mirror && v.mirror(true);
      mirrorU.value = 1; v.root.scale.y = -1; v.camera.layers.disable(1);
      renderer.render(scene, v.camera);
      renderer.clearDepth();
      mirrorU.value = 0; v.root.scale.y = 1; v.camera.layers.enable(1);
      v.mirror && v.mirror(false);
    }
    renderer.render(scene, v.camera);
    v.root.visible = false;
    v.ctx.globalCompositeOperation = 'copy';
    v.ctx.drawImage(gl, 0, gl.height - v.ph, v.pw, v.ph, 0, 0, v.pw, v.ph);
    pa.intensity = pb.intensity = 0;
    studio.drawn++;
  }

  // Ein Bild für alle Module, die gerade im Fenster sind. Gibt die Rechenzeit in Millisekunden zurück.
  studio.frame = (dt, now) => {
    const t0 = performance.now(), vh = innerHeight;
    studio.px = damp(studio.px, tx, 3, dt); studio.py = damp(studio.py, ty, 3, dt);
    for (const v of views) measure(v, vh);
    for (const v of views) if (v.active && v.tick(dt, now, v) !== false) draw(v);
    return performance.now() - t0;
  };

  // Bei Rucklern erst Auflösung senken, dann Spiegelung aus
  let last = 0, slow = 0, frames = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60;
    const raw = last ? now - last : 16; last = now;
    studio.frame(dt, now / 1000);
    if (raw < 250 && ++frames > 40) {
      slow += raw > 30 ? 1 : -.5; slow = Math.max(0, slow);
      if (slow > 40) {
        slow = 0; frames = 0;
        if (studio.quality > .7) studio.quality = Math.max(.7, studio.quality - .15);
        else studio.reflect = false;
      }
    }
  }
  studio.start = async () => {
    // Shader vorab bauen, sonst ruckelt es beim ersten Auftauchen eines Moduls
    const hidden = [];
    scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    const cam = views[0].camera;
    try { await renderer.compileAsync(scene, cam); } catch (e) { renderer.compile(scene, cam); }
    hidden.forEach(o => { o.visible = false; });
    requestAnimationFrame(loop);
    views.forEach(v => v.canvas.classList.add('on'));
    // Modelle einzeln an die Grafikkarte schicken, sonst stockt das Scrollen beim ersten Auftauchen eines Moduls
    for (const v of views) {
      await new Promise(r => setTimeout(r, 60));
      const off = [], cam = new THREE.PerspectiveCamera(fov, 1, .1, 140);
      cam.position.set(0, 3, 30); cam.lookAt(0, 1, 0); cam.layers.enable(1);
      v.root.traverse(o => { if (!o.visible) { off.push(o); o.visible = true; } });
      v.root.visible = true;
      renderer.setViewport(0, 0, 1, 1); renderer.setScissor(0, 0, 1, 1);
      renderer.render(scene, cam);
      v.root.visible = false;
      off.forEach(o => { o.visible = false; });
    }
  };
  return studio;
}

// Prüft vorab, ob WebGL überhaupt geht
export function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

/* ---------- Bauteile ---------- */
function fan(R, ring = M.led) {
  const g = new THREE.Group(), rotor = new THREE.Group();
  add(g, new THREE.TorusGeometry(R, R * .05, 10, 56), ring);
  add(g, new THREE.TorusGeometry(R * 1.08, R * .035, 8, 56), M.black);
  const s = new THREE.Shape();
  s.moveTo(R * .16, -R * .06); s.quadraticCurveTo(R * .62, R * .02, R * .9, R * .32);
  s.quadraticCurveTo(R * .56, R * .4, R * .2, R * .14); s.closePath();
  const blade = new THREE.ExtrudeGeometry(s, { depth: .006, bevelEnabled: false, curveSegments: 8 });
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Group(); p.rotation.z = i / 7 * Math.PI * 2; rotor.add(p);
    add(p, blade, M.blade, 0, 0, 0, .34, 0, 0);
  }
  add(rotor, disc(R * .26, .05, 28), M.black);
  add(rotor, disc(R * .1, .012, 18), ring, 0, 0, .03);
  g.add(rotor); g.userData.rotor = rotor;
  return g;
}
function powerLed(p, x, y, z, r = .055, strength = .55, mat = M.led, col = ACCENT) {
  add(p, new THREE.TorusGeometry(r, r * .22, 10, 32), M.aluDark, x, y, z);
  add(p, disc(r * .72, .008), mat, x, y, z + .002);
  const gl = glow(col, r * 9, strength); gl.position.set(x, y, z + .05); p.add(gl);
}
// Teile, die sich beim Hereinscrollen zum PC zusammensetzen: Richtung und Verzögerung je Teil
function part(list, obj, dx, dy, dz, delay = 0) {
  list.push({ obj, base: obj.position.clone(), dir: new THREE.Vector3(dx, dy, dz), delay });
  return obj;
}
export function assemble(model, a) {
  const u = model.userData;
  if (u.a === a || !u.parts) return;
  u.a = a;
  for (const pt of u.parts) {
    const k = 1 - smooth(seg(a, pt.delay, pt.delay + .5));
    pt.obj.position.copy(pt.base).addScaledVector(pt.dir, k);
  }
}
// Die Leistungsstufe als 3D-Blitze, wie im Icon der Seite
let boltGeo;
export function buildBolts(n) {
  if (!boltGeo) {
    const S = .027, X = x => (x - 12) * S, Y = y => -(y - 12) * S, s = new THREE.Shape();
    s.moveTo(X(13.2), Y(1.8)); s.lineTo(X(4.6), Y(13.4)); s.lineTo(X(10.7), Y(13.4)); s.lineTo(X(9.4), Y(22.2));
    s.lineTo(X(18.3), Y(10.1)); s.lineTo(X(12), Y(10.1)); s.closePath();
    boltGeo = extr(s, .05, .012, 1);
  }
  const g = new THREE.Group(), items = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(); b.position.x = (i - (n - 1) / 2) * .46;
    add(b, boltGeo, M.bolt);
    const gl = glow(SIGNAL, 1, .34); gl.position.z = -.05; b.add(gl);
    g.add(b); items.push(b);
  }
  g.userData.items = items;
  return g;
}

/* ---------- PCs (Boden bei y=0, Front zeigt nach +Z). Stufe 1 Light, 2 Medium, 3 Strong ---------- */
export function buildAlltag(tier = 1) {
  const g = new THREE.Group(), W = .94, H = 1.54, D = 1.24, f = .04, cy = f + H / 2, zF = D / 2, parts = [];
  const strong = tier === 3;
  add(g, rbox(W, H, D, .15, 5), strong ? M.gun : M.alu, 0, cy, 0);
  const fr = new THREE.Group(); fr.position.set(0, cy, zF + .007); g.add(fr);
  add(fr, rbox(W - .24, H - .24, .012, .05, 2), strong ? M.gunSoft : M.aluDark, 0, 0, -.006);
  if (strong) powerLed(fr, 0, H / 2 - .27, .004, .06, .34, M.ledO, SIGNAL);
  else powerLed(fr, 0, H / 2 - .27, .004, .06, tier === 2 ? .34 : .2);
  add(fr, rbox(.13, .034, .004, .012), M.hole, -.11, H / 2 - .48, .002);
  add(fr, rbox(.13, .034, .004, .012), M.hole, .11, H / 2 - .48, .002);
  holes(fr, W - .36, .56, .036, .0115, 0, -.13, .002);
  if (tier > 1) {
    add(fr, rbox(.46, .022, .006, .008), strong ? M.ledO : M.led, 0, -H / 2 + .2, .004);
    const gl = glow(strong ? SIGNAL : ACCENT, 1.1, .36, .24); gl.position.set(0, -H / 2 + .2, .06); fr.add(gl);
  } else add(fr, rbox(.42, .02, .004, .008), M.hole, 0, -H / 2 + .2, .002);
  part(parts, fr, 0, 0, 1.5, 0);
  const tp = new THREE.Group(); tp.position.set(0, f + H + .001, -.02); g.add(tp);
  holes(tp, W - .3, W - .3, .05, .012, 0, 0, 0, 0, -Math.PI / 2, true);
  if (tier > 1) add(tp, new THREE.TorusGeometry((W - .3) / 2 + .03, .009, 8, 48).rotateX(Math.PI / 2), strong ? M.ledO : M.led);
  part(parts, tp, 0, 1.1, 0, .12);
  const ra = new THREE.Group(); ra.position.set(0, cy, -D / 2 - .001); ra.rotation.y = Math.PI; g.add(ra);
  add(ra, rbox(W - .34, .3, .004, .02), M.gunSoft, 0, H / 2 - .4, 0);
  for (let i = 0; i < 4; i++) add(ra, rbox(.11, .034, .006, .012), M.hole, -.21 + i * .14, H / 2 - .4, .003);
  holes(ra, W - .3, .5, .04, .012, 0, -.2, .001);
  part(parts, ra, 0, 0, -1.4, .2);
  add(g, rbox(.14, .06, D - .34, .02), M.rubber, -.26, .03, 0);
  add(g, rbox(.14, .06, D - .34, .02), M.rubber, .26, .03, 0);
  Object.assign(g.userData, { h: f + H, w: W, d: D, parts });
  return g;
}

export function buildBuero(tier = 1) {
  const g = new THREE.Group(), W = .86, H = 2.38, D = 1.92, f = .05, cy = f + H / 2, zF = D / 2, parts = [], rotors = [];
  const strong = tier === 3;
  add(g, rbox(W, H, D, .07, 4), strong ? M.gunSoft : M.gun, 0, cy, 0);
  const fr = new THREE.Group(); fr.position.set(0, cy, zF + .017); g.add(fr);
  add(fr, rbox(W - .1, H - .1, .03, .012), strong ? M.black : M.gunSoft, 0, 0, -.017);
  add(fr, rbox(W - .3, .016, .006, .004), M.alu, 0, H / 2 - .3, 0);
  add(fr, rbox(W - .3, .016, .006, .004), M.alu, 0, H / 2 - .48, 0);
  for (let i = 0; i < 5; i++) add(fr, rbox(.075, .016, .006, .004), M.aluDark, -.22 + i * .11, H / 2 - .74, 0);
  if (strong) powerLed(fr, 0, -H / 2 + .46, .006, .075, .55, M.ledO, SIGNAL);
  else powerLed(fr, 0, -H / 2 + .46, .006, .075);
  for (let i = 0; i < 5; i++) add(fr, rbox(W - .3, .012, .004, .003), M.hole, 0, -H / 2 + .86 + i * .07, 0);
  if (tier > 1) {
    add(fr, rbox(.014, H - .5, .006, .003), strong ? M.ledO : M.led, W / 2 - .1, 0, .002);
    const gl = glow(strong ? SIGNAL : ACCENT, .7, .34, 4.4); gl.position.set(W / 2 - .1, 0, .06); fr.add(gl);
  }
  part(parts, fr, 0, 0, 1.9, 0);
  const side = new THREE.Group(); side.position.set(W / 2 + .001, cy, 0); side.rotation.y = Math.PI / 2; g.add(side);
  add(side, rbox(D - .14, H - .14, .012, .02), strong ? M.black : M.gunSoft, 0, 0, -.006);
  if (strong) {
    // Starke Stufe: Sichtfenster mit Lüfter
    add(side, rbox(1.16, 1.16, .006, .04), M.slab, -.1, .36, .002);
    const fa = fan(.42, M.ledO); fa.position.set(-.1, .36, .012); side.add(fa); rotors.push(fa.userData.rotor);
    const gl = glow(SIGNAL, 1.5, .26); gl.position.set(-.1, .36, .1); side.add(gl);
  } else holes(side, 1, .9, .042, .012, -.28, .55, 0);
  add(side, rbox(D - .36, .008, .004, .002), M.black, 0, -H / 2 + .2, 0);
  add(side, rbox(D - .36, .008, .004, .002), M.black, 0, H / 2 - .12, 0);
  part(parts, side, 1.5, 0, 0, .14);
  const ra = new THREE.Group(); ra.position.set(0, cy, -D / 2 - .001); ra.rotation.y = Math.PI; g.add(ra);
  add(ra, rbox(W - .3, .62, .004, .012), M.black, 0, H / 2 - .56, 0);
  for (let i = 0; i < 4; i++) add(ra, rbox(.26, .036, .006, .01), M.hole, 0, H / 2 - .36 - i * .13, .003);
  holes(ra, W - .3, .7, .045, .013, 0, -.1, .001);
  add(ra, rbox(W - .3, .4, .004, .012), M.gunSoft, 0, -H / 2 + .34, 0);
  part(parts, ra, 0, 0, -1.6, .24);
  add(g, rbox(W - .06, .06, .22, .02), M.rubber, 0, .03, D / 2 - .24);
  add(g, rbox(W - .06, .06, .22, .02), M.rubber, 0, .03, -D / 2 + .24);
  Object.assign(g.userData, { h: f + H, w: W, d: D, parts, rotors });
  return g;
}

export function buildGaming(tier = 2) {
  const g = new THREE.Group(), W = 1.34, H = 2.74, D = 2.42, f = .06, t = .05;
  const bot = f, top = f + H, cy = (bot + top) / 2, rotors = [], parts = [], strong = tier === 3;
  // Rahmen
  add(g, rbox(W, .08, D, .03), M.black, 0, top - .04, 0);
  add(g, rbox(W, .08, D, .03), M.black, 0, bot + .04, 0);
  for (const [x, z] of [[W / 2 - t / 2, D / 2 - t / 2], [-W / 2 + t / 2, D / 2 - t / 2], [W / 2 - t / 2, -D / 2 + t / 2], [-W / 2 + t / 2, -D / 2 + t / 2]])
    add(g, rbox(t, H - .1, t, .012), M.gun, x, cy, z);
  // Rückseite und geschlossene Seite: man kann den PC ja ganz herumdrehen
  const left = new THREE.Group(); left.position.set(-W / 2 + .018, cy, 0); g.add(left);
  add(left, rbox(.03, H - .1, D - .04, .01), M.gun);
  const sv = new THREE.Group(); sv.position.set(-.016, 0, 0); sv.rotation.y = -Math.PI / 2; left.add(sv);
  holes(sv, 1.5, .62, .05, .014, 0, H / 2 - .5, 0);
  add(sv, rbox(D - .5, .014, .006, .003), M.ledO, 0, -H / 2 + .62, 0);
  part(parts, left, -1.3, 0, 0, .3);
  const back = new THREE.Group(); back.position.set(0, cy, -D / 2 + .018); g.add(back);
  add(back, rbox(W - .04, H - .1, .03, .01), M.gun);
  const rv = new THREE.Group(); rv.position.set(0, 0, -.016); rv.rotation.y = Math.PI; back.add(rv);
  add(rv, rbox(.34, .78, .008, .01), M.black, .34, H / 2 - .62, 0);
  for (let i = 0; i < 5; i++) add(rv, rbox(.2, .036, .006, .006), M.hole, .34, H / 2 - .34 - i * .1, .005);
  add(rv, disc(.1, .008), M.hole, -.28, -H / 2 + .36, 0);
  holes(rv, .96, .34, .045, .012, 0, -H / 2 + .36, 0);
  part(parts, back, 0, 0, -1.3, .3);
  // Netzteil-Abdeckung mit Lichtkante
  const psu = new THREE.Group(); psu.position.set(0, bot + .3, 0); g.add(psu);
  add(psu, rbox(W - .1, .44, D - .12, .02), M.gunSoft);
  add(psu, rbox(.006, .018, D - .5, .003), M.led, W / 2 - .052, .16, 0);
  part(parts, psu, 0, -.6, 1.4, .2);
  // Mainboard
  const by = bot + .52 + (H - .66) / 2;
  const board = add(g, rbox(.03, H - .72, D - .46, .01), M.pcb, -W / 2 + .1, by, -.08);
  part(parts, board, -.9, 0, 0, .26);
  // Prozessor-Kühler
  const cool = new THREE.Group(); cool.position.set(-W / 2 + .36, top - .72, -.32); g.add(cool);
  add(cool, rbox(.36, .62, .32, .03), M.aluDark);
  for (let i = 0; i < 6; i++) add(cool, rbox(.37, .012, .33, .002), M.alu, 0, -.26 + i * .105, 0);
  const cf = fan(.26, M.ledO); cf.position.set(.0, 0, .2); cool.add(cf); rotors.push(cf.userData.rotor);
  part(parts, cool, 1.7, .5, 0, .1);
  // Arbeitsspeicher, mehr Riegel je Stufe
  for (let i = 0; i < tier + 1; i++) {
    const r = new THREE.Group(); r.position.set(-W / 2 + .19, top - .72, .22 + i * .1); g.add(r);
    add(r, rbox(.11, .46, .036, .006), M.black);
    add(r, rbox(.112, .03, .04, .004), M.led, 0, .25, 0);
    part(parts, r, 0, 1.2, 0, .16 + i * .03);
  }
  // Grafikkarte
  const gpu = new THREE.Group(); gpu.position.set(-W / 2 + .4, bot + .92, -.06); g.add(gpu);
  add(gpu, rbox(.58, .22, 1.62, .03), M.gun);
  add(gpu, rbox(.006, .03, 1.2, .003), M.led, .292, .02, 0);
  add(gpu, rbox(.5, .03, 1.5, .01), M.alu, 0, .125, 0);
  part(parts, gpu, 1.9, 0, 0, .06);
  // Lüfter hinter der Front wie im Icon, mehr je Stufe
  const fans = tier === 1 ? [[bot + 1.5, .56]] : tier === 2 ? [[bot + 1.02, .47], [bot + 1.96, .47]] : [[bot + .86, .34], [bot + 1.53, .34], [bot + 2.2, .34]];
  fans.forEach(([y, R], i) => {
    const hot = strong && i === 1;
    const fa = fan(R, hot ? M.ledO : M.led); fa.position.set(0, y, D / 2 - .14); g.add(fa); rotors.push(fa.userData.rotor);
    const gl = glow(hot ? SIGNAL : ACCENT, R * 3.6, .22); gl.position.set(0, 0, .19); fa.add(gl);
    part(parts, fa, 0, 0, 1.6, .02 + i * .05);
  });
  const rf = fan(.38); rf.position.set(0, top - .62, -D / 2 + .1); g.add(rf); rotors.push(rf.userData.rotor);
  part(parts, rf, 0, 0, -1, .24);
  // Lichtleiste an der Vorderkante wie im Icon, ab Medium orange
  const strip = new THREE.Group(); strip.position.set(W / 2 - .025, cy, D / 2 + .004); g.add(strip);
  add(strip, rbox(.022, H - .34, .022, .006), tier > 1 ? M.ledO : M.led);
  const gs = glow(tier > 1 ? SIGNAL : ACCENT, .9, .5, 4); gs.position.set(.005, 0, .056); strip.add(gs);
  // Glas vorne und an der Seite
  const gf = add(g, rbox(W - .03, H - .1, .012, .004), M.glass, 0, cy, D / 2 - .01); gf.renderOrder = 5;
  const gsd = add(g, rbox(.012, H - .1, D - .03, .004), M.glass, W / 2 - .01, cy, 0); gsd.renderOrder = 5;
  part(parts, gf, 0, 0, 2.6, .36); part(parts, gsd, 2.4, 0, 0, .42);
  add(g, rbox(.18, .06, D - .4, .02), M.rubber, -W / 2 + .2, .03, 0);
  add(g, rbox(.18, .06, D - .4, .02), M.rubber, W / 2 - .2, .03, 0);
  Object.assign(g.userData, { h: top, w: W, d: D, rotors, parts, lightA: [.1, cy + .2, .3], lightB: [.3, bot + 1.1, 1], lightK: strong ? 1.35 : tier === 1 ? .7 : 1 });
  return g;
}

/* ---------- Lizenzen: die drei Icons der Seite als 3D-Objekte ---------- */
function badge() {
  const b = new THREE.Group();
  add(b, disc(.19, .07, 40), M.orange);
  add(b, rbox(.1, .034, .02, .01), M.white, -.052, -.012, .04, 0, 0, -Math.PI / 4);
  add(b, rbox(.2, .034, .02, .01), M.white, .036, .026, .04, 0, 0, Math.PI / 3.6);
  return b;
}
export function buildLicense(kind) {
  const g = new THREE.Group(); let bdg;
  const W = 1.5, H = 1.28, Z = .058;
  if (kind === 'spiel') {
    const S = .031, X = x => (x - 32) * S, Y = y => -(y - 36) * S, s = new THREE.Shape();
    s.moveTo(X(18), Y(22)); s.lineTo(X(46), Y(22)); s.bezierCurveTo(X(54), Y(22), X(59), Y(30), X(59), Y(39));
    s.bezierCurveTo(X(59), Y(47), X(52), Y(51), X(47), Y(46)); s.lineTo(X(42), Y(41)); s.lineTo(X(22), Y(41)); s.lineTo(X(17), Y(46));
    s.bezierCurveTo(X(12), Y(51), X(5), Y(47), X(5), Y(39)); s.bezierCurveTo(X(5), Y(30), X(10), Y(22), X(18), Y(22));
    const body = extr(s, .13, .05, 20);
    add(g, body, M.slab);
    const zf = .12;
    add(g, rbox(.32, .085, .03, .02), M.white, X(17), Y(34), zf);
    add(g, rbox(.085, .32, .03, .02), M.white, X(17), Y(34), zf);
    add(g, disc(.085, .03), M.led, X(43), Y(31), zf);
    add(g, disc(.085, .03), M.led, X(49), Y(37), zf);
    const gl = glow(ACCENT, 1, .3); gl.position.set(X(46), Y(34), zf + .06); g.add(gl);
    bdg = badge(); bdg.position.set(X(53), Y(17), .12); g.add(bdg);
  } else {
    add(g, extr(rrShape(W, H, .15), .05, .018, 12), M.slab);
    // Titelleiste
    add(g, rbox(W - .02, .012, .01, .003), M.whiteDim, 0, H / 2 - .25, Z);
    if (kind === 'programm') {
      add(g, disc(.042, .012), M.led, -W / 2 + .17, H / 2 - .125, Z);
      add(g, disc(.042, .012), M.led, -W / 2 + .3, H / 2 - .125, Z);
      const L = [.98, .76, .54];
      L.forEach((w, i) => add(g, rbox(w, .058, .016, .008), M.white, -W / 2 + .22 + w / 2, H / 2 - .47 - i * .22, Z));
    } else {
      // Tabelle wie im Office-Icon
      const y0 = H / 2 - .25, x1 = -W / 2 + .5, x2 = x1 + .48, rowH = (H - .25) / 3;
      for (const x of [x1, x2]) add(g, rbox(.012, H - .27, .01, .003), M.whiteDim, x, -.125, Z);
      for (let i = 1; i < 3; i++) add(g, rbox(W - .02, .012, .01, .003), M.whiteDim, 0, y0 - i * rowH, Z);
      add(g, rbox(.38, rowH - .09, .014, .01), M.led, x2 + .26, y0 - 1.5 * rowH, Z);
      add(g, rbox(.28, .05, .014, .008), M.white, x1 - .24, y0 - .5 * rowH, Z);
      add(g, rbox(.3, .05, .014, .008), M.white, x1 + .24, y0 - .5 * rowH, Z);
      add(g, rbox(.28, .05, .014, .008), M.white, x2 + .24, y0 - .5 * rowH, Z);
      add(g, rbox(.22, .05, .014, .008), M.whiteDim, x1 - .24, y0 - 1.5 * rowH, Z);
      add(g, rbox(.3, .05, .014, .008), M.whiteDim, x1 + .24, y0 - 1.5 * rowH, Z);
      add(g, rbox(.26, .05, .014, .008), M.whiteDim, x1 - .24, y0 - 2.5 * rowH, Z);
      add(g, rbox(.2, .05, .014, .008), M.whiteDim, x1 + .24, y0 - 2.5 * rowH, Z);
      const gl = glow(ACCENT, .9, .28); gl.position.set(x2 + .26, y0 - 1.5 * rowH, Z + .06); g.add(gl);
    }
    bdg = badge(); bdg.position.set(W / 2 - .02, H / 2 - .02, .08); g.add(bdg);
  }
  g.userData.badge = bdg;
  return g;
}

/* ---------- Für die Netzwerk-Szene ---------- */
export function buildCore(labelCanvas) {
  const g = new THREE.Group(), S = 1.7, H = S * .92;
  add(g, rbox(S, H, S, .15, 5), M.slab, 0, H / 2, 0);
  // Leuchtender Ring auf dem Deckel: zwei Flächen übereinander ergeben die Lichtkante
  add(g, rbox(S * .74, .014, S * .74, .006, 1), M.led, 0, H + .002, 0);
  add(g, rbox(S * .68, .018, S * .68, .006, 1), M.slab, 0, H + .004, 0);
  add(g, rbox(S * .8, .012, .012, .004, 1), M.led, 0, .12, S / 2 + .002);
  const tex = new THREE.CanvasTexture(labelCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(S * .94, S * .94 * labelCanvas.height / labelCanvas.width),
    patch(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })));
  lab.position.set(0, H * .54, S / 2 + .004); g.add(lab);
  const gl = glow(ACCENT, 4.2, .26); gl.position.set(0, H * .5, -.4); g.add(gl);
  g.userData.h = H;
  return g;
}
/* ---------- Netzwerk wie im Schema der Seite: PC + Lizenz → NetSource → Kunde ---------- */
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
// Kamera von schräg oben, wie auf einen Netzwerkplan. Rückt so weit weg, dass alles ins Bild passt.
export function networkCam(view) {
  const k = Math.max(6.4 / view.visH(16.9), 11.8 / (view.visH(16.9) * view.aspect));
  return { p: [-.55, 10 * k, 13.6 * k], t: [-.55, .55, 0] };
}
// Braucht die geladene Schrift Archivo für die Beschriftung des Würfels
export function createNetwork(root) {
  const V = (x, z) => new THREE.Vector3(x, .03, z);
  const curves = {
    pc: new THREE.CubicBezierCurve3(V(-4.6, -1.7), V(-2.6, -1.7), V(-2.6, 0), V(-.8, 0)),
    lic: new THREE.CubicBezierCurve3(V(-4.6, 1.7), V(-2.6, 1.7), V(-2.6, 0), V(-.8, 0)),
    out: new THREE.LineCurve3(V(.8, 0), V(3.5, 0)),
  };
  const wire = (curve, mat, r = .024) => {
    const geo = new THREE.TubeGeometry(curve, 60, r, 8, false);
    const m = new THREE.Mesh(geo, mat); root.add(m);
    m.userData.count = geo.index.count; geo.setDrawRange(0, 0);
    return m;
  };
  const wires = { pc: wire(curves.pc, M.led), lic: wire(curves.lic, M.led), out: wire(curves.out, M.ledO, .03) };
  const draw = (k, p) => { const m = wires[k]; m.visible = p > .001; m.geometry.setDrawRange(0, Math.floor(m.userData.count * p / 3) * 3); };

  // Lichtpunkte, die durch die Leitungen laufen
  const pulses = [['pc', 0], ['pc', .33], ['pc', .66], ['lic', .16], ['lic', .5], ['lic', .83], ['out', 0], ['out', .33], ['out', .66]].map(([k, o]) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), M.white));
    g.add(glow(k === 'out' ? SIGNAL : ACCENT, .85, .8));
    root.add(g);
    return { k, o, g };
  });

  const core = buildCore(coreLabel()); root.add(core); core.visible = false;
  // Kunde: Ring mit Punkt, wie im Schema
  const client = new THREE.Group();
  client.add(new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 14, 56).rotateX(Math.PI / 2), M.ledO));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 16), M.ledO); dot.position.y = .14; client.add(dot);
  const gl = glow(SIGNAL, 2, .35); gl.position.y = .2; client.add(gl);
  client.position.set(3.5, 0, 0);
  root.add(client);

  const p0 = new THREE.Vector3();
  return {
    // w1, w2: wie weit die Leitungen gezeichnet sind, die anderen Werte sind Größen von 0 bis 1
    update({ now, t, calm, px, w1, w2, coreS, clientS }) {
      draw('pc', w1); draw('lic', w1); draw('out', w2);
      core.visible = coreS > .004;
      core.scale.setScalar(Math.max(.001, coreS));
      core.rotation.y = Math.sin(t * .35) * .05 + px * .06;
      client.visible = clientS > .004;
      client.scale.setScalar(Math.max(.001, clientS));
      // Lichtpunkte laufen erst, wenn die Leitung fertig ist
      pulses.forEach(p => {
        const w = wires[p.k], shown = w.visible && w.geometry.drawRange.count >= w.userData.count * .96;
        p.g.visible = shown;
        if (!shown) return;
        curves[p.k].getPointAt(calm ? p.o : (now * .34 + p.o) % 1, p0);
        p.g.position.set(p0.x, .06, p0.z);
      });
    },
    // Kleine Schilder, die an 3D-Punkten hängen
    tags(list, camera, view, alpha) {
      camera.updateMatrixWorld();
      list.forEach(({ el, k }) => {
        const a = alpha(k);
        el.style.visibility = a > .01 ? 'visible' : 'hidden';
        if (a <= .01) return;
        if (k === 'pc') p0.set(-4.6, 2.05, -1.7);
        else if (k === 'lic') p0.set(-4.6, 1.75, 1.7);
        else p0.set(3.5, .75, 0);
        p0.applyAxisAngle(THREE.Object3D.DEFAULT_UP, root.rotation.y).project(camera);
        el.style.opacity = a;
        el.style.transform = `translate(-50%,-100%) translate(${((p0.x + 1) / 2 * view.w).toFixed(1)}px,${((1 - p0.y) / 2 * view.h).toFixed(1)}px)`;
      });
    },
  };
}
export { floorSpot };

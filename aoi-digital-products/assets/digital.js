// AOI Digital Products: normale Seite mit beweglichen 3D-Modulen, gleicher Baukasten wie NetSource.
// Reihenfolge: Frage → alles von Büro bis Gaming → Büro → Gaming → Netzwerk → Privat und geschäftlich → AOI NetSource.
import { THREE, createStudio, hasWebGL, buildAlltag, buildBuero, buildGaming, clamp } from './aoi3d.js';
import { rowModule, ringModule, networkModules } from './modules.js';

const html = document.documentElement;
if (!hasWebGL() || location.search.includes('static')) {
  html.classList.add('static');
  throw 0;
}

// Die Frage erscheint beim Laden Wort für Wort
{
  const h = document.querySelector('.q'); let n = 0;
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

// Startbild: der PC steht rechts neben der Frage, am Handy darunter
const heroLayout = v => {
  const a = v.aspect, port = a < .8, k = port ? 1.5 : Math.min(1.45, Math.max(1, 1.6 / a));
  return { port, dist: 13 * k, camX: port ? 0 : 1.6, camY: 2.2, lookY: port ? 3.5 : 1.65, x0: port ? -.9 : 3.15, z0: -.2, k: port ? 1 : 1.3, Rx: 0, Rz: 0, center: 1, licX: 1, licK: 1, licY: 0, licZ: 0 };
};

const fonts = document.fonts ? Promise.race([document.fonts.load('800 170px Archivo'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fonts.then(() => {
  const studio = createStudio();
  const [first, ...rest] = document.querySelectorAll('.hero');
  ringModule(studio, first, {
    build: buildBuero, tiers: [2], lic: 'office', intro: true, assembleOnEnter: false, layout: heroLayout,
    licPose: innerWidth / innerHeight < .8 ? { x: 1.85, y: 1.72, z: 1.1, s: .78, ry: -.34 } : { x: 1.9, y: 2.1, z: 1.1, s: 1, ry: -.34 },
  });
  rest.forEach((el, i) => rowModule(studio, el, {
    models: [buildAlltag(2), buildBuero(2), buildGaming(i ? 3 : 2)], licKinds: ['programm', 'office', 'spiel'],
    links: [...el.querySelectorAll('.row-labels a')], floor: i ? [.24, .19] : [.34, .3], showLic: !!i,
  }));
  ringModule(studio, document.getElementById('buero'), {
    build: buildBuero, tiers: [2], lic: 'office', scale: 1.08, word: 'Büro', tint: new THREE.Color('#7d97ff'),
    licPose: { x: 1.72, y: 1.72, z: .55, s: .8, ry: -.34 },
  });
  ringModule(studio, document.getElementById('gaming'), {
    build: buildGaming, tiers: [3], lic: 'spiel', scale: 1, word: 'Gaming', tint: new THREE.Color('#f2994a'),
    licPose: { x: -2.2, y: 1.72, z: .6, s: .88, ry: .36 },
  });
  const [a, b] = document.querySelectorAll('.netz');
  networkModules(studio, a, b);
  studio.start();
});

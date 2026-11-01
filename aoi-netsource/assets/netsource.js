// NetSource: der Katalog als normale Seite mit beweglichen 3D-Modulen.
// Reihenfolge: Start mit allen drei PCs → Alltag, Büro, Gaming mit je drei Stufen → Netzwerk → Privat und geschäftlich.
import { THREE, createStudio, hasWebGL, buildAlltag, buildBuero, buildGaming } from './aoi3d.js';
import { rowModule, ringModule, networkModules } from './modules.js';

const html = document.documentElement;
if (!hasWebGL() || location.search.includes('static')) {
  html.classList.add('static');
  throw 0;
}

const fonts = document.fonts ? Promise.race([document.fonts.load('800 170px Archivo'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fonts.then(() => {
  const studio = createStudio();
  const hero = document.getElementById('produkte');
  rowModule(studio, hero, {
    models: [buildAlltag(2), buildBuero(2), buildGaming(2)], licKinds: ['programm', 'office', 'spiel'],
    links: [...hero.querySelectorAll('.row-labels a')], intro: true, far: 1.16, floor: [.3, .3],
  });
  ringModule(studio, document.getElementById('alltag'), {
    build: buildAlltag, lic: 'programm', scale: 1.44, word: 'Alltag', tint: new THREE.Color('#b9cbff'),
    licPose: { x: 1.72, y: 1.62, z: .5, s: .8, ry: -.34 },
  });
  ringModule(studio, document.getElementById('buero'), {
    build: buildBuero, lic: 'office', scale: 1.08, word: 'Büro', tint: new THREE.Color('#7d97ff'),
    licPose: { x: 1.72, y: 1.72, z: .55, s: .8, ry: -.34 },
  });
  ringModule(studio, document.getElementById('gaming'), {
    build: buildGaming, lic: 'spiel', scale: 1, word: 'Gaming', tint: new THREE.Color('#f2994a'),
    licPose: { x: -2.2, y: 1.72, z: .6, s: .88, ry: .36 },
  });
  const [a, b] = document.querySelectorAll('.netz');
  networkModules(studio, a, b);
  studio.start();
});

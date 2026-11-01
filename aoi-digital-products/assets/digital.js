// AOI Digital Products: die Seite wie im Original. Nur die Icons der Bereiche und das Schema sind bewegliche 3D-Module.
import { THREE, createStudio, hasWebGL, buildAlltag, buildBuero, buildGaming } from './aoi3d.js';
import { artModule, networkModule, BLUE, ORANGE } from './modules.js';

const html = document.documentElement;
if (!hasWebGL() || location.search.includes('static')) {
  html.classList.add('static');
  throw 0;
}

const AREAS = [
  { model: () => buildAlltag(2), licKind: 'programm', scale: 1.26, tint: new THREE.Color('#b9cbff') },
  { model: () => buildBuero(2), licKind: 'office', scale: .88, tint: BLUE },
  { model: () => buildGaming(2), licKind: 'spiel', scale: .76, tint: ORANGE },
];

// Die Beschriftung des Würfels braucht die geladene Schrift Archivo
const fonts = document.fonts ? Promise.race([document.fonts.load('800 170px Archivo'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fonts.then(() => {
  const studio = createStudio();
  document.querySelectorAll('.sparte').forEach((el, i) => {
    const art = document.createElement('div'); art.className = 'sparte-art';
    el.querySelector('h3').after(art);
    const { model, ...area } = AREAS[i];
    artModule(studio, art, { ...area, model: model(), width: 4.1, height: 3.5, pcX: -.62, lic: { x: 1.02, y: 1.42, z: .8, s: .62, ry: -.3 } });
  });
  networkModule(studio, document.querySelector('.net-view'));
  studio.start();
});

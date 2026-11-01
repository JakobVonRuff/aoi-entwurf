// NetSource: der Katalog wie im Original. Nur das Bild in jeder Karte ist ein bewegliches 3D-Modul.
import { THREE, createStudio, hasWebGL, buildAlltag, buildBuero, buildGaming } from './aoi3d.js';
import { artModule, BLUE, ORANGE } from './modules.js';

const html = document.documentElement;
if (!hasWebGL() || location.search.includes('static')) {
  html.classList.add('static');
  throw 0;
}

const AREAS = {
  alltag: { build: buildAlltag, licKind: 'programm', scale: 1.26, tint: new THREE.Color('#b9cbff') },
  buero: { build: buildBuero, licKind: 'office', scale: .88, tint: BLUE },
  gaming: { build: buildGaming, licKind: 'spiel', scale: .76, tint: BLUE },
};

const studio = createStudio();
Object.entries(AREAS).forEach(([id, { build, tint, ...area }]) => {
  document.getElementById(id).querySelectorAll('.pc-card').forEach((card, i) => {
    artModule(studio, card.querySelector('.pc-art'), { ...area, card, model: build(i + 1), bolts: i + 1, tint: i === 2 ? ORANGE : tint });
  });
});
studio.start();

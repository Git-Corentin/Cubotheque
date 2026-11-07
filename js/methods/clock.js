// Rubik's Clock : 18 cadrans (9 devant, 9 derrière) et 4 pins.
// Les coins sont partagés : un coin de face avant tourne en sens inverse vu de l'arrière.
export const blankClock = () => ({ front: Array(9).fill(0), back: Array(9).fill(0), pins: [false, false, false, false], marks: { front: [], back: [] }, linked: true, showBack: true });

const MIRROR = { 0: 2, 2: 0, 6: 8, 8: 6 }; // coin avant → coin arrière correspondant (vu de dos)
export function setDial(c, side, i, v) {
  v = ((v % 12) + 12) % 12;
  c[side][i] = v;
  if (c.linked && i in MIRROR) {
    const other = side === 'front' ? 'back' : 'front';
    c[other][MIRROR[i]] = (12 - v) % 12;
  }
}
export function randomClock() {
  const c = blankClock();
  for (let i = 0; i < 9; i++) { setDial(c, 'front', i, Math.floor(Math.random() * 12)); if (!(i in MIRROR)) c.back[i] = Math.floor(Math.random() * 12); }
  c.pins = c.pins.map(() => Math.random() < 0.5);
  return c;
}

/** Dessin SVG. interactive : ajoute data-side/data-i sur les cadrans et data-pin sur les pins. */
export function renderClock(c, { interactive = false } = {}) {
  const faces = c.showBack ? ['front', 'back'] : ['front'];
  const W = 200, gap = 26;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${faces.length * W + (faces.length - 1) * gap} ${W + 22}">`;
  faces.forEach((side, k) => {
    const ox = k * (W + gap), cx = ox + W / 2, cy = W / 2;
    const body = side === 'front' ? '#1f5fa8' : '#b5262c';
    out += `<circle cx="${cx}" cy="${cy}" r="${W / 2 - 2}" fill="${body}"/>`;
    for (let i = 0; i < 9; i++) {
      const x = ox + 40 + (i % 3) * 60, y = 40 + Math.floor(i / 3) * 60;
      const v = c[side][i] || 0;
      const a = (v * 30 - 90) * Math.PI / 180;
      const marked = c.marks?.[side]?.includes(i);
      const da = interactive ? `data-side="${side}" data-i="${i}" style="cursor:pointer"` : '';
      out += `<g ${da}><circle cx="${x}" cy="${y}" r="23" fill="#fff" stroke="${marked ? '#FFD100' : '#111'}" stroke-width="${marked ? 5 : 1.5}"/>`;
      for (let t = 0; t < 12; t++) { const ta = (t * 30 - 90) * Math.PI / 180; out += `<circle cx="${(x + Math.cos(ta) * 18).toFixed(1)}" cy="${(y + Math.sin(ta) * 18).toFixed(1)}" r="${t === 0 ? 2.2 : 1}" fill="${t === 0 ? '#C8102E' : '#999'}"/>`; }
      out += `<line x1="${x}" y1="${y}" x2="${(x + Math.cos(a) * 15).toFixed(1)}" y2="${(y + Math.sin(a) * 15).toFixed(1)}" stroke="#111" stroke-width="4" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="3.5" fill="#111"/></g>`;
    }
    [[70, 70], [130, 70], [70, 130], [130, 130]].forEach(([px, py], p) => {
      // vu de dos, les pins sont inversés (haut ↔ bas) et en miroir gauche-droite
      const pin = side === 'front' ? p : [1, 0, 3, 2][p];
      const up = side === 'front' ? c.pins[pin] : !c.pins[pin];
      out += `<circle ${interactive ? `data-pin="${pin}" style="cursor:pointer"` : ''} cx="${ox + px}" cy="${py}" r="7" fill="${up ? '#FFD100' : body}" stroke="#111" stroke-width="2"/>`;
    });
    out += `<text x="${cx}" y="${W + 16}" text-anchor="middle" font-size="13" font-weight="700" font-family="Archivo, sans-serif" fill="currentColor">${side === 'front' ? 'Face avant' : 'Face arrière'}</text>`;
  });
  return out + '</svg>';
}

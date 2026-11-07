// Générateur de gabarits de faces : un polygone de base découpé par des coupes.
// Couvre NxN, cuboïdes, Pyraminx, Megaminx, Kilominx, Skewb, Dino, Square-1, FTO…
// Toutes les pièces restent convexes : on découpe par demi-plans et par secteurs.

const EPS = 1e-7;

export function basePolygon(base, ratio = 1.5) {
  const ngon = (k, rot) => Array.from({ length: k }, (_, i) => { const a = rot + (i * 2 * Math.PI) / k; return [Math.cos(a), Math.sin(a)]; });
  switch (base) {
    case 'triangle': return ngon(3, -Math.PI / 2);
    case 'pentagon': return ngon(5, -Math.PI / 2);
    case 'hexagon': return ngon(6, 0);
    case 'octagon': return ngon(8, Math.PI / 8);
    case 'circle': return ngon(72, 0);
    case 'rect': { const w = 1, hh = 1 / ratio; return [[-w, -hh], [w, -hh], [w, hh], [-w, hh]]; }
    default: return [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  }
}

const area = (p) => Math.abs(p.reduce((a, [x, y], i) => { const [X, Y] = p[(i + 1) % p.length]; return a + x * Y - X * y; }, 0)) / 2;

/** Garde la partie du polygone où n·p <= c. */
function clipHalf(poly, n, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const da = n[0] * A[0] + n[1] * A[1] - c, db = n[0] * B[0] + n[1] * B[1] - c;
    if (da <= EPS) out.push(A);
    if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
  }
  return out;
}
function splitLine(pieces, n, c) {
  const res = [];
  for (const p of pieces) {
    const a = clipHalf(p, n, c), b = clipHalf(p, [-n[0], -n[1]], -c);
    if (area(a) > 1e-5 && area(b) > 1e-5) res.push(a, b); else res.push(p);
  }
  return res;
}
function clipConvex(poly, clip) {
  let out = poly;
  for (let i = 0; i < clip.length && out.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length];
    const n = [B[1] - A[1], -(B[0] - A[0])]; // normale extérieure pour un polygone horaire/antihoraire : on teste le centre
    const c = n[0] * A[0] + n[1] * A[1];
    const cx = clip.reduce((s, p) => s + p[0], 0) / clip.length, cy = clip.reduce((s, p) => s + p[1], 0) / clip.length;
    const inside = n[0] * cx + n[1] * cy - c <= 0;
    out = inside ? clipHalf(out, n, c) : clipHalf(out, [-n[0], -n[1]], -c);
  }
  return out;
}

export function generate(o) {
  const base = basePolygon(o.base, o.ratio || 1.5);
  let pieces = [base];
  const nV = base.length;
  const center = [0, 0];

  // grille (carré / rectangle)
  if ((o.base === 'square' || o.base === 'rect') && (o.cols > 1 || o.rows > 1)) {
    const xs = base.map((p) => p[0]), ys = base.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let i = 1; i < (o.cols || 1); i++) pieces = splitLine(pieces, [1, 0], x0 + ((x1 - x0) * i) / o.cols);
    for (let i = 1; i < (o.rows || 1); i++) pieces = splitLine(pieces, [0, 1], y0 + ((y1 - y0) * i) / o.rows);
  }

  // secteurs (rayons depuis le centre)
  let angles = [...(o.rays || [])].map((a) => ((a % 360) + 360) % 360);
  const ang = (p) => (Math.atan2(p[1], p[0]) * 180) / Math.PI;
  if (o.radV && o.base !== 'circle') base.forEach((p) => angles.push(ang(p)));
  if (o.radM && o.base !== 'circle') base.forEach((p, i) => { const q = base[(i + 1) % nV]; angles.push(ang([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])); });
  angles = [...new Set(angles.map((a) => Math.round((((a % 360) + 360) % 360) * 1000) / 1000))].sort((a, b) => a - b);
  if (angles.length >= 2) {
    const gaps = angles.map((a, i) => ((angles[(i + 1) % angles.length] - a + 360) % 360) || 360);
    if (Math.max(...gaps) <= 180.001) {
      const res = [];
      angles.forEach((a, i) => {
        const b = a + gaps[i];
        const wedge = [center];
        const steps = Math.max(2, Math.ceil(gaps[i] / 30));
        for (let s = 0; s <= steps; s++) { const t = ((a + (gaps[i] * s) / steps) * Math.PI) / 180; wedge.push([Math.cos(t) * 10, Math.sin(t) * 10]); }
        for (const p of pieces) { const c = clipConvex(p, wedge); if (area(c) > 1e-5) res.push(c); }
        void b;
      });
      pieces = res;
    }
  }

  if (o.base !== 'circle') {
    // coupes parallèles aux côtés
    const sides = base.map((p, i) => {
      const q = base[(i + 1) % nV];
      let n = [q[1] - p[1], -(q[0] - p[0])]; const L = Math.hypot(...n); n = [n[0] / L, n[1] / L];
      let r = n[0] * p[0] + n[1] * p[1];
      if (r < 0) { n = [-n[0], -n[1]]; r = -r; }
      return { n, r };
    });
    if (o.k > 0) {
      for (const { n, r } of sides) {
        const D = Math.max(...base.map((v) => r - (n[0] * v[0] + n[1] * v[1])));
        for (let j = 1; j <= o.k; j++) pieces = splitLine(pieces, n, r - j * (o.step || 1 / (o.k + 1)) * D);
      }
    }
    // lignes reliant les milieux de côtés voisins
    if (o.midlines) {
      const mids = base.map((p, i) => { const q = base[(i + 1) % nV]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
      mids.forEach((a, i) => {
        const b = mids[(i + 1) % nV];
        let n = [b[1] - a[1], -(b[0] - a[0])]; const L = Math.hypot(...n); n = [n[0] / L, n[1] / L];
        pieces = splitLine(pieces, n, n[0] * a[0] + n[1] * a[1]);
      });
    }
  }
  return pieces.filter((p) => area(p) > 1e-4);
}

export const PRESETS = [
  { id: 'nxn', label: 'Face NxN', o: { base: 'square', cols: 3, rows: 3 } },
  { id: 'cuboid', label: 'Face de cuboïde', o: { base: 'rect', ratio: 1.5, cols: 3, rows: 2 } },
  { id: 'pyra', label: 'Pyraminx', o: { base: 'triangle', k: 2, step: 1 / 3 } },
  { id: 'mpyra', label: 'Master Pyraminx', o: { base: 'triangle', k: 3, step: 1 / 4 } },
  { id: 'mega', label: 'Megaminx', o: { base: 'pentagon', k: 1, step: 0.2 } },
  { id: 'giga', label: 'Gigaminx', o: { base: 'pentagon', k: 2, step: 0.12 } },
  { id: 'kilo', label: 'Kilominx', o: { base: 'pentagon', radM: true } },
  { id: 'skewb', label: 'Skewb', o: { base: 'square', midlines: true } },
  { id: 'dino', label: 'Dino', o: { base: 'square', radV: true } },
  { id: 'redi', label: 'Redi / Rex (approché)', o: { base: 'square', midlines: true, radV: true } },
  { id: 'fto', label: 'FTO (face)', o: { base: 'triangle', k: 2, step: 1 / 3 } },
  { id: 'sq1', label: 'Square-1 (couche)', o: { base: 'square', rays: [15, 75, 105, 165, 195, 255, 285, 345] } },
  { id: 'hexa', label: 'Hexagone', o: { base: 'hexagon', k: 1, step: 0.25 } },
  { id: 'disc', label: 'Disque à secteurs', o: { base: 'circle', rays: [0, 45, 90, 135, 180, 225, 270, 315] } },
];

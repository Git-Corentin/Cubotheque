// Illustrations vectorielles des puzzles (cartes et en-têtes de fiches). Dessinées par calcul, sans image externe.
import * as C from '../cube.js';
import { generate } from '../gabarit.js';
import { renderClock } from './clock.js';

const Y = '#FFD100', G = '#00965E', O = '#FF6A13', R = '#C8102E', B = '#0057B8', W = '#FFFFFF', P = '#8E5BD8', K = '#FF6FB5';
const f2 = (v) => Math.round(v * 100) / 100;

/** Transformation affine qui envoie trois points sources sur trois points cibles. */
function affine([a, b, c], [A, Bp, Cp]) {
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  return ([x, y]) => {
    const u = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / det;
    const v = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / det;
    return [A[0] + u * (Bp[0] - A[0]) + v * (Cp[0] - A[0]), A[1] + u * (Bp[1] - A[1]) + v * (Cp[1] - A[1])];
  };
}
const poly = (pts, fill, sw = 1.6) => `<polygon points="${pts.map((p) => p.map(f2).join(',')).join(' ')}" fill="${fill}" stroke="#111" stroke-width="${sw}" stroke-linejoin="round"/>`;
const svg = (inner, vb = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;

// faces visibles d'un cube en perspective isométrique (carré [-1,1]² → losange)
const CUBE = {
  U: [[50, 6], [88, 28], [12, 28]],
  F: [[12, 28], [50, 50], [12, 72]],
  R: [[50, 50], [88, 28], [50, 94]],
};
const SQ = [[-1, -1], [1, -1], [-1, 1]];
function cubeFaces(template, colors) {
  let out = poly([[50, 6], [88, 28], [88, 72], [50, 94], [12, 72], [12, 28]], '#111', 2.4);
  ['U', 'F', 'R'].forEach((f, k) => {
    const map = affine(SQ, CUBE[f]);
    template(f).forEach((p, i) => { out += poly(p.map(map), colors[f](i), 1.5); });
  });
  return svg(out);
}
const pick = (base, alt, every) => (i) => (i % every === every - 1 ? alt : base);

function pyraminx() {
  const tri = generate({ base: 'triangle', k: 2, step: 1 / 3 });
  const src = [[0, -1], [0.866, 0.5], [-0.866, 0.5]];
  const faces = [
    { dst: [[50, 6], [52, 94], [8, 76]], col: (i) => [G, G, Y, G, G, G, B, G, G][i % 9] },
    { dst: [[50, 6], [92, 76], [52, 94]], col: (i) => [R, R, R, G, R, R, R, R, Y][i % 9] },
  ];
  let out = '';
  for (const f of faces) { const map = affine(src, f.dst); tri.forEach((p, i) => { out += poly(p.map(map), f.col(i), 1.4); }); }
  return svg(out);
}

function megaminx() {
  const cx = 50, cy = 52, Rd = 46;
  const dec = Array.from({ length: 10 }, (_, i) => { const a = (-90 + i * 36) * Math.PI / 180; return [cx + Rd * Math.cos(a), cy + Rd * Math.sin(a)]; });
  const pent = Array.from({ length: 5 }, (_, i) => { const a = (-90 + i * 72) * Math.PI / 180; return [cx + 25 * Math.cos(a), cy + 25 * Math.sin(a)]; });
  const cols = [G, R, Y, B, P];
  let out = poly(dec, '#111', 2.4);
  for (let i = 0; i < 5; i++) {
    const p0 = pent[i], p1 = pent[(i + 1) % 5], d0 = dec[2 * i], d1 = dec[2 * i + 1], d2 = dec[(2 * i + 2) % 10];
    const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    out += poly([p0, d0, mid(d0, d1, 0.55), mid(p0, d1, 0.5), m], cols[i], 1.3);
    out += poly([m, mid(p0, d1, 0.5), d1, mid(p1, d1, 0.5)], cols[(i + 2) % 5], 1.3);
    out += poly([p1, m, mid(p1, d1, 0.5), mid(d2, d1, 0.55), d2], cols[i], 1.3);
  }
  const face = generate({ base: 'pentagon', k: 1, step: 0.2 });
  const src = [[0, -1], [Math.cos(-90 * Math.PI / 180 + 72 * Math.PI / 180), Math.sin(-18 * Math.PI / 180)], [Math.cos(198 * Math.PI / 180), Math.sin(198 * Math.PI / 180)]];
  const map = affine(src, [pent[0], pent[1], pent[4]]);
  face.forEach((p, i) => { out += poly(p.map(map), i === 3 ? O : W, 1.3); });
  return svg(out);
}

function skewb() {
  const t = () => generate({ base: 'square', midlines: true });
  return cubeFaces(t, { U: pick(Y, B, 4), F: pick(G, O, 5), R: pick(O, Y, 3) });
}

function square1() {
  const top = () => generate({ base: 'square', rays: [15, 75, 105, 165, 195, 255, 285, 345] });
  // côtés : coin (36,6 %) / arête / coin, et trois tranches (haut, milieu fin, bas)
  const side = () => {
    const xs = [-1, -0.268, 0.268, 1], ys = [-1, -0.15, 0.15, 1], out = [];
    for (let r = 0; r < 3; r++) {
      if (r === 1) { out.push([[-1, ys[1]], [1, ys[1]], [1, ys[2]], [-1, ys[2]]]); continue; }
      for (let c = 0; c < 3; c++) out.push([[xs[c], ys[r]], [xs[c + 1], ys[r]], [xs[c + 1], ys[r + 1]], [xs[c], ys[r + 1]]]);
    }
    return out;
  };
  return cubeFaces((f) => (f === 'U' ? top() : side()), { U: (i) => [Y, Y, Y, B, Y, Y, Y, Y][i % 8], F: (i) => [G, R, G, G, W, W, W][i % 7], R: (i) => [O, O, G, O, W, W, W][i % 7] });
}

function nxn(n, alg = '') {
  let st; try { st = alg ? C.applyAlg(C.solved(n), n, alg) : C.solved(n); } catch { st = C.solved(n); }
  return C.renderIso(st, n, 'jaune');
}

// Redi Cube : 4 coins carrés et 4 arêtes en « maison » dont la pointe touche le centre (relevé sur un MoYu)
const T = 1 / 3;
const REDI = [
  [[T, T], [1, T], [1, 1], [T, 1]], [[-1, T], [-T, T], [-T, 1], [-1, 1]], [[-1, -1], [-T, -1], [-T, -T], [-1, -T]], [[T, -1], [1, -1], [1, -T], [T, -T]],
  [[-T, 1], [T, 1], [T, T], [0, 0], [-T, T]], [[1, -T], [1, T], [T, T], [0, 0], [T, -T]], [[-T, -1], [T, -1], [T, -T], [0, 0], [-T, -T]], [[-1, -T], [-1, T], [-T, T], [0, 0], [-T, -T]],
];
function redi() { return cubeFaces(() => REDI, { U: (i) => (i === 6 ? O : W), F: (i) => (i === 1 ? Y : B), R: (i) => (i === 4 ? G : O) }); }
function dino() {
  const t = () => generate({ base: 'square', radV: true });
  return cubeFaces(t, { U: (i) => [Y, Y, R, Y][i % 4], F: (i) => [G, B, G, G][i % 4], R: (i) => [O, O, O, Y][i % 4] });
}
function dodeca(faceTpl, cols) {
  const cx = 50, cy = 52, Rd = 46;
  const dec = Array.from({ length: 10 }, (_, i) => { const a = (-90 + i * 36) * Math.PI / 180; return [cx + Rd * Math.cos(a), cy + Rd * Math.sin(a)]; });
  const pent = Array.from({ length: 5 }, (_, i) => { const a = (-90 + i * 72) * Math.PI / 180; return [cx + 25 * Math.cos(a), cy + 25 * Math.sin(a)]; });
  let out = poly(dec, '#111', 2.4);
  for (let i = 0; i < 5; i++) {
    // face voisine vue de biais : pentagone déformé, découpé comme la face centrale
    const quad = [pent[i], dec[2 * i], dec[2 * i + 1], dec[(2 * i + 2) % 10], pent[(i + 1) % 5]];
    const src5 = Array.from({ length: 5 }, (_, k) => { const a = (-90 + k * 72) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; });
    // projection approximative : on envoie le pentagone unité sur les 5 points de la face voisine, triangle par triangle
    faceTpl().forEach((p, k) => {
      const mapped = p.map(([x, y]) => {
        let best = 0, bd = 1e9; src5.forEach((v, j) => { const d = (x - v[0]) ** 2 + (y - v[1]) ** 2; if (d < bd) { bd = d; best = j; } });
        const j2 = (best + 1) % 5;
        const m = affine([[0, 0], src5[best], src5[j2]], [[(quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0] + quad[4][0]) / 5, (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1] + quad[4][1]) / 5], quad[best], quad[j2]]);
        return m([x, y]);
      });
      out += poly(mapped, cols[(i + 1) % cols.length](k), 1.2);
    });
  }
  const src = [[0, -1], [Math.cos(-18 * Math.PI / 180), Math.sin(-18 * Math.PI / 180)], [Math.cos(198 * Math.PI / 180), Math.sin(198 * Math.PI / 180)]];
  const map = affine(src, [pent[0], pent[1], pent[4]]);
  faceTpl().forEach((p, k) => { out += poly(p.map(map), cols[0](k), 1.3); });
  return svg(out);
}
function morphix() {
  // pyramide aux faces bombées, chaque face coupée en 4 (Pyramorphix)
  const A = [50, 5], Bp = [8, 80], Cp = [92, 80], D = [52, 96];
  const mid = (p, q, b = 0) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + b];
  const curve = (p, q, c, fill) => `<path d="M${p} Q${c} ${q}" fill="none"/>`;
  void curve;
  let out = `<path d="M${A} Q${[24, 40]} ${Bp} Q${[30, 96]} ${D} Q${[76, 96]} ${Cp} Q${[78, 40]} ${A} Z" fill="#111"/>`;
  const faceL = [A, Bp, D], faceR = [A, D, Cp];
  const sub = (f, cs) => {
    const [p, q, r] = f; const pq = mid(p, q), qr = mid(q, r), rp = mid(r, p);
    return [[p, pq, rp], [pq, q, qr], [rp, qr, r], [pq, qr, rp]].map((t, i) => `<path d="M${t[0]} Q${mid(t[0], t[1], -2)} ${t[1]} Q${mid(t[1], t[2], 2)} ${t[2]} Q${mid(t[2], t[0], -1)} ${t[0]} Z" fill="${cs[i]}" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>`).join('');
  };
  out += sub(faceL, [G, G, Y, G]) + sub(faceR, [Y, G, Y, Y]);
  return svg(out);
}

const ICONS = {
  redi, dino, morphix,
  kilominx: () => dodeca(() => generate({ base: 'pentagon', radM: true }), [() => W, (k) => [B, B, Y, B, B][k], (k) => [Y, Y, Y, R, Y][k], (k) => [R, R, R, R, P][k], (k) => [G, G, G, G, G][k], (k) => [P, O, P, P, P][k]]),
  'dino+redi': () => { const a = dino().replace(/^<svg[^>]*>|<\/svg>$/g, ''), b = redi().replace(/^<svg[^>]*>|<\/svg>$/g, ''); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 206 100"><g>${a}</g><g transform="translate(106 0)">${b}</g></svg>`; },
  pyraminx, megaminx, skewb, sq1: square1,
  clock: () => renderClock({ front: [0, 3, 0, 9, 0, 3, 6, 0, 0], back: Array(9).fill(0), pins: [true, false, false, true], marks: { front: [], back: [] }, showBack: false }),
  mirror: () => { const r = C.mirrorRelief(3, C.trackedCase(3, "R U R' U R U2 R'")); return C.renderIso(C.solved(3), 3, 'jaune', { relief: r }); },
  cuboid: () => C.renderIso(C.applyAlg(C.solved([3, 2, 3]), [3, 2, 3], "U R2 U'"), [3, 2, 3], 'jaune'),
  void: () => C.renderIso(C.applyMask(C.solved(3), 3, 'void'), 3, 'jaune'),
  supercube: () => { const t = C.trackedCase(3, "E R' E' M E R E' M'"); return C.renderIso(t.map((v) => C.geometry(3).face[v.id]), 3, 'jaune', { marks: C.pictureMarks(3, t) }); },
};

/** Illustration d'un puzzle. kind : 'nxn:3', 'pyraminx', 'skewb', 'megaminx', 'sq1', 'clock', 'mirror', 'cuboid', 'void'. */
export function puzzleIcon(kind) {
  if (!kind) return '';
  if (kind.startsWith('nxn:')) return nxn(+kind.slice(4), +kind.slice(4) > 3 ? 'R U' : "R U R'");
  try { return ICONS[kind]?.() || ''; } catch { return ''; }
}

/** Icône déduite du contenu d'une fiche. */
export function iconFor(sheet) {
  if (sheet.icon) return sheet.icon;
  const pl = sheet.blocks?.find((b) => b.type === 'player');
  const map = { '2x2x2': 'nxn:2', '3x3x3': 'nxn:3', '4x4x4': 'nxn:4', '5x5x5': 'nxn:5', '6x6x6': 'nxn:6', '7x7x7': 'nxn:7', pyraminx: 'pyraminx', master_tetraminx: 'pyraminx', skewb: 'skewb', megaminx: 'megaminx', gigaminx: 'megaminx', kilominx: 'kilominx', redi_cube: 'redi', square1: 'sq1', clock: 'clock' };
  if (pl && map[pl.puzzle]) return map[pl.puzzle];
  if (sheet.blocks?.some((b) => b.type === 'clock')) return 'clock';
  return null;
}

// Moteur de cubes et cuboïdes (NxNxN et AxBxC) en notation WCA / SiGN + rendus SVG.
// Taille : un nombre (3 → 3x3x3) ou un triplet [X, Y, Z] (largeur R-L, hauteur U-D, profondeur F-B).
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const FD = {
  U: { n: [0, 1, 0], r: [1, 0, 0], d: [0, 0, 1] },
  R: { n: [1, 0, 0], r: [0, 0, -1], d: [0, -1, 0] },
  F: { n: [0, 0, 1], r: [1, 0, 0], d: [0, -1, 0] },
  D: { n: [0, -1, 0], r: [1, 0, 0], d: [0, 0, -1] },
  L: { n: [-1, 0, 0], r: [0, 0, 1], d: [0, -1, 0] },
  B: { n: [0, 0, -1], r: [-1, 0, 0], d: [0, -1, 0] },
};
export const SCHEMES = {
  jaune: { U: '#FFD100', F: '#00965E', R: '#FF6A13', D: '#FFFFFF', L: '#C8102E', B: '#0057B8' },
  blanc: { U: '#FFFFFF', F: '#00965E', R: '#C8102E', D: '#FFD100', L: '#FF6A13', B: '#0057B8' },
};
export const EXTRA = { x: '#5B6068', k: '#161616', p: '#FF6FB5', v: '#8E5BD8', c: '#5CD6E8', o: '#000000' };
export const colorOf = (code, scheme = 'jaune') => SCHEMES[scheme]?.[code] || EXTRA[code] || '#999';

const axisOf = (v) => (v[0] ? 0 : v[1] ? 1 : 2);
export const dimsOf = (size) => (Array.isArray(size) ? size.map(Number) : [+size, +size, +size]);
export const sizeLabel = (size) => dimsOf(size).join('x');

const geo = new Map();
export function geometry(size) {
  const dims = dimsOf(size);
  const k = dims.join('x');
  if (geo.has(k)) return geo.get(k);
  const pos = [], nor = [], face = [], row = [], col = [], key = new Map(), faceInfo = {};
  FACES.forEach((f) => {
    const { n: N, r: R, d: D } = FD[f];
    const w = dims[axisOf(R)], h = dims[axisOf(D)], s = dims[axisOf(N)];
    faceInfo[f] = { start: pos.length, w, h };
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const a = 2 * c - (w - 1), b = 2 * r - (h - 1);
      const p = [0, 1, 2].map((m) => N[m] * s + R[m] * a + D[m] * b);
      key.set(p.join(',') + '|' + N.join(','), pos.length);
      pos.push(p); nor.push(N); face.push(f); row.push(r); col.push(c);
    }
  });
  const g = { dims, pos, nor, face, row, col, key, faceInfo, count: pos.length };
  geo.set(k, g);
  return g;
}

export const solved = (size) => geometry(size).face.slice();

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function rotCW(v, A) { const c = cross(A, v), d = dot(A, v); return [0, 1, 2].map((k) => -c[k] + A[k] * d); }

/** Analyse un mouvement. Retourne { face, lo, hi, amt, tok }. */
export function parseMove(tok, size) {
  const dims = dimsOf(size);
  const sAlong = (f) => dims[axisOf(FD[f].n)];
  let m = tok.match(/^([xyz])(\d*)('?)$/);
  let face, lo, hi, cnt, prime;
  if (m) { face = { x: 'R', y: 'U', z: 'F' }[m[1]]; lo = 1; hi = sAlong(face); cnt = m[2]; prime = m[3]; }
  else if ((m = tok.match(/^([MES])(\d*)('?)$/))) {
    face = { M: 'L', E: 'D', S: 'F' }[m[1]]; lo = 2; hi = sAlong(face) - 1; cnt = m[2]; prime = m[3];
    if (hi < 2) throw new Error(`« ${tok} » n'existe pas sur un ${sizeLabel(size)}`);
  } else if ((m = tok.match(/^([urfdlb])(\d*)('?)$/))) { face = m[1].toUpperCase(); lo = 1; hi = Math.min(2, sAlong(face)); cnt = m[2]; prime = m[3]; }
  else if ((m = tok.match(/^(\d+)?(?:-(\d+))?([URFDLB])(w?)(\d*)('?)$/))) {
    face = m[3]; cnt = m[5]; prime = m[6];
    const a = m[1] ? +m[1] : null, b = m[2] ? +m[2] : null;
    if (b) { lo = a; hi = b; } else if (m[4]) { lo = 1; hi = a || 2; } else if (a) { lo = a; hi = a; } else { lo = 1; hi = 1; }
    if (hi > sAlong(face)) throw new Error(`« ${tok} » dépasse les ${sAlong(face)} couches`);
  } else throw new Error(`Mouvement inconnu : « ${tok} »`);
  const amt = ((((cnt ? +cnt : 1) * (prime ? -1 : 1)) % 4) + 4) % 4;
  const ax = axisOf(FD[face].n);
  const others = [0, 1, 2].filter((k) => k !== ax);
  if (amt % 2 && dims[others[0]] !== dims[others[1]]) throw new Error(`« ${tok} » : un quart de tour est impossible sur ce cuboïde, seulement des demi-tours (${tok.replace(/'?$/, '').replace(/\d*$/, '')}2)`);
  return { face, lo, hi, amt, tok };
}

/** Découpe un algorithme en mouvements (gère (R U R' U')3 et les commentaires //). */
export function tokens(alg) {
  const clean = String(alg || '').replace(/\/\/.*$/gm, '').replace(/[’`´]/g, '\'').replace(/,/g, ' ');
  if (/[[\]:]/.test(clean)) throw new Error('Les commutateurs [A, B] ne sont pas pris en charge ici : écrivez les mouvements à plat.');
  const raw = clean.match(/\(|\)\d*'?|[^\s()]+/g) || [];
  const stack = [[]];
  for (const t of raw) {
    if (t === '(') stack.push([]);
    else if (t.startsWith(')')) {
      const grp = stack.pop(); if (!stack.length) throw new Error('Parenthèse fermante en trop');
      let k = parseInt(t.slice(1)) || 1;
      const seq = t.endsWith('\'') ? invertList(grp) : grp;
      while (k--) stack[stack.length - 1].push(...seq);
    } else stack[stack.length - 1].push(t);
  }
  if (stack.length !== 1) throw new Error('Parenthèse non fermée');
  return stack[0];
}
function invertTok(t) { if (t.endsWith('\'')) return t.slice(0, -1); if (/2$/.test(t)) return t; return t + '\''; }
const invertList = (list) => list.slice().reverse().map(invertTok);
export const invertAlg = (alg) => invertList(tokens(alg)).join(' ');

/** Applique un mouvement. f(valeur, axe) permet de transformer les valeurs déplacées (suivi d'orientation). */
export function applyMove(st, size, mv, f) {
  if (!mv.amt) return st;
  const { pos, nor, key, dims } = geometry(size);
  const A = FD[mv.face].n;
  const s = dims[axisOf(A)];
  // demi-tour en une seule passe (indispensable sur les cuboïdes), quarts de tour sinon
  const steps = mv.amt === 2 ? [2] : Array(mv.amt).fill(1);
  const rot = (v, q) => (q === 2 ? [0, 1, 2].map((k) => 2 * A[k] * dot(A, v) - v[k]) : rotCW(v, A));
  let cur = st;
  for (const q of steps) {
    const next = cur.slice();
    for (let i = 0; i < pos.length; i++) {
      const c = dot(pos[i], A);
      const k = c === s ? 1 : c === -s ? s : (s + 1 - c) / 2;
      if (k < mv.lo || k > mv.hi) continue;
      const j = key.get(rot(pos[i], q).join(',') + '|' + rot(nor[i], q).join(','));
      if (j === undefined) throw new Error('Mouvement impossible sur cette forme');
      let v = cur[i];
      if (f) { v = f(v, A); if (q === 2) v = f(v, A); }
      next[j] = v;
    }
    cur = next;
  }
  return cur;
}
export function applyAlg(st, size, alg, f) {
  let s = st;
  for (const t of tokens(alg)) s = applyMove(s, size, parseMove(t, size), f);
  return s;
}

/** Rotation de tout le cube qui remet les centres à leur place (cubes à faces impaires). */
const ROTS = ['', 'y', 'y2', 'y\'', 'x', 'x y', 'x y2', 'x y\'', 'x2', 'x2 y', 'x2 y2', 'x2 y\'', 'x\'', 'x\' y', 'x\' y2', 'x\' y\'', 'z', 'z y', 'z y2', 'z y\'', 'z\'', 'z\' y', 'z\' y2', 'z\' y\''];
export function reorientAlg(st, size) {
  const g = geometry(size);
  const centers = FACES.map((f) => { const { start, w, h } = g.faceInfo[f]; return w % 2 && h % 2 ? start + ((h - 1) / 2) * w + (w - 1) / 2 : -1; }).filter((i) => i >= 0);
  if (!centers.length) return '';
  const ok = (s) => centers.every((i) => s[i] === g.face[i]);
  if (ok(st)) return '';
  for (const r of ROTS) { try { if (ok(applyAlg(st, size, r))) return r; } catch { /* quart de tour impossible sur ce cuboïde */ } }
  return '';
}

/** État montré pour un cas : cube résolu, préparation, puis l'inverse de l'algorithme, réorienté. */
export function caseState(size, alg, setup = '') {
  let s = solved(size);
  if (setup) s = applyAlg(s, size, setup);
  if (alg) s = applyAlg(s, size, invertAlg(alg));
  const r = reorientAlg(s, size);
  return r ? applyAlg(s, size, r) : s;
}
/** Même chose, mais chaque autocollant garde son identité et son orientation (pour les Mirror). */
export function trackedCase(size, alg, setup = '') {
  const g = geometry(size);
  let s = g.pos.map((_, i) => ({ id: i, r: FD[g.face[i]].r }));
  const f = (v, A) => ({ id: v.id, r: rotCW(v.r, A) });
  if (setup) s = applyAlg(s, size, setup, f);
  if (alg) s = applyAlg(s, size, invertAlg(alg), f);
  const colors = s.map((v) => g.face[v.id]);
  const r = reorientAlg(colors, size);
  return r ? applyAlg(s, size, r, f) : s;
}

export function applyMask(st, size, mask) {
  if (!mask || mask === 'none') return st;
  const g = geometry(size);
  const Y = g.dims[1];
  return st.map((c, i) => {
    const top = g.pos[i][1] >= Y - 1;
    const { w, h } = g.faceInfo[g.face[i]];
    const inner = g.row[i] > 0 && g.row[i] < h - 1 && g.col[i] > 0 && g.col[i] < w - 1;
    switch (mask) {
      case 'oll': return top && c === 'U' ? c : 'x';
      case 'pll': case 'll': return top ? c : 'x';
      case 'f2l': return top ? 'x' : c;
      case 'cross': {
        const f = g.face[i], corner = (g.row[i] === 0 || g.row[i] === h - 1) && (g.col[i] === 0 || g.col[i] === w - 1);
        if (f === 'D') return corner ? 'x' : c;
        if (f === 'U') return 'x';
        return g.row[i] === h - 1 && !corner ? c : 'x';
      }
      case 'void': return inner ? 'o' : c;
      case 'grey': return 'x';
      default: return c;
    }
  });
}

/** Relief d'un Mirror : chaque autocollant reçoit la taille et la saillie de sa pièce d'origine. */
export function mirrorRelief(size, tracked) {
  const g = geometry(size);
  const AMP = [0.32, 0.42, 0.22];
  const th = (ax, idx) => { const s = g.dims[ax]; return s < 2 ? 1 : 1 + AMP[ax] * ((2 * idx) / (s - 1) - 1); };
  return tracked.map((v, i) => {
    const o = v.id, p = g.pos[o], N = g.nor[o], F = FD[g.face[o]];
    const T = [0, 1, 2].map((ax) => { const s = g.dims[ax]; const q = Math.abs(p[ax]) === s ? (p[ax] > 0 ? s - 1 : 0) : (p[ax] + s - 1) / 2; return th(ax, q); });
    const Rf = FD[g.face[i]].r;
    const parallel = Math.abs(dot(v.r, Rf)) === 1;
    const ra = axisOf(F.r), da = axisOf(F.d);
    return { w: parallel ? T[ra] : T[da], h: parallel ? T[da] : T[ra], p: T[axisOf(N)] };
  });
}
const gold = (p) => `hsl(44 62% ${Math.round(Math.max(28, Math.min(78, 34 + (p - 0.55) * 45)))}%)`;

/* ---------- rendus SVG ---------- */
const svgOpen = (vb, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}>`;
const f3 = (v) => Math.round(v * 1000) / 1000;

export function renderNet(st, size, scheme = 'jaune', { interactive = false, relief = null } = {}) {
  const g = geometry(size);
  const [X, Y, Z] = g.dims;
  const s = 12, gap = 4;
  const colX = [0, Z * s + gap, (Z + X) * s + 2 * gap, (2 * Z + X) * s + 3 * gap];
  const rowY = [0, Z * s + gap, (Z + Y) * s + 2 * gap];
  const at = { U: [colX[1], rowY[0]], L: [colX[0], rowY[1]], F: [colX[1], rowY[1]], R: [colX[2], rowY[1]], B: [colX[3], rowY[1]], D: [colX[1], rowY[2]] };
  const W = colX[3] + X * s, H = rowY[2] + Z * s;
  let out = svgOpen(`-2 -2 ${W + 4} ${H + 8}`, interactive ? 'class="net-svg"' : '');
  FACES.forEach((f) => {
    const [fx, fy] = at[f]; const { start, w, h } = g.faceInfo[f];
    out += `<rect x="${fx - 1}" y="${fy - 1}" width="${w * s + 2}" height="${h * s + 2}" rx="2" fill="#000"/>`;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const i = start + r * w + c;
      const da = interactive ? `data-i="${i}" style="cursor:pointer"` : '';
      if (relief) {
        const rf = relief[i]; const rw = Math.min(1.5, rf.w) * (s - 1.4), rh = Math.min(1.5, rf.h) * (s - 1.4);
        out += `<rect ${da} x="${f3(fx + c * s + s / 2 - rw / 2)}" y="${f3(fy + r * s + s / 2 - rh / 2)}" width="${f3(rw)}" height="${f3(rh)}" rx="1.4" fill="${st[i] === 'x' ? colorOf('x') : gold(rf.p)}" stroke="#000" stroke-width=".5"/>`;
      } else out += `<rect ${da} x="${fx + c * s + 0.7}" y="${fy + r * s + 0.7}" width="${s - 1.4}" height="${s - 1.4}" rx="1.6" fill="${colorOf(st[i], scheme)}"/>`;
    }
    if (interactive) out += `<text x="${fx + (w * s) / 2}" y="${fy + h * s + 4.4}" font-size="3.6" text-anchor="middle" fill="currentColor" opacity=".6">${f}</text>`;
  });
  return out + '</svg>';
}

export function renderIso(st, size, scheme = 'jaune', { relief = null } = {}) {
  const g = geometry(size);
  const P = ([x, y, z]) => [(x - z) * 0.866, (x + z) * 0.5 - y];
  const gp = 0.86;
  const dm = g.dims;
  let polys = '';
  const faceQuad = (f) => {
    const { n: N, r: R, d: D } = FD[f];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P([0, 1, 2].map((k) => N[k] * dm[k] + R[k] * a * dm[k] + D[k] * b * dm[k])));
  };
  const sw = 0.25 * Math.max(...dm) / 3 + 0.2;
  for (const f of ['U', 'F', 'R']) polys += `<polygon points="${faceQuad(f).map((p) => p.map(f3).join(',')).join(' ')}" fill="#000" stroke="#000" stroke-width="${f3(sw)}" stroke-linejoin="round"/>`;
  for (const f of ['U', 'F', 'R']) {
    const { start, w, h } = g.faceInfo[f]; const { r: R, d: D } = FD[f];
    for (let k = 0; k < w * h; k++) {
      const i = start + k; const c = g.pos[i];
      let sw2 = gp, sh2 = gp, fill = colorOf(st[i], scheme);
      if (relief) { sw2 = gp * Math.min(1.45, relief[i].w); sh2 = gp * Math.min(1.45, relief[i].h); fill = st[i] === 'x' ? colorOf('x') : gold(relief[i].p); }
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P([0, 1, 2].map((m) => c[m] + R[m] * a * sw2 + D[m] * b * sh2)));
      polys += `<polygon points="${pts.map((p) => p.map(f3).join(',')).join(' ')}" fill="${fill}" ${relief ? 'stroke="#000" stroke-width=".12"' : ''} stroke-linejoin="round"/>`;
    }
  }
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(P([sx * dm[0], sy * dm[1], sz * dm[2]]));
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  const pad = 0.8;
  return svgOpen(`${f3(Math.min(...xs) - pad)} ${f3(Math.min(...ys) - pad)} ${f3(Math.max(...xs) - Math.min(...xs) + 2 * pad)} ${f3(Math.max(...ys) - Math.min(...ys) + 2 * pad)}`) + polys + '</svg>';
}

/** Vue de dessus façon fiche OLL/PLL : face U + bandeaux latéraux + flèches. */
export function renderTop(st, size, scheme = 'jaune', arrows = [], { interactive = false, relief = null } = {}) {
  const g = geometry(size);
  const [X, , Z] = g.dims;
  const s = 10, side = 3.2, m = 1.2, off = side + m;
  const W = X * s + 2 * off, H = Z * s + 2 * off;
  const U = g.faceInfo.U, Fi = g.faceInfo.F, Ri = g.faceInfo.R, Bi = g.faceInfo.B, Li = g.faceInfo.L;
  let out = svgOpen(`-1 -1 ${W + 2} ${H + 2}`);
  out += `<defs><marker id="ah" viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#000"/></marker></defs>`;
  out += `<rect x="${off - 0.8}" y="${off - 0.8}" width="${X * s + 1.6}" height="${Z * s + 1.6}" rx="1.6" fill="#000"/>`;
  for (let r = 0; r < Z; r++) for (let c = 0; c < X; c++) {
    const i = U.start + r * X + c;
    const da = interactive ? `data-u="${r * X + c}" style="cursor:pointer"` : '';
    if (relief) {
      const rf = relief[i]; const rw = Math.min(1.5, rf.w) * (s - 1.2), rh = Math.min(1.5, rf.h) * (s - 1.2);
      out += `<rect ${da} x="${f3(off + c * s + s / 2 - rw / 2)}" y="${f3(off + r * s + s / 2 - rh / 2)}" width="${f3(rw)}" height="${f3(rh)}" rx="1.2" fill="${gold(rf.p)}" stroke="#000" stroke-width=".5"/>`;
    } else out += `<rect ${da} x="${off + c * s + 0.6}" y="${off + r * s + 0.6}" width="${s - 1.2}" height="${s - 1.2}" rx="1.3" fill="${colorOf(st[i], scheme)}"/>`;
  }
  const strip = (x, y, w, h, i) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.8" fill="${relief ? gold(relief[i].p) : colorOf(st[i], scheme)}" stroke="#000" stroke-width="0.5"/>`;
  for (let c = 0; c < X; c++) {
    out += strip(off + c * s + 0.6, off + Z * s + m, s - 1.2, side, Fi.start + c);
    out += strip(off + (X - 1 - c) * s + 0.6, 0, s - 1.2, side, Bi.start + c);
  }
  for (let c = 0; c < Z; c++) {
    out += strip(off + X * s + m, off + (Z - 1 - c) * s + 0.6, side, s - 1.2, Ri.start + c);
    out += strip(0, off + c * s + 0.6, side, s - 1.2, Li.start + c);
  }
  const ctr = (u) => [off + (u % X) * s + s / 2, off + Math.floor(u / X) * s + s / 2];
  for (const [a, b, both] of arrows || []) {
    const [x1, y1] = ctr(a), [x2, y2] = ctr(b);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len, sh = 1.8;
    out += `<line x1="${f3(x1 + ux * sh)}" y1="${f3(y1 + uy * sh)}" x2="${f3(x2 - ux * sh)}" y2="${f3(y2 - uy * sh)}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
    out += `<line x1="${f3(x1 + ux * sh)}" y1="${f3(y1 + uy * sh)}" x2="${f3(x2 - ux * sh)}" y2="${f3(y2 - uy * sh)}" stroke="#000" stroke-width="1.15" stroke-linecap="round" marker-end="url(#ah)" ${both ? 'marker-start="url(#ah)"' : ''}/>`;
  }
  return out + '</svg>';
}

export function renderView(view, st, size, scheme, arrows, opts = {}) {
  if (view === 'iso') return renderIso(st, size, scheme, opts);
  if (view === 'top') return renderTop(st, size, scheme, arrows, opts);
  return renderNet(st, size, scheme, opts);
}

/** Flèches de permutation calculées : où doit aller chaque pièce de la face du dessus. */
export function autoArrows(size, alg, setup = '') {
  const g = geometry(size);
  const tr = trackedCase(size, alg, setup);
  const U = g.faceInfo.U, X = U.w, Z = U.h, Y = g.dims[1];
  // autocollant → autocollant de la face U de la même pièce (si elle appartient à la couche du haut)
  const uOf = (o) => {
    const p = g.pos[o], N = g.nor[o];
    const q = [p[0] - N[0], p[1] - N[1], p[2] - N[2]];
    const j = g.key.get(`${q[0]},${Y},${q[2]}|0,1,0`);
    return q[1] === Y - 1 && j !== undefined ? j - U.start : -1;
  };
  const isCenter = (u) => { const r = Math.floor(u / X), c = u % X; return r > 0 && r < Z - 1 && c > 0 && c < X - 1; };
  const dest = [];
  for (let u = 0; u < X * Z; u++) dest[u] = uOf(tr[U.start + u].id);
  const out = [], seen = new Set();
  for (let u = 0; u < X * Z; u++) {
    const to = dest[u];
    if (to === u || to < 0 || isCenter(u) || isCenter(to) || seen.has(u + '>' + to)) continue;
    if (dest[to] === u) { out.push([u, to, 1]); seen.add(to + '>' + u); } else out.push([u, to]);
    seen.add(u + '>' + to);
  }
  return out;
}

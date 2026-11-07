// Mélanges : cubing.js (état aléatoire officiel) si disponible, sinon générateurs locaux à coups aléatoires.

export const EVENTS = [
  { id: '333', label: '3x3x3', twisty: '3x3x3' },
  { id: '222', label: '2x2x2', twisty: '2x2x2' },
  { id: '444', label: '4x4x4', twisty: '4x4x4' },
  { id: '555', label: '5x5x5', twisty: '5x5x5' },
  { id: '666', label: '6x6x6', twisty: '6x6x6' },
  { id: '777', label: '7x7x7', twisty: '7x7x7' },
  { id: 'pyram', label: 'Pyraminx', twisty: 'pyraminx' },
  { id: 'minx', label: 'Megaminx', twisty: 'megaminx' },
  { id: 'skewb', label: 'Skewb', twisty: 'skewb' },
  { id: 'sq1', label: 'Square-1', twisty: 'square1' },
  { id: 'clock', label: 'Clock', twisty: 'clock' },
  { id: 'fto', label: 'FTO', twisty: 'fto' },
  { id: 'master_tetraminx', label: 'Master Tetraminx', twisty: 'master_tetraminx' },
  { id: 'kilominx', label: 'Kilominx', twisty: 'kilominx' },
  { id: 'redi_cube', label: 'Redi Cube', twisty: 'redi_cube' },
  { id: 'baby_fto', label: 'Baby FTO', twisty: 'baby_fto' },
  { id: 'none', label: 'Sans mélange (puzzle libre)' },
];
export const eventById = (id) => EVENTS.find((e) => e.id === id) || EVENTS[0];

export function guessEvent(item) {
  if (item?.event) return item.event;
  const s = ((item?.name || '') + ' ' + (item?.size || '')).toLowerCase();
  if (/kilominx/.test(s)) return 'kilominx';
  if (/megaminx/.test(s)) return 'minx';
  if (/master (pyraminx|tetraminx)/.test(s)) return 'master_tetraminx';
  if (/pyraminx/.test(s)) return 'pyram';
  if (/skewb/.test(s)) return 'skewb';
  if (/square[- ]?1|sq-?1/.test(s)) return 'sq1';
  if (/clock/.test(s)) return 'clock';
  if (/baby fto/.test(s)) return 'baby_fto';
  if (/fto|face turning octa/.test(s)) return 'fto';
  if (/redi/.test(s)) return 'redi_cube';
  if (/mirror|axis|ghost|fisher|windmill|mastermorphix|pillow|penrose|barrel/.test(s)) return '333';
  const m = s.match(/(\d)\s*x\s*(\d)(?:\s*x\s*(\d))?/);
  if (m && m[1] === m[2] && (!m[3] || m[3] === m[1]) && +m[1] >= 2 && +m[1] <= 7) return `${m[1]}${m[1]}${m[1]}`;
  if (item?.category === 'nxn' || /rubik|cube/.test(s)) return '333';
  return 'none';
}

/* ---------- cubing.js ---------- */
let cubingScr = null, cubingFailed = false;
async function viaCubing(ev, timeout) {
  if (cubingFailed) return null;
  try {
    cubingScr ||= import('https://cdn.cubing.net/v0/js/cubing/scramble');
    const mod = await cubingScr;
    const alg = await Promise.race([mod.randomScrambleForEvent(ev), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout))]);
    return alg.toString();
  } catch (e) {
    if (String(e.message).includes('Failed to fetch') || String(e).includes('import')) cubingFailed = true;
    return null;
  }
}

export async function getScramble(ev, { official = true } = {}) {
  if (ev === 'none') return '';
  if (official) { const s = await viaCubing(ev, 9000); if (s) return s; }
  return local(ev);
}

/* ---------- générateurs locaux ---------- */
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const AX = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };

function nxn(n) {
  const len = { 2: 11, 3: 20, 4: 40, 5: 60, 6: 80, 7: 100 }[n] || 30;
  let faces = n === 2 ? ['R', 'U', 'F'] : ['R', 'L', 'U', 'D', 'F', 'B'];
  const moves = faces.map((f) => ({ f, s: f }));
  if (n >= 4) ['R', 'U', 'F'].forEach((f) => moves.push({ f: f + 'w', s: f + 'w', ax: f }));
  if (n >= 5) ['L', 'D', 'B'].forEach((f) => moves.push({ f: f + 'w', s: f + 'w', ax: f }));
  if (n >= 6) ['R', 'U', 'F'].forEach((f) => moves.push({ f: '3' + f + 'w', s: '3' + f + 'w', ax: f }));
  const out = []; let last = null, prevAx = [];
  while (out.length < len) {
    const m = pick(moves);
    const ax = AX[m.ax || m.f[0]] ?? AX[m.f.replace(/\d|w/g, '')];
    if (last === m.f) continue;
    if (prevAx.length >= 2 && prevAx[prevAx.length - 1] === ax && prevAx[prevAx.length - 2] === ax) continue;
    out.push(m.s + pick(['', '\'', '2']));
    prevAx.push(ax); last = m.f;
  }
  return out.join(' ');
}

function randomFaces(faces, len, mods = ['', '\'']) {
  const out = []; let last = null;
  while (out.length < len) { const f = pick(faces); if (f === last) continue; last = f; out.push(f + pick(mods)); }
  return out.join(' ');
}

function pyraminx() {
  const s = randomFaces(['U', 'L', 'R', 'B'], 10);
  const tips = ['u', 'l', 'r', 'b'].map((t) => [t, t + '\'', null][rnd(3)]).filter(Boolean);
  return [s, ...tips].join(' ');
}

function megaminx(lines = 7, per = 10) {
  const out = [];
  for (let l = 0; l < lines; l++) {
    const row = [];
    for (let i = 0; i < per; i++) row.push((i % 2 ? 'D' : 'R') + pick(['++', '--']));
    row.push(pick(['U', 'U\'']));
    out.push(row.join(' '));
  }
  return out.join('\n');
}

function clock() {
  const v = () => { const x = rnd(12) - 5; return x >= 0 ? `${x}+` : `${-x}-`; };
  const parts = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'].map((p) => p + v());
  parts.push('y2', ...['U', 'R', 'D', 'L', 'ALL'].map((p) => p + v()));
  const pins = ['UR', 'DR', 'DL', 'UL'].filter(() => Math.random() < 0.5);
  return parts.concat(pins).join(' ');
}

function square1() {
  // couche = 12 unités ; un coin occupe 2 unités consécutives (même identifiant)
  let top = [0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7];
  let bot = [8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15];
  const rot = (a, k) => { k = ((k % 12) + 12) % 12; return a.slice(12 - k).concat(a.slice(0, 12 - k)); };
  const ok = (a) => a[11] !== a[0] && a[5] !== a[6];
  const out = [];
  let guard = 0;
  while (out.length < 12 && guard++ < 5000) {
    const x = rnd(12) - 5, y = rnd(12) - 5;
    if (x === 0 && y === 0 && out.length) continue;
    const t = rot(top, x), b = rot(bot, y);
    if (!ok(t) || !ok(b)) continue;
    const tr = t.slice(6), br = b.slice(6);
    top = t.slice(0, 6).concat(br.reverse()); bot = b.slice(0, 6).concat(tr.reverse());
    out.push(`(${x},${y})`);
  }
  return out.join(' / ') + ' /';
}

export function local(ev) {
  if (/^\d{3}$/.test(ev)) return nxn(+ev[0]);
  switch (ev) {
    case 'pyram': return pyraminx();
    case 'skewb': return randomFaces(['R', 'U', 'L', 'B'], 9);
    case 'minx': return megaminx();
    case 'kilominx': return megaminx(4, 10);
    case 'clock': return clock();
    case 'sq1': return square1();
    case 'fto': return randomFaces(['U', 'F', 'R', 'L', 'B', 'D', 'BR', 'BL'], 30);
    case 'baby_fto': return randomFaces(['U', 'F', 'R', 'L', 'B', 'D', 'BR', 'BL'], 12);
    case 'master_tetraminx': return randomFaces(['U', 'L', 'R', 'B', 'Uw', 'Lw', 'Rw', 'Bw'], 30);
    case 'redi_cube': return randomFaces(['R', 'L', 'x'], 22);
    default: return '';
  }
}

// Puzzles que le lecteur 3D (cubing.js) sait afficher et animer.
export const TWISTY = [
  ['3x3x3', '3x3x3'], ['2x2x2', '2x2x2'], ['4x4x4', '4x4x4'], ['5x5x5', '5x5x5'], ['6x6x6', '6x6x6'], ['7x7x7', '7x7x7'],
  ['megaminx', 'Megaminx'], ['gigaminx', 'Gigaminx'], ['kilominx', 'Kilominx'], ['pyraminx', 'Pyraminx'], ['master_tetraminx', 'Master Tetraminx'],
  ['skewb', 'Skewb'], ['square1', 'Square-1'], ['clock', 'Clock'], ['fto', 'FTO'], ['baby_fto', 'Baby FTO'], ['redi_cube', 'Redi Cube'],
  ['melindas2x2x2x2', 'Melinda\'s 2x2x2x2'], ['tri_quad', 'Tri-Quad'],
];

// Géométries nommées de puzzle-geometry (cubing.js) : forme (c cube, t tétraèdre, o octaèdre,
// d dodécaèdre, i icosaèdre) suivie des coupes (f faces, v sommets, e arêtes) et de leur profondeur.
export const PG = [
  ['Cubes', [
    ['8x8x8', 'c f 0.75 f 0.5 f 0.25 f 0'], ['9x9x9', 'c f 0.777777777777778 f 0.555555555555556 f 0.333333333333333 f 0.111111111111111'],
    ['10x10x10', 'c f 0.8 f 0.6 f 0.4 f 0.2 f 0'], ['11x11x11', 'c f 0.818181818181818 f 0.636363636363636 f 0.454545454545455 f 0.272727272727273 f 0.0909090909090909'],
    ['12x12x12', 'c f 0.833333333333333 f 0.666666666666667 f 0.5 f 0.333333333333333 f 0.166666666666667 f 0'],
    ['13x13x13', 'c f 0.846153846153846 f 0.692307692307692 f 0.538461538461538 f 0.384615384615385 f 0.230769230769231 f 0.0769230769230769'],
  ]],
  ['Rotation par les coins', [
    ['Skewb', 'c v 0'], ['Master Skewb', 'c v 0.275'], ['Professor Skewb', 'c v 0 v 0.38'], ['Compy Cube', 'c v 0.915641442663986'], ['Dino Cube', 'c v 0.577350269189626'],
  ]],
  ['Rotation par les arêtes', [
    ['Helicopter Cube', 'c e 0.707106781186547'], ['Curvy Copter', 'c e 0.83'], ['Little Chop', 'c e 0'],
  ]],
  ['Hybrides', [
    ['2x2x2 + Dino', 'c f 0 v 0.577350269189626'], ['2x2x2 + Little Chop', 'c f 0 e 0'], ['Dino + Little Chop', 'c v 0.577350269189626 e 0'],
    ['2x2x2 + Dino + Little Chop', 'c f 0 v 0.577350269189626 e 0'], ['Megaminx + Chopasaurus', 'd f 0.61803398875 v 0'], ['Starminx combo', 'd f 0.23606797749979 v 0.937962370425399'],
  ]],
  ['Tétraèdres', [
    ['Pyramorphix', 't e 0'], ['Mastermorphix', 't e 0.346184634065199'], ['Master Pyramorphix', 't e 0.866025403784437'],
    ['Pyraminx', 't v 0.333333333333333 v 1.66666666666667'], ['Tetraminx', 't v 0.333333333333333'], ['Master Pyraminx', 't v 0 v 1 v 2'],
    ['Professor Pyraminx', 't v -0.2 v 0.6 v 1.4 v 2.2'], ['Royal Pyraminx', 't v -0.333333333333333 v 0.333333333333333 v 1 v 1.66666666666667 v 2.33333333333333'],
    ['Emperor Pyraminx', 't v -0.428571428571429 v 0.142857142857143 v 0.714285714285714 v 1.28571428571429 v 1.85714285714286 v 2.42857142857143'],
    ['Jing\'s Pyraminx', 't f 0'],
  ]],
  ['Octaèdres', [
    ['Skewb Diamond', 'o f 0'], ['FTO', 'o f 0.333333333333333'], ['Master FTO', 'o f 0.5 f 0'], ['Christopher\'s Jewel', 'o v 0.577350269189626'],
    ['Octastar', 'o e 0'], ['Trajber\'s Octahedron', 'o v 0.433012701892219'],
  ]],
  ['Dodécaèdres', [
    ['Megaminx', 'd f 0.7'], ['Gigaminx', 'd f 0.64 f 0.82'], ['Teraminx', 'd f 0.64 f 0.76 f 0.88'], ['Petaminx', 'd f 0.64 f 0.73 f 0.82 f 0.91'],
    ['Examinx', 'd f 0.64 f 0.712 f 0.784 f 0.856 f 0.928'], ['Zetaminx', 'd f 0.64 f 0.7 f 0.76 f 0.82 f 0.88 f 0.94'],
    ['Yottaminx', 'd f 0.64 f 0.6914 f 0.7429 f 0.7943 f 0.8457 f 0.8971 f 0.9486'],
    ['Pentultimate', 'd f 0'], ['Master Pentultimate', 'd f 0.1'], ['Elite Pentultimate', 'd f 0 f 0.145905'],
    ['Starminx', 'd v 0.937962370425399'], ['Starminx 2', 'd f 0.23606797749979'], ['Pyraminx Crystal', 'd f 0.447213595499989'],
    ['Chopasaurus', 'd v 0'], ['Big Chop', 'd e 0'],
  ]],
  ['Icosaèdres', [
    ['Radio Chop', 'i f 0'], ['Icosamate', 'i v 0'], ['Regular Astrominx', 'i v 0.18759247376021'], ['Redicosahedron', 'i v 0.794654472291766'],
    ['Icosaminx', 'i v 0.73'], ['Eitan\'s Star', 'i f 0.61803398874989'],
  ]],
];
export const pgDesc = (name) => { for (const [, list] of PG) for (const [n, d] of list) if (n === name) return d; return null; };

export const STICKERINGS = [['full', 'Complet'], ['OLL', 'OLL'], ['PLL', 'PLL'], ['LL', 'Dernière couche'], ['F2L', 'F2L'], ['Cross', 'Croix'], ['EOline', 'EOLine'], ['CMLL', 'CMLL'], ['OCLL', 'OCLL'], ['COLL', 'COLL'], ['ZBLL', 'ZBLL'], ['Daisy', 'Marguerite'], ['picture', 'Image'], ['invisible', 'Invisible']];

let twistyP;
export const loadTwisty = () => (twistyP ||= import('https://cdn.cubing.net/v0/js/cubing/twisty'));

/** Configure un <twisty-player> à partir d'un bloc lecteur. */
export function configurePlayer(player, b, { controls = true } = {}) {
  const desc = b.puzzle?.startsWith('pg:') ? pgDesc(b.puzzle.slice(3)) : b.puzzle === 'custom' ? b.pg : null;
  if (desc) { player.removeAttribute('puzzle'); player.setAttribute('experimental-puzzle-description', desc); }
  else { player.removeAttribute('experimental-puzzle-description'); player.setAttribute('puzzle', b.puzzle || '3x3x3'); }
  // certains puzzles n'ont pas de rendu 3D dans cubing.js
  const only2D = ['redi_cube', 'melindas2x2x2x2', 'tri_quad'].includes(b.puzzle);
  player.setAttribute('visualization', only2D && (b.viz || '3D') === '3D' ? '2D' : b.viz || '3D');
  player.setAttribute('background', 'none');
  player.setAttribute('hint-facelets', 'none');
  player.setAttribute('control-panel', controls ? 'bottom-row' : 'none');
  player.setAttribute('experimental-move-press-input', 'basic');
  if (b.stickering && b.stickering !== 'full') player.setAttribute('experimental-stickering', b.stickering); else player.removeAttribute('experimental-stickering');
  player.setAttribute('experimental-setup-anchor', b.anchor === 'end' ? 'end' : 'start');
  player.experimentalSetupAlg = b.setup || '';
  player.alg = b.alg || '';
}

const shotCache = new Map();
/** Image fixe d'un bloc lecteur (pour l'aperçu et le PDF). */
export async function autoShot(b) {
  const k = JSON.stringify([b.puzzle, b.pg, b.setup, b.alg, b.stickering, b.viz, b.anchor]);
  if (shotCache.has(k)) return shotCache.get(k);
  const p = (async () => {
    await loadTwisty();
    const player = document.createElement('twisty-player');
    Object.assign(player.style, { position: 'fixed', left: '-2000px', top: '0', width: '320px', height: '320px' });
    document.body.append(player);
    configurePlayer(player, b, { controls: false });
    try { player.timestamp = 'start'; } catch { /* */ }
    await new Promise((r) => setTimeout(r, 600));
    const src = await player.experimentalScreenshot({ width: 320, height: 320 });
    player.remove();
    return toWebp(src, 320);
  })();
  shotCache.set(k, p);
  return p;
}

/** Réduit une image (dataURL ou Blob) en WebP compact. */
export async function toWebp(src, max = 360, q = 0.82) {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  const bm = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k));
  c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
  let out = await c.convertToBlob({ type: 'image/webp', quality: q });
  if (out.type !== 'image/webp') out = await c.convertToBlob({ type: 'image/jpeg', quality: q });
  return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(out); });
}

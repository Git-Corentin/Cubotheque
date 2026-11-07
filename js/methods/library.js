// Bibliothèque de méthodes intégrée. Chaque algorithme ci-dessous a été vérifié par calcul :
// moteur NxN du site pour les cubes et cuboïdes, modèles de puzzle de cubing.js pour les autres.
import * as C from '../cube.js';

let n = 0;
const id = () => 'b' + (++n);
const text = (title, body) => ({ id: id(), type: 'text', title, body });
const cube = (title, alg, o = {}) => {
  const b = { id: id(), type: 'cube', title, shape: o.dims ? 'cuboid' : 'cube', n: o.n || 3, dims: o.dims || [3, 2, 3], style: o.style || 'couleurs', alg, setup: o.setup || '', mask: o.mask || 'none', views: o.views || ['top'], paints: o.paints || {}, arrows: [], note: o.note || '' };
  if (o.arrows) { try { b.arrows = C.autoArrows(b.shape === 'cuboid' ? b.dims : b.n, alg, b.setup); } catch { /* */ } }
  return b;
};
const player = (title, puzzle, alg, o = {}) => ({ id: id(), type: 'player', title, puzzle, pg: '', setup: o.setup || '', alg, stickering: o.stickering || 'full', viz: o.viz || '3D', anchor: o.anchor || 'end', shots: [], note: o.note || '' });
const clock = (title, c, note = '') => ({ id: id(), type: 'clock', title, clock: { front: Array(9).fill(0), back: Array(9).fill(0), pins: [false, false, false, false], marks: { front: [], back: [] }, linked: true, showBack: true, ...c }, note });

/* ---------- 3x3 : algorithmes vérifiés ---------- */
const OLL = {
  1: "R U2 R2 F R F' U2 R' F R F'", 2: "F R U R' U' F' f R U R' U' f'", 3: "f R U R' U' f' U' F R U R' U' F'", 4: "f R U R' U' f' U F R U R' U' F'",
  5: "r' U2 R U R' U r", 6: "r U2 R' U' R U' r'", 7: "r U R' U R U2 r'", 8: "l' U' L U' L' U2 l", 9: "R U R' U' R' F R2 U R' U' F'",
  10: "R U R' U R' F R F' R U2 R'", 11: "r U R' U R' F R F' R U2 r'", 12: "M' R' U' R U' R' U2 R U' R r'", 13: "F U R U' R2 F' R U R U' R'",
  14: "R' F R U R' F' R F U' F'", 15: "r' U' r R' U' R U r' U r", 16: "r U r' R U R' U' r U' r'", 17: "F R' F' R2 r' U R U' R' U' M'",
  18: "r U R' U R U2 r2 U' R U' R' U2 r", 19: "r' R U R U R' U' M' R' F R F'", 20: "r U R' U' M2 U R U' R' U' M'", 21: "R U2 R' U' R U R' U' R U' R'",
  22: "R U2 R2 U' R2 U' R2 U2 R", 23: "R2 D' R U2 R' D R U2 R", 24: "r U R' U' r' F R F'", 25: "F' r U R' U' r' F R", 26: "R U2 R' U' R U' R'",
  27: "R U R' U R U2 R'", 28: "r U R' U' r' R U R U' R'", 29: "R U R' U' R U' R' F' U' F R U R'", 30: "F R' F R2 U' R' U' R U R' F2",
  31: "R' U' F U R U' R' F' R", 32: "L U F' U' L' U L F L'", 33: "R U R' U' R' F R F'", 34: "R U R2 U' R' F R U R U' F'",
  35: "R U2 R2 F R F' R U2 R'", 36: "L' U' L U' L' U L U L F' L' F", 37: "F R' F' R U R U' R'", 38: "R U R' U R U' R' U' R' F R F'",
  39: "L F' L' U' L U F U' L'", 40: "R' F R U R' U' F' U R", 41: "R U R' U R U2 R' F R U R' U' F'", 42: "R' U' R U' R' U2 R F R U R' U' F'",
  43: "F' U' L' U L F", 44: "F U R U' R' F'", 45: "F R U R' U' F'", 46: "R' U' R' F R F' U R", 47: "R' U' R' F R F' R' F R F' U R",
  48: "F R U R' U' R U R' U' F'", 49: "r U' r2 U r2 U r2 U' r", 50: "r' U r2 U' r2 U' r2 U r'", 51: "F U R U' R' U R U' R' F'",
  52: "R U R' U R U' B U' B' R'", 53: "l' U2 L U L' U' L U L' U l", 54: "r U2 R' U' R U R' U' R U' r'", 55: "R' F R U R U' R2 F' R2 U' R' U R U R'",
  56: "r' U' r U' R' U R U' R' U R r' U r", 57: "R U R' U' M' U R U' r'",
};
const PLL = {
  Aa: "x R' U R' D2 R U' R' D2 R2 x'", Ab: "x R2 D2 R U R' D2 R U' R x'", E: "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
  F: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", Ga: "R2 U R' U R' U' R U' R2 U' D R' U R D'", Gb: "R' U' R U D' R2 U R' U R U' R U' R2 D",
  Gc: "R2 U' R U' R U R' U R2 U D' R U' R' D", Gd: "R U R' U' D R2 U' R U' R' U R' U R2 D'", H: "M2 U M2 U2 M2 U M2",
  Ja: "x R2 F R F' R U2 r' U r U2 x'", Jb: "R U R' F' R U R' U' R' F R2 U' R' U'", Na: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
  Nb: "R' U R U' R' F' U' F R U R' F R' F' R U' R", Ra: "R U' R' U' R U R D R' U' R D' R' U2 R' U'", Rb: "R2 F R U R U' R' F' R U2 R' U2 R U",
  T: "R U R' U' R' F R2 U' R' U' R U R' F'", Ua: "R U' R U R U R U' R' U' R2", Ub: "R2 U R U R' U' R' U' R' U R'",
  V: "R' U R' U' y R' F' R2 U' R' U R' F R F", Y: "F R U' R' U' R U R' F' R U R' U' R' F R F'", Z: "M' U M2 U M2 U M' U2 M2 U'",
};

function ollGroups() {
  const groups = {};
  for (const [k, alg] of Object.entries(OLL)) {
    const st = C.caseState(3, alg);
    const e = [1, 3, 5, 7].filter((i) => st[i] === 'U');
    const c = [0, 2, 6, 8].filter((i) => st[i] === 'U').length;
    const kind = e.length === 4 ? 'Croix déjà faite (les 7 « OCLL »)' : e.length === 0 ? 'Point : aucune arête orientée' : (e.includes(1) && e.includes(7)) || (e.includes(3) && e.includes(5)) ? 'Ligne : deux arêtes opposées' : 'L : deux arêtes voisines';
    (groups[kind] ||= []).push([+k, alg, c]);
  }
  return groups;
}

function sheet(o) { return { lib: true, scheme: 'jaune', itemId: '', ...o }; }

export function buildLibrary() {
  n = 0;
  const L = [];

  L.push(sheet({
    id: 'lib-333-debutant', title: '3x3 : méthode débutant', puzzle: '3x3x3', events: ['333'], keywords: /3x3|rubik|cube 3/i,
    intro: 'La méthode couche par couche, en 7 étapes. Le cube est tenu jaune en haut, vert devant ; la croix blanche est donc en bas. Chaque diagramme montre le cas que l\'algorithme résout.',
    blocks: [
      text('1. La croix blanche', 'Formez une croix blanche dont chaque arête correspond aussi au centre de sa face latérale. Étape intuitive : amenez une arête au-dessus de sa place, puis tournez la face concernée deux fois (F2, R2…).'),
      cube('Objectif de l\'étape 1', '', { mask: 'cross', views: ['iso', 'net'] }),
      text('2. Les coins blancs', 'Placez un coin blanc dans la couche du haut, au-dessus de son emplacement (devant à droite), puis répétez **R U R\' U\'** jusqu\'à ce qu\'il soit en place et bien orienté (1, 3 ou 5 fois).'),
      cube('Objectif de l\'étape 2', '', { mask: 'f1l', views: ['iso', 'net'] }),
      text('3. La deuxième couche', 'Trouvez dans la couche du haut une arête sans jaune. Alignez sa face latérale avec son centre, puis envoyez-la à droite ou à gauche.'),
      cube('Arête vers la droite', "U R U' R' U' F' U F", { views: ['iso'] }),
      cube('Arête vers la gauche', "U' L' U L U F U' F'", { views: ['iso'] }),
      text('4. La croix jaune', 'Selon le dessus : point, L ou ligne. Tenez le L en haut à gauche ou la ligne à l\'horizontale et faites l\'algorithme ; un point demande deux ou trois passages.'),
      cube('Ligne vers croix', "F R U R' U' F'", { mask: 'oll' }),
      text('5. La face jaune', 'Le Sune oriente les coins. Tenez un coin jaune non orienté devant à gauche (ou le seul coin jaune bien orienté) et recommencez jusqu\'à obtenir la face entière.'),
      cube('Sune', "R U R' U R U2 R'", { mask: 'oll', views: ['top', 'iso'] }),
      cube('Antisune', "R U2 R' U' R U' R'", { mask: 'oll', views: ['top', 'iso'] }),
      text('6. Placer les coins jaunes', 'Si un coin est à sa place, tenez-le devant à droite ; l\'algorithme fait tourner les trois autres.'),
      cube('Cycle de trois coins', "U R U' L' U R' U' L", { mask: 'pll', arrows: true }),
      text('7. Placer les arêtes jaunes', 'Tenez l\'arête déjà placée à l\'arrière. Les flèches montrent dans quel sens tournent les trois autres.'),
      cube('Ua', PLL.Ua, { mask: 'pll', arrows: true }),
      cube('Ub', PLL.Ub, { mask: 'pll', arrows: true }),
    ],
  }));

  L.push(sheet({
    id: 'lib-333-2look', title: '3x3 : CFOP en 2 temps (OLL et PLL)', puzzle: '3x3x3', events: ['333'], keywords: /3x3|rubik/i,
    intro: 'Le passage entre la méthode débutant et le CFOP complet : 10 algorithmes pour orienter, 6 pour permuter.',
    blocks: [
      text('Orienter les arêtes', 'Point, L ou ligne.'),
      cube('Point', OLL[2], { mask: 'oll' }), cube('L', OLL[44], { mask: 'oll' }), cube('Ligne', OLL[45], { mask: 'oll' }),
      text('Orienter les coins', 'Les 7 cas avec la croix déjà faite.'),
      ...[[21, 'H'], [22, 'Pi'], [23, 'Phares'], [24, 'T'], [25, 'Nœud papillon'], [26, 'Antisune'], [27, 'Sune']].map(([k, nm]) => cube(`${nm} (OLL ${k})`, OLL[k], { mask: 'oll' })),
      text('Permuter les coins', 'Deux coins voisins à échanger : T. En diagonale : Y.'),
      cube('T', PLL.T, { mask: 'pll', arrows: true }), cube('Y', PLL.Y, { mask: 'pll', arrows: true }),
      text('Permuter les arêtes', ''),
      ...['Ua', 'Ub', 'H', 'Z'].map((k) => cube(k, PLL[k], { mask: 'pll', arrows: true })),
    ],
  }));

  const groups = ollGroups();
  L.push(sheet({
    id: 'lib-333-oll', title: '3x3 : les 57 OLL', puzzle: '3x3x3', events: ['333'], keywords: /3x3|rubik/i,
    intro: 'Orientation de la dernière couche en un seul algorithme. Classement automatique d\'après le nombre d\'arêtes déjà orientées, puis par numéro.',
    blocks: Object.entries(groups).flatMap(([g, list]) => [text(g, ''), ...list.sort((a, b) => a[0] - b[0]).map(([k, alg]) => cube(`OLL ${k}`, alg, { mask: 'oll' }))]),
  }));

  const PLLG = [['Arêtes seulement', ['Ua', 'Ub', 'H', 'Z']], ['Coins seulement', ['Aa', 'Ab', 'E']], ['Échanges voisins', ['T', 'F', 'Ja', 'Jb', 'Ra', 'Rb']], ['Échanges en diagonale', ['V', 'Y', 'Na', 'Nb']], ['Les G', ['Ga', 'Gb', 'Gc', 'Gd']]];
  L.push(sheet({
    id: 'lib-333-pll', title: '3x3 : les 21 PLL', puzzle: '3x3x3', events: ['333'], keywords: /3x3|rubik/i,
    intro: 'Permutation de la dernière couche. Les flèches sont calculées à partir de l\'algorithme.',
    blocks: PLLG.flatMap(([g, ks]) => [text(g, ''), ...ks.map((k) => cube(`${k}-perm`, PLL[k], { mask: 'pll', arrows: true }))]),
  }));

  L.push(sheet({
    id: 'lib-222', title: '2x2 : méthode Ortega', puzzle: '2x2x2', events: ['222'], keywords: /2x2|pocket/i,
    intro: 'Trois étapes : une face (pas forcément une couche), orientation du dessus, puis permutation des deux couches d\'un coup (PBL).',
    blocks: [
      text('1. Une face', 'Faites une face d\'une couleur, sans vous soucier des côtés. Intuitif, 4 à 6 mouvements avec de l\'entraînement.'),
      text('2. Orienter la face opposée', 'Les mêmes cas que les coins du 3x3.'),
      ...[['H', 'R2 U2 R U2 R2'], ['Pi', "R U2 R2 U' R2 U' R2 U2 R"], ['Phares', "R2 D' R U2 R' D R U2 R"], ['T', "R U R' U' R' F R F'"], ['Nœud papillon', "F R' F' R U R U' R'"], ['Sune', "R U R' U R U2 R'"], ['Antisune', "R U2 R' U' R U' R'"]].map(([nm, a]) => cube(nm, a, { n: 2, mask: 'oll' })),
      text('3. Permuter les deux couches', 'Repérez dans chaque couche une paire de coins déjà assortis (« phares ») ou aucune (échange en diagonale).'),
      cube('Échange voisin en haut', "R U2 R' U' R U2 L' U R' U' L", { n: 2, views: ['iso', 'net'] }),
      cube('Échange diagonal en haut', PLL.Y, { n: 2, views: ['iso', 'net'] }),
      cube('Voisin en haut, voisin en bas', "R2 U' B2 U2 R2 U' R2", { n: 2, views: ['iso', 'net'] }),
      cube('Diagonal en haut et en bas', 'R2 F2 R2', { n: 2, views: ['iso', 'net'] }),
      cube('Voisin et diagonal', "R U' R F2 R' U R'", { n: 2, views: ['iso', 'net'] }),
    ],
  }));

  L.push(sheet({
    id: 'lib-444', title: '4x4 : réduction et parités', puzzle: '4x4x4', events: ['444'], keywords: /4x4|revenge/i,
    intro: 'On réduit le 4x4 à un 3x3 : centres de 2x2, puis arêtes appariées, puis résolution comme un 3x3. Notation : Rw = deux couches de droite, 2R = la deuxième couche seule.',
    blocks: [
      text('1. Les centres', 'Faites deux centres opposés (blanc puis jaune), puis les quatre autres en respectant l\'ordre des couleurs (vert, rouge, bleu, orange dans le sens des aiguilles d\'une montre, jaune en haut). Les mouvements de tranche (Rw, 2R) déplacent des paires sans casser les centres finis.'),
      text('2. Les arêtes', 'Appariez les 12 paires d\'arêtes (méthode 3-2-3 ou 6-6). Pour les deux dernières paires, placez-les devant et utilisez cet algorithme, qui ne touche pas aux centres.'),
      cube('Apparier les deux dernières arêtes', "Uw' R U R' F R' F' R Uw", { n: 4, views: ['iso'] }),
      text('3. Comme un 3x3', 'Résolvez avec votre méthode 3x3 en ne tournant que les faces extérieures. Deux situations impossibles sur un 3x3 peuvent apparaître : les parités.'),
      cube('Parité OLL : une arête retournée', "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'", { n: 4, mask: 'oll', views: ['top', 'iso'], note: 'Préserve les deux premières couches ; refaites ensuite l\'OLL.' }),
      cube('Parité OLL, version courte (une arête retournée sur place)', "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2", { n: 4, mask: 'oll', views: ['top', 'iso'], note: 'Retourne seulement l\'arête avant, rien d\'autre ne bouge.' }),
      cube('Parité PLL : deux arêtes opposées échangées', "2R2 U2 2R2 Uw2 2R2 Uw2 U2", { n: 4, mask: 'pll', arrows: true }),
      player('La parité OLL en mouvement', '4x4x4', "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"),
    ],
  }));

  L.push(sheet({
    id: 'lib-555', title: '5x5 et plus : réduction', puzzle: '5x5x5', events: ['555', '666', '777'], keywords: /5x5|6x6|7x7|professor|v-cube/i,
    intro: 'Même principe que le 4x4 : centres de 3x3, puis arêtes de 3 pièces, puis comme un 3x3. Les 6x6 et 7x7 se résolvent de la même façon, avec des centres et des arêtes plus grands.',
    blocks: [
      text('1. Les centres', 'Formez chaque centre de 3x3 : d\'abord des barres de 3, puis on les assemble. Même ordre de couleurs qu\'au 4x4.'),
      text('2. Les arêtes', 'Appariez les deux « ailes » de chaque arête avec son milieu. Pour les deux dernières, placez-les devant et derrière à droite.'),
      cube('Apparier les deux dernières arêtes', "Dw R F' U R' F Dw'", { n: 5, views: ['iso'] }),
      cube('Parité d\'arête : deux ailes retournées', "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2", { n: 5, mask: 'oll', views: ['top', 'iso'], note: 'Quand il ne reste qu\'une arête dont les deux ailes sont inversées. Ne touche à rien d\'autre.' }),
      text('3. Comme un 3x3', 'Les centres et milieux d\'arêtes fixes empêchent les parités OLL et PLL du 4x4 sur les cubes impairs (5x5, 7x7). Sur le 6x6, elles existent, comme au 4x4.'),
    ],
  }));

  L.push(sheet({
    id: 'lib-pyra', title: 'Pyraminx : méthode débutant', puzzle: 'Pyraminx', events: ['pyram'], keywords: /pyraminx|tetraminx/i,
    intro: 'Quatre étapes, quelques algorithmes courts. Notation WCA : U, L, R, B tournent deux couches autour d\'un sommet ; u, l, r, b ne tournent que la pointe.',
    blocks: [
      text('1. Les pointes', 'Tournez chaque pointe pour qu\'elle prenne les couleurs de la pièce de sommet juste en dessous.'),
      text('2. Les sommets', 'Alignez les pièces de sommet (sous les pointes) pour que les trois couleurs du bas correspondent.'),
      text('3. Une face', 'Placez les trois arêtes d\'une face. Intuitif : amenez une arête au-dessus de sa place, puis insérez-la avec un mouvement du type R U R\'.'),
      text('4. Les trois dernières arêtes', 'Tenez la face résolue en bas.'),
      player('Trois arêtes à faire tourner (sens 1)', 'pyraminx', "R U R' U R U R'"),
      player('Trois arêtes à faire tourner (sens 2)', 'pyraminx', "R U' R' U' R U' R'"),
      player('Deux arêtes retournées sur place', 'pyraminx', "R' L R L' U L' U' L"),
    ],
  }));

  L.push(sheet({
    id: 'lib-skewb', title: 'Skewb : méthode débutant', puzzle: 'Skewb', events: ['skewb'], keywords: /skewb/i,
    intro: 'Notation WCA : R, L, U, B tournent la moitié du cube autour d\'un coin. Le « sledgehammer » R\' L R L\' sert à presque tout.',
    blocks: [
      text('1. Première couche', 'Faites une face (centre et 4 coins) avec les coins bien assortis aux centres latéraux. Intuitif.'),
      text('2. Les coins du haut', 'Face résolue en bas. Répétez le sledgehammer depuis différents angles pour placer puis orienter les quatre coins du haut.'),
      player('Sledgehammer', 'skewb', "R' L R L'", { note: 'Déplace quatre coins et trois centres.' }),
      text('3. Les centres', 'Il ne reste que des centres mal placés. Cet algorithme échange deux paires de centres sans toucher aux coins ; refaites-le depuis un autre angle si besoin.'),
      player('Échange de centres', 'skewb', "R L R' L' U' L' U L"),
    ],
  }));

  L.push(sheet({
    id: 'lib-minx', title: 'Megaminx : méthode débutant', puzzle: 'Megaminx', events: ['minx'], keywords: /megaminx|kilominx/i,
    intro: 'Le Megaminx se résout comme un 3x3 avec plus de pièces. Notation cubing.js : U, F, R, L, BR, BL pour la couronne du haut, FR, FL, DR, DL, B pour celle du bas ; U2 = deux cinquièmes de tour.',
    blocks: [
      text('1. L\'étoile', 'Les cinq arêtes blanches autour du centre blanc, assorties aux centres voisins.'),
      text('2. Première face, puis couronnes', 'Coins blancs, puis arêtes et coins de chaque couronne, en remontant face par face (même technique que la deuxième couche du 3x3).'),
      text('3. Dernière face', 'Face grise en haut.'),
      player('Orienter les arêtes', 'megaminx', "F R U R' U' F'"),
      player('Placer les arêtes (Sune)', 'megaminx', "R U R' U R U2' R'"),
      player('Placer les coins', 'megaminx', "L' U R U' L U R'"),
      player('Orienter un coin', 'megaminx', "R' FR' R FR", { anchor: 'start', note: 'Répétez par deux jusqu\'à ce que le coin devant à droite soit orienté, tournez U pour le suivant. Six répétitions ramènent tout.' }),
    ],
  }));

  L.push(sheet({
    id: 'lib-sq1', title: 'Square-1 : méthode débutant', puzzle: 'Square-1', events: ['sq1'], keywords: /square[- ]?1|sq-?1/i,
    intro: 'Notation : (x,y) tourne le haut de x douzièmes et le bas de y douzièmes, / tourne la moitié droite de 180°.',
    blocks: [
      text('1. Retrouver la forme de cube', 'Ramenez d\'abord tous les coins dans une couche (« six coins en haut » puis répartition), puis remettez les deux couches en carré. C\'est l\'étape à apprendre par cœur avec des schémas : la planche libre (gabarit Square-1) permet de les dessiner.'),
      text('2. Couleurs haut / bas', 'Ramenez les pièces jaunes en haut et blanches en bas avec des mouvements / (3,0) / et (0,3) intuitifs.'),
      text('3. Coins puis arêtes', 'Permutez les coins, puis les arêtes.'),
      player('Cycle de trois arêtes du haut', 'square1', "/ (3,0) / (1,0) / (0,-3) / (-1,0) / (-3,0) / (1,0) / (0,3) / (-1,0)", { note: 'Ne touche à aucune autre pièce.' }),
      text('4. Parité', 'Si à la fin deux pièces seulement doivent être échangées, c\'est la parité : un long algorithme dédié, plus simple à suivre en vidéo (recherche : « square-1 parity algorithm »).'),
    ],
  }));

  L.push(sheet({
    id: 'lib-clock', title: 'Clock : méthode débutant', puzzle: 'Clock', events: ['clock'], keywords: /clock/i,
    intro: 'But : tous les cadrans à midi des deux côtés. Un pin levé relie la roue d\'angle voisine aux cadrans qui l\'entourent. Les coins sont partagés : tourner un coin à l\'avant le tourne en sens inverse à l\'arrière.',
    blocks: [
      text('1. La croix avant', 'Levez un seul pin et tournez sa roue : le coin et les arêtes voisines bougent ensemble. Ramenez les quatre arêtes sur l\'heure du centre.'),
      clock('Exemple : le pin en haut à droite levé', { pins: [false, true, false, false], marks: { front: [1, 2, 4, 5], back: [] } }, 'Les cadrans surlignés tournent ensemble quand on tourne la roue en haut à droite.'),
      text('2. Les coins avant', 'Levez les quatre pins sauf celui du coin à corriger : tout tourne sauf lui. Faites tourner l\'ensemble jusqu\'à son heure, puis tout ramener à midi d\'un coup.'),
      text('3. La face arrière', 'Retournez le Clock et refaites la croix puis les coins, en gardant la face avant intacte : on n\'utilise alors que des combinaisons de pins qui ne la dérangent pas.'),
      clock('Objectif', {}),
    ],
  }));

  L.push(sheet({
    id: 'lib-shapemods', title: 'Shape mods du 3x3 : Mirror, Axis, Ghost, Fisher, Windmill, Void…', puzzle: '3x3x3 modifié', events: [], cats: ['shape'], keywords: /mirror|axis|ghost|fisher|windmill|mastermorphix|void|pillow|penrose|barrel|megamorphix|pyramorphix|spy/i,
    intro: 'Tous ces puzzles cachent un mécanisme de 3x3 : la méthode est la même, seule la reconnaissance change. Ce qui suit vaut pour la plupart des shape mods.',
    blocks: [
      text('Mirror (Mirror Blocks)', 'Chaque pièce a une épaisseur différente : on lit la forme au lieu de la couleur. Commencez par la face la plus épaisse (le « gros » bas), puis comme un 3x3. Le rendu « relief » ci-dessous montre la même situation qu\'un Sune, en formes.'),
      cube('Sune sur un Mirror', "R U R' U R U2 R'", { style: 'mirror', views: ['top', 'iso'] }),
      text('Axis, Fisher, Windmill', 'Les centres ont une orientation visible. Repérez quelle pièce est un centre (elle ne bouge que sur elle-même). Si à la fin un centre est tourné de 180°, faites l\'algorithme ci-dessous, qui ne bouge que le centre du dessus.'),
      cube('Centre du dessus tourné d\'un demi-tour', "R U R' U R U R' U R U R' U R U R' U R U R' U", { views: ['iso'], note: 'Soit (R U R\' U) répété 5 fois. Aucune autre pièce ne change.' }),
      text('Ghost Cube, Mastermorphix, Pyramorphix', 'Mêmes principes que l\'Axis, avec des centres orientés. Le Pyramorphix et le Mastermorphix ont des centres que l\'on voit peu : résolvez d\'abord les coins (les grandes pointes).'),
      text('Void Cube', 'Sans centres, il peut finir avec deux arêtes échangées (parité). Remède : un quart de tour d\'une tranche du milieu (M, E ou S), puis on reprend la résolution normalement.'),
      cube('Void Cube', '', { mask: 'void', views: ['iso', 'top'] }),
    ],
  }));

  L.push(sheet({
    id: 'lib-cuboids', title: 'Cuboïdes : Domino, Tower et compagnie', puzzle: 'Cuboïdes', events: [], cats: ['cuboid'], keywords: /domino|tower|cuboid|cuboïde/i,
    intro: 'Sur un cuboïde, les faces rectangulaires ne tournent que par demi-tours (R2, F2…), les faces carrées par quarts de tour. Le diagramme refuse les mouvements impossibles.',
    blocks: [
      text('3x3x2 Domino', 'Résolvez d\'abord une couche entière, puis la seconde. Pour la dernière couche, un échange utile qui ne touche pas à la couche du bas :'),
      cube('Domino : échange dans la couche du haut', 'R2 U2 R2 U2 R2', { dims: [3, 2, 3], views: ['iso', 'top'], arrows: true }),
      text('2x2x3 Tower, 3x3x4, 3x3x5…', 'Même logique : réduire au cube le plus proche quand c\'est possible (un 3x3x5 se résout souvent comme un 3x3 après avoir apparié les tranches), et ne travailler qu\'en demi-tours sur les faces longues.'),
    ],
  }));

  return L;
}

let cache;
export const library = () => (cache ||= buildLibrary());
export const libSheet = (id) => library().find((s) => s.id === id);

/** Fiches de la bibliothèque qui concernent un objet de la collection. */
export function libraryFor(item, event) {
  const hay = `${item.name} ${item.size} ${item.model}`;
  return library().filter((s) => (event && s.events.includes(event)) || s.cats?.includes(item.category) || s.keywords?.test(hay));
}

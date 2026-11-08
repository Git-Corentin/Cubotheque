// Blocs des fiches de méthode : éditeurs et rendus « document ».
import { uid } from '../store.js';
import { h, toast, debounce } from '../ui.js';
import * as C from '../cube.js';
import { sketchEditor, sketchSVG, blankSketch } from '../sketch.js';
import { TWISTY, PG, STICKERINGS, loadTwisty, configurePlayer, autoShot, toWebp } from './puzzles.js';
import { blankClock, setDial, randomClock, renderClock } from './clock.js';

export const KINDS = {
  text: 'Texte', cube: 'Diagramme de cube', player: 'Lecteur 3D', sketch: 'Planche libre',
  clock: 'Clock', video: 'Vidéo', photos: 'Photos',
};
const DEFAULTS = {
  text: () => ({ title: '', body: '' }),
  cube: () => ({ title: '', shape: 'cube', n: 3, dims: [3, 2, 3], style: 'couleurs', alg: '', setup: '', mask: 'none', views: ['top'], paints: {}, arrows: [], note: '' }),
  player: () => ({ title: '', puzzle: '3x3x3', pg: 'c e 0.707106781186547', setup: '', alg: '', stickering: 'full', viz: '3D', anchor: 'end', shots: [], note: '' }),
  sketch: () => ({ title: '', data: blankSketch(), note: '' }),
  clock: () => ({ title: '', clock: blankClock(), note: '' }),
  video: () => ({ title: '', url: '', start: '', end: '', frames: [], note: '' }),
  photos: () => ({ title: '', photos: [], note: '' }),
};
export const newBlock = (type, extra = {}) => Object.assign({ id: uid(), type }, DEFAULTS[type](), extra);

export const MASKS = [['none', 'Tout en couleur'], ['oll', 'OLL : seulement le dessus'], ['pll', 'PLL : dernière couche'], ['f2l', 'F2L : dernière couche grise'], ['f1l', 'Objectif : première couche'], ['cross', 'Objectif : croix du dessous'], ['void', 'Void : sans centres'], ['grey', 'Tout gris (à peindre)']];
const VIEWS = [['top', 'Dessus'], ['iso', '3D'], ['net', 'Patron']];

/* ---------- cube : calculs ---------- */
export const cubeSize = (b) => (b.shape === 'cuboid' ? (b.dims || [3, 2, 3]).map(Number) : +b.n);
export function cubeState(b) {
  const size = cubeSize(b);
  let st;
  try { st = C.caseState(size, b.alg, b.setup); } catch { st = C.solved(size); }
  if (b.mask === 'f1l') { const g = C.geometry(size); st = st.map((c, i) => (g.pos[i][1] <= -(g.dims[1] - 1) ? c : 'x')); }
  else st = C.applyMask(st, size, b.mask);
  for (const [i, c] of Object.entries(b.paints || {})) if (+i < st.length) st[+i] = c;
  return st;
}
function cubeOpts(b) {
  if (b.style === 'image') { try { return { marks: C.pictureMarks(cubeSize(b), C.trackedCase(cubeSize(b), b.alg, b.setup)) }; } catch { return {}; } }
  if (b.style !== 'mirror') return {};
  try { return { relief: C.mirrorRelief(cubeSize(b), C.trackedCase(cubeSize(b), b.alg, b.setup)) }; } catch { return {}; }
}
export function cubeSVGs(b, scheme) {
  const st = cubeState(b), size = cubeSize(b), o = cubeOpts(b);
  return b.views.map((v) => C.renderView(v, st, size, scheme, b.arrows, o)).join('');
}

/* ---------- éditeurs ---------- */
export function editor(b, save, ctx) {
  switch (b.type) {
    case 'text': return textEd(b, save);
    case 'cube': return cubeEd(b, save, ctx);
    case 'player': return playerEd(b, save);
    case 'sketch': return h('div', { style: { display: 'grid', gap: '10px' } }, sketchEditor(b.data, () => save()), noteIn(b, save));
    case 'clock': return clockEd(b, save);
    case 'video': return videoEd(b, save);
    case 'photos': return photosEd(b, save);
    default: return h('p', {}, 'Bloc inconnu.');
  }
}
const noteIn = (b, save, ph = 'Remarque') => { const n = h('input', { class: 'field', value: b.note || '', placeholder: ph, oninput: () => { b.note = n.value; save(); } }); return n; };

function textEd(b, save) {
  const ta = h('textarea', { class: 'field', placeholder: 'Explications. **gras** possible, une ligne vide sépare les paragraphes.', oninput: () => { b.body = ta.value; save(); } }, b.body || '');
  return ta;
}

function cubeEd(b, save, ctx) {
  let mode = 'paint', code = 'x', armed = null;
  const err = h('p', { class: 'err', 'aria-live': 'polite' });
  const netBox = h('div', { class: 'net' });
  const views = h('div', { class: 'views' });
  const scheme = () => ctx.scheme();
  const reset = () => { b.paints = {}; b.arrows = []; };

  const shapeSel = h('select', { class: 'field', onchange: () => { b.shape = shapeSel.value; reset(); syncShape(); save(); redraw(); } },
    h('option', { value: 'cube' }, 'Cube NxNxN'), h('option', { value: 'cuboid' }, 'Cuboïde AxBxC'));
  shapeSel.value = b.shape || 'cube';
  const nSel = h('select', { class: 'field', onchange: () => { b.n = +nSel.value; reset(); save(); redraw(); } }, [2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('option', { value: n }, `${n}x${n}x${n}`)));
  nSel.value = b.n;
  const dimIn = (k, label) => { const i = h('input', { class: 'field', type: 'number', min: 1, max: 9, value: (b.dims || [3, 2, 3])[k], 'aria-label': label, oninput: () => { b.dims = (b.dims || [3, 2, 3]).slice(); b.dims[k] = Math.max(1, Math.min(9, +i.value || 1)); reset(); save(); redraw(); } }); return i; };
  const dimsRow = h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '4px' } }, dimIn(0, 'Largeur'), 'x', dimIn(1, 'Hauteur'), 'x', dimIn(2, 'Profondeur'));
  const sizeBox = h('div', { class: 'lbl' }, h('span', {}, 'Taille'));
  const syncShape = () => { sizeBox.replaceChildren(h('span', {}, b.shape === 'cuboid' ? 'Largeur x hauteur x profondeur' : 'Taille'), b.shape === 'cuboid' ? dimsRow : nSel); };
  syncShape();
  const styleSel = h('select', { class: 'field', onchange: () => { b.style = styleSel.value; save(); redraw(); } }, h('option', { value: 'couleurs' }, 'Couleurs'), h('option', { value: 'mirror' }, 'Relief Mirror (formes)'), h('option', { value: 'image' }, 'Cube à image (orientation)'));
  styleSel.value = b.style || 'couleurs';
  const maskSel = h('select', { class: 'field', onchange: () => { b.mask = maskSel.value; save(); redraw(); } }, MASKS.map(([v, l]) => h('option', { value: v }, l)));
  maskSel.value = b.mask;
  const algIn = h('input', { class: 'field alg-input', value: b.alg, placeholder: 'R U R\' U R U2 R\'', oninput: () => { b.alg = algIn.value; save(); redraw(); } });
  const setupIn = h('input', { class: 'field alg-input', value: b.setup || '', placeholder: 'facultatif', oninput: () => { b.setup = setupIn.value; save(); redraw(); } });
  const viewChecks = h('div', { class: 'row' }, VIEWS.map(([v, l]) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: b.views.includes(v), onchange: (e) => { b.views = e.target.checked ? [...new Set([...b.views, v])] : b.views.filter((x) => x !== v); if (!b.views.length) b.views = ['top']; save(); redraw(); } }), l)));
  const palette = h('div', { class: 'paint' });
  const codes = ['U', 'F', 'R', 'D', 'L', 'B', 'x', 'k', 'p', 'v', 'c', 'o'];
  const drawPalette = () => palette.replaceChildren(...codes.map((c) => h('button', { type: 'button', style: { '--c': C.colorOf(c, scheme()) }, title: c === 'o' ? 'Trou (Void)' : c === 'x' ? 'Gris' : '', 'aria-label': 'Peindre ' + c, 'aria-pressed': String(code === c), onclick: () => { code = c; drawPalette(); } })));
  const modeSeg = h('div', { class: 'seg' }, [['paint', 'Peindre'], ['arrows', 'Flèches']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(mode === v), onclick: (e) => { mode = v; armed = null; [...modeSeg.children].forEach((x) => x.setAttribute('aria-pressed', String(x === e.currentTarget))); redraw(); } }, l)));

  let painting = false;
  netBox.addEventListener('pointerdown', (e) => {
    if (mode === 'paint') {
      const r = e.target.closest('[data-i]'); if (!r) return;
      painting = true; netBox.setPointerCapture(e.pointerId); b.paints[r.dataset.i] = code; save(); redraw();
    } else {
      const r = e.target.closest('[data-u]'); if (!r) return;
      const u = +r.dataset.u;
      if (armed == null) { armed = u; redraw(); return; }
      if (armed !== u) {
        const ex = b.arrows.findIndex(([a, c]) => (a === armed && c === u) || (a === u && c === armed));
        if (ex >= 0) b.arrows.splice(ex, 1); else b.arrows.push([armed, u]);
      }
      armed = null; save(); redraw();
    }
  });
  netBox.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-i]');
    if (el && b.paints[el.dataset.i] !== code) { b.paints[el.dataset.i] = code; save(); redraw(); }
  });
  netBox.addEventListener('pointerup', () => (painting = false));

  function redraw() {
    err.textContent = '';
    const size = cubeSize(b);
    try { for (const a of [b.setup, b.alg]) C.tokens(a).forEach((t) => C.parseMove(t, size)); } catch (e) { err.textContent = e.message; }
    const st = cubeState(b), o = cubeOpts(b);
    if (mode === 'paint') netBox.innerHTML = C.renderNet(st, size, scheme(), { interactive: true, ...o });
    else {
      netBox.innerHTML = C.renderTop(st, size, scheme(), b.arrows, { interactive: true, ...o });
      const a = armed != null && netBox.querySelector(`[data-u="${armed}"]`);
      if (a) { a.setAttribute('stroke', '#0057B8'); a.setAttribute('stroke-width', '1.6'); }
    }
    views.innerHTML = b.views.map((v) => C.renderView(v, st, size, scheme(), b.arrows, o)).join('');
    drawPalette();
  }
  ctx.redrawers.set(b.id, redraw);
  redraw();

  return h('div', { style: { display: 'grid', gap: '12px' } },
    h('div', { class: 'grid3' }, h('label', { class: 'lbl' }, 'Forme', shapeSel), sizeBox, h('label', { class: 'lbl' }, 'Rendu', styleSel)),
    h('div', { class: 'grid2' }, h('label', { class: 'lbl' }, 'Ce qu\'on montre', maskSel), h('div', { class: 'lbl' }, 'Vues', viewChecks)),
    h('div', { class: 'grid2' },
      h('label', { class: 'lbl' }, h('span', {}, 'Algorithme ', h('small', {}, 'le diagramme montre le cas qu\'il résout')), algIn),
      h('label', { class: 'lbl' }, h('span', {}, 'Préparation ', h('small', {}, 'mouvements joués avant le cas')), setupIn)),
    err,
    h('div', { class: 'cube-editor' },
      h('div', { style: { display: 'grid', gap: '8px' } },
        h('div', { class: 'row' }, modeSeg,
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => { b.paints = {}; save(); redraw(); } }, 'Effacer la peinture'),
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => { b.arrows = []; save(); redraw(); } }, 'Effacer les flèches'),
          h('button', { class: 'btn small', type: 'button', onclick: () => { try { b.arrows = C.autoArrows(cubeSize(b), b.alg, b.setup); save(); mode = 'arrows'; [...modeSeg.children].forEach((x, k) => x.setAttribute('aria-pressed', String(k === 1))); redraw(); } catch (e) { toast(e.message, 'err'); } } }, 'Flèches automatiques')),
        palette,
        h('p', { class: 'hint', style: { margin: 0 } }, 'Peindre : cliquez ou glissez sur les autocollants (la dernière pastille fait un trou, pour les Void). Flèches : cliquez une case du dessus puis sa destination.'),
        netBox),
      h('div', { style: { display: 'grid', gap: '8px' } }, h('span', { class: 'hint' }, 'Rendu dans la fiche'), views)),
    noteIn(b, save, 'Remarque (doigté, reconnaissance du cas)'));
}

function puzzleSelect(b, onchange) {
  const sel = h('select', { class: 'field', onchange: () => { b.puzzle = sel.value; onchange(); } },
    h('optgroup', { label: 'Puzzles officiels et classiques' }, TWISTY.map(([v, l]) => h('option', { value: v }, l))),
    PG.map(([group, list]) => h('optgroup', { label: group }, list.map(([n]) => h('option', { value: 'pg:' + n }, n)))),
    h('optgroup', { label: 'Autre' }, h('option', { value: 'custom' }, 'Géométrie libre (description)')));
  sel.value = b.puzzle || '3x3x3';
  return sel;
}

function playerEd(b, save) {
  const shots = h('div', { class: 'shots' });
  const status = h('p', { class: 'hint', style: { margin: 0 } });
  let player = null;
  const pgIn = h('input', { class: 'field', value: b.pg || '', oninput: debounce(() => { b.pg = pgIn.value; save(); apply(); }, 500) });
  const pgRow = h('label', { class: 'lbl', hidden: b.puzzle !== 'custom' }, h('span', {}, 'Description géométrique ', h('small', {}, 'forme (c t o d i) puis coupes f, v ou e suivies d\'une profondeur entre 0 et 1, ex. « c e 0.707 »')), pgIn);
  const pz = puzzleSelect(b, () => { pgRow.hidden = b.puzzle !== 'custom'; save(); apply(); });
  const sel = (key, opts, label) => { const s = h('select', { class: 'field', onchange: () => { b[key] = s.value; save(); apply(); } }, opts.map(([v, l]) => h('option', { value: v }, l))); s.value = b[key] || opts[0][0]; return h('label', { class: 'lbl' }, label, s); };
  const setup = h('input', { class: 'field alg-input', value: b.setup || '', placeholder: 'facultatif', oninput: debounce(() => { b.setup = setup.value; save(); apply(); }, 300) });
  const alg = h('input', { class: 'field alg-input', value: b.alg || '', placeholder: 'ex. R U R\' U\', R++ D-- (Megaminx), / (3,0) / (Square-1)', oninput: debounce(() => { b.alg = alg.value; save(); apply(); }, 300) });
  const stage = h('div', { style: { display: 'grid', gap: '6px' } });

  function drawShots() {
    shots.replaceChildren(...b.shots.map((s, i) => h('figure', {},
      h('img', { src: s.src, alt: s.cap || 'Capture' }),
      h('figcaption', { contenteditable: 'true', oninput: (e) => { s.cap = e.target.textContent; save(); } }, s.cap || ''),
      h('button', { type: 'button', 'aria-label': 'Retirer', onclick: () => { b.shots.splice(i, 1); save(); drawShots(); } }, '×'))));
  }
  async function apply() {
    try {
      await loadTwisty();
      if (!player) { player = document.createElement('twisty-player'); stage.replaceChildren(player); }
      configurePlayer(player, b);
      status.textContent = '';
    } catch (e) {
      stage.replaceChildren(h('p', { class: 'hint', style: { padding: '20px', background: '#fff', borderRadius: '10px' } }, 'Le lecteur 3D (cubing.js) n\'a pas pu se charger : il a besoin d\'une connexion internet.'));
      status.textContent = String(e.message || e);
    }
  }
  const shoot = async (cap) => ({ src: await toWebp(await player.experimentalScreenshot({ width: 360, height: 360 }), 360), cap });
  async function stepShots() {
    if (!player) return;
    const moves = (b.alg || '').replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!moves.length) { toast('Écrivez d\'abord un algorithme.', 'err'); return; }
    status.textContent = 'Photographie des étapes…';
    const out = [];
    const anchor = b.anchor; b.anchor = 'start';
    const fullSetup = b.setup;
    // on rejoue depuis la position de départ réelle (le cas), pas à pas
    let inv;
    try { const { Alg } = await import('https://cdn.cubing.net/v0/js/cubing/alg'); inv = new Alg(b.alg).invert().toString(); } catch { inv = invert(b.alg); }
    const caseSetup = anchor === 'end' ? [b.setup, inv].filter(Boolean).join(' ') : b.setup;
    for (let i = 0; i <= Math.min(moves.length, 24); i++) {
      configurePlayer(player, { ...b, setup: caseSetup, alg: moves.slice(0, i).join(' ') });
      try { player.timestamp = 'end'; } catch { /* */ }
      await new Promise((r) => setTimeout(r, 160));
      out.push(await shoot(i === 0 ? 'Départ' : moves[i - 1]));
    }
    b.anchor = anchor; b.setup = fullSetup;
    configurePlayer(player, b);
    b.shots.push(...out); save(); drawShots(); status.textContent = `${out.length} images ajoutées.`;
  }

  drawShots(); apply();
  return h('div', { style: { display: 'grid', gap: '8px' } },
    h('div', { class: 'grid3' }, h('label', { class: 'lbl' }, 'Puzzle', pz), sel('anchor', [['end', 'Montrer le cas que l\'algorithme résout'], ['start', 'Partir de la préparation']], 'Point de départ'), sel('viz', [['3D', '3D'], ['2D', '2D (patron)'], ['experimental-2D-LL', 'Dessus (3x3)']], 'Affichage')),
    pgRow,
    h('div', { class: 'grid3' }, h('label', { class: 'lbl' }, 'Préparation', setup), h('label', { class: 'lbl' }, 'Algorithme', alg), sel('stickering', STICKERINGS, 'Autocollants visibles')),
    h('div', { class: 'player-box' }, stage,
      h('div', { style: { display: 'grid', gap: '8px', alignContent: 'start' } },
        h('p', { class: 'hint', style: { margin: 0 } }, 'Faites tourner la vue, jouez l\'animation ou cliquez une face pour la tourner, puis photographiez : les images vont dans la fiche et le PDF. Sans photo, le PDF montre automatiquement la position de départ.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn small solid', type: 'button', onclick: async () => { try { b.shots.push(await shoot('')); save(); drawShots(); } catch (e) { toast('Capture impossible : ' + e.message, 'err'); } } }, 'Photographier'),
          h('button', { class: 'btn small', type: 'button', onclick: () => stepShots().catch((e) => toast(e.message, 'err')) }, 'Photographier chaque étape'),
          h('button', {
            class: 'btn small ghost', type: 'button', onclick: async () => {
              try { const a = (await player.experimentalModel.alg.get()).alg.toString(); alg.value = b.alg = a; save(); toast('Mouvements cliqués recopiés.'); } catch { toast('Impossible de lire les mouvements.', 'err'); }
            },
          }, 'Récupérer les mouvements cliqués'),
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => { b.shots = []; save(); drawShots(); } }, 'Vider les photos')),
        status, shots)),
    noteIn(b, save));
}
// inverse « textuel » générique (fonctionne pour la plupart des notations : R++ → R--, (3,0) → (-3,0))
function invert(alg) {
  const t = String(alg || '').trim().split(/\s+/).filter(Boolean).reverse();
  return t.map((m) => {
    if (/^\(-?\d+,-?\d+\)$/.test(m)) return m.replace(/-?\d+/g, (x) => String(-x));
    if (m === '/') return '/';
    if (/\+\+$/.test(m)) return m.replace(/\+\+$/, '--');
    if (/--$/.test(m)) return m.replace(/--$/, '++');
    if (/\d\+$/.test(m)) return m.replace(/\+$/, '-');
    if (/\d-$/.test(m)) return m.replace(/-$/, '+');
    if (m.endsWith('\'')) return m.slice(0, -1);
    return m + '\'';
  }).join(' ');
}

function clockEd(b, save) {
  let mode = 'dial';
  const box = h('div', { class: 'clock-box' });
  const draw = () => { box.innerHTML = renderClock(b.clock, { interactive: true }); };
  box.addEventListener('click', (e) => {
    const pin = e.target.closest('[data-pin]');
    if (pin) { b.clock.pins[+pin.dataset.pin] = !b.clock.pins[+pin.dataset.pin]; save(); draw(); return; }
    const d = e.target.closest('[data-i]'); if (!d) return;
    const side = d.dataset.side, i = +d.dataset.i;
    if (mode === 'mark') {
      const list = (b.clock.marks ||= { front: [], back: [] })[side];
      const k = list.indexOf(i); if (k >= 0) list.splice(k, 1); else list.push(i);
    } else setDial(b.clock, side, i, (b.clock[side][i] || 0) + (e.shiftKey ? -1 : 1));
    save(); draw();
  });
  box.addEventListener('contextmenu', (e) => {
    const d = e.target.closest('[data-i]'); if (!d) return;
    e.preventDefault(); setDial(b.clock, d.dataset.side, +d.dataset.i, (b.clock[d.dataset.side][+d.dataset.i] || 0) - 1); save(); draw();
  });
  const seg = h('div', { class: 'seg' }, [['dial', 'Tourner les cadrans'], ['mark', 'Surligner']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(mode === v), onclick: (e) => { mode = v; [...seg.children].forEach((x) => x.setAttribute('aria-pressed', String(x === e.currentTarget))); } }, l)));
  draw();
  return h('div', { style: { display: 'grid', gap: '10px' } },
    h('div', { class: 'row' }, seg,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: b.clock.showBack, onchange: (e) => { b.clock.showBack = e.target.checked; save(); draw(); } }), 'Montrer la face arrière'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: b.clock.linked, onchange: (e) => { b.clock.linked = e.target.checked; save(); } }), 'Coins liés (comme le vrai Clock)'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => { b.clock = { ...blankClock(), showBack: b.clock.showBack }; save(); draw(); } }, 'Tout à midi'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => { b.clock = { ...randomClock(), showBack: b.clock.showBack }; save(); draw(); } }, 'Mélanger')),
    h('p', { class: 'hint', style: { margin: 0 } }, 'Clic sur un cadran : une heure de plus (Maj+clic ou clic droit : une de moins). Clic sur un pin : le lever ou l\'abaisser (jaune = levé côté avant).'),
    box, noteIn(b, save, 'Mouvement à faire (ex. pins UR et DR levés, tourner UR de +3)'));
}

/* ---------- vidéo ---------- */
export function ytId(url) { const m = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m?.[1] || null; }
export const toSec = (t) => { if (!t) return 0; if (/^\d+$/.test(String(t))) return +t; return String(t).split(':').map(Number).reduce((a, x) => a * 60 + (x || 0), 0); };
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function videoLink(b) {
  const id = ytId(b.url);
  if (id) return `https://youtu.be/${id}${toSec(b.start) ? '?t=' + toSec(b.start) : ''}`;
  return b.url || '';
}

function videoEd(b, save) {
  const embed = h('div', { class: 'video-embed' });
  const drawEmbed = () => {
    const id = ytId(b.url);
    embed.replaceChildren(id ? h('iframe', { src: `https://www.youtube-nocookie.com/embed/${id}?start=${toSec(b.start)}${b.end ? '&end=' + toSec(b.end) : ''}&rel=0`, title: 'Vidéo', allow: 'encrypted-media; picture-in-picture', allowfullscreen: true, loading: 'lazy' })
      : b.url ? h('p', { class: 'hint' }, 'Lien enregistré (seules les vidéos YouTube s\'affichent ici) : ', h('a', { href: b.url, target: '_blank', rel: 'noopener' }, b.url)) : h('p', { class: 'hint' }, 'Collez un lien YouTube (ou autre) et indiquez le passage utile.'));
  };
  const field = (key, ph, w) => { const i = h('input', { class: 'field', value: b[key] || '', placeholder: ph, style: w ? { maxWidth: w } : null, oninput: debounce(() => { b[key] = i.value.trim(); if (key === 'url') { const t = b.url.match(/[?&]t=(\d+)/); if (t && !b.start) { b.start = fmtT(+t[1]); startIn.value = b.start; } } save(); drawEmbed(); }, 400) }); return i; };
  const startIn = field('start', 'début, ex. 3:25', '140px');
  // extrait d'une vidéo personnelle : on capture des images
  const frames = h('div', { class: 'shots' });
  const drawFrames = () => frames.replaceChildren(...b.frames.map((f, i) => h('figure', {}, h('img', { src: f.src, alt: f.cap || '' }), h('figcaption', { contenteditable: 'true', oninput: (e) => { f.cap = e.target.textContent; save(); } }, f.cap || ''), h('button', { type: 'button', 'aria-label': 'Retirer', onclick: () => { b.frames.splice(i, 1); save(); drawFrames(); } }, '×'))));
  const vid = h('video', { controls: true, playsinline: true, class: 'local-video', hidden: true });
  const fileIn = h('input', { type: 'file', accept: 'video/*', class: 'sr', onchange: () => { const f = fileIn.files[0]; if (!f) return; vid.src = URL.createObjectURL(f); vid.hidden = false; grab.hidden = false; } });
  const grab = h('button', {
    class: 'btn small solid', type: 'button', hidden: true, onclick: async () => {
      const c = new OffscreenCanvas(vid.videoWidth, vid.videoHeight); c.getContext('2d').drawImage(vid, 0, 0);
      b.frames.push({ src: await toWebp(await c.convertToBlob({ type: 'image/png' }), 640), cap: fmtT(vid.currentTime) }); save(); drawFrames();
    },
  }, 'Capturer cette image');
  drawEmbed(); drawFrames();
  return h('div', { style: { display: 'grid', gap: '10px' } },
    h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('div', { style: { flex: '1 1 280px' } }, field('url', 'https://www.youtube.com/watch?v=…')), startIn, field('end', 'fin (facultatif)', '140px')),
    embed,
    h('div', { class: 'row' }, h('label', { class: 'btn small', style: { cursor: 'pointer' } }, fileIn, 'Ouvrir une vidéo de l\'appareil'), grab,
      h('span', { class: 'hint' }, 'Pour garder des images clés d\'un tuto enregistré ou filmé : la vidéo reste sur l\'appareil, seules les images capturées vont dans la fiche.')),
    vid, frames, noteIn(b, save, 'Ce qu\'il faut retenir du passage'));
}

function photosEd(b, save) {
  const grid = h('div', { class: 'shots' });
  const draw = () => grid.replaceChildren(...b.photos.map((f, i) => h('figure', {}, h('img', { src: f.src, alt: f.cap || '' }), h('figcaption', { contenteditable: 'true', oninput: (e) => { f.cap = e.target.textContent; save(); } }, f.cap || ''), h('button', { type: 'button', 'aria-label': 'Retirer', onclick: () => { b.photos.splice(i, 1); save(); draw(); } }, '×'))));
  const add = async (files) => { for (const f of files) b.photos.push({ src: await toWebp(f, 900, 0.85), cap: '' }); save(); draw(); };
  draw();
  return h('div', { style: { display: 'grid', gap: '10px' } },
    h('div', { class: 'row' },
      h('label', { class: 'btn small solid', style: { cursor: 'pointer' } }, h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr', onchange: (e) => add(e.target.files) }), 'Prendre une photo'),
      h('label', { class: 'btn small', style: { cursor: 'pointer' } }, h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr', onchange: (e) => add(e.target.files) }), 'Ajouter des images')),
    grid, noteIn(b, save));
}

/* ---------- rendu document ---------- */
export function rich(text) {
  return String(text || '').split(/\n\s*\n/).map((p) => {
    const el = h('p');
    el.innerHTML = p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
    return el;
  });
}

let qrLib;
async function qrSVG(text) {
  try {
    qrLib ||= import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm').then((m) => m.default || m);
    const qrcode = await qrLib;
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  } catch { return ''; }
}

export function docBlock(b, scheme) {
  const title = b.title ? h(b.type === 'text' ? 'h2' : 'h3', {}, b.title) : null;
  const note = b.note ? h('div', { class: 'note' }, b.note) : null;
  switch (b.type) {
    case 'text': return h('div', { class: 'd-text' }, title, ...rich(b.body));
    case 'cube': {
      const pics = h('div', { class: 'pics' }); pics.innerHTML = cubeSVGs(b, scheme);
      return h('div', { class: 'd-cube' + (b.views.length > 1 ? ' solo' : '') }, title, pics, b.alg ? h('div', { class: 'alg' }, b.alg) : null, note);
    }
    case 'player': {
      const pics = h('div', { class: 'shots' });
      if (b.shots?.length) pics.append(...b.shots.map((s) => h('figure', {}, h('img', { src: s.src, alt: s.cap || '' }), s.cap ? h('figcaption', {}, s.cap) : null)));
      else {
        const img = h('img', { alt: 'Position de départ', class: 'auto-shot' });
        pics.append(h('figure', {}, img));
        autoShot(b).then((src) => { img.src = src; }).catch(() => img.replaceWith(h('span', { class: 'hint' }, 'Aperçu 3D indisponible hors connexion.')));
      }
      const live = h('button', {
        class: 'btn small ghost no-print', type: 'button', onclick: async () => {
          try {
            await loadTwisty(); const p = document.createElement('twisty-player'); p.className = 'doc-player';
            configurePlayer(p, b); live.replaceWith(p);
          } catch { toast('Lecteur 3D indisponible hors connexion.', 'err'); }
        },
      }, 'Voir en 3D animé');
      return h('div', { class: 'd-player' }, title, pics, b.setup && b.anchor !== 'end' ? h('div', { class: 'note' }, 'Préparation : ' + b.setup) : null, b.alg ? h('div', { class: 'alg' }, b.alg) : null, note, live);
    }
    case 'sketch': { const d = h('div', { class: 'd-sketch' }, title); const s = h('div'); s.innerHTML = sketchSVG(b.data); d.append(s, note || ''); return d; }
    case 'clock': { const d = h('div', { class: 'd-clock' }, title); const s = h('div', { class: 'clock-doc' }); s.innerHTML = renderClock(b.clock); d.append(s, note || ''); return d; }
    case 'photos': return h('div', { class: 'd-photos' }, title, h('div', { class: 'shots big' }, b.photos.map((f) => h('figure', {}, h('img', { src: f.src, alt: f.cap || '' }), f.cap ? h('figcaption', {}, f.cap) : null))), note);
    case 'video': {
      const link = videoLink(b);
      const qr = h('div', { class: 'qr' });
      if (link) qrSVG(link).then((svg) => { qr.innerHTML = svg; });
      return h('div', { class: 'd-video' }, title,
        h('div', { class: 'video-doc' }, qr, h('div', {},
          link ? h('p', {}, h('a', { href: link, target: '_blank', rel: 'noopener' }, link)) : null,
          b.start || b.end ? h('p', { class: 'note' }, `Passage : ${b.start || '0:00'}${b.end ? ' à ' + b.end : ''}`) : null, note)),
        b.frames?.length ? h('div', { class: 'shots' }, b.frames.map((f) => h('figure', {}, h('img', { src: f.src, alt: f.cap || '' }), f.cap ? h('figcaption', {}, f.cap) : null))) : null);
    }
    default: return h('div');
  }
}

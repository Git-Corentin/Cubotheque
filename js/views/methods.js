import { state, on, uid, getSheet, saveSheet, deleteSheet, getItem, imageURL } from '../store.js';
import { h, toast, confirmBox, debounce, fmtDate } from '../ui.js';
import * as C from '../cube.js';
import { generate } from '../gabarit.js';
import { KINDS, newBlock, editor, docBlock, cubeState, cubeSize, rich } from '../methods/blocks.js';
import { library, libSheet } from '../methods/library.js';
import { COVERAGE } from '../methods/coverage.js';

export async function render(main, params) {
  if (!params.id) return list(main);
  if (params.id.startsWith('nouvelle')) return chooser(main, new URLSearchParams(params.id.split('?')[1] || '').get('item'));
  if (params.id.startsWith('lib-')) {
    const s = libSheet(params.id);
    if (!s) return notFound(main);
    return doc(main, s);
  }
  const sheet = getSheet(params.id);
  if (!sheet) return notFound(main);
  if (params.mode === 'pdf' || !state.canEdit) return doc(main, sheet);
  return editorView(main, sheet);
}
const notFound = (main) => main.append(h('div', { class: 'empty' }, h('h2', {}, 'Fiche introuvable.'), h('a', { class: 'btn', href: '#/methodes' }, 'Toutes les méthodes')));

function miniOf(s) {
  const mini = h('div', { class: 'mini' });
  const it = s.itemId ? getItem(s.itemId) : null;
  const c = s.blocks.find((b) => b.type === 'cube');
  if (it?.imageId) imageURL(it.imageId, true).then((u) => u && mini.replaceChildren(h('img', { src: u, alt: '' })));
  else if (c) { try { mini.innerHTML = C.renderTop(cubeState(c), cubeSize(c), s.scheme || 'jaune'); } catch { /* */ } }
  else mini.textContent = (s.puzzle || '?').slice(0, 2);
  return mini;
}
const card = (s, href) => h('a', { class: 'sheet-card', href }, miniOf(s), h('div', {}, h('b', {}, s.title), h('span', {}, `${s.puzzle || 'Puzzle non précisé'}, ${s.blocks.length} bloc${s.blocks.length > 1 ? 's' : ''}`)));

function list(main) {
  main.append(h('header', { class: 'head' }, h('h1', {}, 'Méthodes'),
    state.canEdit ? h('div', { class: 'head-actions' }, h('a', { class: 'btn accent', href: '#/methodes/nouvelle' }, 'Nouvelle fiche')) : null,
    h('p', { class: 'lead' }, 'Fiches de résolution : algorithmes dessinés sur le cube, lecteur 3D pour plus de 80 puzzles, cadrans du Clock, planche libre et extraits vidéo pour tous les autres. Chaque fiche s\'imprime ou s\'enregistre en PDF.')));

  const mine = state.sheets.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (mine.length || state.canEdit) {
    main.append(h('h2', { class: 'sec-title' }, state.canEdit ? 'Mes fiches' : 'Fiches du propriétaire'));
    main.append(mine.length ? h('div', { class: 'sheets' }, mine.map((s) => card(s, '#/methodes/' + s.id)))
      : h('p', { class: 'muted' }, 'Aucune fiche personnelle pour l\'instant. Partez d\'une page blanche ou copiez une fiche de la bibliothèque pour l\'adapter.'));
  }
  main.append(h('h2', { class: 'sec-title' }, 'Bibliothèque'),
    h('p', { class: 'muted', style: { marginTop: '-4px' } }, 'Fiches prêtes pour les puzzles courants. Chaque algorithme a été vérifié par calcul.'),
    h('div', { class: 'sheets' }, library().map((s) => card(s, '#/methodes/' + s.id))));

  main.append(h('details', { class: 'coverage' },
    h('summary', {}, 'Quel outil pour quel puzzle ?'),
    h('div', { class: 'ledger-wrap' }, h('table', { class: 'ledger' },
      h('thead', {}, h('tr', {}, ['Famille', 'Exemples', 'Comment la documenter'].map((t) => h('th', {}, t)))),
      h('tbody', {}, COVERAGE.map(([f, ex, how]) => h('tr', { style: { cursor: 'default' } }, h('td', {}, h('b', {}, f)), h('td', {}, ex), h('td', {}, how))))))));
}

function chooser(main, itemId) {
  if (!state.canEdit) { location.hash = '#/methodes'; return; }
  const it = itemId ? getItem(itemId) : null;
  const make = async (s) => { await saveSheet(s); location.replace('#/methodes/' + s.id); };
  const base = () => ({ id: uid(), title: it?.name || 'Nouvelle méthode', itemId: itemId || '', puzzle: it?.name || '', intro: '', scheme: 'jaune', blocks: [], created: Date.now() });
  const opt = (title, desc, fn) => h('button', { class: 'sheet-card', style: { border: 0, textAlign: 'left', cursor: 'pointer', gridTemplateColumns: '1fr' }, onclick: fn }, h('div', {}, h('b', {}, title), h('span', {}, desc)));
  main.append(h('header', { class: 'head' }, h('h1', {}, 'Nouvelle fiche'), h('p', { class: 'lead' }, it ? `Pour « ${it.name} ». Partir de quoi ?` : 'Partir de quoi ?')),
    h('div', { class: 'sheets' },
      opt('Page blanche', 'Un titre, puis les blocs un par un.', () => make(base())),
      opt('Puzzle rare : planche libre', 'Un gabarit de face prêt à peindre, un bloc vidéo et un bloc photos.', () => {
        const s = base(); const sk = newBlock('sketch', { title: 'Situation de départ' }); const g = uid();
        sk.data.shapes = generate({ base: 'pentagon', k: 1, step: 0.2 }).map((p) => ({ id: uid(), t: 'poly', g, fill: '#D9DCE0', pts: p.map(([x, y]) => [450 + x * 190, 290 + y * 190]) }));
        s.blocks = [newBlock('text', { title: 'D\'où vient cette méthode' }), newBlock('video', { title: 'Le passage utile' }), sk, newBlock('photos', { title: 'Mon exemplaire' })];
        make(s);
      }),
      opt('Clock', 'Bloc de cadrans prêt à régler.', () => { const s = base(); s.blocks = [newBlock('text', { title: 'Principe' }), newBlock('clock', { title: 'Position' })]; make(s); })),
    h('h2', { class: 'sec-title' }, 'Ou copier une fiche de la bibliothèque'),
    h('div', { class: 'sheets' }, library().map((l) => h('button', { class: 'sheet-card', style: { border: 0, textAlign: 'left', cursor: 'pointer' }, onclick: () => make(copyOf(l, itemId)) }, miniOf(l), h('div', {}, h('b', {}, l.title), h('span', {}, l.puzzle))))));
}
export function copyOf(l, itemId = '') {
  const s = structuredClone({ ...l, keywords: undefined });
  delete s.lib; delete s.events; delete s.keywords;
  s.id = uid(); s.itemId = itemId || ''; s.created = Date.now();
  s.blocks.forEach((b) => (b.id = uid()));
  return s;
}

function editorView(main, sheet) {
  let gone = false;
  const status = h('span', { class: 'hint save-state' }, 'Enregistré');
  const doSave = debounce(async () => {
    if (gone) return;
    try { await saveSheet(sheet); status.textContent = 'Enregistré'; } catch (e) { status.textContent = 'Échec de l\'enregistrement'; toast(e.message, 'err'); }
  }, 600);
  const save = () => { status.textContent = 'Modifications…'; doSave(); };
  const title = h('input', { class: 'sheet-title', value: sheet.title, 'aria-label': 'Titre de la fiche', oninput: () => { sheet.title = title.value; save(); } });
  const itemSel = h('select', { class: 'field', onchange: () => { sheet.itemId = itemSel.value; const it = getItem(itemSel.value); if (it && !sheet.puzzle) { sheet.puzzle = it.name; puzzleIn.value = it.name; } save(); } },
    h('option', { value: '' }, 'Aucun'), state.items.map((i) => h('option', { value: i.id }, i.name)));
  itemSel.value = sheet.itemId || '';
  const puzzleIn = h('input', { class: 'field', value: sheet.puzzle || '', placeholder: 'ex. Mastermorphix, Curvy Copter III', oninput: () => { sheet.puzzle = puzzleIn.value; save(); } });
  const schemeSel = h('select', { class: 'field', onchange: () => { sheet.scheme = schemeSel.value; save(); ctx.redrawers.forEach((f) => f()); } }, h('option', { value: 'jaune' }, 'Jaune en haut, vert devant'), h('option', { value: 'blanc' }, 'Blanc en haut, vert devant'));
  schemeSel.value = sheet.scheme || 'jaune';
  const intro = h('textarea', { class: 'field', placeholder: 'Principe de la méthode, source (vidéo, auteur), notation utilisée…', oninput: () => { sheet.intro = intro.value; save(); } }, sheet.intro || '');
  const ctx = { redrawers: new Map(), scheme: () => sheet.scheme || 'jaune' };

  const blocksEl = h('div', { class: 'blocks' });
  function paint() { ctx.redrawers.clear(); blocksEl.replaceChildren(...sheet.blocks.map((b, i) => blockEl(b, i))); }
  function blockEl(b, i) {
    const move = (d) => { const j = i + d; if (j < 0 || j >= sheet.blocks.length) return; [sheet.blocks[i], sheet.blocks[j]] = [sheet.blocks[j], sheet.blocks[i]]; save(); paint(); };
    const bar = h('div', { class: 'block-bar' }, h('span', { class: 'kind' }, KINDS[b.type]), h('span', { class: 'sp' }),
      h('button', { type: 'button', 'aria-label': 'Monter', onclick: () => move(-1) }, '↑'),
      h('button', { type: 'button', 'aria-label': 'Descendre', onclick: () => move(1) }, '↓'),
      h('button', { type: 'button', onclick: () => { const c = structuredClone(b); c.id = uid(); sheet.blocks.splice(i + 1, 0, c); save(); paint(); } }, 'Dupliquer'),
      h('button', { type: 'button', onclick: async () => { if (await confirmBox('Retirer ce bloc ?', { ok: 'Retirer', danger: true })) { sheet.blocks.splice(i, 1); save(); paint(); } } }, 'Retirer'));
    const titleIn = h('input', { class: 'bt', value: b.title || '', placeholder: 'Titre du bloc', oninput: () => { b.title = titleIn.value; save(); } });
    return h('section', { class: 'block' }, bar, titleIn, editor(b, save, ctx));
  }
  const add = (type) => { sheet.blocks.push(newBlock(type)); save(); paint(); blocksEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  main.append(
    h('div', { class: 'sheet-head' }, title,
      h('div', { class: 'row' }, status, h('a', { class: 'btn accent', href: `#/methodes/${sheet.id}/pdf` }, 'Aperçu et PDF'),
        h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Supprimer cette fiche et tous ses blocs ?', { ok: 'Supprimer', danger: true })) { gone = true; await deleteSheet(sheet.id); location.hash = '#/methodes'; } } }, 'Supprimer'))),
    h('div', { class: 'panel', style: { display: 'grid', gap: '12px', marginBottom: '8px' } },
      h('div', { class: 'grid3' }, h('label', { class: 'lbl' }, 'Puzzle', puzzleIn), h('label', { class: 'lbl' }, 'Objet de la collection', itemSel), h('label', { class: 'lbl' }, 'Couleurs des diagrammes', schemeSel)),
      h('label', { class: 'lbl' }, 'Introduction', intro)),
    blocksEl,
    h('div', { class: 'add-block', style: { marginTop: '8px' } },
      h('span', { class: 'hint', style: { alignSelf: 'center', marginRight: '6px' } }, 'Ajouter :'),
      ...Object.entries(KINDS).map(([k, l]) => h('button', { class: 'btn small', onclick: () => add(k) }, l))));
  paint();
  const off = on((w) => w === 'all' && paint());
  return () => { off(); if (!gone) saveSheet(sheet).catch(() => {}); };
}

async function doc(main, sheet) {
  const it = sheet.itemId ? getItem(sheet.itemId) : null;
  const img = h('img', { alt: '' });
  if (it?.imageId) { const u = await imageURL(it.imageId); if (u) img.src = u; }
  const scheme = sheet.scheme || 'jaune';
  const flow = h('div', { class: 'doc-flow' }, sheet.blocks.map((b) => docBlock(b, scheme)));
  const back = sheet.lib ? h('a', { class: 'btn ghost', href: '#/methodes' }, 'Toutes les méthodes')
    : state.canEdit ? h('a', { class: 'btn ghost', href: '#/methodes/' + sheet.id }, 'Revenir à l\'édition') : h('a', { class: 'btn ghost', href: '#/methodes' }, 'Toutes les méthodes');
  main.append(
    h('div', { class: 'row no-print', style: { margin: '14px 0 18px', justifyContent: 'space-between' } }, back,
      h('div', { class: 'row' },
        sheet.lib && state.canEdit ? h('button', { class: 'btn', onclick: async () => { const s = copyOf(sheet); await saveSheet(s); toast('Copiée dans vos fiches.'); location.hash = '#/methodes/' + s.id; } }, 'Copier dans mes fiches') : null,
        h('button', { class: 'btn accent', onclick: () => window.print() }, 'Imprimer ou enregistrer en PDF'))),
    h('article', { class: 'doc' },
      h('header', { class: 'doc-head' },
        h('div', {}, h('h1', {}, sheet.title), h('div', { class: 'meta' }, [sheet.puzzle, it?.brand].filter(Boolean).join(', '))),
        it?.imageId ? img : h('span')),
      sheet.intro ? h('div', { class: 'doc-intro' }, ...rich(sheet.intro)) : null,
      flow,
      h('footer', { class: 'doc-foot' }, sheet.lib ? `${state.settings.title}, bibliothèque de méthodes.` : `${state.settings.title}, fiche mise à jour le ${fmtDate(sheet.updated || Date.now())}.`)));
}

import { state, on, CATEGORIES, catLabel, STATUS, SOLVE_STATE, imageURL, getItem, deleteItem, yearOf } from '../store.js';
import { h, $, modal, confirmBox, fmtMoney, fmtDate, tilt, toast, esc } from '../ui.js';
import { libraryFor } from '../methods/library.js';
import { guessEvent } from '../scramble.js';

const LS = 'cubo.coll';
let ui = { q: '', cat: '', status: 'all', sort: 'num', view: null };
try { Object.assign(ui, JSON.parse(localStorage.getItem(LS) || '{}'), { q: '' }); } catch { /* */ }
const persist = () => { try { localStorage.setItem(LS, JSON.stringify(ui)); } catch { /* */ } };

let root, bodyEl, chipsEl, leadEl, specEl, detailM = null, firstPaint = true, filtered = [];

export function cutEl(item, { big = false } = {}) {
  const cut = h('div', { class: 'cut' });
  if (item.imageId) {
    const img = h('img', { alt: '', loading: big ? 'eager' : 'lazy', decoding: 'async' });
    imageURL(item.imageId, !big).then((u) => { if (u) img.src = u; else cut.replaceChildren(placeholder()); });
    cut.append(img);
  } else cut.append(placeholder());
  return cut;
}
const placeholder = () => h('div', { class: 'ph', 'aria-hidden': 'true' }, Array.from({ length: 9 }, () => h('i')));

function matches(it) {
  if (ui.cat && it.category !== ui.cat) return false;
  if (ui.status === 'here' && !(it.status === 'owned' || it.status === 'lent')) return false;
  if (ui.status !== 'all' && ui.status !== 'here' && it.status !== ui.status) return false;
  if (ui.q) {
    const hay = [it.name, it.brand, it.model, it.size, it.notes, it.source, yearOf(it), ...(it.tags || [])].join(' ').toLowerCase();
    if (!ui.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

const SORTS = {
  num: (a, b) => a.num - b.num,
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  brand: (a, b) => (a.brand || '~').localeCompare(b.brand || '~', 'fr') || a.name.localeCompare(b.name, 'fr'),
  recent: (a, b) => (yearOf(b) || 0) - (yearOf(a) || 0) || String(b.acquired || '').localeCompare(String(a.acquired || '')) || b.num - a.num,
  hard: (a, b) => (b.difficulty || 0) - (a.difficulty || 0),
  color: (a, b) => hue(a.tone) - hue(b.tone),
};
function hue(hex = '#888') {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 0.08) return 400 + mx * 100;
  const d = mx - mn; const hh = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return hh * 60;
}

export function render(main, params) {
  root = main;
  ui.view ||= state.settings.defaultView || 'presentoir';
  const items = state.items;
  const ro = state.readonly;

  if (!items.length) {
    main.append(h('section', { class: 'empty' },
      h('h1', {}, ro ? 'Bientôt ici' : 'Vitrine vide'),
      ro ? h('p', { class: 'muted' }, 'La collection n\'a pas encore été mise en ligne. En attendant, le chrono, la mosaïque et la bibliothèque de méthodes sont ouverts à tous.')
        : h('p', { class: 'muted' }, 'Ajoutez un premier casse-tête : le nom suffit, l\'image peut venir plus tard. Pour 200 objets, l\'ajout en série permet de tout saisir d\'un coup, un nom par ligne.'),
      ro ? h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/methodes' }, 'Voir les méthodes'), h('a', { class: 'btn ghost', href: '#/chrono' }, 'Ouvrir le chrono'))
        : h('div', { class: 'row' },
          h('a', { class: 'btn accent', href: '#/ajouter' }, 'Ajouter un casse-tête'),
          h('a', { class: 'btn', href: '#/serie' }, 'Ajout en série'),
          h('a', { class: 'btn ghost', href: '#/reglages' }, 'Restaurer une sauvegarde'))));
    return on(() => {});
  }

  leadEl = h('p', { class: 'lead' });
  main.append(h('header', { class: 'head' },
    h('h1', {}, 'Collection'),
    ro ? null : h('div', { class: 'head-actions' },
      h('a', { class: 'btn', href: '#/serie' }, 'Ajout en série'),
      h('a', { class: 'btn accent', href: '#/ajouter' }, 'Ajouter un casse-tête')),
    leadEl,
    state.settings.about ? h('p', { class: 'lead about' }, state.settings.about) : null));

  specEl = h('nav', { class: 'spectrum', 'aria-label': 'Toutes les teintes de la collection' });
  main.append(specEl);

  const search = h('input', { class: 'field search', type: 'search', placeholder: 'Chercher un nom, une marque, une étiquette', value: ui.q, 'aria-label': 'Rechercher' });
  search.addEventListener('input', () => { ui.q = search.value; paint(); });
  const statusSel = h('select', { class: 'field', style: { width: 'auto' }, 'aria-label': 'Statut' },
    h('option', { value: 'all' }, 'Tous les statuts'), h('option', { value: 'here' }, 'Présents sur l\'étagère'),
    STATUS.map((s) => h('option', { value: s.id }, s.label)));
  statusSel.value = ui.status;
  statusSel.onchange = () => { ui.status = statusSel.value; persist(); paint(); };
  const sortSel = h('select', { class: 'field', style: { width: 'auto' }, 'aria-label': 'Tri' },
    [['num', 'Ordre d\'arrivée'], ['name', 'Nom'], ['brand', 'Marque'], ['recent', 'Plus récents'], ['hard', 'Plus difficiles'], ['color', 'Couleur']].map(([v, l]) => h('option', { value: v }, l)));
  sortSel.value = ui.sort;
  sortSel.onchange = () => { ui.sort = sortSel.value; persist(); paint(); };
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Présentation' },
    [['presentoir', 'Présentoir'], ['etagere', 'À l\'échelle'], ['registre', 'Registre']].map(([v, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(ui.view === v), onclick: (e) => { ui.view = v; persist(); [...seg.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); paint(); } }, l)));
  main.append(h('div', { class: 'toolbar' }, search, statusSel, sortSel, seg));

  chipsEl = h('div', { class: 'chips', role: 'group', 'aria-label': 'Catégories' });
  main.append(chipsEl);
  bodyEl = h('div');
  main.append(bodyEl);
  paint();
  if (params.id) openDetail(params.id);

  const key = (e) => {
    if (e.target.matches('input, textarea, select') || detailM) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    if (e.key === 'n' && !ro) location.hash = '#/ajouter';
  };
  document.addEventListener('keydown', key);
  const off = on((w) => { if (w === 'items') paint(); });
  return () => { document.removeEventListener('keydown', key); off(); detailM?.close(); };
}

export function update(params) {
  if (params.id) openDetail(params.id);
  else if (detailM) { const m = detailM; detailM = null; m.close(); }
}

function paint() {
  const all = state.items;
  filtered = all.filter(matches).sort(SORTS[ui.sort] || SORTS.num);

  const owned = all.filter((i) => i.status === 'owned' || i.status === 'lent');
  const wish = all.filter((i) => i.status === 'wish').length;
  const known = owned.filter((i) => i.solve && i.solve !== 'unknown');
  const solved = known.filter((i) => i.solve !== 'never').length;
  leadEl.textContent = `${owned.length} casse-têtes sur l'étagère` + (wish ? `, ${wish} en liste d'envies` : '') +
    (known.length ? `. ${Math.round((solved / known.length) * 100)} % déjà résolus au moins une fois${known.length < owned.length ? ` (sur ${known.length} renseignés)` : ''}.` : '.');

  specEl.replaceChildren(...all.filter((i) => i.status !== 'wish').slice().sort(SORTS.color).map((i) =>
    h('a', { href: '#/c/' + i.id, style: { '--c': i.tone }, title: i.name, 'aria-label': i.name })));

  const counts = {};
  for (const i of all.filter((x) => matchesExceptCat(x))) counts[i.category] = (counts[i.category] || 0) + 1;
  chipsEl.replaceChildren(
    h('button', { class: 'chip', 'aria-pressed': String(!ui.cat), onclick: () => { ui.cat = ''; persist(); paint(); } }, 'Tout', h('b', {}, all.filter(matchesExceptCat).length)),
    ...CATEGORIES.filter((c) => counts[c.id]).map((c) => h('button', { class: 'chip', title: c.hint, 'aria-pressed': String(ui.cat === c.id), onclick: () => { ui.cat = ui.cat === c.id ? '' : c.id; persist(); paint(); } }, c.label, h('b', {}, counts[c.id]))));

  bodyEl.replaceChildren();
  if (!filtered.length) {
    bodyEl.append(h('div', { class: 'empty' }, h('h2', {}, 'Rien ne correspond.'), h('p', { class: 'muted' }, 'Essayez un autre mot, ou retirez le filtre de catégorie.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { ui.q = ''; ui.cat = ''; ui.status = 'all'; persist(); $('input[type=search]', root).value = ''; paint(); } }, 'Tout afficher'))));
    return;
  }
  if (ui.view === 'etagere') bodyEl.append(shelves(filtered));
  else if (ui.view === 'registre') bodyEl.append(ledger(filtered));
  else bodyEl.append(board(filtered));
}
function matchesExceptCat(i) { const c = ui.cat; ui.cat = ''; const r = matches(i); ui.cat = c; return r; }

function board(list) {
  const grid = h('div', { class: 'plate' }, h('div', { class: 'board' + (firstPaint ? ' intro' : '') }));
  firstPaint = false;
  const b = grid.firstChild;
  list.forEach((it, i) => {
    const t = h('a', {
      class: 'tile', href: '#/c/' + it.id, 'data-status': it.status, style: { '--tone': it.tone, '--i': Math.min(i, 40) },
      'aria-label': it.name,
    },
    h('span', { class: 'no' }, String(it.num).padStart(3, '0')),
    it.fav ? h('span', { class: 'fav', title: 'Coup de cœur' }) : null,
    h('div', { class: 'stage' }, cutEl(it)),
    h('div', {},
      h('div', { class: 'tname' }, it.name || 'Sans nom'),
      h('div', { class: 'tsub' }, [it.brand, it.model && it.model.length < 34 ? it.model : it.size].filter(Boolean).join(', ') || catLabel(it.category)),
      it.status === 'wish' ? h('span', { class: 'flag' }, 'Envie') : it.status === 'lent' ? h('span', { class: 'flag' }, 'Prêté') : it.status === 'sold' ? h('span', { class: 'flag' }, 'Parti') : null));
    tilt(t, 12);
    b.append(t);
  });
  return grid;
}

/** Étagère : chaque objet est affiché à sa taille réelle relative. */
function shelves(list) {
  const PX_PER_MM = 2.1;
  const wrap = h('div', { class: 'shelves' });
  let guessed = 0;
  for (const it of list) {
    let mm = parseFloat(it.sizeMm);
    if (!mm) { mm = guessSize(it); guessed++; }
    const px = Math.max(36, Math.min(340, mm * PX_PER_MM));
    const btn = h('a', { class: 'shelf-item', href: '#/c/' + it.id, title: `${it.name} (${Math.round(mm)} mm${it.sizeMm ? '' : ', estimé'})`, style: { '--tone': it.tone } });
    if (it.imageId) {
      const img = h('img', { alt: it.name, loading: 'lazy', style: { height: px + 'px' } });
      imageURL(it.imageId, true).then((u) => u && (img.src = u));
      btn.append(img);
    } else btn.append(h('span', { class: 'ph-s', style: { height: px * 0.8 + 'px' } }));
    btn.append(h('span', { class: 'cap' }, it.name));
    wrap.append(btn);
  }
  return h('div', {}, wrap, h('p', { class: 'scale-note' },
    `Les objets sont dessinés à l'échelle de leur plus grande dimension. ` + (guessed ? `${guessed} taille${guessed > 1 ? 's sont estimées' : ' est estimée'} faute de mesure : renseignez le champ « dimension » pour corriger.` : '')));
}
function guessSize(it) {
  const s = (it.size + ' ' + it.name).toLowerCase();
  const m = s.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/);
  if (m) { const n = Math.max(+m[1], +m[2], +(m[3] || 0)); return Math.min(100, 38 + n * 6.5); }
  if (/mini|keychain|porte-cl/.test(s)) return 30;
  if (/megaminx|kilominx|gigaminx|teraminx/.test(s)) return 70;
  if (/pyraminx|pyramid/.test(s)) return 98;
  return 57;
}

function ledger(list) {
  const tb = h('tbody');
  for (const it of list) {
    const img = h('img', { class: 'thumb', alt: '', loading: 'lazy' });
    if (it.imageId) imageURL(it.imageId, true).then((u) => u && (img.src = u));
    tb.append(h('tr', { style: { '--tone': it.tone }, tabindex: '0', onclick: () => (location.hash = '#/c/' + it.id), onkeydown: (e) => e.key === 'Enter' && (location.hash = '#/c/' + it.id) },
      h('td', { class: 'num' }, String(it.num).padStart(3, '0')),
      h('td', {}, it.imageId ? img : h('span', { class: 'sw' })),
      h('td', {}, h('b', {}, it.name)),
      h('td', {}, it.brand),
      h('td', {}, catLabel(it.category)),
      h('td', {}, it.solve === 'unknown' ? '' : SOLVE_STATE.find((s) => s.id === it.solve)?.label || ''),
      h('td', { class: 'num' }, yearOf(it) || ''),
      h('td', { class: 'num' }, fmtMoney(it.price))));
  }
  return h('div', { class: 'ledger-wrap' }, h('table', { class: 'ledger' },
    h('thead', {}, h('tr', {}, ['N°', '', 'Nom', 'Marque', 'Catégorie', 'Résolution', 'Année', 'Prix'].map((t) => h('th', {}, t)))), tb));
}

/* ---------- fiche détaillée ---------- */
function openDetail(id) {
  const it = getItem(id);
  if (!it) { location.hash = '#/'; return; }
  const content = detailContent(it);
  if (detailM) { detailM.el.querySelector('.detail')?.replaceWith(content); return; }
  detailM = modal(content, {
    wide: true, label: it.name,
    onClose: () => { detailM = null; if (location.hash.startsWith('#/c/')) history.replaceState(null, '', '#/'); },
  });
  detailM.el.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
}
function step(d) {
  const cur = location.hash.split('/')[2];
  const list = filtered.length ? filtered : state.items;
  const i = list.findIndex((x) => x.id === cur);
  const n = list[(i + d + list.length) % list.length];
  if (n) location.replace('#/c/' + n.id);
}

function detailContent(it) {
  const st = h('div', { class: 'stage', style: { '--tone': it.tone } }, cutEl(it, { big: true }),
    h('div', { class: 'nav' },
      h('button', { class: 'btn small', 'aria-label': 'Précédent', onclick: () => step(-1) }, '‹'),
      h('button', { class: 'btn small', 'aria-label': 'Suivant', onclick: () => step(1) }, '›')));
  tilt(st, 16);
  const dots = it.difficulty ? h('span', { class: 'dots', 'aria-label': `Difficulté ${it.difficulty} sur 5` }, [1, 2, 3, 4, 5].map((n) => h('i', { class: n <= it.difficulty ? 'on' : '' }))) : '';
  const rows = [
    ['Catégorie', catLabel(it.category)],
    ['Format', it.size],
    ['Finition', { stickerless: 'Sans autocollants', stickers: 'Autocollants', tiles: 'Tuiles', custom: 'Personnalisée' }[it.finish] || ''],
    ['Aimants', it.magnetic ? 'Oui' : ''],
    ['Difficulté', dots],
    ['Résolution', it.solve === 'unknown' ? '' : SOLVE_STATE.find((s) => s.id === it.solve)?.label],
    ['Statut', it.status !== 'owned' ? STATUS.find((s) => s.id === it.status)?.label : ''],
    ['Arrivé', it.acquired ? 'le ' + fmtDate(it.acquired) : it.year ? 'en ' + it.year : ''],
    ['Provenance', it.source],
    ['Prix', fmtMoney(it.price)],
    ['Dimension', it.sizeMm ? it.sizeMm + ' mm' : ''],
    ['Poids', it.weightG ? it.weightG + ' g' : ''],
  ].filter(([, v]) => v);
  const sheets = state.sheets.filter((s) => s.itemId === it.id);
  const lib = libraryFor(it, guessEvent(it));
  const ro = state.readonly;
  return h('article', { class: 'detail', style: { '--tone': it.tone } }, st,
    h('div', { class: 'info' },
      h('div', {}, h('span', { class: 'muted num' }, 'N° ' + String(it.num).padStart(3, '0'))),
      h('h2', {}, it.name),
      (it.brand || it.model) ? h('div', { class: 'who' }, [it.brand, it.model].filter(Boolean).join(' ')) : null,
      h('dl', { class: 'specs' }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
      it.tags?.length ? h('div', { class: 'tags' }, it.tags.map((t) => h('span', { class: 'tag' }, t))) : null,
      it.notes ? h('div', { class: 'notes' }, it.notes) : null,
      sheets.length || lib.length ? h('div', {}, h('h3', { style: { marginBottom: '6px' } }, 'Méthodes'), h('div', { class: 'row' }, sheets.map((s) => h('a', { class: 'btn small solid', href: '#/methodes/' + s.id }, s.title)), lib.map((s) => h('a', { class: 'btn small', href: '#/methodes/' + s.id }, s.title)))) : null,
      h('div', { class: 'resources' }, h('span', { class: 'hint' }, 'Chercher ailleurs : '),
        h('a', { href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(it.name + ' tutorial'), target: '_blank', rel: 'noopener' }, 'tutos vidéo'),
        h('a', { href: 'https://www.speedsolving.com/wiki/index.php?search=' + encodeURIComponent(it.name), target: '_blank', rel: 'noopener' }, 'wiki Speedsolving'),
        h('a', { href: 'https://www.google.com/search?q=' + encodeURIComponent('site:twistypuzzles.com ' + it.name), target: '_blank', rel: 'noopener' }, 'musée TwistyPuzzles')),
      h('div', { class: 'actions' },
        ro ? null : h('a', { class: 'btn solid', href: '#/modifier/' + it.id }, 'Modifier'),
        h('a', { class: 'btn', href: '#/chrono/item:' + it.id }, 'Chronométrer'),
        ro ? null : h('a', { class: 'btn', href: '#/methodes/nouvelle?item=' + it.id }, 'Écrire une méthode'),
        ro ? null : h('button', {
          class: 'btn danger', onclick: async () => {
            if (await confirmBox(`Supprimer « ${it.name} » de la collection ? Son image sera effacée aussi.`, { ok: 'Supprimer', danger: true })) {
              await deleteItem(it.id); detailM?.close(); toast('Supprimé.');
            }
          },
        }, 'Supprimer'))));
}

import { state, CATEGORIES, SOLVE_STATE, getItem } from '../store.js';
import { h, fmtMoney } from '../ui.js';
import { fmt, eff, avg } from './timer.js';
import { eventById } from '../scramble.js';

function bars(entries) {
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return h('div', { class: 'bars' }, entries.map(([k, v]) => h('div', { class: 'b' },
    h('span', {}, k), h('span', { class: 'tr' }, h('i', { style: { width: (v / max) * 100 + '%' } })), h('b', {}, v))));
}
function hue(hex = '#888') {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 0.08) return 400 + mx * 100;
  const d = mx - mn; return 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
}

export function render(main) {
  const all = state.items;
  const here = all.filter((i) => i.status === 'owned' || i.status === 'lent');
  const wish = all.filter((i) => i.status === 'wish');
  const priced = here.filter((i) => +i.price > 0);
  const spent = priced.reduce((a, i) => a + +i.price, 0);
  const solved = here.filter((i) => i.solve !== 'never').length;

  main.append(h('header', { class: 'head' }, h('h1', {}, 'Chiffres'), h('p', { class: 'lead' }, 'La collection racontée en nombres.')));
  if (!all.length) { main.append(h('p', { class: 'muted' }, 'Les chiffres apparaîtront dès le premier casse-tête ajouté.')); return; }

  const byCat = CATEGORIES.map((c) => [c.label, here.filter((i) => i.category === c.id).length]).filter((e) => e[1]).sort((a, b) => b[1] - a[1]);
  const brands = {}; here.forEach((i) => { const b = i.brand || 'Marque inconnue'; brands[b] = (brands[b] || 0) + 1; });
  const byBrand = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const years = {}; here.forEach((i) => { if (i.acquired) { const y = new Date(i.acquired).getFullYear(); years[y] = (years[y] || 0) + 1; } });
  const ys = Object.keys(years).map(Number).sort();
  const yMax = Math.max(1, ...Object.values(years));
  const cols = ys.length ? Array.from({ length: ys[ys.length - 1] - ys[0] + 1 }, (_, k) => ys[0] + k) : [];

  const sessions = {};
  for (const s of state.solves) (sessions[s.session] ||= []).push(s);
  const recRows = Object.entries(sessions).map(([k, list]) => {
    const name = k.startsWith('item:') ? getItem(k.slice(5))?.name || 'Objet supprimé' : eventById(k.slice(3)).label;
    return [name, list.length, Math.min(...list.map(eff)), avg(list, 5), avg(list, 12)];
  }).sort((a, b) => b[1] - a[1]);

  main.append(h('div', { class: 'stats-layout' },
    h('section', { class: 'card', style: { gridColumn: 'span 4' } }, h('h3', {}, 'Sur l\'étagère'), h('div', { class: 'big' }, here.length),
      h('p', { class: 'muted', style: { marginTop: '10px' } }, `${wish.length} sur la liste d'envies, ${all.filter((i) => i.fav).length} coups de cœur.`)),
    h('section', { class: 'card', style: { gridColumn: 'span 4' } }, h('h3', {}, 'Investi'), h('div', { class: 'big' }, fmtMoney(spent) || '0 €'),
      h('p', { class: 'muted', style: { marginTop: '10px' } }, priced.length ? `En moyenne ${fmtMoney(spent / priced.length)} par casse-tête (${priced.length} prix renseignés).` : 'Aucun prix renseigné.')),
    h('section', { class: 'card', style: { gridColumn: 'span 4' } }, h('h3', {}, 'Déjà résolus'), h('div', { class: 'big' }, here.length ? Math.round((solved / here.length) * 100) + ' %' : '–'),
      h('div', { style: { marginTop: '12px' } }, bars(SOLVE_STATE.map((s) => [s.label, here.filter((i) => i.solve === s.id).length])))),
    h('section', { class: 'card', style: { gridColumn: 'span 6' } }, h('h3', {}, 'Par famille'), bars(byCat)),
    h('section', { class: 'card', style: { gridColumn: 'span 6' } }, h('h3', {}, 'Marques les plus présentes'), bars(byBrand)),
    h('section', { class: 'card', style: { gridColumn: 'span 8' } }, h('h3', {}, 'Arrivées par année'),
      cols.length ? h('div', { class: 'cols', role: 'img', 'aria-label': 'Nombre de casse-têtes arrivés chaque année' }, cols.map((y) => h('div', { title: `${y} : ${years[y] || 0}` }, h('b', { style: { color: 'var(--ink)' } }, years[y] || ''), h('i', { style: { height: ((years[y] || 0) / yMax) * 120 + 'px' } }), h('span', {}, String(y).slice(2))))) : h('p', { class: 'muted' }, 'Renseignez les dates d\'arrivée pour voir la frise.')),
    h('section', { class: 'card', style: { gridColumn: 'span 4' } }, h('h3', {}, 'Difficulté ressentie'), bars([1, 2, 3, 4, 5].map((d) => [`${d} sur 5`, here.filter((i) => i.difficulty === d).length]))),
    h('section', { class: 'card', style: { gridColumn: 'span 12' } }, h('h3', {}, 'Le mur de couleurs'),
      h('p', { class: 'muted' }, 'Un carré par casse-tête, dans la teinte tirée de sa photo, rangés du rouge au violet puis du noir au blanc.'),
      h('div', { class: 'wall' }, here.slice().sort((a, b) => hue(a.tone) - hue(b.tone)).map((i) => h('a', { href: '#/c/' + i.id, title: i.name, 'aria-label': i.name, style: { '--c': i.tone } })))),
    recRows.length ? h('section', { class: 'card', style: { gridColumn: 'span 12' } }, h('h3', {}, 'Records au chrono'),
      h('div', { class: 'ledger-wrap' }, h('table', { class: 'ledger' },
        h('thead', {}, h('tr', {}, ['Puzzle', 'Résolutions', 'Meilleur', 'Moy. de 5 actuelle', 'Moy. de 12 actuelle'].map((t) => h('th', {}, t)))),
        h('tbody', {}, recRows.map((r) => h('tr', { style: { cursor: 'default' } }, h('td', {}, h('b', {}, r[0])), h('td', { class: 'num' }, r[1]), h('td', { class: 'num' }, fmt(r[2])), h('td', { class: 'num' }, fmt(r[3])), h('td', { class: 'num' }, fmt(r[4])))))))) : null));
}

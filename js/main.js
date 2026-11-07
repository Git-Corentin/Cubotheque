import { state, load, on, adoptPublished } from './store.js';
import { h, $, $$, toast } from './ui.js';

const views = {
  collection: () => import('./views/collection.js'),
  form: () => import('./views/item-form.js'),
  bulk: () => import('./views/bulk.js'),
  chrono: () => import('./views/timer.js'),
  mosaique: () => import('./views/mosaic.js'),
  methodes: () => import('./views/methods.js'),
  stats: () => import('./views/stats.js'),
  reglages: () => import('./views/settings.js'),
  connexion: () => import('./views/login.js'),
};
const EDIT_ONLY = new Set(['form', 'bulk', 'reglages']);

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  if (!a) return { view: 'collection', sec: 'collection', params: {} };
  if (a === 'c') return { view: 'collection', sec: 'collection', params: { id: b } };
  if (a === 'ajouter') return { view: 'form', sec: 'collection', params: {} };
  if (a === 'modifier') return { view: 'form', sec: 'collection', params: { id: b } };
  if (a === 'serie') return { view: 'bulk', sec: 'collection', params: {} };
  if (a === 'methodes') return { view: 'methodes', sec: 'methodes', params: { id: b, mode: c } };
  if (a === 'connexion') return { view: 'connexion', sec: 'reglages', params: { arg: b } };
  if (views[a]) return { view: a, sec: a, params: { arg: b } };
  return { view: 'collection', sec: 'collection', params: {} };
}

let current = { key: null, mod: null, cleanup: null };

async function route() {
  let r = parse();
  if (EDIT_ONLY.has(r.view) && !state.canEdit) { location.replace(state.backend === 'supabase' ? '#/connexion' : '#/'); return; }
  document.body.dataset.sec = r.sec;
  $$('.rail a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.sec === r.sec));
  const main = $('#main');
  const key = r.view + (r.view === 'methodes' ? ':' + (r.params.id || '') + ':' + (r.params.mode || '') : '') + (r.view === 'connexion' ? ':' + (r.params.arg || '') : '');
  if (current.key === key && current.mod?.update) { current.mod.update(r.params); return; }
  current.cleanup?.();
  const mod = await views[r.view]();
  main.replaceChildren();
  main.className = 'view-' + r.view;
  current = { key, mod, cleanup: null };
  try {
    current.cleanup = (await mod.render(main, r.params)) || null;
  } catch (err) {
    console.error(err);
    main.append(h('div', { class: 'empty' }, h('h2', {}, 'Cette page n\'a pas pu s\'afficher.'), h('p', {}, String(err.message || err))));
  }
  if (!r.params.id) window.scrollTo(0, 0);
}

function applySettings() {
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.fx = s.effect;
  $('#siteTitle').textContent = s.title || 'Cubothèque';
  document.title = s.title || 'Cubothèque';
  // Réglages : visibles seulement pour qui peut modifier
  const set = $('.rail a[data-sec="reglages"]');
  set.hidden = !state.canEdit;
  const foot = $('#foot');
  foot.replaceChildren(
    h('span', {}, s.title || 'Cubothèque'),
    state.backend === 'supabase'
      ? (state.user ? h('a', { href: '#/connexion' }, state.canEdit ? `Connecté : ${state.user.email}` : 'Compte sans droits d\'édition')
        : h('a', { href: '#/connexion' }, 'Espace propriétaire'))
      : h('span', { class: 'muted' }, 'Données enregistrées dans ce navigateur'));
}

function banner() {
  const b = $('#banner');
  b.replaceChildren();
  if (state.backendError) b.append(h('div', { class: 'banner warn' }, h('span', {}, state.backendError)));
  if (state.viewingPublished) {
    b.append(h('div', { class: 'banner' },
      h('span', {}, 'Version publiée, en lecture seule.'),
      h('button', {
        class: 'btn small', onclick: async (e) => {
          e.target.disabled = true; e.target.textContent = 'Copie en cours…';
          await adoptPublished(); toast('La collection est maintenant modifiable dans ce navigateur.');
        },
      }, 'C\'est ma collection : la modifier ici')));
  }
}

on((what) => {
  if (what === 'settings' || what === 'all') applySettings();
  if (what === 'all') { banner(); current.key = null; route(); }
});
window.addEventListener('hashchange', route);

(async () => {
  try { await load(); } catch (e) { console.error(e); state.backendError = e.message; }
  applySettings();
  banner();
  route();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

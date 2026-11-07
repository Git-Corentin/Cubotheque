import { state, saveSettings, exportZip, importZip, wipeAll, enterReadonly, signOut, localDataSummary, migrateLocal, collectionCSV } from '../store.js';
import { supaConfig, testSupabase } from '../backend.js';
import { h, toast, download, confirmBox } from '../ui.js';

export function render(main) {
  const s = state.settings;
  const online = state.backend === 'supabase';
  const seg = (key, opts) => {
    const box = h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', {
      type: 'button', 'aria-pressed': String(s[key] === v),
      onclick: (e) => { saveSettings({ [key]: v }).catch((er) => toast(er.message, 'err')); [...box.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
    }, l)));
    return box;
  };
  const title = h('input', { class: 'field', value: s.title, onchange: () => saveSettings({ title: title.value.trim() || 'Cubothèque' }) });
  const about = h('textarea', { class: 'field', placeholder: 'Quelques mots pour les visiteurs : depuis quand vous collectionnez, vos puzzles préférés…', onchange: () => saveSettings({ about: about.value }) }, s.about || '');
  const fx = h('div', { class: 'fx-pick', role: 'group', 'aria-label': 'Effet de présentation' },
    [['socle', 'Socle'], ['autocollant', 'Autocollant'], ['dure', 'Ombre dure'], ['halo', 'Halo'], ['aucun', 'Aucun']].map(([v, l]) => h('button', {
      type: 'button', 'data-fx': v, 'aria-pressed': String(s.effect === v),
      onclick: (e) => { saveSettings({ effect: v }); [...fx.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
    }, h('span', { class: 'demo' }, h('i')), l)));
  const proxy = h('input', { class: 'field', value: s.proxy, placeholder: 'https://mon-relais.workers.dev/?url=', onchange: () => saveSettings({ proxy: proxy.value.trim() }) });
  const hold = h('input', { class: 'field', type: 'number', min: 0, max: 1500, step: 50, value: s.holdMs, onchange: () => saveSettings({ holdMs: +hold.value }) });
  const zipIn = h('input', { type: 'file', accept: '.zip', class: 'field' });
  const progress = h('p', { class: 'hint', 'aria-live': 'polite' });

  main.append(h('header', { class: 'head' }, h('h1', {}, 'Réglages')), h('div', { class: 'settings' },
    onlineCard(),
    h('section', { class: 'card' }, h('h3', {}, 'Apparence'),
      h('label', { class: 'lbl' }, 'Nom du site', title),
      h('label', { class: 'lbl' }, 'Présentation (affichée sous la collection)', about),
      h('div', { class: 'lbl' }, 'Couleur du corps', seg('theme', [['blanc', 'Corps blanc'], ['noir', 'Corps noir'], ['primaire', 'Couleurs vives']])),
      h('div', { class: 'lbl' }, 'Présentation des objets détourés', fx),
      h('div', { class: 'lbl' }, 'Vue par défaut de la collection', seg('defaultView', [['presentoir', 'Présentoir'], ['etagere', 'À l\'échelle'], ['registre', 'Registre']]))),

    h('section', { class: 'card' }, h('h3', {}, 'Sauvegarde'),
      h('p', {}, online ? 'La base en ligne n\'a pas de sauvegarde automatique sur l\'offre gratuite. Téléchargez une sauvegarde de temps en temps : fiches, images, méthodes et temps dans un seul fichier.' : 'Tout est enregistré dans ce navigateur. Téléchargez régulièrement une sauvegarde : fiches, images, méthodes et temps.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn solid', onclick: async (e) => {
            e.target.disabled = true;
            try { download(await exportZip({ onProgress: (i, n) => (progress.textContent = `Préparation : ${i} / ${n}`) }), `cubotheque-${new Date().toISOString().slice(0, 10)}.zip`); toast('Sauvegarde téléchargée.'); } catch (er) { toast('Export impossible : ' + er.message, 'err'); }
            e.target.disabled = false; progress.textContent = '';
          },
        }, 'Télécharger une sauvegarde'),
        h('button', { class: 'btn', onclick: () => download(new Blob([collectionCSV()], { type: 'text/csv;charset=utf-8' }), 'collection.csv') }, 'Exporter pour un tableur (CSV)')),
      h('label', { class: 'lbl' }, 'Restaurer une sauvegarde (.zip)', zipIn),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => restore(false) }, 'Ajouter à l\'existant'),
        h('button', { class: 'btn danger', onclick: () => restore(true) }, 'Remplacer tout')),
      progress),

    online ? null : h('section', { class: 'card' }, h('h3', {}, 'Publier sans base en ligne'),
      h('p', {}, 'Autre possibilité, sans compte : décompressez une sauvegarde dans le dossier ', h('b', {}, 'data/'), ' du site, puis mettez le site à jour. Les visiteurs voient alors cette version figée.'),
      state.published ? h('p', { class: 'muted' }, `Version publiée détectée : ${state.published.items?.length || 0} objets.`) : null,
      state.published ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { enterReadonly(); location.hash = '#/'; } }, 'Voir comme un visiteur')) : null),

    h('section', { class: 'card' }, h('h3', {}, 'Chrono (cet appareil)'),
      h('label', { class: 'lbl' }, h('span', {}, 'Temps d\'appui avant départ (ms) ', h('small', {}, '300 par défaut, 0 pour partir tout de suite')), hold)),

    h('section', { class: 'card' }, h('h3', {}, 'Images en ligne (cet appareil)'),
      h('p', {}, 'La recherche interroge Wikimedia Commons et Openverse. Certains sites refusent qu\'une autre page télécharge leurs images : un petit relais gratuit (worker/cors-proxy.js, sur Cloudflare Workers) contourne ce blocage.'),
      h('label', { class: 'lbl' }, 'Adresse du relais (facultatif)', proxy)),

    h('section', { class: 'card' }, h('h3', {}, 'Tout effacer'),
      h('p', {}, online ? 'Supprime toute la collection de la base en ligne, images comprises.' : 'Supprime la collection, les images, les méthodes et les temps de ce navigateur.'),
      h('div', { class: 'row' }, h('button', {
        class: 'btn danger', onclick: async () => {
          if (await confirmBox('Tout effacer ? Sans sauvegarde, rien ne pourra être récupéré.', { ok: 'Tout effacer', danger: true })) { await wipeAll(); toast('Collection effacée.'); }
        },
      }, 'Effacer les données')))));

  async function restore(replace) {
    const f = zipIn.files[0];
    if (!f) { toast('Choisissez d\'abord le fichier .zip.', 'err'); zipIn.focus(); return; }
    if (replace && !(await confirmBox('Remplacer toute la collection actuelle par cette sauvegarde ?', { ok: 'Remplacer', danger: true }))) return;
    try { const n = await importZip(f, { replace, onProgress: (i, t, name) => (progress.textContent = `Import ${i} / ${t} : ${name}`) }); toast(`${n} casse-têtes importés.`); } catch (e) { toast('Import impossible : ' + e.message, 'err'); }
    progress.textContent = '';
  }
}

/** Base en ligne : état, migration, ou assistant de mise en place. */
function onlineCard() {
  const card = h('section', { class: 'card', style: { gridColumn: '1 / -1' } }, h('h3', {}, 'Base en ligne'));
  const cfg = supaConfig();
  if (state.backend === 'supabase') {
    const mig = h('div', { style: { display: 'grid', gap: '8px' } });
    card.append(
      h('p', {}, 'Connectée à ', h('b', {}, new URL(cfg.url).host), state.user ? ['. Compte : ', h('b', {}, state.user.email), '.'] : '.'),
      cfg.temp ? h('p', { class: 'err' }, 'Réglage provisoire, valable sur cet appareil seulement : copiez l\'adresse et la clé dans js/config.js pour que les visiteurs voient la collection.') : null,
      mig,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: async () => { await signOut(); location.hash = '#/'; } }, 'Se déconnecter'),
        cfg.temp ? h('button', { class: 'btn ghost', onclick: () => { localStorage.removeItem('cubo.supa'); location.reload(); } }, 'Oublier ce réglage provisoire') : null));
    localDataSummary().then(({ count, sheets }) => {
      if (!count && !sheets) return;
      const out = h('p', { class: 'hint' });
      mig.append(h('p', {}, `Ce navigateur contient encore ${count} casse-têtes et ${sheets} fiches saisis avant le branchement de la base.`),
        h('div', { class: 'row' }, h('button', {
          class: 'btn accent', onclick: async (e) => {
            e.target.disabled = true;
            try { const n = await migrateLocal((i, t, name) => (out.textContent = `Envoi ${i} / ${t} : ${name}`)); toast(`${n} casse-têtes envoyés dans la base en ligne.`); } catch (er) { toast(er.message, 'err'); e.target.disabled = false; }
          },
        }, 'Les envoyer dans la base en ligne')), out);
    });
    return card;
  }
  const url = h('input', { class: 'field', placeholder: 'https://xxxxxxxx.supabase.co' });
  const key = h('input', { class: 'field', placeholder: 'sb_publishable_… (ou clé anon)' });
  const res = h('p', { class: 'hint', 'aria-live': 'polite' });
  const code = h('pre', { class: 'code', hidden: true });
  card.append(
    h('p', {}, 'Aujourd\'hui la collection vit dans ce navigateur. Branchée sur une base Supabase (gratuite), elle est accessible depuis l\'ordinateur et le téléphone, les visiteurs la consultent, et seul votre compte administrateur peut la modifier.'),
    h('ol', { class: 'steps' },
      h('li', {}, 'Créez un compte et un projet sur supabase.com (offre gratuite).'),
      h('li', {}, 'SQL Editor : collez le contenu du fichier supabase/schema.sql et lancez-le.'),
      h('li', {}, 'Authentication, Users : ajoutez votre utilisateur (e-mail et mot de passe). Dans Sign In / Providers, désactivez les nouvelles inscriptions.'),
      h('li', {}, 'SQL Editor : lancez la ligne « insert into public.admins … » en bas du script, avec votre adresse.'),
      h('li', {}, 'Project Settings, API Keys : copiez l\'adresse du projet et la clé publique ci-dessous, puis testez.')),
    h('div', { class: 'grid2' }, h('label', { class: 'lbl' }, 'Adresse du projet', url), h('label', { class: 'lbl' }, 'Clé publique', key)),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn solid', onclick: async () => {
          res.textContent = 'Test en cours…';
          try {
            res.textContent = await testSupabase(url.value.trim(), key.value.trim());
            code.hidden = false;
            code.textContent = `export const SUPABASE = {\n  url: '${url.value.trim()}',\n  key: '${key.value.trim()}',\n};`;
          } catch (e) { res.textContent = 'Échec : ' + e.message; }
        },
      }, 'Tester la connexion'),
      h('button', {
        class: 'btn', onclick: () => {
          if (!url.value || !key.value) { toast('Renseignez l\'adresse et la clé.', 'err'); return; }
          localStorage.setItem('cubo.supa', JSON.stringify({ url: url.value.trim(), key: key.value.trim() }));
          location.hash = '#/connexion'; location.reload();
        },
      }, 'L\'utiliser sur cet appareil')),
    res,
    h('p', { class: 'hint' }, 'Pour que tout le monde (et votre téléphone) utilise la base, remplacez le contenu de js/config.js par :'),
    code);
  return card;
}

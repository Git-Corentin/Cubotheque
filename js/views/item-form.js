import { state, CATEGORIES, STATUS, SOLVE_STATE, getItem, blankItem, saveItem, saveImage, deleteImage, imageURL } from '../store.js';
import { studio } from '../camera.js';
import { h, $, toast } from '../ui.js';
import { searchImages, fetchBlob } from '../imagepipe.js';
import { openCutout } from '../cutout.js';
import { EVENTS } from '../scramble.js';

const BRANDS = ['GAN', 'MoYu', 'QiYi', 'YJ', 'DaYan', 'ShengShou', 'X-Man', 'Rubik\'s', 'MF8', 'Meffert\'s', 'LanLan', 'Calvin\'s Puzzle', 'WitEden', 'FangShi', 'Diansheng', 'SengSo', 'Cyclone Boys', 'YuXin', 'MoFangGe', 'V-Cube', 'Verypuzzle', 'TomZ', 'Z-Cube', 'Mf8', 'Shuang Ren', 'Fanxin', 'JieHui', 'Kungfu'];
const NAMES = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', 'Pyraminx', 'Megaminx', 'Skewb', 'Square-1', 'Clock', 'Mirror Cube', 'Axis Cube', 'Ghost Cube', 'Fisher Cube', 'Windmill Cube', 'Mastermorphix', 'Ivy Cube', 'Dino Cube', 'Rex Cube', 'Redi Cube', 'Helicopter Cube', 'Curvy Copter', 'Kilominx', 'Gigaminx', 'Master Pyraminx', 'FTO', 'Skewb Diamond', 'Gear Cube', 'Crazy 3x3', 'Bandaged Cube', '3x3x2 Domino', '2x2x3 Tower', 'Void Cube', 'Mixup Cube', 'Fenzy Cube', 'Super Floppy'];

let pasteHandler;

export function render(main, params) {
  const editing = params.id ? getItem(params.id) : null;
  if (params.id && !editing) { main.append(h('p', {}, 'Objet introuvable.')); return; }
  if (state.readonly) { location.hash = '#/'; return; }
  const it = editing ? structuredClone(editing) : blankItem();
  let pending = null; // { blob, tone } image traitée non encore enregistrée
  let source = null;  // Blob source avant détourage

  /* ---------- champs ---------- */
  const f = {};
  const input = (key, attrs = {}) => (f[key] = h('input', { class: 'field', value: it[key] ?? '', ...attrs }));
  const select = (key, opts) => { const s = h('select', { class: 'field' }, opts.map(([v, l]) => h('option', { value: v }, l))); s.value = it[key] ?? ''; return (f[key] = s); };

  const brandsList = h('datalist', { id: 'dl-brands' }, [...new Set([...state.items.map((i) => i.brand).filter(Boolean), ...BRANDS])].map((b) => h('option', { value: b })));
  const namesList = h('datalist', { id: 'dl-names' }, NAMES.map((b) => h('option', { value: b })));
  let diffSet = !!it.difficulty;
  const diffOut = h('b', {}, it.difficulty || '?');
  const diff = h('input', { type: 'range', min: 1, max: 5, step: 1, value: it.difficulty || 3, oninput: () => { diffSet = true; diffOut.textContent = diff.value; } });
  f.difficulty = diff;
  f.magnetic = h('input', { type: 'checkbox', checked: !!it.magnetic });
  f.fav = h('input', { type: 'checkbox', checked: !!it.fav });
  f.notes = h('textarea', { class: 'field', placeholder: 'Souvenirs, défauts, réglage des ressorts, vidéo qui a aidé…' }, it.notes || '');
  f.tags = h('input', { class: 'field', value: (it.tags || []).join(', '), placeholder: 'cadeau, édition limitée, à lubrifier' });

  const left = h('div', { style: { display: 'grid', gap: '26px' } },
    h('fieldset', {}, h('legend', {}, 'Identité'),
      h('label', { class: 'lbl' }, 'Nom', input('name', { required: true, list: 'dl-names', placeholder: 'ex. Megaminx, Mirror Cube, Curvy Copter' })),
      h('div', { class: 'grid2' },
        h('label', { class: 'lbl' }, 'Marque', input('brand', { list: 'dl-brands' })),
        h('label', { class: 'lbl' }, 'Modèle ou version', input('model', { placeholder: 'ex. 12 M Pro, WR M V9' }))),
      h('div', { class: 'grid2' },
        h('label', { class: 'lbl' }, 'Catégorie', select('category', CATEGORIES.map((c) => [c.id, c.label]))),
        h('label', { class: 'lbl' }, 'Format', input('size', { placeholder: '3x3x3, 2x2x4, 5 couches…' }))),
      h('div', { class: 'grid2' },
        h('label', { class: 'lbl' }, 'Finition', select('finish', [['', 'Non précisée'], ['stickerless', 'Sans autocollants'], ['stickers', 'Autocollants'], ['tiles', 'Tuiles'], ['custom', 'Personnalisée']])),
        h('div', { class: 'row', style: { alignSelf: 'end', minHeight: '42px' } },
          h('label', { class: 'check' }, f.magnetic, 'Aimanté'), h('label', { class: 'check' }, f.fav, 'Coup de cœur')))),
    h('fieldset', {}, h('legend', {}, 'Vous et lui'),
      h('div', { class: 'grid2' },
        h('label', { class: 'lbl' }, 'Statut', select('status', STATUS.map((s) => [s.id, s.label]))),
        h('label', { class: 'lbl' }, 'Résolution', select('solve', SOLVE_STATE.map((s) => [s.id, s.label])))),
      h('div', { class: 'grid2' },
        h('label', { class: 'lbl' }, h('span', {}, 'Difficulté ressentie : ', diffOut, ' / 5'), diff),
        h('label', { class: 'lbl' }, 'Mélange au chrono', select('event', [['', 'Deviner d\'après le nom'], ...EVENTS.map((e) => [e.id, e.label])])))),
    h('fieldset', {}, h('legend', {}, 'Acquisition et mesures'),
      h('div', { class: 'grid3' },
        h('label', { class: 'lbl' }, 'Arrivé le', input('acquired', { type: 'date' })),
        h('label', { class: 'lbl' }, h('span', {}, 'ou l\'année ', h('small', {}, 'si la date est inconnue')), input('year', { type: 'number', min: 1970, max: 2100, placeholder: 'ex. 2019' })),
        h('label', { class: 'lbl' }, 'Prix (€)', input('price', { type: 'number', step: '0.01', min: 0 }))),
      h('label', { class: 'lbl' }, 'Provenance', input('source', { list: 'dl-sources', placeholder: 'Leboncoin, Aliexpress, brocante, cadeau…' })),
      h('datalist', { id: 'dl-sources' }, [...new Set(state.items.map((i) => i.source).filter(Boolean))].map((v) => h('option', { value: v }))),
      h('div', { class: 'grid2' },
        h('label', { class: 'lbl' }, h('span', {}, 'Plus grande dimension (mm) ', h('small', {}, 'pour la vue à l\'échelle')), input('sizeMm', { type: 'number', min: 5, max: 400 })),
        h('label', { class: 'lbl' }, 'Poids (g)', input('weightG', { type: 'number', min: 1 })))),
    h('fieldset', {}, h('legend', {}, 'Notes'), f.notes, h('label', { class: 'lbl' }, h('span', {}, 'Étiquettes ', h('small', {}, 'séparées par des virgules')), f.tags)),
    brandsList, namesList);

  /* ---------- atelier image ---------- */
  const preview = h('div', { class: 'wk-preview', style: { '--tone': it.tone } });
  const toneIn = h('input', { type: 'color', value: it.tone || '#9aa0a6', 'aria-label': 'Teinte de fond', oninput: () => { it.tone = toneIn.value; preview.style.setProperty('--tone', it.tone); } });
  const bgToggle = h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => preview.classList.toggle('on-tone', e.target.checked) }), 'Voir sur sa teinte');
  const status = h('p', { class: 'hint', 'aria-live': 'polite' });
  const credit = h('p', { class: 'credit' }, it.imageCredit || '');

  async function showCurrent() {
    preview.replaceChildren();
    let url = null;
    if (pending) url = URL.createObjectURL(pending.blob);
    else if (it.imageId) url = await imageURL(it.imageId);
    const stage = h('div', { class: 'stage' }, h('div', { class: 'cut' }, url ? h('img', { src: url, alt: 'Aperçu' }) : h('p', { class: 'hint', style: { textAlign: 'center', padding: '20px' } }, 'Aucune image pour l\'instant. Cherchez-en une en ligne, importez une photo ou collez une image copiée (Ctrl+V).')));
    preview.append(stage);
  }

  function progress(label, frac) {
    let p = $('.wk-progress', preview);
    if (!p) { p = h('div', { class: 'wk-progress' }, h('span'), h('div', { class: 'bar' }, h('i'))); preview.append(p); }
    p.firstChild.textContent = label;
    p.querySelector('i').style.width = Math.round((frac || 0) * 100) + '%';
  }

  async function process() {
    if (!source) return;
    const res = await openCutout(source, { title: f.name.value ? `Détourage : ${f.name.value}` : 'Atelier de détourage' });
    if (!res) { status.textContent = pending ? '' : 'Détourage annulé : choisissez une autre image ou relancez l\'atelier.'; return; }
    pending = res;
    it.tone = pending.tone; toneIn.value = pending.tone; preview.style.setProperty('--tone', it.tone);
    status.textContent = 'Détourée, recadrée et centrée. La teinte de la fiche est tirée de l\'objet ; vous pouvez la changer.';
    await showCurrent();
  }

  async function useBlob(blob, cred = '') {
    source = blob; it.imageCredit = cred; credit.textContent = cred;
    modeBar.hidden = false;
    await process();
  }

  const modeBar = h('div', { class: 'row', hidden: true },
    h('button', { type: 'button', class: 'btn small', onclick: () => process() }, 'Retoucher le détourage'));

  // sources
  const q = h('input', { class: 'field', type: 'search', placeholder: 'Nom du casse-tête', 'aria-label': 'Recherche d\'images' });
  const results = h('div', { class: 'results', hidden: true });
  const doSearch = async () => {
    const term = q.value.trim() || f.name.value.trim();
    if (!term) { q.focus(); return; }
    results.hidden = false;
    results.replaceChildren(h('p', { class: 'hint', style: { gridColumn: '1/-1', padding: '10px' } }, h('span', { class: 'spin' }), ' Recherche dans Wikimedia Commons et Openverse…'));
    try {
      const list = await searchImages(term);
      results.replaceChildren(...(list.length ? list.map((r) => h('button', {
        type: 'button', title: `${r.title}${r.credit ? ' par ' + r.credit : ''} (${r.license})`,
        onclick: async () => {
          status.textContent = 'Téléchargement…';
          try { await useBlob(await fetchBlob(r.full, r.alt), `Image : ${r.credit || 'auteur inconnu'}, ${r.license.trim()}, via ${r.src}`); } catch (e) { toast(e.message, 'err'); status.textContent = ''; }
        },
      }, h('img', { src: r.thumb, alt: r.title, loading: 'lazy' }), h('span', { class: 'src' }, r.src))) : [h('p', { class: 'hint', style: { gridColumn: '1/-1', padding: '10px' } }, 'Aucune image libre trouvée. Les puzzles rares sont souvent absents des banques libres : essayez Google Images ci-dessous puis collez l\'image.')]));
    } catch (e) { results.replaceChildren(h('p', { class: 'err', style: { padding: '10px' } }, e.message)); }
  };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'sr', id: 'filein', onchange: () => fileIn.files[0] && useBlob(fileIn.files[0]) });
  const drop = h('label', { class: 'drop', for: 'filein' }, 'Déposez une photo ici, ou ', h('u', {}, 'choisissez un fichier'), '. Une photo sur fond uni donne le meilleur détourage.');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault(); drop.classList.remove('over');
    const file = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
    if (file) return useBlob(file);
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url) try { await useBlob(await fetchBlob(url), 'Image : ' + url); } catch (er) { toast(er.message, 'err'); }
  });
  const urlIn = h('input', { class: 'field', type: 'url', placeholder: 'https://…/image.jpg', 'aria-label': 'Adresse de l\'image' });
  const loadUrl = async () => { try { await useBlob(await fetchBlob(urlIn.value.trim()), 'Image : ' + urlIn.value.trim()); } catch (e) { toast(e.message, 'err'); } };

  const google = h('a', { class: 'btn small', target: '_blank', rel: 'noopener', href: '#', onclick: (e) => { e.currentTarget.href = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent((q.value || f.name.value) + ' puzzle'); } }, 'Ouvrir Google Images');

  const workshop = h('aside', { class: 'workshop' },
    h('div', { class: 'panel', style: { display: 'grid', gap: '12px' } },
      h('h2', { style: { fontSize: '1.3rem' } }, 'Image'),
      preview, modeBar, status, credit,
      h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Teinte de la fiche'), toneIn, bgToggle)),
    h('div', { class: 'panel', style: { display: 'grid', gap: '10px' } },
      h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, q, h('button', { type: 'button', class: 'btn solid', onclick: doSearch }, 'Chercher')),
      results,
      h('p', { class: 'hint' }, 'Pas trouvé ? ', google, ' : faites un clic droit sur une image, « Copier l\'image », puis revenez ici et collez avec Ctrl+V.'),
      h('div', { class: 'row' },
        h('label', { class: 'btn solid', style: { cursor: 'pointer' } }, h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr', onchange: (e) => e.target.files[0] && useBlob(e.target.files[0]) }), 'Prendre une photo'),
        navigator.mediaDevices?.getUserMedia ? h('button', { type: 'button', class: 'btn', onclick: () => studio((b) => useBlob(b)) }, 'Studio photo avec cadrage') : null),
      fileIn, drop,
      h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, urlIn, h('button', { type: 'button', class: 'btn', onclick: loadUrl }, 'Charger'))));

  pasteHandler = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (file) { e.preventDefault(); useBlob(file, ''); toast('Image collée.'); }
  };
  document.addEventListener('paste', pasteHandler);

  /* ---------- enregistrement ---------- */
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!f.name.value.trim()) { f.name.focus(); toast('Le nom est obligatoire.', 'err'); return; }
      for (const k of ['name', 'brand', 'model', 'category', 'size', 'finish', 'status', 'solve', 'event', 'acquired', 'year', 'price', 'source', 'sizeMm', 'weightG']) it[k] = f[k].value.trim?.() ?? f[k].value;
      it.difficulty = diffSet ? +diff.value : 0; it.magnetic = f.magnetic.checked; it.fav = f.fav.checked; it.notes = f.notes.value;
      it.tags = f.tags.value.split(',').map((s) => s.trim()).filter(Boolean);
      it.tone = toneIn.value;
      const saveBtn = e.submitter; if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…'; }
      try {
      if (pending) {
        const old = it.imageId;
        it.imageId = await saveImage(pending.blob);
        if (old) await deleteImage(old).catch(() => {});
      }
      await saveItem(it);
      toast(editing ? 'Modifications enregistrées.' : `« ${it.name} » ajouté à la collection.`);
      location.hash = '#/c/' + it.id;
      } catch (er) { toast('Enregistrement impossible : ' + er.message, 'err'); if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Réessayer'; } }
    },
  },
  h('div', { class: 'form-layout' }, left, workshop),
  h('div', { class: 'sticky-bar' },
    h('a', { class: 'btn ghost', href: editing ? '#/c/' + it.id : '#/' }, 'Annuler'),
    h('button', { class: 'btn accent', type: 'submit' }, editing ? 'Enregistrer' : 'Ajouter à la collection')));

  main.append(h('header', { class: 'head' }, h('h1', {}, editing ? editing.name : 'Nouveau casse-tête')), form);
  f.name.addEventListener('change', () => { if (!q.value) q.placeholder = f.name.value; });
  showCurrent();
  if (!editing) f.name.focus();
  return () => document.removeEventListener('paste', pasteHandler);
}

import { state, CATEGORIES, blankItem, saveItem, saveImage, catLabel } from '../store.js';
import { h, $, modal, toast } from '../ui.js';
import { searchImages, fetchBlob, removeBgAI, removeBgFlat, normalize, squareKeep } from '../imagepipe.js';

export function guessCategory(name) {
  const s = name.toLowerCase();
  if (/minx|dodeca/.test(s)) return 'dodeca';
  if (/mirror|axis|ghost|fisher|windmill|mastermorphix|fenzy|mixup|void|pillow|barrel|penrose/.test(s)) return 'shape';
  if (/pyramin|tetra|jing/.test(s)) return 'tetra';
  if (/fto|octa|diamond|gem/.test(s)) return 'octa';
  if (/skewb|dino|rex|redi|ivy|xyz/.test(s)) return 'corner';
  if (/helicopter|copter|curvy/.test(s)) return 'edge';
  if (/square[- ]?1|sq[- ]?1|bandag|shift|morph|floppy/.test(s)) return 'shift';
  const m = s.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/);
  if (m) { const d = [m[1], m[2], m[3] || m[2]]; return new Set(d).size === 1 ? 'nxn' : 'cuboid'; }
  if (/clock|gear|sphere|ball|maze/.test(s)) return 'other';
  if (/cube|rubik/.test(s)) return 'nxn';
  return 'other';
}
function matchCategory(txt, name) {
  const t = (txt || '').toLowerCase().trim();
  if (!t) return guessCategory(name);
  const c = CATEGORIES.find((c) => c.id === t || c.label.toLowerCase().startsWith(t) || c.label.toLowerCase().includes(t));
  return c ? c.id : guessCategory(name);
}

export function render(main) {
  if (state.readonly) { location.hash = '#/'; return; }
  const ta = h('textarea', { class: 'field', rows: 12, style: { minHeight: '260px' }, placeholder: 'Megaminx ; QiYi ; ; \nGear Cube ; Meffert\'s\n3x3x5 ; WitEden ; cuboïdes\nMirror Cube\nCurvy Copter III ; LanLan' });
  const prev = h('div');
  const parse = () => ta.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, brand = '', cat = '', size = ''] = l.split(';').map((s) => s.trim());
    const m = name.match(/\d+\s*x\s*\d+(\s*x\s*\d+)?/);
    return { name, brand, category: matchCategory(cat, name), size: size || (m ? m[0].replace(/\s/g, '') : '') };
  });
  const showPrev = () => {
    const rows = parse();
    prev.replaceChildren(rows.length ? h('div', { class: 'ledger-wrap' }, h('table', { class: 'ledger' },
      h('thead', {}, h('tr', {}, ['Nom', 'Marque', 'Catégorie devinée', 'Format'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((r) => h('tr', {}, h('td', {}, h('b', {}, r.name)), h('td', {}, r.brand), h('td', {}, catLabel(r.category)), h('td', {}, r.size)))))) : '');
    addBtn.textContent = rows.length ? `Ajouter ${rows.length} casse-tête${rows.length > 1 ? 's' : ''}` : 'Ajouter';
    addBtn.disabled = !rows.length;
  };
  ta.addEventListener('input', showPrev);
  const addBtn = h('button', {
    class: 'btn accent', disabled: true, onclick: async () => {
      const rows = parse();
      for (const r of rows) { const it = Object.assign(blankItem(), r); await saveItem(it); }
      toast(`${rows.length} casse-têtes ajoutés.`);
      ta.value = ''; showPrev(); paintMissing();
    },
  }, 'Ajouter');

  const missingEl = h('div');
  const paintMissing = () => {
    const miss = state.items.filter((i) => !i.imageId);
    missingEl.replaceChildren(h('div', { class: 'panel', style: { display: 'grid', gap: '12px' } },
      h('h2', {}, 'Atelier photo en série'),
      h('p', {}, miss.length
        ? `${miss.length} objet${miss.length > 1 ? 's n\'ont' : ' n\'a'} pas encore d'image. L'atelier les fait défiler un par un : il cherche une photo d'après le nom, vous cliquez la bonne, elle est détourée et rangée, puis on passe au suivant.`
        : 'Tous les objets ont une image.'),
      miss.length ? h('div', { class: 'row' }, h('button', { class: 'btn solid', onclick: () => photoQueue(miss) }, 'Lancer l\'atelier photo')) : null));
  };
  paintMissing();

  main.append(
    h('header', { class: 'head' }, h('h1', {}, 'Ajout en série'),
      h('p', { class: 'lead' }, 'Un casse-tête par ligne. Ajoutez si vous voulez la marque, la catégorie et le format, séparés par des points-virgules. La catégorie est devinée d\'après le nom quand elle manque.')),
    h('div', { class: 'form-layout' },
      h('div', { style: { display: 'grid', gap: '12px' } }, ta, h('div', { class: 'row' }, addBtn, h('a', { class: 'btn ghost', href: '#/' }, 'Retour à la collection'))),
      h('div', { style: { display: 'grid', gap: '12px' } }, prev, missingEl)));
}

function photoQueue(list) {
  let i = 0;
  let mode = localStorage.getItem('cubo.cutmode') || 'ai';
  const body = h('div', { style: { padding: '26px', display: 'grid', gap: '14px' } });
  const m = modal(body, { wide: true, label: 'Atelier photo' });
  const onPaste = (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); take(f, ''); } };
  document.addEventListener('paste', onPaste);
  m.el.addEventListener('close', () => document.removeEventListener('paste', onPaste));
  let busy = false;

  async function take(blob, credit) {
    if (busy) return; busy = true;
    const it = list[i];
    const st = $('.qstatus', body);
    try {
      let cut = null;
      if (mode === 'ai') cut = await removeBgAI(blob, (l, f) => (st.textContent = `${l} ${Math.round(f * 100)} %`));
      else if (mode === 'flat') { st.textContent = 'Détourage…'; cut = await removeBgFlat(blob); }
      const res = cut ? await normalize(cut) : await squareKeep(blob);
      it.imageId = await saveImage(res.blob); it.tone = res.tone; it.imageCredit = credit;
      await saveItem(it);
      i++; busy = false; show();
    } catch (e) { busy = false; st.textContent = ''; toast(e.message || 'Échec du détourage', 'err'); }
  }

  async function show() {
    if (i >= list.length) { body.replaceChildren(h('h2', {}, 'Terminé.'), h('p', {}, 'Toutes les images de la série sont rangées.'), h('div', { class: 'row' }, h('button', { class: 'btn solid', onclick: () => { m.close(); location.hash = '#/'; } }, 'Voir la collection'))); return; }
    const it = list[i];
    const results = h('div', { class: 'results', style: { maxHeight: '420px' } }, h('p', { class: 'hint', style: { gridColumn: '1/-1', padding: '10px' } }, h('span', { class: 'spin' }), ' Recherche…'));
    const q = h('input', { class: 'field', value: it.name + (it.brand ? ' ' + it.brand : ''), 'aria-label': 'Recherche' });
    const fileIn = h('input', { type: 'file', accept: 'image/*', onchange: () => fileIn.files[0] && take(fileIn.files[0], '') });
    const seg = h('div', { class: 'seg' }, [['ai', 'Détourage précis'], ['flat', 'Fond uni'], ['keep', 'Garder le fond']].map(([v, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(mode === v), onclick: (e) => { mode = v; localStorage.setItem('cubo.cutmode', v); [...seg.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, l)));
    const search = async () => {
      try {
        const r = await searchImages(q.value);
        results.replaceChildren(...(r.length ? r.map((x) => h('button', {
          type: 'button', title: x.title, onclick: async () => {
            $('.qstatus', body).textContent = 'Téléchargement…';
            try { await take(await fetchBlob(x.full, x.alt), `Image : ${x.credit || 'auteur inconnu'}, ${x.license.trim()}, via ${x.src}`); } catch (e) { toast(e.message, 'err'); }
          },
        }, h('img', { src: x.thumb, alt: '', loading: 'lazy' }), h('span', { class: 'src' }, x.src))) : [h('p', { class: 'hint', style: { gridColumn: '1/-1', padding: '10px' } }, 'Aucun résultat libre. Collez une image copiée ailleurs (Ctrl+V) ou importez un fichier.')]));
      } catch (e) { results.replaceChildren(h('p', { class: 'err' }, e.message)); }
    };
    body.replaceChildren(
      h('p', { class: 'muted num' }, `${i + 1} sur ${list.length}`),
      h('h2', {}, it.name),
      h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, q, h('button', { class: 'btn solid', onclick: search }, 'Chercher')),
      seg, results,
      h('div', { class: 'row' },
        h('label', { class: 'btn small solid', style: { cursor: 'pointer' } }, h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr', onchange: (e) => e.target.files[0] && take(e.target.files[0], '') }), 'Prendre une photo'),
        h('span', { class: 'hint' }, 'ou un fichier :'), fileIn,
        h('a', { class: 'btn small', target: '_blank', rel: 'noopener', href: 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(it.name + ' puzzle') }, 'Google Images'),
        h('span', { class: 'sp', style: { flex: 1 } }),
        h('button', { class: 'btn', onclick: () => { i++; show(); } }, 'Passer')),
      h('p', { class: 'qstatus hint', 'aria-live': 'polite' }));
    q.addEventListener('keydown', (e) => e.key === 'Enter' && search());
    search();
  }
  show();
}

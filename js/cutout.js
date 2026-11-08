// Atelier de détourage : IA (RMBG-1.4 via transformers.js, secours IMG.LY), couleur de fond calibrable,
// pinceaux, gomme de zone, finitions (dureté, lissage, anti-reflet, îlots). Tout tourne dans le navigateur.
import { h, modal, toast } from './ui.js';
import { normalize } from './imagepipe.js';

const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
const IMGLY = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const MAX = 1280; // résolution de travail

const prefs = () => { try { return JSON.parse(localStorage.getItem('cubo.cut') || '{}'); } catch { return {}; } };
const savePrefs = (p) => localStorage.setItem('cubo.cut', JSON.stringify({ ...prefs(), ...p }));

/* ---------- moteurs IA ---------- */
let segP = null, segKey = '';
async function rmbg(blob, quality, onProgress) {
  const dtype = { rapide: 'q8', equilibre: 'fp16', max: 'fp32' }[quality] || 'fp16';
  const T = await import(TRANSFORMERS);
  T.env.allowLocalModels = false;
  const make = async (device, dt) => T.pipeline('background-removal', 'briaai/RMBG-1.4', {
    dtype: dt, device,
    progress_callback: (p) => { if (p.status === 'progress' && p.total) onProgress?.('Téléchargement du modèle (une seule fois)', p.loaded / p.total); },
  });
  const key = dtype;
  if (!segP || segKey !== key) {
    segKey = key;
    segP = (async () => {
      const tries = navigator.gpu ? [['webgpu', dtype], ['wasm', dtype], ['wasm', 'fp32']] : [['wasm', dtype], ['wasm', 'fp32']];
      let last;
      for (const [dev, dt] of tries) { try { return await make(dev, dt); } catch (e) { last = e; console.warn('RMBG', dev, dt, e); } }
      throw last;
    })();
    segP.catch(() => { segP = null; });
  }
  const seg = await segP;
  onProgress?.('Détourage en cours', 0.92);
  const img = await T.RawImage.fromBlob(blob);
  const out = await seg(img);
  const r = Array.isArray(out) ? out[0] : out;
  const a = new Float32Array(r.width * r.height);
  for (let i = 0; i < a.length; i++) a[i] = r.data[i * r.channels + 3] / 255;
  return { a, w: r.width, h: r.height };
}
async function imgly(blob, quality, onProgress) {
  const mod = await import(IMGLY);
  const fn = mod.removeBackground || mod.default;
  const out = await fn(blob, {
    model: { rapide: 'isnet_quint8', equilibre: 'isnet_fp16', max: 'isnet' }[quality] || 'isnet_fp16',
    device: navigator.gpu ? 'gpu' : 'cpu',
    output: { format: 'image/png' },
    progress: (k, c, t) => onProgress?.(k.includes('fetch') ? 'Téléchargement du modèle (une seule fois)' : 'Détourage en cours', t ? c / t : 0),
  });
  const bm = await createImageBitmap(out);
  const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
  const d = g.getImageData(0, 0, bm.width, bm.height).data;
  const a = new Float32Array(bm.width * bm.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
  return { a, w: bm.width, h: bm.height };
}
/** Masque IA : RMBG d'abord, IMG.LY en secours. Lève une erreur détaillée si les deux échouent. */
export async function aiMask(blob, quality, onProgress) {
  const errs = [];
  for (const [name, fn] of [['RMBG-1.4', rmbg], ['IMG.LY', imgly]]) {
    try { return await fn(blob, quality, onProgress); } catch (e) { errs.push(`${name} : ${e?.message || e}`); console.error(name, e); }
  }
  throw new Error(errs.join(' | '));
}

/* ---------- utilitaires masque ---------- */
function resample(src, sw, sh, w, h) {
  if (sw === w && sh === h) return src;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = ((y + 0.5) * sh) / h - 0.5, y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(sh - 1, y0 + 1), ty = Math.max(0, fy - y0);
    for (let x = 0; x < w; x++) {
      const fx = ((x + 0.5) * sw) / w - 0.5, x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(sw - 1, x0 + 1), tx = Math.max(0, fx - x0);
      out[y * w + x] = (src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx) * (1 - ty) + (src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx) * ty;
    }
  }
  return out;
}
function boxBlur(a, w, h, r) {
  if (r < 1) return a;
  const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = s / (2 * r + 1); s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}
function keepMain(a, w, h) {
  const lab = new Int32Array(w * h); const sizes = [0]; let n = 0; const q = new Int32Array(w * h);
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0.5 || lab[i]) continue;
    n++; let qh = 0, qt = 0; q[qt++] = i; lab[i] = n; let sz = 0;
    while (qh < qt) { const p = q[qh++]; sz++; const x = p % w, y = (p / w) | 0;
      for (const nb of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (nb >= 0 && !lab[nb] && a[nb] >= 0.5) { lab[nb] = n; q[qt++] = nb; } }
    sizes.push(sz);
  }
  if (n < 2) return a;
  const max = Math.max(...sizes); const keep = sizes.map((s) => s >= max * 0.03);
  // on garde aussi la frange douce autour des composantes conservées
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = lab[i] ? (keep[lab[i]] ? a[i] : 0) : a[i];
  return out;
}
const dist = (d, i, c) => { const dr = d[i] - c[0], dg = d[i + 1] - c[1], db = d[i + 2] - c[2]; return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) / 3; };

/** Masque par couleur de fond : échantillons + remplissage depuis les bords et les clics. */
function colorMask(S, w, h, samples, tol, connected, seeds) {
  const D = new Float32Array(w * h);
  for (let i = 0, p = 0; p < D.length; i += 4, p++) { let m = 1e9; for (const c of samples) { const v = dist(S, i, c); if (v < m) m = v; } D[p] = m; }
  const bg = new Uint8Array(w * h);
  if (connected) {
    const q = new Int32Array(w * h); let qh = 0, qt = 0;
    const push = (p) => { if (!bg[p] && D[p] < tol) { bg[p] = 1; q[qt++] = p; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    for (const p of seeds) push(p);
    while (qh < qt) { const p = q[qh++]; const x = p % w, y = (p / w) | 0; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w); }
  } else for (let p = 0; p < D.length; p++) bg[p] = D[p] < tol ? 1 : 0;
  const a = new Float32Array(w * h);
  for (let p = 0; p < a.length; p++) {
    if (bg[p]) { a[p] = 0; continue; }
    const x = p % w, y = (p / w) | 0;
    const nearBg = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
    a[p] = nearBg ? Math.min(1, Math.max(0.15, (D[p] - tol * 0.7) / (tol * 0.9))) : 1;
  }
  return a;
}
function borderSamples(S, w, h) {
  const pts = [];
  const add = (x, y) => { const i = (y * w + x) * 4; pts.push([S[i], S[i + 1], S[i + 2]]); };
  const step = Math.max(1, Math.floor((w + h) / 300));
  for (let x = 0; x < w; x += step) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y += step) { add(0, y); add(w - 1, y); }
  // 3 groupes par k-moyennes simples (gère un fond dégradé ou un vignettage)
  let cs = [pts[0], pts[Math.floor(pts.length / 3)], pts[Math.floor((2 * pts.length) / 3)]].map((c) => c.slice());
  for (let it = 0; it < 6; it++) {
    const acc = cs.map(() => [0, 0, 0, 0]);
    for (const p of pts) { let b = 0, bd = 1e9; cs.forEach((c, k) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = k; } }); acc[b][0] += p[0]; acc[b][1] += p[1]; acc[b][2] += p[2]; acc[b][3]++; }
    cs = acc.map((a, k) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cs[k]));
  }
  return cs.map((c) => c.map(Math.round));
}

/* ---------- l'atelier ---------- */
/** Ouvre l'atelier sur une image source. Résout avec { blob, tone, ratio } ou null si annulé. */
export function openCutout(srcBlob, { title = 'Atelier de détourage' } = {}) {
  return new Promise(async (resolve) => {
    const P = { method: 'ai', quality: 'equilibre', tol: 34, connected: true, hard: 30, feather: 1, defringe: true, islands: true, brush: 18, ...prefs() };
    let done = false;
    const bm = await createImageBitmap(srcBlob);
    const k = Math.min(1, MAX / Math.max(bm.width, bm.height));
    const w = Math.round(bm.width * k), hh = Math.round(bm.height * k);
    const work = new OffscreenCanvas(w, hh); const wg = work.getContext('2d', { willReadFrequently: true }); wg.drawImage(bm, 0, 0, w, hh);
    const S = wg.getImageData(0, 0, w, hh).data;
    let M0 = null;                       // masque du moteur
    let samples = borderSamples(S, w, hh);
    const seeds = [];
    let E = new Int8Array(w * hh);       // retouches : +1 garder, -1 effacer
    const undo = [];
    let tool = 'erase', bgView = 'checker', final = null;

    const cv = h('canvas', { width: w, height: hh, class: 'cut-canvas', 'aria-label': 'Aperçu du détourage' });
    const ctx = cv.getContext('2d');
    const status = h('p', { class: 'hint cut-status', 'aria-live': 'polite' });
    const bar = h('div', { class: 'bar' }, h('i'));
    const busy = h('div', { class: 'cut-busy', hidden: true }, h('span'), bar);
    const setBusy = (label, f) => { busy.hidden = !label; if (label) { busy.firstChild.textContent = label; bar.firstChild.style.width = Math.round((f || 0) * 100) + '%'; } };

    const seg = (key, opts, onPick) => { const box = h('div', { class: 'seg', role: 'group' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(P[key] === v), onclick: (e) => { P[key] = v; savePrefs({ [key]: v }); [...box.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); onPick?.(v); } }, l))); return box; };
    const range = (label, key, min, max, step, after) => { const i = h('input', { type: 'range', min, max, step, value: P[key], oninput: () => { P[key] = +i.value; after(); }, onchange: () => savePrefs({ [key]: P[key] }) }); return h('label', { class: 'lbl' }, label, i); };
    const check = (label, key, after) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: P[key], onchange: (e) => { P[key] = e.target.checked; savePrefs({ [key]: P[key] }); after(); } }), label);

    const swatches = h('div', { class: 'cut-swatches' });
    const drawSwatches = () => swatches.replaceChildren(...samples.map((c, i) => h('button', { type: 'button', class: 'sw', title: 'Retirer cette couleur', style: { background: `rgb(${c})` }, onclick: () => { samples.splice(i, 1); if (!samples.length) samples = borderSamples(S, w, hh); drawSwatches(); run(); } })));

    const aiBox = h('div', { class: 'cut-group' }, h('span', { class: 'lbl' }, 'Qualité du modèle'), seg('quality', [['rapide', 'Rapide'], ['equilibre', 'Équilibrée'], ['max', 'Maximale']], () => run(true)),
      h('p', { class: 'hint' }, 'Maximale : modèle complet (plus lourd à télécharger la première fois), contours les plus fins.'));
    const colorBox = h('div', { class: 'cut-group' },
      h('span', { class: 'lbl' }, 'Couleurs du fond ', h('small', {}, 'cliquez sur le fond avec la pipette pour en ajouter')), swatches,
      range('Tolérance', 'tol', 6, 90, 1, () => runSoon()),
      check('Seulement le fond relié aux bords (protège les couleurs identiques dans l\'objet)', 'connected', () => run()),
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => { samples = borderSamples(S, w, hh); seeds.length = 0; drawSwatches(); run(); } }, 'Réinitialiser l\'échantillonnage'));
    const syncMethod = () => { aiBox.hidden = P.method !== 'ai'; colorBox.hidden = P.method !== 'color'; pipetteBtn.hidden = P.method !== 'color'; };

    const toolSeg = h('div', { class: 'seg cut-tools', role: 'group', 'aria-label': 'Outils' });
    const toolsDef = [['pipette', 'Pipette fond'], ['wand', 'Gomme de zone'], ['erase', 'Effacer'], ['restore', 'Restaurer']];
    const drawTools = () => toolSeg.replaceChildren(...toolsDef.map(([v, l]) => { const b = h('button', { type: 'button', 'aria-pressed': String(tool === v), onclick: () => { tool = v; drawTools(); } }, l); if (v === 'pipette') { pipetteBtn = b; b.hidden = P.method !== 'color'; } return b; }));
    let pipetteBtn = null; drawTools();

    const panel = h('div', { class: 'cut-panel' },
      h('div', { class: 'cut-group' }, h('span', { class: 'lbl' }, 'Méthode'), seg('method', [['ai', 'IA précise'], ['color', 'Couleur du fond'], ['none', 'Garder le fond']], () => { syncMethod(); run(true); })),
      aiBox, colorBox,
      h('div', { class: 'cut-group' }, h('span', { class: 'lbl' }, 'Retouche'), toolSeg,
        range('Taille du pinceau', 'brush', 4, 80, 1, () => {}),
        h('p', { class: 'hint' }, 'Gomme de zone : cliquez une zone de fond oubliée, elle disparaît d\'un coup (tolérance ci-dessus). Effacer et Restaurer : peignez au doigt ou à la souris.'),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small ghost', onclick: () => { if (undo.length) { E = undo.pop(); compose(); } } }, 'Annuler la retouche'), h('button', { type: 'button', class: 'btn small ghost', onclick: () => { undo.push(E.slice()); E.fill(0); compose(); } }, 'Effacer les retouches'))),
      h('div', { class: 'cut-group' }, h('span', { class: 'lbl' }, 'Finitions'),
        range('Dureté du contour', 'hard', 0, 100, 1, () => composeSoon()),
        range('Lissage du contour', 'feather', 0, 4, 1, () => composeSoon()),
        check('Retirer les reflets colorés du fond sur les bords', 'defringe', () => compose()),
        check('Supprimer les petits îlots détachés', 'islands', () => compose())),
      h('div', { class: 'cut-group' }, h('span', { class: 'lbl' }, 'Aperçu sur'), seg('bgView', [['checker', 'Damier'], ['white', 'Blanc'], ['black', 'Noir'], ['tone', 'Couleur']], (v) => { bgView = v; paint(); })));
    bgView = P.bgView || 'checker';

    const okBtn = h('button', { class: 'btn accent', type: 'button', disabled: true }, 'Valider le détourage');
    const body = h('div', { class: 'cutout' },
      h('div', { class: 'cut-head' }, h('h2', {}, title), h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Annuler'), okBtn)),
      h('div', { class: 'cut-body' }, h('div', { class: 'cut-stage' }, cv, busy), panel), status);
    const m = modal(body, { wide: true, label: title, onClose: () => { if (!done) resolve(null); } });
    m.el.classList.add('modal-cut');

    /* ----- calcul ----- */
    let timer;
    const runSoon = () => { clearTimeout(timer); timer = setTimeout(() => run(), 160); };
    const composeSoon = () => { clearTimeout(timer); timer = setTimeout(compose, 60); };
    let aiCache = {};
    let keepStatus = false;
    async function run(fresh = false) {
      if (!keepStatus) status.textContent = '';
      keepStatus = false;
      if (P.method === 'none') { M0 = new Float32Array(w * hh).fill(1); compose(); return; }
      if (P.method === 'color') { M0 = colorMask(S, w, hh, samples, P.tol, P.connected, seeds); compose(); return; }
      const key = P.quality;
      if (aiCache[key] && !fresh) { M0 = aiCache[key]; compose(); return; }
      if (aiCache[key]) { M0 = aiCache[key]; compose(); return; }
      setBusy('Préparation de l\'IA', 0.02); okBtn.disabled = true;
      try {
        const r = await aiMask(srcBlob, P.quality, (l, f) => setBusy(l, f));
        M0 = aiCache[key] = resample(r.a, r.w, r.h, w, hh);
        setBusy(null); compose();
      } catch (e) {
        setBusy(null);
        status.innerHTML = '';
        status.append(h('b', {}, 'L\'IA n\'a pas pu se charger. '), 'Vérifiez la connexion (le modèle vient de huggingface.co ou staticimgly.com, parfois bloqués par un bloqueur de publicité ou un réseau d\'entreprise). Passage automatique à « Couleur du fond ». ', h('small', {}, 'Détail : ' + String(e.message || e).slice(0, 300)));
        P.method = 'color'; keepStatus = true; syncMethod(); [...panel.querySelector('.seg').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === 1)));
        run();
      }
    }
    function compose() {
      if (!M0) return;
      let a = M0;
      if (P.hard) { const g = 1 + (P.hard / 100) * 9; a = a.map((v) => Math.min(1, Math.max(0, (v - 0.5) * g + 0.5))); }
      if (P.islands) a = keepMain(a, w, hh);
      a = a.map((v, i) => (E[i] > 0 ? 1 : E[i] < 0 ? 0 : v));
      if (P.feather) a = boxBlur(a, w, hh, P.feather);
      // couleur du fond moyenne (pour l'anti-reflet)
      let bg = [0, 0, 0], n = 0;
      for (let p = 0; p < a.length; p += 7) if (a[p] < 0.03) { bg[0] += S[p * 4]; bg[1] += S[p * 4 + 1]; bg[2] += S[p * 4 + 2]; n++; }
      bg = n ? bg.map((v) => v / n) : samples[0];
      const out = new ImageData(w, hh);
      const o = out.data;
      for (let p = 0, i = 0; p < a.length; p++, i += 4) {
        const al = a[p];
        let r = S[i], g = S[i + 1], b = S[i + 2];
        if (P.defringe && al > 0.04 && al < 0.97 && P.method !== 'none') {
          r = (r - (1 - al) * bg[0]) / al; g = (g - (1 - al) * bg[1]) / al; b = (b - (1 - al) * bg[2]) / al;
        }
        o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = al < 0.03 ? 0 : al * 255;
      }
      final = out; okBtn.disabled = false; paint();
    }
    const tile = (() => { const c = new OffscreenCanvas(24, 24); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 24, 24); g.fillStyle = '#d5d8dc'; g.fillRect(0, 0, 12, 12); g.fillRect(12, 12, 12, 12); return c; })();
    function paint() {
      if (!final) { ctx.drawImage(work, 0, 0); return; }
      if (bgView === 'checker') { ctx.fillStyle = ctx.createPattern(tile, 'repeat'); }
      else ctx.fillStyle = bgView === 'white' ? '#fff' : bgView === 'black' ? '#111' : '#00965E';
      ctx.fillRect(0, 0, w, hh);
      const tmp = new OffscreenCanvas(w, hh); tmp.getContext('2d').putImageData(final, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    }

    /* ----- outils au pointeur ----- */
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * w), Math.round(((e.clientY - r.top) / r.height) * hh)]; };
    let painting = false;
    const dab = (x, y) => {
      const rad = (P.brush * w) / Math.max(320, cv.getBoundingClientRect().width), v = tool === 'erase' ? -1 : 1;
      for (let yy = Math.max(0, Math.floor(y - rad)); yy <= Math.min(hh - 1, y + rad); yy++) for (let xx = Math.max(0, Math.floor(x - rad)); xx <= Math.min(w - 1, x + rad); xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rad * rad) E[yy * w + xx] = v;
    };
    cv.addEventListener('pointerdown', (e) => {
      const [x, y] = pt(e); if (x < 0 || y < 0 || x >= w || y >= hh) return;
      const i = (y * w + x) * 4;
      if (tool === 'pipette') {
        if (P.method !== 'color') return;
        samples.push([S[i], S[i + 1], S[i + 2]]); seeds.push(y * w + x); drawSwatches(); run(); return;
      }
      undo.push(E.slice()); if (undo.length > 30) undo.shift();
      if (tool === 'wand') {
        const c = [S[i], S[i + 1], S[i + 2]]; const seen = new Uint8Array(w * hh); const q = [y * w + x]; seen[y * w + x] = 1;
        while (q.length) { const p = q.pop(); E[p] = -1; const px = p % w, py = (p / w) | 0; for (const nb of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < hh - 1 ? p + w : -1]) if (nb >= 0 && !seen[nb] && dist(S, nb * 4, c) < P.tol) { seen[nb] = 1; q.push(nb); } }
        compose(); return;
      }
      painting = true; cv.setPointerCapture(e.pointerId); dab(x, y); compose();
    });
    cv.addEventListener('pointermove', (e) => { if (!painting) return; const [x, y] = pt(e); dab(x, y); composeSoon(); });
    cv.addEventListener('pointerup', () => { if (painting) { painting = false; compose(); } });

    okBtn.onclick = async () => {
      okBtn.disabled = true; okBtn.textContent = 'Préparation…';
      const c = new OffscreenCanvas(w, hh); c.getContext('2d').putImageData(final, 0, 0);
      const png = await c.convertToBlob({ type: 'image/png' });
      const res = await normalize(png);
      done = true; m.close(); resolve(res);
    };

    drawSwatches(); syncMethod(); paint(); run();
    void toast;
  });
}

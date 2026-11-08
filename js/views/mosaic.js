import { state, imageURL } from '../store.js';
import { h, toast, debounce, download } from '../ui.js';

const COLORS = [
  { k: 'W', name: 'Blanc', hex: '#FFFFFF' }, { k: 'Y', name: 'Jaune', hex: '#FFD100' },
  { k: 'O', name: 'Orange', hex: '#FF6A13' }, { k: 'R', name: 'Rouge', hex: '#C8102E' },
  { k: 'G', name: 'Vert', hex: '#00965E' }, { k: 'B', name: 'Bleu', hex: '#0057B8' },
];
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function lab(r, g, b) {
  const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  x = t(x); y = t(y); z = t(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const PAL = COLORS.map((c) => { const rgb = rgbOf(c.hex); return { rgb, lab: lab(...rgb) }; });
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const DITHERS = { fs: 'Diffusion (Floyd–Steinberg)', atk: 'Diffusion légère (Atkinson)', bayer: 'Trame ordonnée', none: 'Aplats (sans tramage)' };
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/* Table de correspondance couleur → pastille la plus proche (Lab), par palette : 32 niveaux par canal. */
const luts = new Map();
function lutFor(mask) {
  if (luts.has(mask)) return luts.get(mask);
  const ids = COLORS.map((_, i) => i).filter((i) => mask & (1 << i));
  const t = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    const L = lab(r * 8.226, g * 8.226, b * 8.226);
    let best = ids[0], bd = Infinity;
    for (const i of ids) { const p = PAL[i].lab; const d = (L[0] - p[0]) ** 2 + (L[1] - p[1]) ** 2 + (L[2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    t[(r << 10) | (g << 5) | b] = best;
  }
  luts.set(mask, t);
  return t;
}

/** Image source échantillonnée à la résolution des autocollants (RGB, avant tout réglage). */
function sample(src, o) {
  const n = o.n, pw = o.cubesW * n;
  const ph = Math.max(n, Math.round((src.height / src.width) * pw / n) * n);
  const c = new OffscreenCanvas(pw, ph);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = COLORS[o.bg].hex; g.fillRect(0, 0, pw, ph);
  const crop = cropOf(src, pw, ph, o.fit);
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, ...crop);
  const px = g.getImageData(0, 0, pw, ph).data;
  const rgb = new Float32Array(pw * ph * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2]; }
  return { pw, ph, rgb };
}
function cropOf(src, pw, ph, fit) {
  const ir = src.width / src.height, cr = pw / ph;
  let sx = 0, sy = 0, sw = src.width, sh = src.height, dx = 0, dy = 0, dw = pw, dh = ph;
  if (fit === 'cover') { if (ir > cr) { sw = src.height * cr; sx = (src.width - sw) / 2; } else { sh = src.width / cr; sy = (src.height - sh) / 2; } }
  else if (ir > cr) { dh = pw / ir; dy = (ph - dh) / 2; } else { dw = ph * ir; dx = (pw - dw) / 2; }
  return [sx, sy, sw, sh, dx, dy, dw, dh];
}

/** Réglages + tramage → index de couleur de chaque autocollant. */
function quantize(smp, p, mask) {
  const { pw, ph, rgb } = smp;
  const lut = lutFor(mask);
  const buf = new Float32Array(rgb.length);
  const cf = (259 * (p.contrast + 255)) / (255 * (259 - p.contrast)), s = 1 + p.sat / 100, br = p.bright * 1.6;
  for (let j = 0; j < rgb.length; j += 3) {
    const r = rgb[j], g = rgb[j + 1], b = rgb[j + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    buf[j] = cf * (l + (r - l) * s - 128) + 128 + br;
    buf[j + 1] = cf * (l + (g - l) * s - 128) + 128 + br;
    buf[j + 2] = cf * (l + (b - l) * s - 128) + 128 + br;
  }
  const cells = new Uint8Array(pw * ph);
  const spread = (x, y, er, eg, eb, k) => { if (x < 0 || x >= pw || y >= ph) return; const j = (y * pw + x) * 3; buf[j] += er * k; buf[j + 1] += eg * k; buf[j + 2] += eb * k; };
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const j = (y * pw + x) * 3;
    let r = buf[j], g = buf[j + 1], b = buf[j + 2];
    if (p.dither === 'bayer') { const t = (BAYER[y % 4][x % 4] / 16 - 0.5) * 64; r += t; g += t; b += t; }
    const idx = lut[((clamp(r) >> 3) << 10) | ((clamp(g) >> 3) << 5) | (clamp(b) >> 3)];
    cells[y * pw + x] = idx;
    if (p.dither === 'fs' || p.dither === 'atk') {
      const q = PAL[idx].rgb, er = r - q[0], eg = g - q[1], eb = b - q[2];
      if (p.dither === 'fs') { spread(x + 1, y, er, eg, eb, 7 / 16); spread(x - 1, y + 1, er, eg, eb, 3 / 16); spread(x, y + 1, er, eg, eb, 5 / 16); spread(x + 1, y + 1, er, eg, eb, 1 / 16); }
      else for (const [dx, dy] of [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) spread(x + dx, y + dy, er, eg, eb, 1 / 8);
    }
  }
  return cells;
}

/* ---------- réglage automatique ----------
   On compare la mosaïque à l'image d'origine comme un œil la verrait : de loin (flou d'un demi-cube)
   et de près (autocollant par autocollant). Le meilleur compromis l'emporte. */
function boxBlur(a, pw, ph, r) {
  const out = new Float32Array(a.length);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    let s0 = 0, s1 = 0, s2 = 0, k = 0;
    for (let yy = Math.max(0, y - r); yy <= Math.min(ph - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(pw - 1, x + r); xx++) {
      const j = (yy * pw + xx) * 3; s0 += a[j]; s1 += a[j + 1]; s2 += a[j + 2]; k++;
    }
    const j = (y * pw + x) * 3; out[j] = s0 / k; out[j + 1] = s1 / k; out[j + 2] = s2 / k;
  }
  return out;
}
function reference(smp, n) {
  const { pw, ph, rgb } = smp, L = new Float32Array(rgb.length);
  for (let j = 0; j < rgb.length; j += 3) { const v = lab(rgb[j], rgb[j + 1], rgb[j + 2]); L[j] = v[0]; L[j + 1] = v[1]; L[j + 2] = v[2]; }
  const r = Math.max(1, Math.round(n / 2));
  return { L, B: boxBlur(L, pw, ph, r), r };
}
function score(cells, smp, ref) {
  const { pw, ph } = smp, M = new Float32Array(cells.length * 3);
  for (let i = 0; i < cells.length; i++) { const p = PAL[cells[i]].lab; M[i * 3] = p[0]; M[i * 3 + 1] = p[1]; M[i * 3 + 2] = p[2]; }
  const MB = boxBlur(M, pw, ph, ref.r);
  let far = 0, near = 0;
  for (let j = 0; j < M.length; j += 3) {
    far += Math.hypot(MB[j] - ref.B[j], MB[j + 1] - ref.B[j + 1], MB[j + 2] - ref.B[j + 2]);
    near += Math.hypot(M[j] - ref.L[j], M[j + 1] - ref.L[j + 1], M[j + 2] - ref.L[j + 2]);
  }
  return (0.68 * far + 0.32 * near) / cells.length;
}
/** Fond des zones transparentes : la couleur de cube la plus éloignée du sujet. */
function autoBg(src) {
  const w = 64, ht = Math.max(1, Math.round((64 * src.height) / src.width));
  const c = new OffscreenCanvas(w, ht), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, ht);
  const d = g.getImageData(0, 0, w, ht).data;
  let tr = 0; const subj = [];
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) tr++; else if (i % 16 === 0) subj.push(lab(d[i], d[i + 1], d[i + 2])); }
  if (tr / (d.length / 4) < 0.04 || !subj.length) return 0;
  let best = 0, bs = -1;
  PAL.forEach((p, i) => {
    let near = 0; // part du sujet qui se confondrait avec ce fond
    for (const v of subj) if (Math.hypot(v[0] - p.lab[0], v[1] - p.lab[1], v[2] - p.lab[2]) < 30) near++;
    const s = 1 - near / subj.length + (i === 0 ? 0.04 : 0); // léger penchant pour le blanc, plus lisible
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}
async function autoTune(src, o, mask, tick) {
  const smp = sample(src, o), ref = reference(smp, o.n);
  const tried = new Map();
  const test = (p) => { const k = JSON.stringify(p); if (!tried.has(k)) tried.set(k, { p, s: score(quantize(smp, p, mask), smp, ref) }); return tried.get(k); };
  const big = smp.pw * smp.ph > 60000;
  let best = null;
  const keep = (r) => { if (!best || r.s < best.s) best = r; };
  // 1er passage : grandes familles
  const dithers = big ? ['fs', 'none'] : ['fs', 'atk', 'none'];
  let i = 0;
  for (const dither of dithers) for (const contrast of [0, 20, 40]) for (const sat of [0, 30, 60, 90]) {
    keep(test({ dither, contrast, sat, bright: 0 }));
    if (++i % 6 === 0) { tick?.(); await new Promise((r) => setTimeout(r)); }
  }
  // 2e passage : affinage autour du meilleur
  const b0 = best.p;
  for (const bright of [-16, -8, 8, 16]) keep(test({ ...b0, bright }));
  const b1 = best.p;
  for (const dc of [-10, 10]) for (const ds of [-15, 15]) keep(test({ ...b1, contrast: Math.max(-20, Math.min(80, b1.contrast + dc)), sat: Math.max(-50, Math.min(120, b1.sat + ds)) }));
  if (!big) keep(test({ ...best.p, dither: 'bayer' }));
  return best.p;
}

export function render(main) {
  const o = { cubesW: 16, n: 3, fit: 'cover', dither: 'fs', bright: 0, contrast: 20, sat: 30, bg: 0, palette: new Set(COLORS.map((c) => c.k)) };
  let src = null, srcName = '';
  let grid = null;
  let auto = true, view = 'mosaic', split = 50, tuning = 0;

  const canvas = h('canvas', { 'aria-label': 'Mosaïque' });
  const orig = h('canvas', { class: 'mz-orig', 'aria-label': 'Image d\'origine' });
  const bar = h('div', { class: 'mz-split', hidden: true });
  const stage = h('div', { class: 'mz-stage' }, canvas, orig, bar);
  const zoom = h('div', { class: 'cube-zoom', hidden: true });
  const out = h('div', { class: 'mosaic-out' }, h('p', { class: 'hint' }, 'Choisissez une image : une photo, un logo, un portrait, ou l\'un de vos casse-têtes. Le meilleur réglage est calculé tout seul.'));
  const legend = h('div', { class: 'mosaic-legend' });
  const info = h('p', { class: 'hint' });
  const autoNote = h('p', { class: 'hint mz-auto' });
  const mask = () => COLORS.reduce((m, c, i) => (o.palette.has(c.k) ? m | (1 << i) : m), 0);

  /* --- contrôles --- */
  const fineInputs = {};
  const range = (label, key, min, max) => {
    const val = h('output', {}, String(o[key]));
    const i = h('input', { type: 'range', min, max, value: o[key], oninput: () => { o[key] = +i.value; val.textContent = (o[key] > 0 ? '+' : '') + o[key]; manual(); } });
    fineInputs[key] = { set: () => { i.value = o[key]; val.textContent = (o[key] > 0 ? '+' : '') + o[key]; } };
    return h('label', { class: 'lbl' }, h('span', { class: 'mz-lbl' }, label, val), i);
  };
  const ditherSel = h('select', { class: 'field', onchange: () => { o.dither = ditherSel.value; manual(); } }, Object.entries(DITHERS).map(([v, l]) => h('option', { value: v }, l)));
  fineInputs.dither = { set: () => (ditherSel.value = o.dither) };
  const segOf = (opts, get, set) => {
    const box = h('div', { class: 'seg', role: 'group' });
    const paintSeg = () => box.replaceChildren(...opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(get() === v), onclick: () => { set(v); paintSeg(); } }, l)));
    paintSeg();
    return box;
  };
  const wIn = h('input', { class: 'field', type: 'number', min: 1, max: 80, value: o.cubesW, oninput: debounce(() => { o.cubesW = Math.max(1, Math.min(80, +wIn.value || 1)); presetSeg.refresh(); retune(); }, 350) });
  const presetBox = h('div', { class: 'seg', role: 'group' });
  const presetSeg = { refresh: () => presetBox.replaceChildren(...[[8, 'Petite'], [16, 'Moyenne'], [30, 'Grande']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(o.cubesW === v), onclick: () => { o.cubesW = v; wIn.value = v; presetSeg.refresh(); retune(); } }, l))) };
  presetSeg.refresh();
  const nSel = h('select', { class: 'field', onchange: () => { o.n = +nSel.value; retune(); } }, [2, 3, 4, 5].map((v) => h('option', { value: v }, `${v}x${v}`)));
  nSel.value = String(o.n);

  const pal = h('div', { class: 'palette-pick' }, COLORS.map((c) => {
    const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': c.name, onchange: () => { cb.checked ? o.palette.add(c.k) : o.palette.delete(c.k); if (!o.palette.size) { cb.checked = true; o.palette.add(c.k); } retune(); } });
    return h('label', { style: { '--c': c.hex }, title: c.name }, cb);
  }));
  const bgBox = h('div', { class: 'palette-pick mz-bg' });
  const paintBg = () => bgBox.replaceChildren(...COLORS.map((c, i) => h('button', { type: 'button', style: { '--c': c.hex }, title: c.name, 'aria-label': 'Fond ' + c.name, 'aria-pressed': String(o.bg === i), onclick: () => { o.bg = i; paintBg(); retune(); } })));
  paintBg();

  const autoBtn = h('button', { class: 'btn small', hidden: true, onclick: () => { auto = true; retune(); } }, 'Revenir au réglage automatique');
  const fitSeg = segOf([['cover', 'Remplir'], ['contain', 'Image entière']], () => o.fit, (v) => { o.fit = v; retune(); });
  const viewSeg = segOf([['mosaic', 'Mosaïque'], ['orig', 'Original'], ['split', 'Comparer']], () => view, (v) => { view = v; applyView(); });

  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'sr', onchange: () => fileIn.files[0] && setSrc(fileIn.files[0], fileIn.files[0].name) });
  const withImg = state.items.filter((i) => i.imageId);
  const fromColl = withImg.length ? h('select', { class: 'field', onchange: async (e) => { if (!e.target.value) return; const it = withImg.find((i) => i.imageId === e.target.value); const u = await imageURL(e.target.value); setSrc(await (await fetch(u)).blob(), it?.name || ''); } },
    h('option', { value: '' }, 'Un casse-tête de la collection…'), withImg.map((i) => h('option', { value: i.imageId }, i.name))) : null;

  main.append(
    h('header', { class: 'head' }, h('h1', {}, 'Mosaïque'),
      h('p', { class: 'lead' }, 'Transformez une image en fresque de cubes résolus face par face. Le réglage est calculé automatiquement ; le plan imprimable indique le motif de chaque cube, rangée par rangée.')),
    h('div', { class: 'mosaic-layout' },
      h('div', { class: 'mosaic-controls panel' },
        h('div', { class: 'lbl' }, 'Image', h('div', { class: 'row' }, h('label', { class: 'btn small solid', style: { cursor: 'pointer' } }, fileIn, 'Choisir une image'), h('span', { class: 'hint' }, 'ou coller (Ctrl+V)')), fromColl),
        h('div', { class: 'lbl' }, 'Taille de la fresque', presetBox, h('div', { class: 'grid2' }, h('label', { class: 'lbl' }, 'Cubes en largeur', wIn), h('label', { class: 'lbl' }, 'Cubes', nSel))),
        h('div', { class: 'lbl' }, 'Cadrage', fitSeg),
        autoNote, autoBtn,
        h('details', { class: 'mz-fine' }, h('summary', {}, 'Réglages fins'),
          h('div', { style: { display: 'grid', gap: '12px', marginTop: '10px' } },
            h('p', { class: 'hint', style: { margin: 0 } }, 'Toucher un réglage passe en mode manuel. Astuce : « Comparer » montre l\'original à côté.'),
            h('label', { class: 'lbl' }, 'Tramage', ditherSel),
            range('Contraste', 'contrast', -20, 80), range('Saturation', 'sat', -50, 120), range('Luminosité', 'bright', -40, 40),
            h('div', { class: 'lbl' }, 'Couleurs disponibles', pal),
            h('div', { class: 'lbl' }, 'Fond des zones transparentes', bgBox)))),
      h('div', { style: { display: 'grid', gap: '12px' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, viewSeg, h('span', { class: 'hint' }, 'Maintenez la touche Espace pour voir l\'original.')),
        out, legend, info,
        h('div', { class: 'row' },
          h('button', { class: 'btn accent', onclick: () => grid && canvas.toBlob((b) => download(b, 'mosaique-cubes.png')) }, 'Télécharger l\'image'),
          h('button', { class: 'btn', onclick: printPlan }, 'Imprimer le plan de montage')))));

  function manual() { auto = false; autoBtn.hidden = false; autoNote.textContent = 'Réglage manuel.'; redraw(); }
  function describe() {
    const sg = (v) => (v > 0 ? '+' : '') + v;
    autoNote.textContent = `Réglage automatique : ${DITHERS[o.dither].toLowerCase()}, contraste ${sg(o.contrast)}, saturation ${sg(o.sat)}${o.bright ? ', luminosité ' + sg(o.bright) : ''}.`;
  }
  const syncFine = () => Object.values(fineInputs).forEach((f) => f.set());

  async function setSrc(blob, name = '') {
    try { src = await createImageBitmap(blob); srcName = name; } catch { toast('Image illisible.', 'err'); return; }
    o.bg = autoBg(src); paintBg();
    auto = true;
    retune();
  }
  const onPaste = (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/')); if (f) setSrc(f, 'image collée'); };
  document.addEventListener('paste', onPaste);

  const retune = debounce(async () => {
    if (!src) return;
    if (!auto) return redraw();
    const run = ++tuning;
    autoNote.textContent = 'Recherche du meilleur rendu…';
    out.classList.add('busy');
    const p = await autoTune(src, o, mask());
    if (run !== tuning) return;
    Object.assign(o, p); syncFine(); describe(); autoBtn.hidden = true;
    out.classList.remove('busy');
    draw();
  }, 200);
  const redraw = debounce(() => draw(), 80);

  function draw() {
    if (!src) return;
    const smp = sample(src, o);
    grid = { W: o.cubesW, H: smp.ph / o.n, n: o.n, pw: smp.pw, ph: smp.ph, cells: quantize(smp, o, mask()) };
    paint();
  }

  function paint() {
    const { pw, ph, n, cells } = grid;
    const S = Math.max(4, Math.min(26, Math.floor(1000 / pw)));
    const gap = Math.max(1, Math.round(S * 0.1));
    const cubeGap = Math.max(2, Math.round(S * 0.28));
    const cw = pw * S + (pw / n) * cubeGap + cubeGap, ch = ph * S + (ph / n) * cubeGap + cubeGap;
    canvas.width = cw; canvas.height = ch;
    const g = canvas.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
    const counts = new Array(6).fill(0);
    const r = Math.max(1, S * 0.14);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const idx = cells[y * pw + x]; counts[idx]++;
      g.fillStyle = COLORS[idx].hex;
      const X = cubeGap + x * S + Math.floor(x / n) * cubeGap, Y = cubeGap + y * S + Math.floor(y / n) * cubeGap;
      g.beginPath(); g.roundRect ? g.roundRect(X + gap / 2, Y + gap / 2, S - gap, S - gap, r) : g.rect(X + gap / 2, Y + gap / 2, S - gap, S - gap); g.fill();
    }
    // l'original, cadré exactement comme la mosaïque
    orig.width = cw; orig.height = ch;
    const go = orig.getContext('2d');
    go.fillStyle = COLORS[o.bg].hex; go.fillRect(0, 0, cw, ch);
    const crop = cropOf(src, cw, ch, o.fit);
    go.imageSmoothingQuality = 'high';
    go.drawImage(src, ...crop);
    grid.S = S; grid.cubeGap = cubeGap;
    stage.style.width = `min(100%, ${Math.max(cw, 600)}px, ${((72 * cw) / ch).toFixed(1)}vh)`;
    if (!out.contains(stage)) out.replaceChildren(stage, zoom);
    applyView();
    legend.replaceChildren(...COLORS.map((c, i) => counts[i] ? h('span', {}, h('i', { style: { '--c': c.hex } }), `${c.name} ${counts[i]}`) : null).filter(Boolean));
    const total = grid.W * grid.H;
    const cm = { 2: 5, 3: 5.6 }[n] || 6.2;
    info.textContent = `${srcName ? srcName + ' : ' : ''}${grid.W} × ${grid.H} = ${total} cubes ${n}x${n}. Avec des cubes de ${Math.round(cm * 10)} mm, la fresque mesure environ ${Math.round(grid.W * cm)} × ${Math.round(grid.H * cm)} cm. Survolez un cube pour voir sa face.`;
  }

  function applyView(peek = false) {
    const v = peek ? 'orig' : view;
    stage.dataset.view = v;
    orig.style.clipPath = v === 'split' ? `inset(0 ${100 - split}% 0 0)` : '';
    bar.hidden = v !== 'split';
    bar.style.left = split + '%';
  }
  // Comparer : on fait glisser la séparation
  let dragging = false;
  const setSplit = (e) => { const r = stage.getBoundingClientRect(); split = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); applyView(); };
  stage.addEventListener('pointerdown', (e) => { if (view !== 'split') return; dragging = true; stage.setPointerCapture(e.pointerId); setSplit(e); });
  stage.addEventListener('pointerup', () => (dragging = false));
  // Espace maintenu : coup d'œil sur l'original
  const typing = (e) => /input|select|textarea/i.test(e.target?.tagName || '');
  const kd = (e) => { if (e.code === 'Space' && !typing(e) && grid) { e.preventDefault(); applyView(true); } };
  const ku = (e) => { if (e.code === 'Space' && grid) applyView(); };
  addEventListener('keydown', kd); addEventListener('keyup', ku);

  stage.addEventListener('pointermove', (e) => {
    if (dragging) return setSplit(e);
    if (!grid || view === 'orig') { zoom.hidden = true; return; }
    const r = canvas.getBoundingClientRect();
    if (view === 'split' && e.clientX - r.left < (r.width * split) / 100) { zoom.hidden = true; return; }
    const k = canvas.width / r.width;
    const mx = (e.clientX - r.left) * k, my = (e.clientY - r.top) * k;
    const block = grid.n * grid.S + grid.cubeGap;
    const cx = Math.floor((mx - grid.cubeGap / 2) / block), cy = Math.floor((my - grid.cubeGap / 2) / block);
    if (cx < 0 || cy < 0 || cx >= grid.W || cy >= grid.H) { zoom.hidden = true; return; }
    zoom.hidden = false;
    zoom.style.gridTemplateColumns = `repeat(${grid.n}, 18px)`;
    const cells = [];
    for (let y = 0; y < grid.n; y++) for (let x = 0; x < grid.n; x++) cells.push(h('i', { style: { background: COLORS[grid.cells[(cy * grid.n + y) * grid.pw + cx * grid.n + x]].hex } }));
    zoom.replaceChildren(...cells, h('b', {}, `${rowName(cy)}${cx + 1}`));
    const or = out.getBoundingClientRect();
    zoom.style.left = Math.min(or.width - 90, e.clientX - or.left + 16) + 'px';
    zoom.style.top = e.clientY - or.top + 16 + 'px';
  });
  stage.addEventListener('pointerleave', () => (zoom.hidden = true));

  function printPlan() {
    if (!grid) { toast('Choisissez d\'abord une image.', 'err'); return; }
    const { W, H, n, pw, cells } = grid;
    const s = 10, cube = n * s + 6;
    let svg = '';
    for (let cy = 0; cy < H; cy++) {
      svg += `<text x="0" y="${30 + cy * (cube + 16) + cube / 2 + 4}" font-size="12" font-weight="700">${rowName(cy)}</text>`;
      for (let cx = 0; cx < W; cx++) {
        const ox = 26 + cx * (cube + 6), oy = 30 + cy * (cube + 16);
        svg += `<rect x="${ox}" y="${oy}" width="${cube}" height="${cube}" rx="3" fill="#000"/>`;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const c = COLORS[cells[(cy * n + y) * pw + cx * n + x]];
          svg += `<rect x="${ox + 3 + x * s + 0.6}" y="${oy + 3 + y * s + 0.6}" width="${s - 1.2}" height="${s - 1.2}" rx="1.5" fill="${c.hex}"/><text x="${ox + 3 + x * s + s / 2}" y="${oy + 3 + y * s + s / 2 + 2.6}" font-size="6.5" text-anchor="middle" fill="${c.k === 'W' || c.k === 'Y' ? '#000' : '#fff'}">${c.k}</text>`;
        }
      }
    }
    for (let cx = 0; cx < W; cx++) svg += `<text x="${26 + cx * (cube + 6) + cube / 2}" y="20" font-size="11" text-anchor="middle" font-weight="700">${cx + 1}</text>`;
    const w = 26 + W * (cube + 6), hh = 30 + H * (cube + 16);
    const plan = h('div', { class: 'print-plan doc' },
      h('h2', {}, `Plan de montage, ${W} × ${H} cubes ${n}x${n}`),
      h('p', {}, 'Chaque carré est la face avant d\'un cube, vue de face. Lettres : W blanc, Y jaune, O orange, R rouge, G vert, B bleu.'),
      h('div', { html: `<svg viewBox="0 0 ${w} ${hh}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Archivo, sans-serif">${svg}</svg>` }));
    document.body.append(plan);
    document.body.classList.add('printing-plan');
    const done = () => { plan.remove(); document.body.classList.remove('printing-plan'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }

  return () => { document.removeEventListener('paste', onPaste); removeEventListener('keydown', kd); removeEventListener('keyup', ku); tuning++; };
}
const rowName = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));

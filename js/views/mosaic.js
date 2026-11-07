import { state, imageURL } from '../store.js';
import { h, $, download, toast, debounce } from '../ui.js';

const COLORS = [
  { k: 'W', name: 'Blanc', hex: '#FFFFFF' }, { k: 'Y', name: 'Jaune', hex: '#FFD100' },
  { k: 'O', name: 'Orange', hex: '#FF6A13' }, { k: 'R', name: 'Rouge', hex: '#C8102E' },
  { k: 'G', name: 'Vert', hex: '#00965E' }, { k: 'B', name: 'Bleu', hex: '#0057B8' },
];
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function lab([r, g, b]) {
  const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  x = t(x); y = t(y); z = t(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

export function render(main) {
  const o = { cubesW: 12, n: 3, fit: 'cover', dither: 'fs', bright: 0, contrast: 10, sat: 15, bg: '#FFFFFF', palette: new Set(COLORS.map((c) => c.k)) };
  let src = null; // ImageBitmap
  let grid = null; // { W, H, cells: Uint8Array index de couleur }

  const canvas = h('canvas', { 'aria-label': 'Aperçu de la mosaïque' });
  const zoom = h('div', { class: 'cube-zoom', hidden: true });
  const out = h('div', { class: 'mosaic-out' }, h('p', { class: 'hint' }, 'Choisissez une image : une photo, un logo, un portrait, ou l\'un de vos casse-têtes.'));
  const legend = h('div', { class: 'mosaic-legend' });
  const info = h('p', { class: 'hint' });

  const num = (label, key, min, max, step = 1) => {
    const i = h('input', { class: 'field', type: 'number', min, max, step, value: o[key], oninput: () => { o[key] = Math.max(min, Math.min(max, +i.value || min)); redraw(); } });
    return h('label', { class: 'lbl' }, label, i);
  };
  const range = (label, key, min, max) => {
    const i = h('input', { type: 'range', min, max, value: o[key], oninput: () => { o[key] = +i.value; redraw(); } });
    return h('label', { class: 'lbl' }, label, i);
  };
  const sel = (label, key, opts) => {
    const s = h('select', { class: 'field', onchange: () => { o[key] = s.value; redraw(); } }, opts.map(([v, l]) => h('option', { value: v }, l)));
    s.value = o[key];
    return h('label', { class: 'lbl' }, label, s);
  };

  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'field', onchange: () => fileIn.files[0] && setSrc(fileIn.files[0]) });
  const withImg = state.items.filter((i) => i.imageId);
  const fromColl = withImg.length ? h('select', { class: 'field', onchange: async (e) => { if (!e.target.value) return; const u = await imageURL(e.target.value); setSrc(await (await fetch(u)).blob()); } },
    h('option', { value: '' }, 'Un casse-tête de la collection…'), withImg.map((i) => h('option', { value: i.imageId }, i.name))) : null;

  const pal = h('div', { class: 'palette-pick' }, COLORS.map((c) => {
    const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': c.name, onchange: () => { cb.checked ? o.palette.add(c.k) : o.palette.delete(c.k); if (!o.palette.size) { cb.checked = true; o.palette.add(c.k); } redraw(); } });
    return h('label', { style: { '--c': c.hex }, title: c.name }, cb);
  }));

  main.append(
    h('header', { class: 'head' }, h('h1', {}, 'Mosaïque'),
      h('p', { class: 'lead' }, 'Transformez une image en fresque de cubes résolus face par face. Le plan imprimable indique le motif de chaque cube, rangée par rangée.')),
    h('div', { class: 'mosaic-layout' },
      h('div', { class: 'mosaic-controls panel' },
        h('label', { class: 'lbl' }, 'Image', fileIn), fromColl,
        h('div', { class: 'grid2' }, num('Cubes en largeur', 'cubesW', 1, 80), num('Taille des cubes', 'n', 2, 7)),
        sel('Cadrage', 'fit', [['cover', 'Remplir (recadre)'], ['contain', 'Image entière']]),
        sel('Tramage', 'dither', [['fs', 'Diffusion (Floyd–Steinberg)'], ['atk', 'Diffusion légère (Atkinson)'], ['bayer', 'Trame ordonnée'], ['none', 'Aucun (aplats)']]),
        h('div', { class: 'lbl' }, 'Couleurs disponibles', pal),
        range('Luminosité', 'bright', -60, 60), range('Contraste', 'contrast', -50, 80), range('Saturation', 'sat', -100, 100),
        h('label', { class: 'lbl' }, 'Fond des zones transparentes', h('input', { type: 'color', value: o.bg, oninput: (e) => { o.bg = e.target.value; redraw(); } }))),
      h('div', { style: { display: 'grid', gap: '12px' } }, out, legend, info,
        h('div', { class: 'row' },
          h('button', { class: 'btn accent', onclick: () => grid && canvas.toBlob((b) => download(b, 'mosaique-cubes.png')) }, 'Télécharger l\'image'),
          h('button', { class: 'btn', onclick: printPlan }, 'Imprimer le plan de montage')))));

  async function setSrc(blob) {
    try { src = await createImageBitmap(blob); redraw(); } catch { toast('Image illisible.', 'err'); }
  }
  const onPaste = (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/')); if (f) setSrc(f); };
  document.addEventListener('paste', onPaste);

  const redraw = debounce(() => {
    if (!src) return;
    const n = o.n;
    const pw = o.cubesW * n;
    let ph = Math.max(n, Math.round((src.height / src.width) * pw / n) * n);
    const H = ph / n;
    // échantillonnage à la résolution des autocollants
    const c = new OffscreenCanvas(pw, ph);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = o.bg; g.fillRect(0, 0, pw, ph);
    const ir = src.width / src.height, cr = pw / ph;
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx = 0, dy = 0, dw = pw, dh = ph;
    if (o.fit === 'cover') { if (ir > cr) { sw = src.height * cr; sx = (src.width - sw) / 2; } else { sh = src.width / cr; sy = (src.height - sh) / 2; } }
    else { if (ir > cr) { dh = pw / ir; dy = (ph - dh) / 2; } else { dw = ph * ir; dx = (pw - dw) / 2; } }
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    const px = g.getImageData(0, 0, pw, ph).data;
    const buf = new Float32Array(pw * ph * 3);
    const cf = (259 * (o.contrast + 255)) / (255 * (259 - o.contrast));
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
      let r = px[i], gg = px[i + 1], b = px[i + 2];
      const l = 0.299 * r + 0.587 * gg + 0.114 * b; const s = 1 + o.sat / 100;
      r = l + (r - l) * s; gg = l + (gg - l) * s; b = l + (b - l) * s;
      r = cf * (r - 128) + 128 + o.bright * 1.6; gg = cf * (gg - 128) + 128 + o.bright * 1.6; b = cf * (b - 128) + 128 + o.bright * 1.6;
      buf[j] = r; buf[j + 1] = gg; buf[j + 2] = b;
    }
    const palette = COLORS.map((cc, idx) => ({ idx, rgb: rgbOf(cc.hex), lab: lab(rgbOf(cc.hex)) })).filter((p) => o.palette.has(COLORS[p.idx].k));
    const nearest = (r, gg, b) => {
      const L = lab([Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, gg)), Math.max(0, Math.min(255, b))]);
      let best = palette[0], bd = Infinity;
      for (const p of palette) { const d = (L[0] - p.lab[0]) ** 2 + (L[1] - p.lab[1]) ** 2 + (L[2] - p.lab[2]) ** 2; if (d < bd) { bd = d; best = p; } }
      return best;
    };
    const cells = new Uint8Array(pw * ph);
    const spread = (x, y, er, eg, eb, k) => { if (x < 0 || x >= pw || y >= ph) return; const j = (y * pw + x) * 3; buf[j] += er * k; buf[j + 1] += eg * k; buf[j + 2] += eb * k; };
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const j = (y * pw + x) * 3;
      let r = buf[j], gg = buf[j + 1], b = buf[j + 2];
      if (o.dither === 'bayer') { const t = (BAYER[y % 4][x % 4] / 16 - 0.5) * 64; r += t; gg += t; b += t; }
      const p = nearest(r, gg, b);
      cells[y * pw + x] = p.idx;
      if (o.dither === 'fs' || o.dither === 'atk') {
        const er = r - p.rgb[0], eg = gg - p.rgb[1], eb = b - p.rgb[2];
        if (o.dither === 'fs') { spread(x + 1, y, er, eg, eb, 7 / 16); spread(x - 1, y + 1, er, eg, eb, 3 / 16); spread(x, y + 1, er, eg, eb, 5 / 16); spread(x + 1, y + 1, er, eg, eb, 1 / 16); }
        else { for (const [ddx, ddy] of [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) spread(x + ddx, y + ddy, er, eg, eb, 1 / 8); }
      }
    }
    grid = { W: o.cubesW, H, n, pw, ph, cells };
    paint();
  }, 120);

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
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const idx = cells[y * pw + x]; counts[idx]++;
      g.fillStyle = COLORS[idx].hex;
      const X = cubeGap + x * S + Math.floor(x / n) * cubeGap, Y = cubeGap + y * S + Math.floor(y / n) * cubeGap;
      const r = Math.max(1, S * 0.14);
      g.beginPath(); g.roundRect ? g.roundRect(X + gap / 2, Y + gap / 2, S - gap, S - gap, r) : g.rect(X + gap / 2, Y + gap / 2, S - gap, S - gap); g.fill();
    }
    grid.S = S; grid.cubeGap = cubeGap;
    if (!out.contains(canvas)) out.replaceChildren(canvas, zoom);
    legend.replaceChildren(...COLORS.map((c, i) => counts[i] ? h('span', {}, h('i', { style: { '--c': c.hex } }), `${c.name} ${counts[i]}`) : null).filter(Boolean));
    const total = grid.W * grid.H;
    const cm = { 2: 5, 3: 5.6 }[n] || 6.2;
    info.textContent = `${grid.W} × ${grid.H} = ${total} cubes ${n}x${n}. Avec des cubes de ${Math.round(cm * 10)} mm, la fresque mesure environ ${Math.round(grid.W * cm)} × ${Math.round(grid.H * cm)} cm. Survolez un cube pour voir sa face.`;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!grid) return;
    const r = canvas.getBoundingClientRect();
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
  canvas.addEventListener('pointerleave', () => (zoom.hidden = true));

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

  return () => document.removeEventListener('paste', onPaste);
}
const rowName = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));

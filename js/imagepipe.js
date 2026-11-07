// Recherche d'images libres, détourage et normalisation.
import { state } from './store.js';

/* ---------- recherche ---------- */
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').trim();

async function commons(q) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: q + ' filetype:bitmap',
    gsrnamespace: '6', gsrlimit: '24', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '900',
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  const j = await r.json();
  return Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index).map((p) => {
    const ii = p.imageinfo?.[0] || {};
    const md = ii.extmetadata || {};
    return {
      src: 'Wikimedia', thumb: ii.thumburl, full: ii.thumburl, page: ii.descriptionurl,
      title: p.title.replace(/^File:/, ''), credit: strip(md.Artist?.value), license: md.LicenseShortName?.value || '',
    };
  }).filter((x) => x.thumb);
}

async function openverse(q) {
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`);
  const j = await r.json();
  return (j.results || []).map((x) => ({
    src: 'Openverse', thumb: x.thumbnail, full: x.url, alt: x.thumbnail, page: x.foreign_landing_url,
    title: x.title, credit: x.creator || '', license: (x.license || '').toUpperCase() + ' ' + (x.license_version || ''),
  }));
}

export async function searchImages(q) {
  const [a, b] = await Promise.allSettled([commons(q), openverse(q)]);
  const A = a.status === 'fulfilled' ? a.value : [];
  const B = b.status === 'fulfilled' ? b.value : [];
  const out = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) { if (B[i]) out.push(B[i]); if (A[i]) out.push(A[i]); }
  if (!out.length && a.status === 'rejected' && b.status === 'rejected') throw new Error('Les banques d\'images ne répondent pas.');
  return out;
}

/** Télécharge une image distante en Blob (CORS direct, puis proxy si configuré). */
export async function fetchBlob(url, fallback) {
  const tries = [url, fallback].filter(Boolean);
  if (state.settings.proxy) for (const t of [url, fallback].filter(Boolean)) tries.push(state.settings.proxy + encodeURIComponent(t));
  let last;
  for (const t of tries) {
    try {
      const r = await fetch(t, { mode: 'cors' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = await r.blob();
      if (!b.type.startsWith('image/')) throw new Error('Ce lien ne pointe pas vers une image.');
      return b;
    } catch (e) { last = e; }
  }
  throw new Error('Le site d\'origine bloque le téléchargement direct (' + (last?.message || 'CORS') + '). Enregistrez l\'image puis importez-la, ou copiez-la et collez-la ici.');
}

/* ---------- détourage ---------- */
let bgLib;
export async function removeBgAI(blob, onProgress) {
  bgLib ||= import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
  const mod = await bgLib;
  const fn = mod.removeBackground || mod.default;
  const small = await downscale(blob, 1600);
  return fn(small, {
    progress: (key, cur, total) => onProgress?.(key.includes('fetch') ? 'Téléchargement du modèle (une seule fois)' : 'Détourage', total ? cur / total : 0),
    output: { format: 'image/png' },
  });
}

async function bitmap(blob) { return createImageBitmap(blob); }

async function downscale(blob, max) {
  const bm = await bitmap(blob);
  const k = Math.min(1, max / Math.max(bm.width, bm.height));
  if (k === 1) return blob;
  const c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k));
  c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
  return c.convertToBlob({ type: 'image/png' });
}

/** Détourage rapide par remplissage depuis les bords : idéal pour un fond uni. */
export async function removeBgFlat(blob, tolerance = 42) {
  const bm = await bitmap(await downscale(blob, 1400));
  const W = bm.width, H = bm.height;
  const c = new OffscreenCanvas(W, H);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bm, 0, 0);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  // couleur de fond = médiane des pixels de bord
  const rs = [], gs = [], bs = [];
  const sample = (x, y) => { const i = (y * W + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); };
  for (let x = 0; x < W; x += 2) { sample(x, 0); sample(x, H - 1); }
  for (let y = 0; y < H; y += 2) { sample(0, y); sample(W - 1, y); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  const bg = [med(rs), med(gs), med(bs)];
  const dist = (i) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
  const seen = new Uint8Array(W * H);
  const q = new Int32Array(W * H);
  let qh = 0, qt = 0;
  const push = (p) => { if (!seen[p] && dist(p * 4) < tolerance) { seen[p] = 1; q[qt++] = p; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (qh < qt) {
    const p = q[qh++]; const x = p % W, y = (p / W) | 0;
    d[p * 4 + 3] = 0;
    if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W);
  }
  // adoucit le contour : les pixels voisins du fond deviennent semi-transparents
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x; if (seen[p]) continue;
    if (seen[p - 1] || seen[p + 1] || seen[p - W] || seen[p + W]) {
      const k = Math.min(1, dist(p * 4) / (tolerance * 2.2));
      d[p * 4 + 3] = Math.round(255 * Math.max(0.25, k));
    }
  }
  g.putImageData(img, 0, 0);
  return c.convertToBlob({ type: 'image/png' });
}

/* ---------- normalisation ---------- */
function toHex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''); }

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const dd = mx - mn; const s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
  let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [h * 60, s, l];
}

/** Couleur dominante « vivante » d'une image (ignore le noir, le blanc, le gris). */
export function dominantTone(data) {
  const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    ar += r; ag += g; ab += b; an++;
    const [h, s, l] = rgb2hsl(r, g, b);
    if (s < 0.3 || l < 0.14 || l > 0.9) continue;
    const bin = bins[Math.floor(h / 15) % 24]; const w = s;
    bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
  }
  const best = bins.reduce((m, b) => (b.w > m.w ? b : m), { w: 0 });
  if (best.w > an * 0.04 && best.w > 0) return toHex(best.r / best.w, best.g / best.w, best.b / best.w);
  if (!an) return '#9aa0a6';
  return toHex(ar / an, ag / an, ab / an);
}

/** Recadre sur l'objet, le centre dans un carré, calcule la teinte. */
export async function normalize(blob, size = 900) {
  const bm = await bitmap(blob);
  const W = bm.width, H = bm.height;
  const c = new OffscreenCanvas(W, H);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bm, 0, 0);
  const { data } = g.getImageData(0, 0, W, H);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const out = new OffscreenCanvas(size, size);
  const o = out.getContext('2d');
  const pad = size * 0.04;
  const k = Math.min((size - 2 * pad) / bw, (size - 2 * pad) / bh);
  const dw = bw * k, dh = bh * k;
  o.imageSmoothingQuality = 'high';
  o.drawImage(c, x0, y0, bw, bh, (size - dw) / 2, size - pad - dh - (size - 2 * pad - dh) / 2, dw, dh);
  const tone = dominantTone(o.getImageData(0, 0, size, size).data);
  let outBlob = await out.convertToBlob({ type: 'image/webp', quality: 0.9 });
  if (outBlob.type !== 'image/webp') outBlob = await out.convertToBlob({ type: 'image/png' });
  return { blob: outBlob, tone, ratio: bh / bw };
}

/** Variante : garde le fond, simplement recadré au carré. */
export async function squareKeep(blob, size = 900) {
  const bm = await bitmap(blob);
  const s = Math.min(bm.width, bm.height);
  const out = new OffscreenCanvas(size, size);
  const o = out.getContext('2d');
  o.drawImage(bm, (bm.width - s) / 2, (bm.height - s) / 2, s, s, 0, 0, size, size);
  const tone = dominantTone(o.getImageData(0, 0, size, size).data);
  return { blob: await out.convertToBlob({ type: 'image/jpeg', quality: 0.88 }), tone, ratio: 1 };
}

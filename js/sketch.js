// Planche à dessin vectorielle pour les casse-têtes qu'aucun simulateur ne connaît.
import { h, modal, promptBox, toast } from './ui.js';
import { generate, PRESETS, basePolygon } from './gabarit.js';
import { uid } from './store.js';

export const SK_COLORS = ['#FFFFFF', '#FFD100', '#FF6A13', '#C8102E', '#00965E', '#0057B8', '#5B6068', '#161616', '#FF6FB5', '#8E5BD8', '#5CD6E8', '#D9DCE0'];

const r2 = (v) => Math.round(v * 10) / 10;
function arrowParts(s) {
  const { x1, y1, x2, y2 } = s; const bend = s.bend || 0;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const cx = (x1 + x2) / 2 - (dy / L) * bend * L, cy = (y1 + y2) / 2 + (dx / L) * bend * L;
  const w = s.w || 5;
  const head = (tx, ty, fx, fy) => {
    const ux = tx - fx, uy = ty - fy, l = Math.hypot(ux, uy) || 1, ax = ux / l, ay = uy / l, hs = w * 3.4;
    return `${r2(tx)},${r2(ty)} ${r2(tx - ax * hs - ay * hs * 0.6)},${r2(ty - ay * hs + ax * hs * 0.6)} ${r2(tx - ax * hs + ay * hs * 0.6)},${r2(ty - ay * hs - ax * hs * 0.6)}`;
  };
  const shorten = (tx, ty, fx, fy) => { const ux = tx - fx, uy = ty - fy, l = Math.hypot(ux, uy) || 1; return [tx - (ux / l) * w * 2.4, ty - (uy / l) * w * 2.4]; };
  const [ex, ey] = shorten(x2, y2, cx, cy);
  const [sx, sy] = s.both ? shorten(x1, y1, cx, cy) : [x1, y1];
  return { d: `M${r2(sx)} ${r2(sy)} Q${r2(cx)} ${r2(cy)} ${r2(ex)} ${r2(ey)}`, h1: head(x2, y2, cx, cy), h0: s.both ? head(x1, y1, cx, cy) : null };
}

export function shapeSVG(s, interactive = false) {
  const id = interactive ? ` data-id="${s.id}"` : '';
  switch (s.t) {
    case 'poly': return `<polygon${id} points="${s.pts.map((p) => p.map(r2).join(',')).join(' ')}" fill="${s.fill}" stroke="#111" stroke-width="${s.sw || 2.5}" stroke-linejoin="round"/>`;
    case 'arrow': {
      const a = arrowParts(s);
      return `<g${id}><path d="${a.d}" fill="none" stroke="#fff" stroke-width="${(s.w || 5) + 4}" stroke-linecap="round" opacity=".9"/><path d="${a.d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 5}" stroke-linecap="round"/><polygon points="${a.h1}" fill="${s.color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>${a.h0 ? `<polygon points="${a.h0}" fill="${s.color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>` : ''}</g>`;
    }
    case 'ring': return `<circle${id} cx="${r2(s.x)}" cy="${r2(s.y)}" r="${r2(s.r)}" fill="none" stroke="${s.color}" stroke-width="5" stroke-dasharray="${s.dash ? '10 7' : ''}"/>`;
    case 'badge': return `<g${id}><circle cx="${r2(s.x)}" cy="${r2(s.y)}" r="15" fill="${s.color}" stroke="#fff" stroke-width="3"/><text x="${r2(s.x)}" y="${r2(s.y + 6)}" text-anchor="middle" font-size="17" font-weight="800" fill="${['#FFFFFF', '#FFD100', '#5CD6E8', '#D9DCE0'].includes(s.color) ? '#000' : '#fff'}" font-family="Archivo, sans-serif">${s.n}</text></g>`;
    case 'text': return `<text${id} x="${r2(s.x)}" y="${r2(s.y)}" font-size="${s.size || 24}" font-weight="750" fill="${s.color}" stroke="#fff" stroke-width="5" paint-order="stroke" stroke-linejoin="round" font-family="Archivo, sans-serif">${String(s.s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</text>`;
    default: return '';
  }
}

export function sketchSVG(d, { interactive = false, selected = null } = {}) {
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w} ${d.h}">`;
  out += `<rect width="${d.w}" height="${d.h}" fill="#fff"/>`;
  if (d.bg) out += `<image href="${d.bg}" x="0" y="0" width="${d.w}" height="${d.h}" preserveAspectRatio="xMidYMid meet" opacity="${d.bgOpacity ?? 0.6}"/>`;
  for (const s of d.shapes) out += shapeSVG(s, interactive);
  if (selected?.size) {
    const bb = bbox(d.shapes.filter((s) => selected.has(s.id)));
    if (bb) out += `<rect class="sel" x="${bb[0] - 8}" y="${bb[1] - 8}" width="${bb[2] - bb[0] + 16}" height="${bb[3] - bb[1] + 16}" fill="none" rx="6" pointer-events="none"/>`;
  }
  return out + '</svg>';
}

function pointsOf(s) {
  if (s.t === 'poly') return s.pts;
  if (s.t === 'arrow') return [[s.x1, s.y1], [s.x2, s.y2]];
  if (s.t === 'ring') return [[s.x - s.r, s.y - s.r], [s.x + s.r, s.y + s.r]];
  if (s.t === 'badge') return [[s.x - 15, s.y - 15], [s.x + 15, s.y + 15]];
  if (s.t === 'text') return [[s.x, s.y - (s.size || 24)], [s.x + String(s.s).length * (s.size || 24) * 0.55, s.y]];
  return [];
}
function bbox(list) {
  const pts = list.flatMap(pointsOf);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function transform(s, f) {
  if (s.t === 'poly') s.pts = s.pts.map(f);
  else if (s.t === 'arrow') { [s.x1, s.y1] = f([s.x1, s.y1]); [s.x2, s.y2] = f([s.x2, s.y2]); }
  else { [s.x, s.y] = f([s.x, s.y]); }
}

export const blankSketch = () => ({ w: 900, h: 560, bg: null, bgOpacity: 0.6, shapes: [] });

/** Monte l'éditeur dans un conteneur. onChange(data) est appelé à chaque modification. */
export function sketchEditor(data, onChange) {
  let tool = 'paint', color = '#FFD100', sel = new Set(), drag = null, draft = null;
  const undo = [];
  const snap = () => { undo.push(JSON.stringify(data.shapes)); if (undo.length > 60) undo.shift(); };
  const changed = () => { draw(); onChange(data); };

  const canvas = h('div', { class: 'sketch-canvas' });
  const TOOLS = [['select', 'Déplacer'], ['paint', 'Peindre'], ['trace', 'Tracer une pièce'], ['arrow', 'Flèche droite'], ['curve', 'Flèche courbe'], ['double', 'Flèche double'], ['ring', 'Entourer'], ['badge', 'Pastille numérotée'], ['text', 'Texte'], ['erase', 'Gomme']];
  const toolBox = h('div', { class: 'seg-v', role: 'group', 'aria-label': 'Outils' }, TOOLS.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(tool === v), onclick: (e) => { tool = v; [...toolBox.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, l)));
  const pal = h('div', { class: 'paint' }, SK_COLORS.map((c) => h('button', { type: 'button', style: { '--c': c }, 'aria-label': 'Couleur ' + c, 'aria-pressed': String(c === color), onclick: (e) => { color = c; [...pal.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); if (sel.size) { snap(); data.shapes.filter((s) => sel.has(s.id)).forEach((s) => (s.t === 'poly' ? (s.fill = c) : (s.color = c))); changed(); } } })));
  const custom = h('input', { type: 'color', value: '#00A0B0', 'aria-label': 'Couleur libre', oninput: () => { color = custom.value; } });

  const selTools = h('div', { class: 'row', style: { gap: '4px' } },
    h('button', { class: 'btn small', type: 'button', title: 'Pivoter', onclick: () => xf('rot', -15) }, '↺'),
    h('button', { class: 'btn small', type: 'button', title: 'Pivoter', onclick: () => xf('rot', 15) }, '↻'),
    h('button', { class: 'btn small', type: 'button', title: 'Réduire', onclick: () => xf('scale', 0.9) }, '−'),
    h('button', { class: 'btn small', type: 'button', title: 'Agrandir', onclick: () => xf('scale', 1.1) }, '+'),
    h('button', { class: 'btn small', type: 'button', onclick: dup }, 'Dupliquer'),
    h('button', { class: 'btn small danger', type: 'button', onclick: delSel }, 'Retirer'));

  const bgIn = h('input', { type: 'file', accept: 'image/*', class: 'sr' });
  bgIn.onchange = async () => {
    const f = bgIn.files[0]; if (!f) return;
    const bm = await createImageBitmap(f);
    const k = Math.min(1, 1400 / bm.width);
    const c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k));
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    data.bg = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    data.w = 900; data.h = Math.round(900 * (c.height / c.width));
    changed();
  };
  const bgOp = h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: data.bgOpacity ?? 0.6, oninput: () => { data.bgOpacity = +bgOp.value; changed(); } });

  const tools = h('div', { class: 'sketch-tools' },
    h('button', { class: 'btn small solid', type: 'button', onclick: () => templateDialog((polys) => { snap(); data.shapes.unshift(...polys); sel = new Set(polys.map((p) => p.id)); tool = 'paint'; changed(); }) }, 'Insérer un gabarit'),
    toolBox, pal, h('label', { class: 'row hint', style: { gap: '6px' } }, custom, 'autre couleur'),
    h('label', { class: 'btn small', style: { cursor: 'pointer' } }, bgIn, data.bg ? 'Changer l\'image de fond' : 'Calquer une image (capture de vidéo…)'),
    data.bg ? h('label', { class: 'lbl hint' }, 'Opacité du fond', bgOp) : null,
    data.bg ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => { data.bg = null; changed(); } }, 'Retirer le fond') : null,
    h('button', { class: 'btn small ghost', type: 'button', onclick: () => { if (undo.length) { data.shapes = JSON.parse(undo.pop()); sel.clear(); changed(); } } }, 'Annuler (Ctrl+Z)'),
    h('p', { class: 'hint', style: { margin: 0 } }, 'Peignez en glissant d\'une pièce à l\'autre. « Tracer une pièce » : cliquez les sommets d\'une forme quelconque (pièce courbe, engrenage, puzzle bandé…) par-dessus une photo, puis recliquez le premier point ou double-cliquez pour fermer.'));

  const root = h('div', { class: 'sketch' }, tools, h('div', { style: { display: 'grid', gap: '6px' } }, canvas, selTools));

  function draw() {
    canvas.innerHTML = sketchSVG(data, { interactive: true, selected: sel });
    if (draft) {
      const svg = canvas.querySelector('svg');
      svg.insertAdjacentHTML('beforeend', `<polyline points="${draft.pts.map((p) => p.join(',')).join(' ')}${draft.hover ? ' ' + draft.hover.join(',') : ''}" fill="${color}" fill-opacity=".35" stroke="#0057B8" stroke-width="2.5" stroke-dasharray="6 4"/>` + draft.pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? 7 : 4}" fill="${i === 0 ? '#FFD100' : '#0057B8'}" stroke="#000"/>`).join(''));
    }
    selTools.style.visibility = sel.size ? 'visible' : 'hidden';
  }
  const svgPt = (e) => { const svg = canvas.querySelector('svg'); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  const hit = (e) => { const el = e.target.closest('[data-id]'); return el ? data.shapes.find((s) => s.id === el.dataset.id) : null; };
  const groupOf = (s) => (s.g ? data.shapes.filter((x) => x.g === s.g).map((x) => x.id) : [s.id]);

  canvas.addEventListener('pointerdown', async (e) => {
    if (!canvas.querySelector('svg')) return;
    const [x, y] = svgPt(e); const s = hit(e);
    canvas.setPointerCapture(e.pointerId);
    if (tool === 'select') {
      if (s) { if (!sel.has(s.id)) sel = new Set(e.shiftKey ? [...sel, ...groupOf(s)] : groupOf(s)); snap(); drag = { kind: 'move', x, y }; }
      else sel.clear();
      draw();
    } else if (tool === 'paint') {
      if (s?.t === 'poly') { snap(); s.fill = color; drag = { kind: 'paint' }; changed(); }
    } else if (['arrow', 'curve', 'double'].includes(tool)) {
      snap(); const a = { id: uid(), t: 'arrow', x1: x, y1: y, x2: x, y2: y, bend: tool === 'curve' ? 0.32 : 0, both: tool === 'double', color: color === '#FFFFFF' ? '#161616' : color, w: 5 };
      data.shapes.push(a); drag = { kind: 'arrow', s: a };
    } else if (tool === 'ring') {
      snap(); const r = { id: uid(), t: 'ring', x, y, r: 4, color: color === '#FFFFFF' ? '#161616' : color };
      data.shapes.push(r); drag = { kind: 'ring', s: r };
    } else if (tool === 'badge') {
      snap(); const n = Math.max(0, ...data.shapes.filter((q) => q.t === 'badge').map((q) => q.n)) + 1;
      data.shapes.push({ id: uid(), t: 'badge', x, y, n, color: color === '#FFFFFF' ? '#161616' : color }); changed();
    } else if (tool === 'text') {
      const txt = await promptBox('Texte à placer');
      if (txt) { snap(); data.shapes.push({ id: uid(), t: 'text', x, y, s: txt, size: 26, color: color === '#FFFFFF' ? '#161616' : color }); changed(); }
    } else if (tool === 'erase' && s) { snap(); data.shapes = data.shapes.filter((q) => q !== s); changed(); }
    else if (tool === 'trace') {
      if (!draft) { draft = { pts: [[x, y]] }; draw(); return; }
      const [fx, fy] = draft.pts[0];
      if (draft.pts.length >= 3 && Math.hypot(x - fx, y - fy) < 14) { finishTrace(); return; }
      draft.pts.push([x, y]); draw();
    }
  });
  function finishTrace() {
    if (draft && draft.pts.length >= 3) { snap(); data.shapes.push({ id: uid(), t: 'poly', fill: color, pts: draft.pts, sw: 2.5 }); }
    draft = null; changed();
  }
  canvas.addEventListener('dblclick', () => { if (tool === 'trace' && draft) { draft.pts.pop(); finishTrace(); } });
  canvas.addEventListener('pointermove', (e) => { if (tool === 'trace' && draft && canvas.querySelector('svg')) { draft.hover = svgPt(e); draw(); } });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [x, y] = svgPt(e);
    if (drag.kind === 'move') {
      const dx = x - drag.x, dy = y - drag.y; drag.x = x; drag.y = y;
      data.shapes.filter((s) => sel.has(s.id)).forEach((s) => transform(s, ([a, b]) => [a + dx, b + dy])); draw();
    } else if (drag.kind === 'paint') {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-id]');
      const s = el && data.shapes.find((q) => q.id === el.dataset.id);
      if (s?.t === 'poly' && s.fill !== color) { s.fill = color; draw(); }
    } else if (drag.kind === 'arrow') { drag.s.x2 = x; drag.s.y2 = y; draw(); }
    else if (drag.kind === 'ring') { drag.s.r = Math.max(6, Math.hypot(x - drag.s.x, y - drag.s.y)); draw(); }
  });
  canvas.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.kind === 'arrow' && Math.hypot(drag.s.x2 - drag.s.x1, drag.s.y2 - drag.s.y1) < 12) data.shapes = data.shapes.filter((s) => s !== drag.s);
    drag = null; changed();
  });
  root.tabIndex = -1;
  root.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (undo.length) { data.shapes = JSON.parse(undo.pop()); sel.clear(); changed(); } }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size) { e.preventDefault(); delSel(); }
    if (e.key === 'Escape' && draft) { draft = null; draw(); }
    if (e.key === 'Enter' && draft) finishTrace();
  });

  function xf(kind, v) {
    const list = data.shapes.filter((s) => sel.has(s.id)); const bb = bbox(list); if (!bb) return;
    snap();
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    const f = kind === 'rot'
      ? (([x, y]) => { const a = (v * Math.PI) / 180, dx = x - cx, dy = y - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; })
      : (([x, y]) => [cx + (x - cx) * v, cy + (y - cy) * v]);
    list.forEach((s) => { transform(s, f); if (kind === 'scale' && s.t === 'ring') s.r *= v; });
    changed();
  }
  function dup() {
    snap(); const g = uid(); const map = new Map();
    const copies = data.shapes.filter((s) => sel.has(s.id)).map((s) => { const c = structuredClone(s); c.id = uid(); if (s.g) { if (!map.has(s.g)) map.set(s.g, g + map.size); c.g = map.get(s.g); } transform(c, ([x, y]) => [x + 30, y + 30]); return c; });
    data.shapes.push(...copies); sel = new Set(copies.map((c) => c.id)); changed();
  }
  function delSel() { snap(); data.shapes = data.shapes.filter((s) => !sel.has(s.id)); sel.clear(); changed(); }

  draw();
  return root;
}

/* ---------- boîte de dialogue des gabarits ---------- */
function templateDialog(onInsert) {
  const o = { ...PRESETS[0].o, size: 300 };
  const prev = h('div', { class: 'tpl-prev' });
  const fld = (label, el) => h('label', { class: 'lbl' }, label, el);
  const num = (key, min, max, step) => { const i = h('input', { class: 'field', type: 'number', min, max, step, value: o[key] ?? '', oninput: () => { o[key] = i.value === '' ? undefined : +i.value; paint(); } }); i.dataset.key = key; return i; };
  const baseSel = h('select', { class: 'field', onchange: () => { o.base = baseSel.value; paint(); } },
    [['square', 'Carré'], ['rect', 'Rectangle'], ['triangle', 'Triangle'], ['pentagon', 'Pentagone'], ['hexagon', 'Hexagone'], ['octagon', 'Octogone'], ['circle', 'Disque']].map(([v, l]) => h('option', { value: v }, l)));
  const chk = (key, label) => { const c = h('input', { type: 'checkbox', onchange: () => { o[key] = c.checked; paint(); } }); c.dataset.key = key; return h('label', { class: 'check' }, c, label); };
  const raysIn = h('input', { class: 'field', placeholder: 'ex. 0, 90, 180, 270', oninput: () => { o.rays = raysIn.value.split(/[,; ]+/).map(Number).filter((x) => !isNaN(x) && raysIn.value.trim()); paint(); } });
  const fields = h('div', { style: { display: 'grid', gap: '10px' } },
    h('div', { class: 'grid2' }, fld('Forme de base', baseSel), fld('Rapport largeur / hauteur', num('ratio', 0.3, 4, 0.1))),
    h('div', { class: 'grid2' }, fld('Colonnes (carré, rectangle)', num('cols', 1, 20, 1)), fld('Rangées', num('rows', 1, 20, 1))),
    h('div', { class: 'grid2' }, fld('Coupes parallèles par côté', num('k', 0, 8, 1)), fld('Espacement des coupes (0 à 1)', num('step', 0.02, 0.9, 0.01))),
    h('div', { class: 'row' }, chk('midlines', 'Relier les milieux'), chk('radV', 'Rayons vers les sommets'), chk('radM', 'Rayons vers les milieux')),
    fld('Rayons supplémentaires (angles en degrés)', raysIn),
    fld('Taille', h('input', { type: 'range', min: 80, max: 520, value: o.size, oninput: (e) => { o.size = +e.target.value; } })));
  const sync = () => {
    baseSel.value = o.base;
    fields.querySelectorAll('[data-key]').forEach((el) => { if (el.type === 'checkbox') el.checked = !!o[el.dataset.key]; else el.value = o[el.dataset.key] ?? ''; });
    raysIn.value = (o.rays || []).join(', ');
  };
  const presets = h('div', { class: 'presets' }, PRESETS.map((p) => h('button', { type: 'button', class: 'btn small', onclick: () => { for (const k of ['ratio', 'cols', 'rows', 'k', 'step', 'midlines', 'radV', 'radM', 'rays']) delete o[k]; Object.assign(o, structuredClone(p.o)); sync(); paint(); } }, p.label)));
  function paint() {
    try {
      const polys = generate(o);
      const pts = polys.flat(); const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const pad = 0.08;
      prev.innerHTML = `<svg viewBox="${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + 2 * pad} ${Math.max(...ys) - Math.min(...ys) + 2 * pad}">${polys.map((p) => `<polygon points="${p.map((q) => q.join(',')).join(' ')}" fill="#E7E9EC" stroke="#111" stroke-width="0.025" stroke-linejoin="round"/>`).join('')}</svg>`;
      info.textContent = `${polys.length} pièce${polys.length > 1 ? 's' : ''}`;
    } catch (e) { prev.textContent = e.message; }
  }
  const info = h('p', { class: 'hint', style: { margin: 0 } });
  const m = modal(h('div', { class: 'tpl-form' },
    h('h2', {}, 'Gabarit de face'),
    h('p', { class: 'muted', style: { margin: 0 } }, 'Partez d\'un modèle puis ajustez les coupes. Chaque pièce devient une zone à peindre.'),
    presets,
    h('div', { class: 'grid2', style: { alignItems: 'start' } }, fields, h('div', { style: { display: 'grid', gap: '6px' } }, prev, info)),
    h('div', { class: 'row end' }, h('button', {
      class: 'btn accent', type: 'button', onclick: () => {
        const polys = generate(o); const g = uid(); const k = o.size / 2;
        onInsert(polys.map((p) => ({ id: uid(), t: 'poly', g, fill: '#D9DCE0', pts: p.map(([x, y]) => [450 + x * k, 280 + y * k]) })));
        m.close();
      },
    }, 'Insérer'))), { wide: true, label: 'Gabarit' });
  sync(); paint();
  void basePolygon;
}

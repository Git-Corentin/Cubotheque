import { state, on, uid, addSolve, updateSolve, deleteSolve, getItem, saveSettings } from '../store.js';
import { h, $, confirmBox, toast } from '../ui.js';
import { EVENTS, eventById, guessEvent, getScramble } from '../scramble.js';

let twistyP;
export const loadTwisty = () => (twistyP ||= import('https://cdn.cubing.net/v0/js/cubing/twisty'));

export const fmt = (ms) => {
  if (ms === Infinity) return 'DNF';
  if (ms == null || isNaN(ms)) return '–';
  const cs = Math.floor(ms / 10); const s = Math.floor(cs / 100); const m = Math.floor(s / 60);
  const rest = `${String(cs % 100).padStart(2, '0')}`;
  return m ? `${m}:${String(s % 60).padStart(2, '0')}.${rest}` : `${s}.${rest}`;
};
export const eff = (s) => (s.penalty === 'dnf' ? Infinity : s.time + (s.penalty === '+2' ? 2000 : 0));
export function avg(list, n) {
  if (list.length < n) return null;
  const xs = list.slice(-n).map(eff).sort((a, b) => a - b);
  const cut = n >= 5 ? Math.max(1, Math.ceil(n * 0.05)) : 0;
  const kept = xs.slice(cut, n - cut);
  if (kept.some((x) => x === Infinity)) return Infinity;
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}
function bestAvg(list, n) {
  let best = null;
  for (let i = n; i <= list.length; i++) { const a = avg(list.slice(i - n, i), n); if (a != null && (best == null || a < best)) best = a; }
  return best;
}

export function render(main, params) {
  const last = localStorage.getItem('cubo.session') || 'ev:333';
  let session = params.arg || last;
  if (session.startsWith('item:') && !getItem(session.slice(5))) session = 'ev:333';
  let event, scramble = '', phase = 'idle', t0 = 0, raf = 0, holdT = 0, inspStart = 0, fromInspect = false, inspPenalty = null;

  const sel = h('select', { class: 'field', 'aria-label': 'Puzzle' },
    h('optgroup', { label: 'Épreuves' }, EVENTS.map((e) => h('option', { value: 'ev:' + e.id }, e.label))),
    state.items.length ? h('optgroup', { label: 'Ma collection' }, state.items.filter((i) => i.status !== 'wish').map((i) => h('option', { value: 'item:' + i.id }, i.name + (i.brand ? ` (${i.brand})` : '')))) : null);
  const evSel = h('select', { class: 'field', 'aria-label': 'Type de mélange' }, EVENTS.map((e) => h('option', { value: e.id }, e.label)));
  const evLbl = h('label', { class: 'lbl' }, 'Mélange utilisé', evSel);
  const insp = h('input', { type: 'checkbox', checked: !!state.settings.inspection, onchange: () => saveSettings({ inspection: insp.checked }) });
  const scrEl = h('div', { class: 'scramble', 'aria-live': 'polite' });
  const tEl = h('div', { class: 't num' }, '0.00');
  const subEl = h('div', { class: 'sub' });
  const clock = h('div', { class: 'clock', 'data-phase': 'idle', role: 'button', tabindex: '0', 'aria-label': 'Chronomètre : maintenir pour armer, relâcher pour démarrer' }, tEl, subEl);
  const preview = h('div', { class: 'preview-puzzle' });
  const statsEl = h('div', { class: 'stats-grid' });
  const chartEl = h('div', { class: 'chart card', style: { padding: '12px' } });
  const listEl = h('ol', { class: 'solves', reversed: true });

  main.append(
    h('header', { class: 'head' }, h('h1', {}, 'Chrono'),
      h('p', { class: 'lead' }, 'Maintenez la barre d\'espace (ou le doigt sur l\'écran) jusqu\'au vert, relâchez pour partir, appuyez pour arrêter. Chaque casse-tête de la collection a sa propre série de temps.')),
    h('div', { class: 'timer-tools' },
      h('label', { class: 'lbl' }, 'Puzzle', sel), evLbl,
      h('label', { class: 'check', style: { minHeight: '42px' } }, insp, 'Inspection de 15 s'),
      h('button', { class: 'btn', onclick: () => { newScramble(); clock.focus({ preventScroll: true }); } }, 'Autre mélange')),
    h('div', { class: 'timer-layout' },
      h('div', {}, scrEl, clock),
      h('aside', { class: 'side' }, preview, statsEl, chartEl,
        h('div', { class: 'card', style: { padding: '12px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px' } }, h('h3', {}, 'Résolutions'),
            h('button', { class: 'btn small danger', onclick: clearSession }, 'Vider la série')),
          listEl))));

  function sessionSolves() { return state.solves.filter((s) => s.session === session); }

  function setSession(s) {
    session = s; sel.value = s; localStorage.setItem('cubo.session', s);
    if (s.startsWith('item:')) { const it = getItem(s.slice(5)); event = guessEvent(it); evLbl.hidden = false; }
    else { event = s.slice(3); evLbl.hidden = true; }
    evSel.value = event;
    paintStats(); newScramble();
  }
  const refocus = () => clock.focus({ preventScroll: true });
  sel.onchange = () => { setSession(sel.value); refocus(); };
  evSel.onchange = () => { event = evSel.value; newScramble(); refocus(); };

  async function newScramble() {
    scrEl.textContent = '…';
    const ev = event;
    const s = await getScramble(ev);
    if (ev !== event) return;
    scramble = s;
    scrEl.textContent = s || (ev === 'none' ? 'Pas de mélange automatique pour ce puzzle : mélangez-le à la main.' : '');
    scrEl.style.whiteSpace = ev === 'minx' || ev === 'kilominx' ? 'pre-line' : '';
    drawPreview();
  }

  async function drawPreview() {
    const e = eventById(event);
    if (!e.twisty || !scramble) { preview.replaceChildren(h('p', { class: 'hint', style: { padding: '16px' } }, 'Pas d\'aperçu pour ce mélange.')); return; }
    try {
      await loadTwisty();
      let p = preview.querySelector('twisty-player');
      if (!p) { p = document.createElement('twisty-player'); preview.replaceChildren(p); }
      p.setAttribute('puzzle', e.twisty);
      p.setAttribute('visualization', '2D');
      p.setAttribute('control-panel', 'none');
      p.setAttribute('background', 'none');
      p.setAttribute('hint-facelets', 'none');
      p.experimentalSetupAlg = scramble;
      p.alg = '';
    } catch { preview.replaceChildren(h('p', { class: 'hint', style: { padding: '16px' } }, 'Aperçu indisponible hors connexion.')); }
  }

  /* ---------- machine à états ---------- */
  const setPhase = (p) => { phase = p; clock.dataset.phase = p; document.body.classList.toggle('solving', ['hold', 'ready', 'run', 'inspect'].includes(p)); };
  function tick() {
    if (phase === 'run') tEl.textContent = fmt(performance.now() - t0);
    else if (phase === 'inspect' || (phase === 'hold' && fromInspect) || (phase === 'ready' && fromInspect)) {
      const e = (performance.now() - inspStart) / 1000;
      tEl.textContent = e < 15 ? String(Math.ceil(15 - e)) : e < 17 ? '+2' : 'DNF';
    }
    raf = requestAnimationFrame(tick);
  }
  function down() {
    if (phase === 'run') { stop(); return; }
    if (phase === 'idle' || phase === 'inspect') {
      fromInspect = phase === 'inspect';
      if (state.settings.inspection && !fromInspect) { setPhase('arm-insp'); return; }
      setPhase('hold'); if (!fromInspect) tEl.textContent = '0.00';
      holdT = setTimeout(() => phase === 'hold' && setPhase('ready'), state.settings.holdMs ?? 300);
    }
  }
  function up() {
    if (phase === 'arm-insp') { inspStart = performance.now(); setPhase('inspect'); subEl.textContent = 'Inspection'; return; }
    if (phase === 'hold') { clearTimeout(holdT); setPhase(fromInspect ? 'inspect' : 'idle'); return; }
    if (phase === 'ready') {
      if (fromInspect) { const e = (performance.now() - inspStart) / 1000; inspPenalty = e > 17 ? 'dnf' : e > 15 ? '+2' : null; } else inspPenalty = null;
      t0 = performance.now(); setPhase('run'); subEl.textContent = '';
      return;
    }
    if (phase === 'done') setPhase('idle');
  }
  async function stop() {
    const time = Math.round(performance.now() - t0);
    setPhase('done');
    tEl.textContent = fmt(time) + (inspPenalty === '+2' ? '+' : '');
    const s = { id: uid(), session, event, time, penalty: inspPenalty, scramble, date: Date.now() };
    const prevBest = Math.min(...sessionSolves().map(eff));
    await addSolve(s);
    if (eff(s) < prevBest && sessionSolves().length > 1) { subEl.textContent = 'Record personnel pour ce puzzle'; toast('Nouveau record : ' + fmt(eff(s))); } else subEl.textContent = '';
    newScramble();
  }
  // la barre d'espace pilote le chrono partout sur la page, sauf dans un champ de saisie
  const typing = (t) => t.isContentEditable || t.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button])');
  const isSpace = (e) => e.code === 'Space' && !typing(e.target);
  const kd = (e) => {
    if (e.key === 'Escape' && phase !== 'idle') { clearTimeout(holdT); setPhase('idle'); tEl.textContent = '0.00'; subEl.textContent = ''; return; }
    if (phase === 'run' && !e.repeat && !typing(e.target)) { e.preventDefault(); stop(); return; }
    if (isSpace(e)) { e.preventDefault(); if (!e.repeat) down(); }
  };
  const ku = (e) => { if (phase === 'done' || isSpace(e)) { e.preventDefault(); up(); } };
  document.addEventListener('keydown', kd);
  document.addEventListener('keyup', ku);
  clock.addEventListener('pointerdown', (e) => { e.preventDefault(); clock.setPointerCapture(e.pointerId); down(); });
  clock.addEventListener('pointerup', (e) => { e.preventDefault(); up(); });
  raf = requestAnimationFrame(tick);

  /* ---------- statistiques ---------- */
  function paintStats() {
    const list = sessionSolves();
    const best = list.length ? Math.min(...list.map(eff)) : null;
    const valid = list.filter((s) => eff(s) !== Infinity);
    const mean = valid.length ? valid.reduce((a, s) => a + eff(s), 0) / valid.length : null;
    const st = [
      ['Meilleur temps', fmt(best)], ['Résolutions', list.length],
      ['Moyenne de 5', fmt(avg(list, 5))], ['Meilleure Mo5', fmt(bestAvg(list.slice(-1000), 5))],
      ['Moyenne de 12', fmt(avg(list, 12))], ['Moyenne de 100', fmt(avg(list, 100))],
      ['Moyenne générale', fmt(mean)], ['Abandons', list.filter((s) => s.penalty === 'dnf').length],
    ];
    statsEl.replaceChildren(...st.map(([k, v]) => h('div', { class: 'stat' }, h('span', {}, k), h('b', {}, v))));

    listEl.replaceChildren(...list.slice().reverse().slice(0, 300).map((s, i) => {
      const li = h('li', { class: eff(s) === best ? 'best' : '', title: s.scramble },
        h('span', { class: 'i' }, list.length - i),
        h('span', { class: 'tm' }, fmt(eff(s)) + (s.penalty === '+2' ? '+' : '')),
        h('span', { class: 'ops' },
          h('button', { 'aria-pressed': String(s.penalty === '+2'), title: 'Pénalité de 2 s', onclick: () => { s.penalty = s.penalty === '+2' ? null : '+2'; updateSolve(s); } }, '+2'),
          h('button', { 'aria-pressed': String(s.penalty === 'dnf'), title: 'Abandon', onclick: () => { s.penalty = s.penalty === 'dnf' ? null : 'dnf'; updateSolve(s); } }, 'DNF'),
          h('button', { title: 'Supprimer', 'aria-label': 'Supprimer', onclick: () => deleteSolve(s.id) }, '×')));
      return li;
    }));
    chart(list);
  }

  function chart(list) {
    const pts = list.slice(-80);
    if (pts.length < 2) { chartEl.replaceChildren(h('p', { class: 'hint', style: { margin: 0 } }, 'La courbe apparaîtra après deux résolutions.')); return; }
    const W = 320, H = 130, P = 8;
    const vals = pts.map(eff).filter((x) => x !== Infinity);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const x = (i) => P + (i / (pts.length - 1)) * (W - 2 * P);
    const y = (v) => H - P - ((v - lo) / Math.max(1, hi - lo)) * (H - 2 * P);
    const dots = pts.map((s, i) => (eff(s) === Infinity ? '' : `<circle cx="${x(i)}" cy="${y(eff(s))}" r="2.6" fill="var(--blue)" />`)).join('');
    const ao = []; for (let i = 4; i < pts.length; i++) { const a = avg(pts.slice(i - 4, i + 1), 5); if (a !== Infinity && a != null) ao.push(`${x(i)},${y(a)}`); }
    chartEl.innerHTML = `<h3 style="margin-bottom:8px">Progression</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Temps des ${pts.length} dernières résolutions, avec la moyenne de 5 glissante">
      <line x1="${P}" x2="${W - P}" y1="${y(lo)}" y2="${y(lo)}" stroke="var(--line)" stroke-dasharray="3 3"/>
      <text x="${W - P}" y="${y(lo) - 4}" text-anchor="end" font-size="10" fill="var(--ink-2)">${fmt(lo)}</text>
      ${ao.length > 1 ? `<polyline points="${ao.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>` : ''}
      ${dots}</svg><p class="hint" style="margin:4px 0 0">Points : chaque résolution. Trait : moyenne de 5.</p>`;
  }

  async function clearSession() {
    const list = sessionSolves();
    if (!list.length) return;
    if (!(await confirmBox(`Effacer les ${list.length} temps de cette série ?`, { ok: 'Effacer', danger: true }))) return;
    for (const s of list) await deleteSolve(s.id);
  }

  const off = on((w) => (w === 'solves' || w === 'all') && paintStats());
  setSession(session);
  // focus d'emblée sur le chrono : la barre d'espace marche sans clic préalable
  document.activeElement?.blur?.();
  requestAnimationFrame(() => clock.focus({ preventScroll: true }));
  insp.addEventListener('change', () => clock.focus({ preventScroll: true }));
  return () => { off(); cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); document.body.classList.remove('solving'); };
}

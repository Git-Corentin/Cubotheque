// Outils DOM minimalistes.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (val == null) continue;
        if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val;
      }
    }
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(msg, kind = '') {
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

/** Ouvre une boîte de dialogue modale native. Retourne {el, close}. */
export function modal(content, { wide = false, onClose, label = 'Fenêtre' } = {}) {
  const dlg = h('dialog', { class: 'modal' + (wide ? ' wide' : ''), 'aria-label': label });
  const closeBtn = h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Fermer' }, '×');
  dlg.append(closeBtn, content);
  document.body.append(dlg);
  const close = () => { if (dlg.open) dlg.close(); };
  closeBtn.onclick = close;
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.showModal();
  return { el: dlg, close };
}

export function confirmBox(text, { ok = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    let answer = false;
    const body = h('div', { class: 'confirm' },
      h('p', {}, text),
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Annuler'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'solid'), onclick: () => { answer = true; m.close(); } }, ok)));
    const m = modal(body, { onClose: () => resolve(answer), label: 'Confirmation' });
  });
}

export function promptBox(label, value = '') {
  return new Promise((resolve) => {
    let answer = null;
    const input = h('input', { class: 'field', value });
    const form = h('form', { class: 'confirm', onsubmit: (e) => { e.preventDefault(); answer = input.value; m.close(); } },
      h('label', { class: 'lbl' }, label, input),
      h('div', { class: 'row end' }, h('button', { class: 'btn solid' }, 'Valider')));
    const m = modal(form, { onClose: () => resolve(answer), label });
    input.focus(); input.select();
  });
}

export const fmtMoney = (v) => (v === '' || v == null || isNaN(+v) ? '' : (+v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Inclinaison au pointeur (effet objet en main). */
export function tilt(el, strength = 10) {
  if (reduceMotion()) return;
  const target = el.querySelector('.cut') || el;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    target.style.transform = `perspective(700px) rotateY(${x * strength}deg) rotateX(${-y * strength}deg) translateZ(18px)`;
  });
  el.addEventListener('pointerleave', () => { target.style.transform = ''; });
}

import { localBackend, supaBackend, supaConfig } from './backend.js';

export const CATEGORIES = [
  { id: 'nxn', label: 'Cubes NxN', hint: '2x2 à 21x21, la famille du Rubik\'s Cube' },
  { id: 'cuboid', label: 'Cuboïdes', hint: '2x2x3, 3x3x2 Domino, 3x3x5…' },
  { id: 'shape', label: 'Shape mods', hint: 'Un mécanisme connu (souvent 3x3) taillé dans une autre forme : Mirror, Axis, Ghost, Fisher, Windmill, Void, Pyramorphix…' },
  { id: 'corner', label: 'Rotation par les coins', hint: 'Skewb, Dino, Rex, Redi Cube, Ivy…' },
  { id: 'edge', label: 'Rotation par les arêtes', hint: 'Helicopter, Curvy Copter…' },
  { id: 'tetra', label: 'Tétraèdres', hint: 'Pyraminx, Master Pyraminx, Jing\'s…' },
  { id: 'octa', label: 'Octaèdres', hint: 'FTO, Skewb Diamond, Gems…' },
  { id: 'dodeca', label: 'Dodécaèdres', hint: 'Megaminx, Kilominx, Gigaminx…' },
  { id: 'shift', label: 'Square-1 et bandés', hint: 'Coupes non cubiques ou pièces soudées : certains mouvements se bloquent et la forme change en tournant. Square-1, Mixup, Bandaged, Bermuda…' },
  { id: 'other', label: 'Curiosités', hint: 'Clock, Gear, sphères, puzzles 2D…' },
];
export const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || 'Sans catégorie';
export const STATUS = [
  { id: 'owned', label: 'Dans la collection' },
  { id: 'wish', label: 'Sur la liste d\'envies' },
  { id: 'lent', label: 'Prêté' },
  { id: 'sold', label: 'Parti' },
];
export const SOLVE_STATE = [
  { id: 'unknown', label: 'Non renseigné' },
  { id: 'never', label: 'Jamais résolu' },
  { id: 'help', label: 'Résolu avec un tuto' },
  { id: 'self', label: 'Résolu seul' },
  { id: 'memory', label: 'Méthode connue par cœur' },
];

// Réglages du site (partagés, enregistrés avec la collection) et préférences de l'appareil.
const SITE_KEYS = ['title', 'theme', 'effect', 'defaultView', 'scheme', 'about', 'tileBg', 'tileColor'];
const PREF_KEY = 'cubo.prefs';

const listeners = new Set();
export const state = {
  items: [], sheets: [], solves: [],
  settings: { title: 'Cubothèque', theme: 'blanc', effect: 'socle', tileBg: 'uni', tileColor: '#E8E2D4', defaultView: 'presentoir', scheme: 'jaune', about: '', inspection: false, holdMs: 300, proxy: '' },
  backend: null,        // 'local' | 'supabase'
  canEdit: true,        // le visiteur peut-il modifier ?
  readonly: false,      // = !canEdit (compatibilité)
  user: null,           // compte connecté (mode en ligne)
  backendError: null,
  published: null,      // data/collection.json (mode local uniquement)
  viewingPublished: false,
};
let B = null;
export const backend = () => B;

export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(what) { for (const fn of listeners) fn(what); }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function applyPerms() {
  state.backend = B.kind;
  if (B.kind === 'supabase') { state.user = B.me.user; state.canEdit = B.me.isAdmin; }
  else { state.user = null; state.canEdit = !state.viewingPublished; }
  state.readonly = !state.canEdit;
}

export async function load() {
  const cfg = supaConfig();
  state.backendError = null;
  if (cfg && (!B || B.kind !== 'supabase')) {
    try {
      B = await supaBackend(cfg);
      // Supabase renvoie « SIGNED_IN » à chaque retour sur l'onglet : on ne recharge que si le compte a vraiment changé.
      let lastUid;
      B.onAuth(async (ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { location.hash = '#/connexion/nouveau'; return; }
        const now = session?.user?.id || null;
        if (lastUid === undefined) { lastUid = now; return; }
        if (now === lastUid) return;
        lastUid = now;
        if (job.running) return;
        await reload(); emit('all');
      });
    } catch (e) { state.backendError = 'La bibliothèque de la base en ligne n\'a pas pu se charger (' + e.message + ').'; B = null; }
  }
  B ||= localBackend();
  try { Object.assign(state.settings, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch { /* */ }
  await reload();
  if (B.kind === 'local') {
    try {
      const r = await fetch('data/collection.json', { cache: 'no-cache' });
      if (r.ok) state.published = await r.json();
    } catch { /* pas de version publiée */ }
    if (!state.items.length && state.published?.items?.length) enterReadonly();
  }
}

async function reload() {
  try {
    const d = await B.loadAll();
    state.items = (d.items || []).sort((a, b) => a.num - b.num);
    state.sheets = d.sheets || [];
    state.solves = (d.solves || []).sort((a, b) => a.date - b.date);
    if (d.site) for (const k of SITE_KEYS) if (k in d.site) state.settings[k] = d.site[k];
  } catch (e) {
    state.backendError = e.message.includes('fetch') ? 'La base en ligne ne répond pas. Sur l\'offre gratuite, un projet inactif pendant une semaine est mis en pause : relancez-le depuis le tableau de bord Supabase.' : e.message;
  }
  applyPerms();
}

/* ---------- connexion ---------- */
export async function signIn(email, pw) { await B.signIn(email, pw); await reload(); emit('all'); return state.canEdit; }
export async function signOut() { await B.signOut(); await reload(); emit('all'); }
export const resetPassword = (email) => B.resetPassword(email);
export const setPassword = (pw) => B.setPassword(pw);

/* ---------- version publiée (mode local) ---------- */
export function enterReadonly() {
  const p = state.published;
  state.viewingPublished = true;
  state.items = p.items.slice().sort((a, b) => a.num - b.num);
  state.sheets = p.sheets || [];
  if (p.settings) for (const k of SITE_KEYS) if (k in p.settings) state.settings[k] = p.settings[k];
  applyPerms();
  emit('all');
}
export async function adoptPublished() {
  const p = state.published;
  state.viewingPublished = false; applyPerms();
  state.items = []; state.sheets = [];
  await importData(p, async (id) => { const path = p.images?.[id]; if (!path) return null; const r = await fetch('data/' + path); return r.ok ? r.blob() : null; }, { replace: false, keepIds: true });
}

/* ---------- réglages ---------- */
export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  const prefs = {}; for (const k of ['inspection', 'holdMs', 'proxy']) prefs[k] = state.settings[k];
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  if (Object.keys(patch).some((k) => SITE_KEYS.includes(k)) && state.canEdit) {
    const site = {}; for (const k of SITE_KEYS) site[k] = state.settings[k];
    await B.saveSite(site);
  }
  emit('settings');
}

/* ---------- objets ---------- */
export const getItem = (id) => state.items.find((i) => i.id === id);
export const nextNum = () => state.items.reduce((m, i) => Math.max(m, i.num || 0), 0) + 1;
export function blankItem() {
  return {
    id: uid(), num: nextNum(), name: '', brand: '', model: '', category: 'nxn', size: '', status: 'owned',
    solve: 'never', difficulty: 2, magnetic: false, finish: 'stickerless', acquired: '', price: '', sizeMm: '', weightG: '',
    notes: '', tags: [], fav: false, imageId: null, tone: '#9aa0a6', event: '', source: '', year: '', createdAt: Date.now(),
  };
}
function guard() { if (!state.canEdit) throw new Error('Connectez-vous avec le compte administrateur pour modifier.'); }

export async function saveItem(item) {
  guard();
  item.updatedAt = Date.now();
  await B.saveItem(item);
  const i = state.items.findIndex((x) => x.id === item.id);
  if (i >= 0) state.items[i] = item; else state.items.push(item);
  state.items.sort((a, b) => a.num - b.num);
  emit('items');
}
export async function deleteItem(id) {
  guard();
  const it = getItem(id);
  if (it?.imageId) await B.deleteImage(it.imageId).catch(() => {});
  await B.deleteItem(id);
  state.items = state.items.filter((i) => i.id !== id);
  emit('items');
}

/* ---------- images ---------- */
export async function saveImage(blob) { guard(); return B.saveImage(blob); }
export async function deleteImage(id) { guard(); return B.deleteImage(id); }
export async function imageURL(id, small = false) {
  if (!id) return null;
  if (state.viewingPublished) { const path = state.published?.images?.[id]; return path ? 'data/' + path : null; }
  return B.imageURL(id, small);
}

/* ---------- fiches ---------- */
export const getSheet = (id) => state.sheets.find((s) => s.id === id);
export async function saveSheet(sheet) {
  guard();
  sheet.updated = Date.now();
  await B.saveSheet(sheet);
  const i = state.sheets.findIndex((x) => x.id === sheet.id);
  if (i >= 0) state.sheets[i] = sheet; else state.sheets.push(sheet);
  emit('sheets');
}
export async function deleteSheet(id) {
  guard();
  await B.deleteSheet(id);
  state.sheets = state.sheets.filter((s) => s.id !== id);
  emit('sheets');
}

/* ---------- chronos (les visiteurs gardent leurs temps sur leur appareil) ---------- */
export async function addSolve(s) { await B.saveSolve(s); state.solves.push(s); emit('solves'); }
export async function updateSolve(s) { await B.saveSolve(s); emit('solves'); }
export async function deleteSolve(id) { await B.deleteSolve(id); state.solves = state.solves.filter((x) => x.id !== id); emit('solves'); }

/* ---------- sauvegarde, import, migration ---------- */
let JSZipP;
const jszip = () => (JSZipP ||= import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm').then((m) => m.default || m));
const extOf = (type) => ({ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[type] || 'png');

export async function exportZip({ withSolves = true, onProgress } = {}) {
  const JSZip = await jszip();
  const zip = new JSZip();
  const images = {};
  let n = 0;
  for (const it of state.items) {
    n++; onProgress?.(n, state.items.length);
    if (!it.imageId) continue;
    const blob = await B.imageBlob(it.imageId).catch(() => null);
    if (!blob) continue;
    const name = `images/${it.imageId.replace(/\.\w+$/, '')}.${extOf(blob.type)}`;
    zip.file(name, blob);
    images[it.imageId] = name;
  }
  const site = {}; for (const k of SITE_KEYS) site[k] = state.settings[k];
  const data = { format: 'cubotheque', version: 2, exported: new Date().toISOString(), settings: site, items: state.items, sheets: state.sheets, images };
  if (withSolves) data.solves = state.solves;
  zip.file('collection.json', JSON.stringify(data, null, 1));
  return zip.generateAsync({ type: 'blob' });
}

/* Import en tâche de fond : progression globale, reprise possible, plusieurs envois en parallèle. */
export const job = { running: false, done: 0, total: 0, skipped: 0, label: '', errors: [] };
const JOB_KEY = 'cubo.import';
export const interruptedImport = () => { try { return JSON.parse(localStorage.getItem(JOB_KEY) || 'null'); } catch { return null; } };
const leaveGuard = (e) => { e.preventDefault(); e.returnValue = ''; };

/** Importe un jeu de données ; getBlob(id) fournit l'image d'origine.
 *  Les identifiants sont conservés : relancer le même fichier reprend là où l'import s'était arrêté. */
export async function importData(data, getBlob, { replace = false, label = 'Import', onProgress } = {}) {
  guard();
  if (job.running) throw new Error('Un import est déjà en cours : attendez qu\'il se termine.');
  const items = data.items || [];
  Object.assign(job, { running: true, done: 0, total: items.length, skipped: 0, label, errors: [] });
  localStorage.setItem(JOB_KEY, JSON.stringify({ label, total: items.length, done: 0, at: Date.now() }));
  window.addEventListener('beforeunload', leaveGuard);
  emit('job');
  try {
    if (replace) { job.label = 'Effacement de l\'ancienne collection'; emit('job'); await wipe(); job.label = label; }
    const existing = new Map(state.items.map((i) => [i.id, i]));
    let next = 0;
    const work = async () => {
      while (next < items.length) {
        const raw = items[next++];
        const old = existing.get(raw.id);
        if (old && (old.imageId || !raw.imageId)) { job.done++; job.skipped++; emit('job'); continue; } // déjà importé
        const it = structuredClone(raw);
        for (let attempt = 1; ; attempt++) {
          try {
            if (raw.imageId) {
              const blob = await getBlob(raw.imageId);
              it.imageId = blob ? await B.saveImage(blob, 'img-' + it.id) : null;
            }
            await B.saveItem(it);
            break;
          } catch (e) {
            if (attempt >= 3) { job.errors.push(`${it.name} : ${e.message}`); break; }
            await new Promise((r) => setTimeout(r, 800 * attempt));
          }
        }
        const k = state.items.findIndex((x) => x.id === it.id);
        if (k >= 0) state.items[k] = it; else state.items.push(it);
        job.done++;
        onProgress?.(job.done, job.total, it.name);
        localStorage.setItem(JOB_KEY, JSON.stringify({ label, total: job.total, done: job.done, at: Date.now() }));
        emit('job');
      }
    };
    await Promise.all(Array.from({ length: B.kind === 'local' ? 1 : 4 }, work));
    for (const s of data.sheets || []) await B.saveSheet(s);
    if (data.solves) for (const s of data.solves) await B.saveSolve(s).catch(() => {});
    if (data.settings && replace) { const site = {}; for (const k of SITE_KEYS) if (k in data.settings) site[k] = data.settings[k]; await B.saveSite({ ...Object.fromEntries(SITE_KEYS.map((k) => [k, state.settings[k]])), ...site }); }
    localStorage.removeItem(JOB_KEY);
  } finally {
    job.running = false;
    window.removeEventListener('beforeunload', leaveGuard);
    B.clearCache?.();
    await reload(); emit('all'); emit('job');
  }
  return items.length;
}

export async function importZip(file, opts = {}) {
  const JSZip = await jszip();
  const zip = await JSZip.loadAsync(file);
  const json = JSON.parse(await zip.file('collection.json').async('string'));
  return importData(json, async (id) => {
    const path = json.images?.[id]; const f = path && zip.file(path); if (!f) return null;
    const ext = path.split('.').pop();
    return new Blob([await f.async('arraybuffer')], { type: { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[ext] || 'image/png' });
  }, { label: `Import de ${file.name}`, ...opts });
}

/** Envoie dans la base en ligne ce qui avait été saisi dans ce navigateur. */
export async function localDataSummary() {
  const L = localBackend(); const d = await L.loadAll();
  return { count: d.items.length, sheets: d.sheets.length, solves: d.solves.length, data: d, L };
}
export async function migrateLocal(onProgress) {
  const { data, L } = await localDataSummary();
  return importData(data, (id) => L.imageBlob(id), { onProgress, label: 'Envoi vers la base en ligne' });
}

async function wipe() {
  if (B.wipe) await B.wipe();
  else {
    for (const it of state.items) { if (it.imageId) await B.deleteImage(it.imageId).catch(() => {}); await B.deleteItem(it.id); }
    for (const s of state.sheets) await B.deleteSheet(s.id);
  }
  state.items = []; state.sheets = []; state.solves = [];
}
export async function wipeAll() { guard(); await wipe(); emit('all'); }

/** Année d'arrivée : date complète si connue, sinon l'année seule. */
export const yearOf = (it) => (it.acquired ? new Date(it.acquired).getFullYear() : +it.year || null);

/** Liste CSV de la collection (pour un tableur). */
export function collectionCSV() {
  const cols = ['num', 'name', 'brand', 'model', 'category', 'size', 'status', 'solve', 'difficulty', 'magnetic', 'finish', 'acquired', 'year', 'price', 'source', 'sizeMm', 'weightG', 'tags', 'notes'];
  const esc = (v) => { const s = Array.isArray(v) ? v.join(', ') : String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = state.items.map((it) => cols.map((c) => esc(c === 'category' ? catLabel(it.category) : it[c])).join(';'));
  return '﻿' + cols.join(';') + '\n' + rows.join('\n');
}

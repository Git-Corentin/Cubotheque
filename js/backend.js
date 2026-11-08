// Deux façons de ranger les données, avec la même interface :
//  - local : IndexedDB du navigateur (aucune configuration) ;
//  - supabase : base en ligne, lecture publique, écriture réservée aux administrateurs.
import { db } from './db.js';
import { SUPABASE } from './config.js';

const SUPA_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function supaConfig() {
  // Un réglage temporaire (assistant de configuration) peut remplacer config.js sur cet appareil.
  try { const o = JSON.parse(localStorage.getItem('cubo.supa') || 'null'); if (o?.url && o?.key) return { ...o, temp: true }; } catch { /* */ }
  return SUPABASE.url && SUPABASE.key ? { ...SUPABASE, temp: false } : null;
}

async function thumbOf(blob, max = 380) {
  const bm = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k));
  c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
  const b = await c.convertToBlob({ type: 'image/webp', quality: 0.82 });
  return b.type === 'image/webp' ? b : c.convertToBlob({ type: 'image/png' });
}

/* ---------- local ---------- */
export function localBackend() {
  const urls = new Map();
  return {
    kind: 'local',
    async loadAll() {
      const [items, sheets, solves, kv] = await Promise.all([db.all('items'), db.all('sheets'), db.all('solves'), db.get('kv', 'settings')]);
      return { items, sheets, solves, site: kv?.value || null };
    },
    saveItem: (it) => db.put('items', it),
    deleteItem: (id) => db.del('items', id),
    async saveImage(blob, name) { const id = name || uid(); await db.put('images', { id, blob, type: blob.type }); return id; },
    async wipe() { for (const st of ['items', 'images', 'sheets', 'solves']) await db.clear(st); urls.clear(); },
    async deleteImage(id) { if (id) await db.del('images', id); },
    async imageURL(id) {
      if (!id) return null;
      if (urls.has(id)) return urls.get(id);
      const rec = await db.get('images', id);
      const u = rec ? URL.createObjectURL(rec.blob) : null;
      urls.set(id, u); return u;
    },
    async imageBlob(id) { return (await db.get('images', id))?.blob || null; },
    saveSheet: (s) => db.put('sheets', s),
    deleteSheet: (id) => db.del('sheets', id),
    saveSolve: (s) => db.put('solves', s),
    deleteSolve: (id) => db.del('solves', id),
    saveSite: (v) => db.put('kv', { id: 'settings', value: v }),
    clearCache() { urls.clear(); },
  };
}

/* ---------- supabase ---------- */
export async function supaBackend(cfg) {
  const { createClient } = await import(SUPA_CDN);
  const client = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const bucket = client.storage.from('images');
  const base = cfg.url.replace(/\/$/, '') + '/storage/v1/object/public/images/';
  const local = localBackend(); // les temps des visiteurs restent sur leur appareil

  const me = { user: null, isAdmin: false };
  async function refreshUser() {
    const { data } = await client.auth.getSession();
    me.user = data.session?.user || null;
    me.isAdmin = false;
    if (me.user) {
      const { data: rows, error } = await client.from('admins').select('user_id').eq('user_id', me.user.id);
      me.isAdmin = !error && rows?.length > 0;
    }
    return me;
  }
  const check = ({ error }) => { if (error) throw new Error(error.message || 'Erreur de la base'); };
  const rows = async (table) => {
    const { data, error } = await client.from(table).select('data').limit(5000);
    if (error) throw new Error(`Lecture de « ${table} » impossible : ${error.message}`);
    return data.map((r) => r.data);
  };

  return {
    kind: 'supabase', client, me, refreshUser, cfg,
    async loadAll() {
      await refreshUser();
      const [items, sheets, siteRows] = await Promise.all([rows('items'), rows('sheets'), client.from('site').select('data').eq('id', 'site')]);
      const solves = me.isAdmin ? await rows('solves') : (await local.loadAll()).solves;
      return { items, sheets, solves, site: siteRows.data?.[0]?.data || null };
    },
    async saveItem(it) { check(await client.from('items').upsert({ id: it.id, num: it.num, data: it, updated_at: new Date().toISOString() })); },
    async deleteItem(id) { check(await client.from('items').delete().eq('id', id)); },
    async saveImage(blob, name) {
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const id = `${name || uid()}.${ext}`;
      const opts = { contentType: blob.type, cacheControl: '31536000', upsert: true };
      const r1 = await bucket.upload(id, blob, opts); if (r1.error) throw new Error('Envoi de l\'image refusé : ' + r1.error.message);
      const small = await thumbOf(blob);
      const r2 = await bucket.upload('s/' + id, small, { ...opts, contentType: small.type }); if (r2.error) console.warn(r2.error);
      return id;
    },
    async deleteImage(id) { if (id && id.includes('.')) await bucket.remove([id, 's/' + id]); },
    async imageURL(id, small = false) {
      if (!id) return null;
      if (!id.includes('.')) return local.imageURL(id); // image restée dans ce navigateur
      return base + (small ? 's/' : '') + id;
    },
    async imageBlob(id) { const u = await this.imageURL(id); if (!u) return null; const r = await fetch(u); return r.ok ? r.blob() : null; },
    async saveSheet(s) { check(await client.from('sheets').upsert({ id: s.id, data: s, updated_at: new Date().toISOString() })); },
    async deleteSheet(id) { check(await client.from('sheets').delete().eq('id', id)); },
    async saveSolve(s) { if (me.isAdmin) check(await client.from('solves').upsert({ id: s.id, data: s })); else await local.saveSolve(s); },
    async deleteSolve(id) { if (me.isAdmin) check(await client.from('solves').delete().eq('id', id)); else await local.deleteSolve(id); },
    async saveSite(v) { check(await client.from('site').upsert({ id: 'site', data: v, updated_at: new Date().toISOString() })); },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Adresse ou mot de passe incorrect.' : error.message);
      return refreshUser();
    },
    async signOut() { await client.auth.signOut(); return refreshUser(); },
    async resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/connexion' });
      if (error) throw new Error(error.message);
    },
    async setPassword(password) { const { error } = await client.auth.updateUser({ password }); if (error) throw new Error(error.message); },
    onAuth(fn) { return client.auth.onAuthStateChange((ev, session) => fn(ev, session)); },
    /** Vide toute la collection en quelques requêtes (au lieu d'une par objet). */
    async wipe() {
      for (const t of ['items', 'sheets', 'solves']) check(await client.from(t).delete().neq('id', ''));
      for (const dir of ['', 's']) {
        for (;;) {
          const { data, error } = await bucket.list(dir, { limit: 1000 });
          if (error || !data?.length) break;
          const files = data.filter((f) => f.id).map((f) => (dir ? dir + '/' : '') + f.name);
          if (!files.length) break;
          await bucket.remove(files);
          if (data.length < 1000) break;
        }
      }
    },
    clearCache() { local.clearCache(); },
    local,
  };
}

/** Teste une adresse + clé (assistant de configuration). */
export async function testSupabase(url, key) {
  const { createClient } = await import(SUPA_CDN);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await c.from('items').select('id').limit(1);
  if (error) throw new Error(error.message.includes('does not exist') || error.code === '42P01' ? 'La base répond, mais les tables manquent : lancez supabase/schema.sql.' : error.message);
  const { error: e2 } = await c.storage.from('images').list('', { limit: 1 });
  if (e2) return 'Tables trouvées. Le stockage « images » n\'est pas visible avec cette clé : vérifiez que le script SQL a bien été exécuté en entier.';
  return 'Connexion réussie : tables et stockage d\'images en place.';
}

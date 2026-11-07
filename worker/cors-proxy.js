// Relais CORS minimal pour Cloudflare Workers (offre gratuite).
// Usage depuis le site : https://votre-relais.workers.dev/?url=<adresse de l'image encodée>
// Il ne relaie que des images, pour éviter de servir de proxy ouvert à n'importe quoi.

const ALLOWED_ORIGINS = ['*']; // remplacez par ['https://votre-site.pages.dev'] une fois en ligne

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '*';
    const allow = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) ? origin : 'null';
    const cors = { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const target = new URL(request.url).searchParams.get('url');
    if (!target || !/^https?:\/\//.test(target)) return new Response('Paramètre url manquant', { status: 400, headers: cors });

    const upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; image-relay)' }, redirect: 'follow' });
    const type = upstream.headers.get('Content-Type') || '';
    if (!type.startsWith('image/')) return new Response('Ce n\'est pas une image', { status: 415, headers: cors });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' },
    });
  },
};

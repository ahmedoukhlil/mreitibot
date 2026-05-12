/**
 * n8n — Code node : télécharge une page HTML, extrait le texte (priorité <main>/<article>),
 * produit un item compatible avec « Split into chunks (hybrid JS) » (champ `text`).
 *
 * Variables d'environnement (optionnelles) :
 *   INGEST_HTML_URL — URL complète (défaut : page des exigences ITIE en français)
 *
 * Note : le fragment #exigence-1-17277 n’est pas envoyé au serveur ; la même ressource
 * est chargée qu’avec l’URL sans ancre. Citer la source (eiti.org) selon leur politique de contenu.
 */
const httpRequest = this.helpers.httpRequest.bind(this);

const DEFAULT_URL =
  'https://eiti.org/fr/exigences-de-litie';

function envStr(name) {
  try {
    if (typeof process === 'undefined') return '';
    const v = process.env && process.env[name];
    return typeof v === 'string' ? v : '';
  } catch (_) {
    return '';
  }
}

function extractMainHtml(html) {
  const h = String(html || '');
  const main = h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) return main[0];
  const art = h.match(/<article\b[^>]*>[\s\S]*?<\/article>/i);
  if (art) return art[0];
  return h;
}

function htmlToPlain(html) {
  let s = extractMainHtml(html);
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|section|header|footer)\b[^>]*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const c = parseInt(n, 10);
      return Number.isFinite(c) && c > 0 && c < 0x110000
        ? String.fromCodePoint(c)
        : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const c = parseInt(h, 16);
      return Number.isFinite(c) && c > 0 && c < 0x110000
        ? String.fromCodePoint(c)
        : '';
    });
  s = s.replace(/[ \t\f\v]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function fileNameFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean);
    const last = seg.pop() || 'page';
    const base = last.replace(/[^a-zA-Z0-9._-]+/g, '_');
    return (base || 'page') + '.html';
  } catch (_) {
    return 'page.html';
  }
}

const pageUrl = (envStr('INGEST_HTML_URL').trim() || DEFAULT_URL).split('#')[0];

const res = await httpRequest({
  method: 'GET',
  url: pageUrl,
  headers: {
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr,en;q=0.9',
    'User-Agent':
      'MREITI-ChafafiyaBot/1.0 (ingestion documentation ITIE; +https://eiti.org)',
  },
  returnFullResponse: true,
  timeout: 120000,
});

const status = res.statusCode ?? res.status ?? 0;
if (status < 200 || status >= 300) {
  throw new Error(`HTTP ${status} pour ${pageUrl}`);
}

const body =
  typeof res.body === 'string'
    ? res.body
    : res.body != null && typeof res.body.toString === 'function'
      ? res.body.toString()
      : String(res.data ?? '');

const text = htmlToPlain(body);
if (!text || text.length < 200) {
  throw new Error(
    'Texte extrait trop court : structure HTML inattendue ou page bloquée.',
  );
}

const fileName = fileNameFromUrl(pageUrl);

return [
  {
    json: {
      text,
      fileName,
      name: fileName,
      path: pageUrl,
      ingest_source: 'url',
      content_type: 'text/html',
      source_title: 'Exigences de l’ITIE (eiti.org)',
    },
  },
];

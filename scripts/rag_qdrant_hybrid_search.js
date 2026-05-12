/**
 * Recherche hybride Qdrant (dense + BM25) pour le chat RAG.
 *
 * Stratégie par défaut (smart si RAG_RETRIEVAL_STRATEGY vide) :
 *  - Si la question cite une exigence (ex. 2.5) : recherche d’abord dans note_orientation ;
 *    si aucun chunk ne correspond à cette exigence → guide de validation (doc_validation),
 *    puis norme (norme_itie) si trop peu de résultats, puis corpus « reference », puis sans filtre.
 *  - Sinon : un passage avec filtre multi-types (RAG_REFERENCE_DOC_TYPES).
 *
 * RAG_RETRIEVAL_STRATEGY :
 *   (vide) | "smart" — comportement ci-dessus
 *   "reference" — uniquement filtre multi-types (pas de logique exigence / GN d’abord)
 *   "orientation_then_validation" — orientation puis validation si < RAG_ORIENTATION_MIN_HITS
 *   "all" | "legacy" | "none" — pas de filtre
 *
 * RAG_FALLBACK_MIN_HITS — sous-seuil pour compléter avec la norme après le guide (défaut 2)
 *
 * Cache Redis (optionnel) — évite embeddings Ollama + appels Qdrant pour les mêmes requêtes :
 *   RAG_REDIS_HOST — ex. 127.0.0.1 (vide = pas de cache)
 *   RAG_REDIS_PORT — défaut 6379
 *   RAG_REDIS_PASSWORD — optionnel
 *   RAG_REDIS_DB — défaut 0
 *   RAG_CACHE_TTL_SEC — défaut 3600
 *   RAG_CACHE_ENABLED — false pour désactiver même si Redis est configuré
 *   RAG_CACHE_NAMESPACE — isole plusieurs déploiements (défaut default)
 *   RAG_CACHE_BUST — changez la valeur pour invalider tout le cache (défaut 1)
 *   RAG_CACHE_KEY_PREFIX — défaut chafafiya:rag:v1:
 */
const httpRequest = this.helpers.httpRequest.bind(this);

const b = $('Code in JavaScript3').first().json.body ?? {};
const question =
  (typeof b.chatInput === 'string' && b.chatInput.trim()) ||
  (typeof b.originalQuestion === 'string' && b.originalQuestion.trim()) ||
  '';

const QDRANT_COLLECTION = 'documents';
const DENSE_VECTOR_NAME = 'dense';
const SPARSE_VECTOR_NAME = 'text-bm25';

function envStr(name) {
  try {
    if (typeof process === 'undefined') return '';
    const pe = process.env;
    if (!pe || typeof pe[name] !== 'string') return '';
    return pe[name];
  } catch (_) {
    return '';
  }
}

function envInt(name, def) {
  const v = envStr(name).trim();
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const PREFETCH_LIMIT = envInt('RAG_PREFETCH_LIMIT', 24);
const FINAL_LIMIT = envInt('RAG_FINAL_LIMIT', 10);
const ORIENTATION_MIN_HITS = envInt('RAG_ORIENTATION_MIN_HITS', 3);
const FALLBACK_MIN_HITS = envInt('RAG_FALLBACK_MIN_HITS', 2);
const OLLAMA_MODEL = 'nomic-embed-text:latest';
const TIMEOUT_OLLAMA_EMBED_MS = envInt('RAG_OLLAMA_TIMEOUT_MS', 30000);
const TIMEOUT_QDRANT_MS = envInt('RAG_QDRANT_TIMEOUT_MS', 15000);
const CB_THRESHOLD = envInt('RAG_CB_THRESHOLD', 5);
const CB_OPEN_MS = envInt('RAG_CB_OPEN_MS', 60000);

const retrievalErrors = [];
const retrievalMetrics = {
  latency_retrieval_ms: null,
  latency_ollama_embed_ms: null,
  latency_qdrant_ms: null,
  qdrant_status: 'unknown',
  ollama_status: 'unknown',
  retrieval_strategy: null,
  points_returned: 0,
  redis_cache: 'disabled',
  cache_hit: false,
  cache_key_hash: null,
};
const tRetrievalStart = Date.now();

const root = $('Code in JavaScript3').first().json ?? {};
const ret = root._retrieval ?? {};

let baseUrl = '';
let apiKey = '';
let ollamaBase = '';

if (typeof this.getCredentials === 'function') {
  try {
    const qCred = await this.getCredentials('qdrantApi');
    baseUrl = String(qCred.url || '').replace(/\/$/, '');
    apiKey = qCred.apiKey || qCred.api_key || '';
  } catch (_) {}
  try {
    const o = await this.getCredentials('ollamaApi');
    ollamaBase = String(o.baseUrl || o.host || o.url || '').replace(
      /\/$/,
      '',
    );
  } catch (_) {}
}

if (!baseUrl) {
  baseUrl = String(
    ret.qdrantUrl || envStr('QDRANT_URL') || 'http://127.0.0.1:6333',
  ).replace(/\/$/, '');
}
if (!apiKey) {
  apiKey =
    ret.qdrantApiKey || envStr('QDRANT_API_KEY') || envStr('QDRANT_KEY') || '';
}
if (!baseUrl || !String(baseUrl).startsWith('http')) {
  throw new Error(
    "Qdrant: URL manquante. Renseignez _retrieval.qdrantUrl (nœud Set avant ce Code), ou variables d'environnement QDRANT_URL si process est exposé, ou getCredentials si dispo.",
  );
}
if (!ollamaBase) {
  ollamaBase = String(
    ret.ollamaUrl || envStr('OLLAMA_URL') || 'http://127.0.0.1:11434',
  ).replace(/\/$/, '');
}

const headers = { 'Content-Type': 'application/json' };
if (apiKey) headers['api-key'] = apiKey;

if (!question) {
  return [];
}

const crypto = require('crypto');
const net = require('net');

const RAG_REDIS_HOST = envStr('RAG_REDIS_HOST').trim();
const RAG_REDIS_PORT = envInt('RAG_REDIS_PORT', 6379);
const RAG_REDIS_PASSWORD = envStr('RAG_REDIS_PASSWORD');
const RAG_REDIS_DB = envInt('RAG_REDIS_DB', 0);
const RAG_CACHE_TTL_SEC = envInt('RAG_CACHE_TTL_SEC', 3600);
const RAG_CACHE_ENABLED =
  envStr('RAG_CACHE_ENABLED').trim().toLowerCase() !== 'false';

let strategyForCacheKey = envStr('RAG_RETRIEVAL_STRATEGY').trim().toLowerCase();
if (!strategyForCacheKey) strategyForCacheKey = 'smart';

function buildRagCachePayload() {
  return JSON.stringify({
    v: 1,
    q: question.normalize('NFC').trim(),
    strategy: strategyForCacheKey,
    coll: QDRANT_COLLECTION,
    pl: PREFETCH_LIMIT,
    fl: FINAL_LIMIT,
    omh: ORIENTATION_MIN_HITS,
    fmh: FALLBACK_MIN_HITS,
    rdt: envStr('RAG_REFERENCE_DOC_TYPES').trim(),
    bust: envStr('RAG_CACHE_BUST').trim() || '1',
    ns: envStr('RAG_CACHE_NAMESPACE').trim() || 'default',
  });
}

function ragCacheRedisKey() {
  const h = crypto
    .createHash('sha256')
    .update(buildRagCachePayload())
    .digest('hex')
    .slice(0, 48);
  const prefix =
    envStr('RAG_CACHE_KEY_PREFIX').trim() || 'chafafiya:rag:v1:';
  retrievalMetrics.cache_key_hash = h;
  return `${prefix}${h}`;
}

function encodeRedisCmd(args) {
  let out = `*${args.length}\r\n`;
  for (const a of args) {
    const s = a == null ? '' : String(a);
    const n = Buffer.byteLength(s, 'utf8');
    out += `$${n}\r\n${s}\r\n`;
  }
  return out;
}

function tryConsumeOneRedisReply(buf) {
  if (!buf.length) return { needMore: true };
  const c = buf[0];
  if (c === 43) {
    const i = buf.indexOf('\r\n');
    if (i === -1) return { needMore: true };
    return {
      consumed: i + 2,
      simple: buf.slice(1, i).toString('utf8'),
    };
  }
  if (c === 45) {
    const i = buf.indexOf('\r\n');
    if (i === -1) return { needMore: true };
    return {
      consumed: i + 2,
      err: buf.slice(1, i).toString('utf8'),
    };
  }
  if (c === 36) {
    const i = buf.indexOf('\r\n', 1);
    if (i === -1) return { needMore: true };
    const len = parseInt(buf.slice(1, i).toString('utf8'), 10);
    if (len === -1) return { consumed: i + 2, bulk: null };
    if (!Number.isFinite(len) || len < 0) return { parseErr: 'bad_bulk_len' };
    const end = i + 2 + len + 2;
    if (buf.length < end) return { needMore: true };
    const bulk = buf.slice(i + 2, i + 2 + len).toString('utf8');
    return { consumed: end, bulk };
  }
  return { parseErr: `bad_type_${c}` };
}

function redisPipeline(host, port, password, db, commands) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port, family: 4 });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('redis_timeout'));
    }, 3000);
    let buf = Buffer.alloc(0);
    const cmds = [];
    if (password) cmds.push(['AUTH', password]);
    if (db != null && String(db) !== '0') cmds.push(['SELECT', String(db)]);
    cmds.push(...commands);
    let encoded = '';
    for (const c of cmds) encoded += encodeRedisCmd(c);
    const replies = [];
    sock.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    sock.on('connect', () => sock.write(encoded));
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (true) {
        const r = tryConsumeOneRedisReply(buf);
        if (r.needMore) break;
        if (r.parseErr) {
          clearTimeout(timer);
          sock.destroy();
          reject(new Error(r.parseErr));
          return;
        }
        if (r.err) {
          clearTimeout(timer);
          sock.destroy();
          reject(new Error(r.err));
          return;
        }
        buf = buf.slice(r.consumed);
        if ('simple' in r) replies.push({ type: 'simple', val: r.simple });
        else if ('bulk' in r) replies.push({ type: 'bulk', val: r.bulk });
        if (replies.length >= cmds.length) {
          clearTimeout(timer);
          sock.end();
          resolve(replies);
          return;
        }
      }
    });
  });
}

async function redisGetJson(host, port, password, db, key) {
  const replies = await redisPipeline(host, port, password, db, [['GET', key]]);
  const last = replies[replies.length - 1];
  if (!last || last.type !== 'bulk' || last.val == null) return null;
  try {
    return JSON.parse(last.val);
  } catch {
    return null;
  }
}

async function redisSetEx(host, port, password, db, key, ttlSec, jsonStr) {
  await redisPipeline(host, port, password, db, [
    ['SETEX', key, String(ttlSec), jsonStr],
  ]);
}

async function tryReturnFromRedisCache() {
  if (!RAG_CACHE_ENABLED || !RAG_REDIS_HOST) {
    retrievalMetrics.redis_cache = 'disabled';
    return null;
  }
  retrievalMetrics.redis_cache = 'miss';
  try {
    const key = ragCacheRedisKey();
    const parsed = await redisGetJson(
      RAG_REDIS_HOST,
      RAG_REDIS_PORT,
      RAG_REDIS_PASSWORD || undefined,
      RAG_REDIS_DB,
      key,
    );
    if (
      !parsed ||
      parsed.v !== 1 ||
      !Array.isArray(parsed.items) ||
      !parsed.items.length
    ) {
      return null;
    }
    retrievalMetrics.redis_cache = 'hit';
    retrievalMetrics.cache_hit = true;
    retrievalMetrics.latency_ollama_embed_ms = 0;
    retrievalMetrics.latency_qdrant_ms = 0;
    retrievalMetrics.ollama_status = 'skipped_cache';
    retrievalMetrics.qdrant_status = 'skipped_cache';
    retrievalMetrics.retrieval_strategy = strategyForCacheKey;
    retrievalMetrics.points_returned = parsed.items.length;
    retrievalMetrics.latency_retrieval_ms = Date.now() - tRetrievalStart;
    return parsed.items.map((it) => ({
      json: {
        ...(it && typeof it === 'object' ? it : {}),
        retrieval_metrics: { ...retrievalMetrics },
      },
    }));
  } catch {
    retrievalMetrics.redis_cache = 'error';
    return null;
  }
}

async function maybeStoreRedisCache(itemsJson) {
  if (!RAG_CACHE_ENABLED || !RAG_REDIS_HOST) return;
  if (retrievalErrors.length) return;
  if (!itemsJson || !itemsJson.length) return;
  try {
    const key = ragCacheRedisKey();
    await redisSetEx(
      RAG_REDIS_HOST,
      RAG_REDIS_PORT,
      RAG_REDIS_PASSWORD || undefined,
      RAG_REDIS_DB,
      key,
      RAG_CACHE_TTL_SEC,
      JSON.stringify({ v: 1, items: itemsJson }),
    );
  } catch (_) {}
}

const cachedRetrievalOut = await tryReturnFromRedisCache();
if (cachedRetrievalOut) return cachedRetrievalOut;

function getBreaker(serviceName) {
  const g = globalThis;
  g.__chafafiyaBreakers = g.__chafafiyaBreakers || {};
  if (!g.__chafafiyaBreakers[serviceName]) {
    g.__chafafiyaBreakers[serviceName] = {
      failureCount: 0,
      state: 'CLOSED',
      openUntil: 0,
    };
  }
  return g.__chafafiyaBreakers[serviceName];
}

function breakerOpen(serviceName) {
  const br = getBreaker(serviceName);
  return br.state === 'OPEN' && Date.now() < br.openUntil;
}

function breakerRecordFailure(serviceName) {
  const br = getBreaker(serviceName);
  br.failureCount++;
  if (br.failureCount >= CB_THRESHOLD) {
    br.state = 'OPEN';
    br.openUntil = Date.now() + CB_OPEN_MS;
  }
}

function breakerRecordSuccess(serviceName) {
  const br = getBreaker(serviceName);
  br.failureCount = 0;
  br.state = 'CLOSED';
  br.openUntil = 0;
}

let queryVector = [];
if (breakerOpen('ollama')) {
  retrievalErrors.push({
    service: 'ollama',
    operation: 'embeddings',
    message: 'circuit_open',
  });
  retrievalMetrics.ollama_status = 'circuit_open';
} else {
  try {
    const t0 = Date.now();
    const embRes = await httpRequest({
      method: 'POST',
      url: `${ollamaBase}/api/embeddings`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: question }),
      json: true,
      timeout: TIMEOUT_OLLAMA_EMBED_MS,
    });
    const v = embRes.embedding;
    if (Array.isArray(v) && v.length) queryVector = v;
    else {
      throw new Error('Ollama: embedding vide');
    }
    retrievalMetrics.latency_ollama_embed_ms = Date.now() - t0;
    breakerRecordSuccess('ollama');
    retrievalMetrics.ollama_status = 'ok';
  } catch (err) {
    breakerRecordFailure('ollama');
    const message = err && err.message ? String(err.message) : 'Ollama error';
    retrievalErrors.push({
      service: 'ollama',
      operation: 'embeddings',
      message,
    });
    retrievalMetrics.ollama_status = /timeout/i.test(message) ? 'timeout' : 'error';
  }
}

if (!queryVector.length) {
  retrievalMetrics.latency_retrieval_ms = Date.now() - tRetrievalStart;
  return [
    {
      json: {
        retrieval_errors: retrievalErrors.length ? retrievalErrors : [{ service: 'ollama', operation: 'embeddings', message: 'embedding_unavailable' }],
        retrieval_metrics: retrievalMetrics,
        document: { pageContent: '', metadata: {} },
        score: 0,
        searchType: 'hybrid',
      },
    },
  ];
}

function buildHybridBody(filter) {
  const body = {
    prefetch: [
      { query: queryVector, using: DENSE_VECTOR_NAME, limit: PREFETCH_LIMIT },
      {
        query: {
          text: question,
          model: 'qdrant/bm25',
          options: { language: 'french' },
        },
        using: SPARSE_VECTOR_NAME,
        limit: PREFETCH_LIMIT,
      },
    ],
    query: { fusion: 'rrf' },
    limit: FINAL_LIMIT,
    with_payload: true,
  };
  if (filter) body.filter = filter;
  return body;
}

function mapPointsToItems(points) {
  return points.map((p) => {
    const payload = p.payload || {};
    const pageContent =
      payload.content ?? payload.text ?? payload.page_content ?? '';
    const metadata =
      typeof payload.metadata === 'object' && payload.metadata !== null
        ? payload.metadata
        : {};
    return {
      json: {
        document: { pageContent, metadata },
        score: typeof p.score === 'number' ? p.score : 0,
        searchType: 'hybrid',
      },
    };
  });
}

function normalizePoints(raw) {
  return Array.isArray(raw) ? raw : [];
}

function pointKey(p) {
  if (p == null) return '';
  if (p.id !== undefined && p.id !== null) return String(p.id);
  const pay = p.payload || {};
  const mid = pay.metadata?.document_id || pay.document_id || '';
  const cx = (pay.content || '').toString().slice(0, 80);
  return `${mid}:${cx}`;
}

/**
 * Filtre uniquement sur la clé racine payload.document_type (remplie par l’upsert hybride).
 * Évite les 400 Qdrant dus aux chemins imbriqués du type metadata.document_type sans index.
 */
function filterDocType(value) {
  return {
    must: [{ key: 'document_type', match: { value } }],
  };
}

function parseReferenceDocTypes() {
  const raw = envStr('RAG_REFERENCE_DOC_TYPES').trim();
  if (raw) {
    return raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['note_orientation', 'norme_itie', 'doc_validation'];
}

function filterAnyDocType(values) {
  const v = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!v.length) return null;
  if (v.length === 1) return filterDocType(v[0]);
  return {
    should: v.map((value) => ({
      key: 'document_type',
      match: { value },
    })),
    minimum_should_match: 1,
  };
}

const FILTER_NOTE_ORIENTATION = filterDocType('note_orientation');
const FILTER_VALIDATION = filterDocType('doc_validation');
const FILTER_NORM = filterDocType('norme_itie');
const FILTER_REFERENCE = filterAnyDocType(parseReferenceDocTypes());

function extractRequirementId(q) {
  const s = String(q || '');
  const m1 = s.match(
    /\bexigence\s+([1-7])[\._]([0-9]{1,2})(?:[\._]([a-z]))?\b/i,
  );
  if (m1) {
    return m1[3] ? `${m1[1]}.${m1[2]}.${m1[3]}` : `${m1[1]}.${m1[2]}`;
  }
  const hasCtx =
    /itie|eiti|orientation|norme|note\s*d|validation|standard|couvre|explique|gn\b|thématique/i.test(
      s,
    );
  if (!hasCtx) return '';
  const m2 = s.match(/\b([1-7])[\._]([0-9]{1,2})(?:[\._]([a-z]))?\b/);
  if (!m2) return '';
  return m2[3] ? `${m2[1]}.${m2[2]}.${m2[3]}` : `${m2[1]}.${m2[2]}`;
}

function pointMatchesRequirement(point, rid) {
  if (!rid || !point) return false;
  const pay = point.payload || {};
  const meta = pay.metadata || {};
  const hint = String(meta.requirement_hint || pay.requirement_hint || '').trim();
  const parts = rid.split('.');
  const base = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : rid;
  if (
    hint &&
    (hint === rid ||
      hint === base ||
      hint.startsWith(base + '.') ||
      rid.startsWith(hint + '.'))
  ) {
    return true;
  }
  const src = String(
    pay.source || meta.source || meta.filename || '',
  ).toLowerCase();
  const maj = parts[0];
  const min = parts[1];
  if (maj && min) {
    const pat = new RegExp(
      `\\b${maj}[._-]${min}\\b|gn[\\s._-]*${maj}[._]${min}|eiti[._-]?gn[._-]*${maj}[._]${min}|\\bgn\\s*${maj}[._]${min}`,
      'i',
    );
    if (pat.test(src)) return true;
  }
  const text = String(pay.content || pay.page_content || '')
    .slice(0, 10000)
    .toLowerCase();
  const chap = String(meta.itie_chapter || pay.itie_chapter || '').trim();
  if (maj && min && chap === maj) {
    if (
      text.includes(`${maj}.${min}`) ||
      new RegExp(
        `exigence\\s*${maj}\\s*[.,\\s]+\\s*${min}\\b`,
        'i',
      ).test(text) ||
      new RegExp(`sous-exigence\\s*${maj}[.\\s]*${min}\\b`, 'i').test(
        text,
      )
    ) {
      return true;
    }
  }
  if (!maj || !min) return false;
  if (
    text.includes(`exigence ${maj}.${min}`) ||
    text.includes(`exigence ${maj}, ${min}`) ||
    text.includes(`exigence ${maj} ${min}`)
  ) {
    return true;
  }
  if (
    new RegExp(
      `exigence\\s*${maj}\\s*[.,\\s]+\\s*${min}\\b`,
      'i',
    ).test(text)
  ) {
    return true;
  }
  if (
    new RegExp(`sous-exigence\\s*${maj}[.\\s]*${min}\\b`, 'i').test(text)
  ) {
    return true;
  }
  return false;
}

function mergePointsUnique(primary, extra, limit) {
  const seen = new Set(primary.map(pointKey));
  const out = primary.slice();
  for (const p of extra) {
    if (out.length >= limit) break;
    const k = pointKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

async function runSmartExigenceRetrieval(rid) {
  const ori = await runRetrievalFiltered(FILTER_NOTE_ORIENTATION);
  const matched = ori.filter((p) => pointMatchesRequirement(p, rid));
  if (matched.length > 0) {
    return mergePointsUnique(matched, ori, FINAL_LIMIT);
  }
  let pts = await runRetrievalFiltered(FILTER_VALIDATION);
  if (pts.length < FALLBACK_MIN_HITS) {
    const nrm = await runRetrievalFiltered(FILTER_NORM);
    pts = mergePointsUnique(pts, nrm, FINAL_LIMIT);
  }
  if (!pts.length) {
    pts = await runRetrievalFiltered(FILTER_REFERENCE);
  }
  if (!pts.length) {
    pts = await runRetrievalUnfiltered();
  }
  return pts.slice(0, FINAL_LIMIT);
}

const qdrantReqOpts = {
  returnFullResponse: true,
  ignoreHttpStatusErrors: true,
};

function pointsFromQdrantParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return [];
  const r = parsed.result;
  if (Array.isArray(r)) return normalizePoints(r);
  if (r && Array.isArray(r.points)) return normalizePoints(r.points);
  if (Array.isArray(parsed.points)) return normalizePoints(parsed.points);
  return [];
}

async function tryHybridQuery(body) {
  try {
    if (breakerOpen('qdrant')) {
      retrievalErrors.push({
        service: 'qdrant',
        operation: 'hybrid_query',
        message: 'circuit_open',
      });
      retrievalMetrics.qdrant_status = 'circuit_open';
      return [];
    }
    const t0 = Date.now();
    const qRes = await httpRequest({
      method: 'POST',
      url: `${baseUrl}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/query`,
      headers,
      body: JSON.stringify(body),
      json: true,
      ...qdrantReqOpts,
      timeout: TIMEOUT_QDRANT_MS,
    });
    const dt = Date.now() - t0;
    retrievalMetrics.latency_qdrant_ms = (retrievalMetrics.latency_qdrant_ms || 0) + dt;
    const code = qRes.statusCode ?? qRes.status ?? 200;
    if (code >= 400) {
      breakerRecordFailure('qdrant');
      retrievalErrors.push({
        service: 'qdrant',
        operation: 'hybrid_query',
        message: `http_${code}`,
      });
      retrievalMetrics.qdrant_status = 'error';
      return [];
    }
    breakerRecordSuccess('qdrant');
    retrievalMetrics.qdrant_status = 'ok';
    return pointsFromQdrantParsed(qRes.body);
  } catch (err) {
    breakerRecordFailure('qdrant');
    const message = err && err.message ? String(err.message) : 'qdrant_error';
    retrievalErrors.push({
      service: 'qdrant',
      operation: 'hybrid_query',
      message,
    });
    retrievalMetrics.qdrant_status = /timeout/i.test(message) ? 'timeout' : 'error';
    return [];
  }
}

async function trySearchDense(filter) {
  const named = {
    vector: { name: DENSE_VECTOR_NAME, vector: queryVector },
    limit: FINAL_LIMIT,
    with_payload: true,
  };
  if (filter) named.filter = filter;
  try {
    if (breakerOpen('qdrant')) {
      retrievalErrors.push({
        service: 'qdrant',
        operation: 'dense_search_named',
        message: 'circuit_open',
      });
      retrievalMetrics.qdrant_status = 'circuit_open';
      throw new Error('circuit_open');
    }
    const t0 = Date.now();
    const sRes = await httpRequest({
      method: 'POST',
      url: `${baseUrl}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/search`,
      headers,
      body: JSON.stringify(named),
      json: true,
      ...qdrantReqOpts,
      timeout: TIMEOUT_QDRANT_MS,
    });
    const dt = Date.now() - t0;
    retrievalMetrics.latency_qdrant_ms = (retrievalMetrics.latency_qdrant_ms || 0) + dt;
    const code = sRes.statusCode ?? sRes.status ?? 200;
    if (code >= 400) {
      breakerRecordFailure('qdrant');
      retrievalErrors.push({
        service: 'qdrant',
        operation: 'dense_search_named',
        message: `http_${code}`,
      });
      retrievalMetrics.qdrant_status = 'error';
      throw new Error('dense named failed');
    }
    breakerRecordSuccess('qdrant');
    retrievalMetrics.qdrant_status = 'ok';
    return pointsFromQdrantParsed(sRes.body);
  } catch (err) {
    const flat = {
      vector: queryVector,
      limit: FINAL_LIMIT,
      with_payload: true,
    };
    if (filter) flat.filter = filter;
    try {
      if (breakerOpen('qdrant')) {
        retrievalErrors.push({
          service: 'qdrant',
          operation: 'dense_search_flat',
          message: 'circuit_open',
        });
        retrievalMetrics.qdrant_status = 'circuit_open';
        return [];
      }
      const t1 = Date.now();
      const sRes2 = await httpRequest({
        method: 'POST',
        url: `${baseUrl}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/search`,
        headers,
        body: JSON.stringify(flat),
        json: true,
        ...qdrantReqOpts,
        timeout: TIMEOUT_QDRANT_MS,
      });
      const dt2 = Date.now() - t1;
      retrievalMetrics.latency_qdrant_ms = (retrievalMetrics.latency_qdrant_ms || 0) + dt2;
      const c2 = sRes2.statusCode ?? sRes2.status ?? 200;
      if (c2 >= 400) {
        breakerRecordFailure('qdrant');
        retrievalErrors.push({
          service: 'qdrant',
          operation: 'dense_search_flat',
          message: `http_${c2}`,
        });
        retrievalMetrics.qdrant_status = 'error';
        return [];
      }
      breakerRecordSuccess('qdrant');
      retrievalMetrics.qdrant_status = 'ok';
      return pointsFromQdrantParsed(sRes2.body);
    } catch (err2) {
      breakerRecordFailure('qdrant');
      const message =
        err2 && err2.message ? String(err2.message) : 'qdrant_error';
      retrievalErrors.push({
        service: 'qdrant',
        operation: 'dense_search_flat',
        message,
      });
      retrievalMetrics.qdrant_status = /timeout/i.test(message) ? 'timeout' : 'error';
      return [];
    }
  }
}

async function runRetrievalFiltered(filter) {
  const pts = await tryHybridQuery(buildHybridBody(filter));
  if (pts.length) return pts;
  return trySearchDense(filter);
}

async function runRetrievalUnfiltered() {
  const pts = await tryHybridQuery(buildHybridBody(null));
  if (pts.length) return pts;
  return trySearchDense(null);
}

let points = [];
let strategy = envStr('RAG_RETRIEVAL_STRATEGY').trim().toLowerCase();
if (!strategy) strategy = 'smart';
retrievalMetrics.retrieval_strategy = strategy;

if (strategy === 'all' || strategy === 'legacy' || strategy === 'none') {
  points = await runRetrievalUnfiltered();
} else if (strategy === 'orientation_then_validation') {
  points = await runRetrievalFiltered(FILTER_NOTE_ORIENTATION);

  if (points.length < ORIENTATION_MIN_HITS) {
    const valPts = await runRetrievalFiltered(FILTER_VALIDATION);
    const seen = new Set(points.map(pointKey));
    for (const p of valPts) {
      if (points.length >= FINAL_LIMIT) break;
      const k = pointKey(p);
      if (seen.has(k)) continue;
      seen.add(k);
      points.push(p);
    }
  }

  if (!points.length) {
    points = await runRetrievalUnfiltered();
  }
} else if (strategy === 'reference') {
  points = await runRetrievalFiltered(FILTER_REFERENCE);
  if (!points.length) {
    points = await runRetrievalUnfiltered();
  }
} else {
  const rid = extractRequirementId(question);
  if (rid) {
    points = await runSmartExigenceRetrieval(rid);
  } else {
    points = await runRetrievalFiltered(FILTER_REFERENCE);
    if (!points.length) {
      points = await runRetrievalUnfiltered();
    }
  }
}

if (points.length === 0 && retrievalErrors.length) {
  retrievalMetrics.latency_retrieval_ms = Date.now() - tRetrievalStart;
  return [
    {
      json: {
        retrieval_errors: retrievalErrors,
        retrieval_metrics: retrievalMetrics,
        document: { pageContent: '', metadata: {} },
        score: 0,
        searchType: 'hybrid',
      },
    },
  ];
}

retrievalMetrics.points_returned = points.length;
retrievalMetrics.latency_retrieval_ms = Date.now() - tRetrievalStart;

const mappedForOut = mapPointsToItems(points);
await maybeStoreRedisCache(mappedForOut.map((it) => it.json));

return mappedForOut.map((it) => ({
  json: {
    ...it.json,
    retrieval_errors: retrievalErrors.length ? retrievalErrors : undefined,
    retrieval_metrics: retrievalMetrics,
  },
}));

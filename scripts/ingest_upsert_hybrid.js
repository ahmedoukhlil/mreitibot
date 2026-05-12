/* Upsert dense + BM25 — utilise embedding_text (préfixe contextuel) pour vecteur + sparse ;
   payload.content = chunk affiché tel quel pour le LLM. */
const httpRequest = this.helpers.httpRequest.bind(this);

const COLLECTION = 'documents';
const OLLAMA_MODEL = 'nomic-embed-text:latest';
const BM25_TEXT_MAX = 32000;
const EMB_BATCH = 32;
const UPSERT_BATCH = 32;
const EMB_PARALLEL = 8;

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

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function qdrantReq(method, url, headers, bodyObj) {
  const reqOpts = {
    method,
    url,
    headers,
    json: true,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
  };
  if (bodyObj !== undefined) reqOpts.body = bodyObj;
  const resp = await httpRequest(reqOpts);
  const code = resp.statusCode ?? resp.status ?? 0;
  const body = resp.body ?? resp.data ?? resp;
  if (code >= 400) {
    const errTxt =
      typeof body === 'string'
        ? body
        : body?.status?.error || JSON.stringify(body);
    return { ok: false, code, error: errTxt, raw: body };
  }
  return { ok: true, code, data: body };
}

async function embedTexts(ollamaBase, texts) {
  try {
    const res = await httpRequest({
      method: 'POST',
      url: ollamaBase + '/api/embed',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, input: texts }),
      json: true,
    });
    const embs = res && res.embeddings;
    if (Array.isArray(embs) && embs.length === texts.length) {
      return embs;
    }
  } catch (_) {}
  const out = new Array(texts.length);
  for (let i = 0; i < texts.length; i += EMB_PARALLEL) {
    const slice = texts.slice(i, i + EMB_PARALLEL);
    const baseIdx = i;
    await Promise.all(
      slice.map((t, k) =>
        httpRequest({
          method: 'POST',
          url: ollamaBase + '/api/embeddings',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt: t }),
          json: true,
        }).then((r) => {
          out[baseIdx + k] = r.embedding;
        }),
      ),
    );
  }
  return out;
}

let baseUrl = '';
let apiKey = '';
if (typeof this.getCredentials === 'function') {
  try {
    const q = await this.getCredentials('qdrantApi');
    baseUrl = String(q.url || '').replace(/\/$/, '');
    apiKey = q.apiKey || q.api_key || '';
  } catch (_) {}
}
if (!baseUrl)
  baseUrl = String(envStr('QDRANT_URL') || 'http://127.0.0.1:6333').replace(
    /\/$/,
    '',
  );

let ollamaBase = '';
if (typeof this.getCredentials === 'function') {
  try {
    const o = await this.getCredentials('ollamaApi');
    ollamaBase = String(o.baseUrl || o.host || o.url || '').replace(/\/$/, '');
  } catch (_) {}
}
if (!ollamaBase)
  ollamaBase = String(envStr('OLLAMA_URL') || 'http://127.0.0.1:11434').replace(
    /\/$/,
    '',
  );

const qH = { 'Content-Type': 'application/json' };
if (apiKey) qH['api-key'] = apiKey;

let qdrantVersion = '';
try {
  const ri = await httpRequest({
    method: 'GET',
    url: baseUrl,
    headers: qH,
    json: true,
  });
  if (ri && ri.version) qdrantVersion = ri.version;
} catch (_) {}

const colRes = await qdrantReq(
  'GET',
  baseUrl + '/collections/' + encodeURIComponent(COLLECTION),
  qH,
  undefined,
);
if (!colRes.ok) {
  throw new Error(
    'Collection "' +
      COLLECTION +
      '" introuvable (' +
      colRes.code +
      '). Lancez Setup. ' +
      String(colRes.error).slice(0, 500),
  );
}
const colData =
  colRes.data && colRes.data.result !== undefined
    ? colRes.data.result
    : colRes.data;
const colParams =
  (colData && colData.config && colData.config.params) || colData.params || {};
const vectors = colParams.vectors || {};
let expectedDim = null;
if (vectors.dense && vectors.dense.size) expectedDim = vectors.dense.size;
else if (typeof vectors.size === 'number') expectedDim = vectors.size;
const sparseKeys = Object.keys(colParams.sparse_vectors || {});
if (sparseKeys.indexOf('text-bm25') < 0) {
  throw new Error(
    'Sparse "text-bm25" absent. Recréez la collection (DROP_COLLECTION_FIRST=true).',
  );
}

const upsertUrl =
  baseUrl +
  '/collections/' +
  encodeURIComponent(COLLECTION) +
  '/points?wait=false';
const rows = $input.all();

const chunks = [];
for (let i = 0; i < rows.length; i++) {
  const json = rows[i].json || {};
  const raw = json.chunk;
  if (!raw || !String(raw).trim()) continue;
  const embedSrc = json.embedding_text || json.chunk;
  const safe = String(raw).replace(/\0/g, '');
  const safeEmbed = String(embedSrc).replace(/\0/g, '');
  const bm25Src =
    safeEmbed.length > BM25_TEXT_MAX
      ? safeEmbed.slice(0, BM25_TEXT_MAX)
      : safeEmbed;
  const meta = json.metadata || { source: json.source, type: 'pdf' };
  chunks.push({
    idx: i,
    text: safe,
    embedText: safeEmbed,
    bm25: bm25Src,
    meta,
    source: json.source,
    chunk_index: json.chunk_index,
  });
}

const embeddings = [];
for (let b = 0; b < chunks.length; b += EMB_BATCH) {
  const slice = chunks.slice(b, b + EMB_BATCH);
  const vecs = await embedTexts(
    ollamaBase,
    slice.map(function (c) {
      return c.embedText;
    }),
  );
  for (let k = 0; k < vecs.length; k++) {
    var emb = vecs[k];
    if (!Array.isArray(emb) || !emb.length) {
      throw new Error('[chunk ' + slice[k].idx + '] Ollama: embedding vide');
    }
    if (expectedDim != null && emb.length !== expectedDim) {
      throw new Error(
        '[chunk ' +
          slice[k].idx +
          '] Dimension=' +
          emb.length +
          ' vs collection=' +
          expectedDim,
      );
    }
    embeddings.push(emb);
  }
}

const results = [];
for (let b = 0; b < chunks.length; b += UPSERT_BATCH) {
  var batchChunks = chunks.slice(b, b + UPSERT_BATCH);
  var batchEmbs = embeddings.slice(b, b + UPSERT_BATCH);
  var points = batchChunks.map(function (c, k) {
    const m = c.meta || {};
    return {
      id: uuid4(),
      vector: {
        dense: batchEmbs[k],
        'text-bm25': {
          text: c.bm25,
          model: 'qdrant/bm25',
          options: { language: 'french' },
        },
      },
      payload: {
        content: c.text,
        page_content: c.text,
        document_id: m.document_id,
        source: c.source,
        chunk_index: c.chunk_index,
        metadata: m,
        document_type: m.document_type,
        chunk_type: m.chunk_type,
        section_path: m.section_path,
        requirement_hint: m.requirement_hint,
      },
    };
  });

  var res = await qdrantReq('PUT', upsertUrl, qH, { points: points });
  if (!res.ok) {
    throw new Error(
      '[lot interne ' +
        Math.floor(b / UPSERT_BATCH) +
        '] Qdrant ' +
        (qdrantVersion || '?') +
        ' HTTP ' +
        res.code +
        ' : ' +
        String(res.error).slice(0, 2000),
    );
  }

  for (var k = 0; k < batchChunks.length; k++) {
    results.push({
      json: {
        upserted: true,
        pointId: points[k].id,
        source: batchChunks[k].source,
        chunk_index: batchChunks[k].chunk_index,
      },
    });
  }
}

return results;

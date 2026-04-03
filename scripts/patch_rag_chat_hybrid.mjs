/**
 * Met à jour RAG-chat (4).json : retrieval hybride Qdrant + rerank Cohere (HTTP).
 * Exécuter : node scripts/patch_rag_chat_hybrid.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const wfPath = path.join(root, "RAG-chat (4).json");

const hybridCode = `const httpRequest = this.helpers.httpRequest.bind(this);

const b = $('Code in JavaScript3').first().json.body ?? {};
const question =
  (typeof b.chatInput === 'string' && b.chatInput.trim()) ||
  (typeof b.originalQuestion === 'string' && b.originalQuestion.trim()) ||
  '';

const QDRANT_COLLECTION = 'documents';
const DENSE_VECTOR_NAME = 'dense';
const SPARSE_VECTOR_NAME = 'text-bm25';
const PREFETCH_LIMIT = 24;
const FINAL_LIMIT = 12;
const OLLAMA_MODEL = 'nomic-embed-text:latest';

const root = $('Code in JavaScript3').first().json ?? {};
const ret = root._retrieval ?? {};

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

let baseUrl = '';
let apiKey = '';
let ollamaBase = '';

if (typeof this.getCredentials === 'function') {
  try {
    const qCred = await this.getCredentials('qdrantApi');
    baseUrl = String(qCred.url || '').replace(/\\/$/, '');
    apiKey = qCred.apiKey || qCred.api_key || '';
  } catch (_) {}
  try {
    const o = await this.getCredentials('ollamaApi');
    ollamaBase = String(o.baseUrl || o.host || o.url || '').replace(/\\/$/, '');
  } catch (_) {}
}

if (!baseUrl) {
  baseUrl = String(
    ret.qdrantUrl || envStr('QDRANT_URL') || 'http://127.0.0.1:6333',
  ).replace(/\\/$/, '');
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
  ).replace(/\\/$/, '');
}

const headers = { 'Content-Type': 'application/json' };
if (apiKey) headers['api-key'] = apiKey;

if (!question) {
  return [];
}

const embRes = await httpRequest({
  method: 'POST',
  url: \`\${ollamaBase}/api/embeddings\`,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: OLLAMA_MODEL, prompt: question }),
  json: true,
});
const queryVector = embRes.embedding;
if (!Array.isArray(queryVector) || !queryVector.length) {
  throw new Error('Ollama: embedding vide');
}

const hybridBody = {
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

let points = [];
try {
  const qRes = await httpRequest({
    method: 'POST',
    url: \`\${baseUrl}/collections/\${encodeURIComponent(QDRANT_COLLECTION)}/points/query\`,
    headers,
    body: JSON.stringify(hybridBody),
    json: true,
  });
  const raw = qRes.result?.points ?? qRes.points ?? qRes.result;
  points = Array.isArray(raw) ? raw : [];
} catch (_) {
  try {
    const named = {
      vector: { name: DENSE_VECTOR_NAME, vector: queryVector },
      limit: FINAL_LIMIT,
      with_payload: true,
    };
    const sRes = await httpRequest({
      method: 'POST',
      url: \`\${baseUrl}/collections/\${encodeURIComponent(QDRANT_COLLECTION)}/points/search\`,
      headers,
      body: JSON.stringify(named),
      json: true,
    });
    points = sRes.result ?? [];
  } catch (_) {
    const flat = {
      vector: queryVector,
      limit: FINAL_LIMIT,
      with_payload: true,
    };
    const sRes2 = await httpRequest({
      method: 'POST',
      url: \`\${baseUrl}/collections/\${encodeURIComponent(QDRANT_COLLECTION)}/points/search\`,
      headers,
      body: JSON.stringify(flat),
      json: true,
    });
    points = sRes2.result ?? [];
  }
}

return mapPointsToItems(points);`;

const cohereRerankCode = `function envStr(name) {
  try {
    if (typeof process === 'undefined') return '';
    const pe = process.env;
    if (!pe || typeof pe[name] !== 'string') return '';
    return pe[name];
  } catch (_) {
    return '';
  }
}

const items = $input.all();
if (!items.length) return [];

const b = $('Code in JavaScript3').first().json.body ?? {};
const question =
  (typeof b.chatInput === 'string' && b.chatInput.trim()) ||
  (typeof b.originalQuestion === 'string' && b.originalQuestion.trim()) ||
  '';

const docs = items.map(
  (i) =>
    i.json?.document?.pageContent ||
    i.json?.pageContent ||
    i.json?.text ||
    '',
);

let apiKey = '';
if (typeof this.getCredentials === 'function') {
  try {
    const c = await this.getCredentials('cohereApi');
    apiKey = c.apiKey || c.accessToken || '';
  } catch (_) {}
}
if (!apiKey) apiKey = envStr('COHERE_API_KEY');

if (!apiKey || !question) return items;

const nonEmptyIdx = docs.map((t, i) => (t && String(t).trim() ? i : -1)).filter((i) => i >= 0);
if (!nonEmptyIdx.length) return items;

const toRank = nonEmptyIdx.map((i) => docs[i]);
const maxN = Math.min(10, toRank.length);

const res = await this.helpers.httpRequest.call(this, {
  method: 'POST',
  url: 'https://api.cohere.com/v1/rerank',
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: {
    model: 'rerank-v3.5',
    query: question,
    documents: toRank,
    top_n: maxN,
  },
  timeout: 10000,
  json: true,
});

const results = res.results || [];
if (!results.length) return items;

return results.map((r) => items[nonEmptyIdx[r.index]]).filter(Boolean);`;

const j = JSON.parse(fs.readFileSync(wfPath, "utf8"));

j.nodes = j.nodes.filter(
  (n) =>
    ![
      "Qdrant Vector Store",
      "Embeddings Ollama",
      "Reranker Cohere",
      "Qdrant Hybrid Search",
      "Cohere Rerank HTTP",
    ].includes(n.name),
);

const hybridNode = {
  parameters: { jsCode: hybridCode },
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [512, 1584],
  id: "7f3a2c1e-9b8d-4e7f-a6b5-c4d3e2f1a0b9",
  name: "Qdrant Hybrid Search",
  credentials: {
    qdrantApi: { id: "fdUD8PGs55JXUGZa", name: "QdrantApi account" },
    ollamaApi: { id: "imNsiOICQnbBmguP", name: "Ollama account" },
  },
};

const cohereNode = {
  parameters: { jsCode: cohereRerankCode },
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [640, 1584],
  id: "8e4b3d2f-0c9e-5f8a-b7c6-d5e4f3a2b1c8",
  name: "Cohere Rerank HTTP",
};

j.nodes.unshift(cohereNode);
j.nodes.unshift(hybridNode);

delete j.connections["Qdrant Vector Store"];
delete j.connections["Embeddings Ollama"];
delete j.connections["Reranker Cohere"];

j.connections["Qdrant Hybrid Search"] = {
  main: [[{ node: "Cohere Rerank HTTP", type: "main", index: 0 }]],
};
j.connections["Cohere Rerank HTTP"] = {
  main: [[{ node: "Code in JavaScript", type: "main", index: 0 }]],
};

const js3 = j.connections["Code in JavaScript3"];
if (js3?.main?.[0]?.[0]) {
  js3.main[0][0].node = "Qdrant Hybrid Search";
}

fs.writeFileSync(wfPath, JSON.stringify(j, null, 2), "utf8");
console.log("OK:", wfPath);

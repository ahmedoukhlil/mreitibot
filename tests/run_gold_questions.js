/**
 * Rejoue le jeu de questions gold contre le webhook n8n /chat et compare
 * contentIntent / reportYears / entities / retrieval_strategy réellement
 * observés aux valeurs attendues. Ne valide PAS le contenu textuel de la
 * réponse finale (générée séparément par route.ts/OpenAI) — seulement la
 * couche retrieval/classification, qui est ce que ce script peut vérifier
 * de façon déterministe et rejouable.
 *
 * Usage: node run_gold_questions.js
 */
const fs = require('fs');
const path = require('path');

const WEBHOOK = 'http://153.75.249.154:5678/webhook/chat';
const SET_PATH = path.join(__dirname, 'chafafiya_gold_questions_itie.json');
const OUT_DIR = path.join(__dirname, 'runs');

// Adaptation temporaire : le rapport 2025 n'est pas encore ingéré.
const SKIP_IDS = [5, 7];

function extractHistoryHint(question) {
  const m = question.match(/\[([^\]]+)\]\s*$/);
  return m ? m[1] : null;
}

function stripHistoryHint(question) {
  return question.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
}

async function callWebhook(chatInput, chatHistory) {
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatInput, chatHistory: chatHistory || [] }),
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch (e) {
    return { ok: res.ok, status: res.status, raw: text };
  }
}

function arraysRoughlyEqual(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return null;
  const a = new Set(actual.map((x) => String(x).toUpperCase()));
  const e = new Set(expected.map((x) => String(x).toUpperCase()));
  if (e.size === 0) return a.size === 0;
  for (const v of e) if (!a.has(v)) return false;
  return true;
}

async function main() {
  const set = JSON.parse(fs.readFileSync(SET_PATH, 'utf-8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];

  for (const q of set.questions) {
    if (SKIP_IDS.includes(q.id)) {
      console.log(`[${q.id}] SKIPPED (${q.categorie} - dépend du rapport 2025 non ingéré)`);
      results.push({ id: q.id, skipped: true, reason: '2025 non ingéré' });
      continue;
    }

    const histHint = extractHistoryHint(q.question);
    const chatInput = stripHistoryHint(q.question);

    // Historique synthétique minimal si nécessaire (juste assez pour tester
    // l'héritage de contexte ; ne prétend pas reproduire l'échange exact).
    let chatHistory = [];
    if (q.necessite_historique && histHint) {
      chatHistory = [
        { role: 'user', content: histHint },
        { role: 'assistant', content: 'Réponse précédente (contexte synthétique de test).' },
      ];
    }

    const t0 = Date.now();
    let resp;
    try {
      resp = await callWebhook(chatInput, chatHistory);
    } catch (err) {
      console.log(`[${q.id}] ERROR: ${err.message}`);
      results.push({ id: q.id, error: String(err.message) });
      continue;
    }
    const elapsed = Date.now() - t0;

    if (!resp.ok || !resp.json) {
      console.log(`[${q.id}] HTTP ${resp.status} — pas de JSON exploitable`);
      results.push({ id: q.id, error: `HTTP ${resp.status}`, raw: resp.raw });
      continue;
    }

    const j = resp.json;
    const strategy = j.retrieval_metrics?.retrieval_strategy ?? null;
    const chunksRetrieved = j.chunks_retrieved ?? null;
    const enrichedQuery = j.enriched_query ?? null;
    const contexteLen = (j.contexte || '').length;

    const row = {
      id: q.id,
      categorie: q.categorie,
      question: chatInput,
      elapsed_ms: elapsed,
      retrieval_strategy_observed: strategy,
      retrieval_strategy_attendu: q.retrieval_strategy_attendu,
      chunks_retrieved: chunksRetrieved,
      contexte_length: contexteLen,
      enriched_query: enrichedQuery,
    };

    console.log(
      `[${q.id}] ${q.categorie} | strategy=${strategy} chunks=${chunksRetrieved} ctxLen=${contexteLen} (${elapsed}ms)`,
    );

    results.push(row);

    // Sauvegarde individuelle pour inspection manuelle a posteriori.
    fs.writeFileSync(
      path.join(OUT_DIR, `q${String(q.id).padStart(2, '0')}.json`),
      JSON.stringify(j, null, 2),
    );
  }

  fs.writeFileSync(path.join(OUT_DIR, '_summary.json'), JSON.stringify(results, null, 2));
  console.log(`\nTerminé. ${results.length} questions traitées. Détails dans ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Script d'évaluation gold set — étend run_gold_questions.js avec une vraie
 * vérification numérique (pas seulement retrieval_strategy). Contrairement à
 * run_gold_questions.js qui n'appelle que le webhook n8n /chat (retrieval
 * seul), ce script peut soit :
 *   - vérifier que expected_value apparaît dans le CONTEXTE récupéré (rapide,
 *     ne dépend pas d'un appel OpenAI — valide que le retrieval a bien trouvé
 *     le bon chunk, indépendamment de la qualité de la génération) ;
 *   - avec --full, appeler l'endpoint complet /api/chat (Next.js, retrieval +
 *     génération OpenAI) et vérifier que expected_value apparaît dans le
 *     TEXTE de la réponse générée (plus lent, plus coûteux, mais teste le
 *     pipeline de bout en bout tel que l'utilisateur le vit réellement).
 *
 * Usage:
 *   node eval_gold_set.js            (vérifie contre le contexte retrieval)
 *   node eval_gold_set.js --full     (vérifie contre la réponse générée)
 */
const fs = require('fs');
const path = require('path');

const N8N_WEBHOOK = 'http://153.75.249.154:5678/webhook/chat';
const NEXT_CHAT_URL = process.env.CHAFAFIYA_CHAT_URL || 'http://localhost:3000/api/chat';
const SET_PATH = path.join(__dirname, 'chafafiya_gold_questions_itie.json');
const OUT_DIR = path.join(__dirname, 'runs');

const FULL_MODE = process.argv.includes('--full');

// Rapport 2025 pas encore ingéré au moment de l'écriture de ce script.
const SKIP_IDS = [5, 7];

function extractHistoryHint(question) {
  const m = question.match(/\[([^\]]+)\]\s*$/);
  return m ? m[1] : null;
}

function stripHistoryHint(question) {
  return question.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
}

/**
 * Compare deux nombres avec la même tolérance d'échelle que
 * app/api/chat/route.ts (numberIsVerified) — un chiffre "arrondi" en
 * milliers/millions/milliards du même montant exact doit être accepté,
 * un vrai chiffre différent doit être rejeté.
 */
function normalizeAndValue(raw) {
  const s = String(raw).trim();
  const normalized = s.replace(/[ .,]/g, '');
  const lastSepMatch = s.match(/([ .,])(\d+)$/);
  const value = lastSepMatch
    ? lastSepMatch[1] === ','
      ? parseFloat(s.slice(0, lastSepMatch.index).replace(/[ .,]/g, '') + '.' + lastSepMatch[2])
      : parseFloat(s.replace(/[ .,]/g, ''))
    : parseFloat(s.replace(/[ .,]/g, ''));
  return { normalized, value };
}

const SCALE_FACTORS = [1, 1000, 1_000_000, 1_000_000_000];
const SCALE_TOLERANCE = 0.01;

/** Cherche expected_value (avec tolérance d'échelle) dans un texte libre (contexte ou réponse). */
function textContainsValue(text, expectedRaw) {
  const expected = normalizeAndValue(expectedRaw);
  if (text.includes(expected.normalized)) return true;
  const re = /\b\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d+)?\b|\b\d+[.,]\d+\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const found = normalizeAndValue(m[0]);
    if (found.normalized === expected.normalized) return true;
    for (const scale of SCALE_FACTORS) {
      if (expected.value !== 0 && Math.abs(found.value * scale - expected.value) / expected.value <= SCALE_TOLERANCE) return true;
      if (found.value !== 0 && Math.abs(expected.value * scale - found.value) / found.value <= SCALE_TOLERANCE) return true;
    }
  }
  return false;
}

async function callN8nWebhook(chatInput, chatHistory) {
  const res = await fetch(N8N_WEBHOOK, {
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

/** Appel de bout en bout via l'endpoint Next.js (SSE) — reconstruit le texte complet depuis le flux. */
async function callFullPipeline(chatInput, chatHistory) {
  const res = await fetch(NEXT_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatInput, chatHistory: chatHistory || [] }),
  });
  if (!res.ok || !res.body) return { ok: false, status: res.status, text: '' };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let sources = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const lines = raw.split('\n');
      let eventName = 'message';
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine = line.slice(5).trim();
      }
      if (!dataLine) continue;
      try {
        const payload = JSON.parse(dataLine);
        if (eventName === 'chunk' && payload.text) fullText += payload.text;
        else if (eventName === 'correction' && payload.text) fullText = payload.text;
        else if (eventName === 'done') sources = payload.sources;
      } catch {
        // ligne SSE partielle, ignorée
      }
    }
  }

  return { ok: true, status: res.status, text: fullText, sources };
}

async function main() {
  const set = JSON.parse(fs.readFileSync(SET_PATH, 'utf-8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  const byCategory = {};

  for (const q of set.questions) {
    if (SKIP_IDS.includes(q.id)) {
      console.log(`[${q.id}] SKIPPED (${q.categorie} - dépend du rapport 2025 non ingéré)`);
      results.push({ id: q.id, skipped: true, reason: '2025 non ingéré' });
      continue;
    }

    const histHint = extractHistoryHint(q.question);
    const chatInput = stripHistoryHint(q.question);
    let chatHistory = [];
    if (q.necessite_historique && histHint) {
      chatHistory = [
        { role: 'user', content: histHint },
        { role: 'assistant', content: 'Réponse précédente (contexte synthétique de test).' },
      ];
    }

    const t0 = Date.now();
    let n8nResp;
    try {
      n8nResp = await callN8nWebhook(chatInput, chatHistory);
    } catch (err) {
      console.log(`[${q.id}] ERROR (n8n): ${err.message}`);
      results.push({ id: q.id, error: String(err.message) });
      continue;
    }
    if (!n8nResp.ok || !n8nResp.json) {
      console.log(`[${q.id}] HTTP ${n8nResp.status} (n8n) — pas de JSON exploitable`);
      results.push({ id: q.id, error: `HTTP ${n8nResp.status}`, raw: n8nResp.raw });
      continue;
    }

    const j = n8nResp.json;
    const contexte = j.contexte || '';
    const strategy = j.retrieval_metrics?.retrieval_strategy ?? null;

    let numericCheck = null;
    let fullText = null;
    if (q.expected_value) {
      if (FULL_MODE) {
        try {
          const full = await callFullPipeline(chatInput, chatHistory);
          fullText = full.text;
          numericCheck = { target: 'response_text', found: textContainsValue(fullText, q.expected_value) };
        } catch (err) {
          numericCheck = { target: 'response_text', found: false, error: String(err.message) };
        }
      } else {
        numericCheck = { target: 'retrieval_context', found: textContainsValue(contexte, q.expected_value) };
      }
    }

    const elapsed = Date.now() - t0;
    const row = {
      id: q.id,
      categorie: q.categorie,
      question: chatInput,
      elapsed_ms: elapsed,
      retrieval_strategy_observed: strategy,
      retrieval_strategy_attendu: q.retrieval_strategy_attendu,
      chunks_retrieved: j.chunks_retrieved ?? null,
      contexte_length: contexte.length,
      expected_value: q.expected_value || null,
      numeric_check: numericCheck,
      response_text: fullText,
    };

    const label = numericCheck ? (numericCheck.found ? 'VALEUR_OK' : 'VALEUR_MANQUANTE') : 'pas_de_valeur_attendue';
    console.log(`[${q.id}] ${q.categorie} | strategy=${strategy} | ${label} (${elapsed}ms)`);

    results.push(row);
    byCategory[q.categorie] = byCategory[q.categorie] || { total: 0, ok: 0, checked: 0 };
    byCategory[q.categorie].total += 1;
    if (numericCheck) {
      byCategory[q.categorie].checked += 1;
      if (numericCheck.found) byCategory[q.categorie].ok += 1;
    }

    fs.writeFileSync(
      path.join(OUT_DIR, `eval_q${String(q.id).padStart(2, '0')}.json`),
      JSON.stringify({ ...row, contexte_excerpt: contexte.slice(0, 2000) }, null, 2),
    );
  }

  fs.writeFileSync(path.join(OUT_DIR, '_eval_summary.json'), JSON.stringify(results, null, 2));

  console.log('\n=== Rapport de régression par catégorie ===\n');
  for (const [cat, stats] of Object.entries(byCategory)) {
    const rate = stats.checked > 0 ? `${stats.ok}/${stats.checked} valeurs vérifiées` : 'aucune valeur attendue définie';
    console.log(`${cat}: ${stats.total} questions, ${rate}`);
  }

  console.log(`\nTerminé. ${results.length} questions traitées. Détails dans ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

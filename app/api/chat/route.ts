import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const N8N_WEBHOOK = "http://153.75.249.154:5678/webhook/chat";
const N8N_LOG_WEBHOOK = "http://153.75.249.154:5678/webhook/log-completion";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

interface RagContext {
  response_id: string;
  user_id: string;
  original_question: string;
  enriched_query: string;
  prompt: string;
  question: string;
  contexte: string;
  sources: Record<string, string>;
  retrieval_errors: unknown[];
  retrieval_metrics: Record<string, unknown>;
  chunks_retrieved: number;
  chunks_used: number;
  created_at: string;
}

const FALLBACK_TEXT =
  "Je ne peux pas confirmer cette réponse à partir des extraits fournis. Veuillez reformuler votre question ou préciser le sujet (exigence, norme ITIE, rapport MREITI).";

function maxCitationFromContext(contexte: string): number {
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  let max = 0;
  while ((m = re.exec(contexte)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max;
}

function stripRagMetaParagraphs(text: string): string {
  const chunks = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = chunks.filter((p) => {
    const low = p.toLowerCase();
    if (/^#{0,3}\s*\*{0,2}\s*nota\s+bene\b/i.test(p)) return false;
    if (/^nota\s+bene\s*:/i.test(low)) return false;
    if (/^nb\s*:/i.test(low)) return false;
    if (/^\*{0,2}\s*nota\s+bene\b/i.test(low)) return false;
    return true;
  });
  return kept.join("\n\n").trim();
}

/**
 * Extrait les nombres "significatifs" d'un texte (au moins 3 chiffres, ou
 * décimales) — ignore les petits nombres isolés (numéros de citation [3],
 * années seules "2023") pour ne pas polluer la comparaison avec du bruit.
 * Retourne à la fois la chaîne normalisée (comparaison verbatim, tolérante au
 * formatage espaces/virgules) et la valeur numérique réelle (comparaison par
 * échelle, tolérante à un arrondi légitime en milliers/millions/milliards —
 * ex. "0,72 milliards MRU" pour un exact "720 311 759" du contexte, qui ne
 * partagent aucune sous-chaîne mais représentent le même montant).
 */
interface ExtractedNumber {
  raw: string;
  normalized: string;
  value: number;
}

function extractSignificantNumbers(text: string): ExtractedNumber[] {
  const re = /\b\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d+)?\b|\b\d+[.,]\d+\b/g;
  const out: ExtractedNumber[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const normalized = raw.replace(/[ .,]/g, "");
    if (normalized.length < 3) continue;
    // Valeur numérique réelle : le SÉPARATEUR devant le dernier groupe détermine
    // s'il s'agit d'une décimale ou d'un simple séparateur de milliers — pas sa
    // longueur (un groupe de milliers "075" et une décimale "423" font tous les
    // deux 3 chiffres, donc la longueur seule ne peut pas trancher). Convention
    // des rapports ITIE : virgule = décimale, espace = milliers.
    const lastSepMatch = raw.match(/([ .,])(\d+)$/);
    const value = lastSepMatch
      ? lastSepMatch[1] === ","
        ? parseFloat(raw.slice(0, lastSepMatch.index).replace(/[ .,]/g, "") + "." + lastSepMatch[2])
        : parseFloat(raw.replace(/[ .,]/g, ""))
      : parseFloat(raw.replace(/[ .,]/g, ""));
    if (Number.isFinite(value)) out.push({ raw, normalized, value });
  }
  return out;
}

const SCALE_FACTORS = [1, 1000, 1_000_000, 1_000_000_000];
const SCALE_TOLERANCE = 0.01; // 1% — tolère un arrondi d'affichage, pas un chiffre différent.

/**
 * Un nombre de la réponse est "vérifié" s'il matche verbatim OU à une échelle
 * usuelle (k/M/Md) près un nombre du contexte — dans les DEUX sens, car soit
 * la réponse peut arrondir un montant exact du contexte (ex. réponse "0,72
 * milliards" pour un contexte exact "720 311 759"), soit l'inverse (réponse
 * exacte pour un contexte qui n'affiche que la valeur arrondie en milliards).
 */
function numberIsVerified(candidate: ExtractedNumber, contextNumbers: ExtractedNumber[]): boolean {
  for (const ctx of contextNumbers) {
    if (candidate.normalized === ctx.normalized) return true;
    for (const scale of SCALE_FACTORS) {
      if (ctx.value !== 0) {
        const scaledUp = candidate.value * scale;
        if (Math.abs(scaledUp - ctx.value) / ctx.value <= SCALE_TOLERANCE) return true;
      }
      if (candidate.value !== 0) {
        const scaledDown = ctx.value * scale;
        if (Math.abs(scaledDown - candidate.value) / candidate.value <= SCALE_TOLERANCE) return true;
      }
    }
  }
  return false;
}

function responseQualityWarnings(response: string, contexte: string): string[] {
  const warnings: string[] = [];
  const maxRef = maxCitationFromContext(contexte);
  const citeRe = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  let invalidCitations = 0;
  while ((m = citeRe.exec(response)) !== null) {
    const n = parseInt(m[1], 10);
    if (maxRef > 0 && n > maxRef) invalidCitations++;
  }
  // Une seule citation légèrement hors-plage (ex. décalage d'un cran sur un long
  // contexte multi-chunks) ne justifie pas de jeter toute la réponse : on ne
  // signale une vraie hallucination systématique qu'à partir de 2 occurrences.
  if (invalidCitations >= 2) {
    warnings.push("citation_hors_contexte");
  }
  const low = response.toLowerCase();
  if (/source:\s*blob/.test(low) || /fichier:\s*blob/.test(low)) {
    warnings.push("source_invalide");
  }

  // Garde-fou léger : signale (sans rejeter la réponse) si des montants/chiffres
  // significatifs cités n'apparaissent nulle part dans le contexte documentaire
  // fourni — utile pour repérer les hallucinations de chiffres en monitoring
  // (request_logs) sans risquer de faux positifs sur des chiffres reformatés
  // légitimement (espaces/virgules différentes, ou arrondis en milliers/
  // millions/milliards — cf. numberIsVerified) ni détectés comme une vraie
  // hallucination du nombre lui-même.
  const responseNumbers = extractSignificantNumbers(response);
  if (responseNumbers.length > 0) {
    const contextNumbers = extractSignificantNumbers(contexte);
    const unverified = responseNumbers.filter((n) => !numberIsVerified(n, contextNumbers));
    if (unverified.length > 0) {
      warnings.push("chiffres_non_verifies");
    }
  }

  return warnings;
}

/** Applique le même post-traitement anti-hallucination que l'ancien nœud n8n "Code in JavaScript1". */
function finalizeResponse(rawText: string, contexte: string): { text: string; warnings: string[] } {
  let response = rawText.trim();
  if (!response) {
    return { text: "Désolé, je n'ai pas pu générer de réponse.", warnings: [] };
  }

  const stripped = stripRagMetaParagraphs(response);
  if (stripped.length >= 24) response = stripped;

  const warnings = responseQualityWarnings(response, contexte);
  // "chiffres_non_verifies" reste un signal de monitoring (loggé, visible côté
  // client) : le rejet total avec le message générique n'est déclenché que par
  // des signaux forts (citation hors contexte répétée, source invalide), pour
  // éviter les faux positifs sur des chiffres légitimement calculés/reformatés
  // (sommes de lignes, pourcentages) que ce garde-fou ne peut pas distinguer
  // d'une vraie hallucination.
  const hasStrongWarning = warnings.some((w) => w !== "chiffres_non_verifies");

  if (hasStrongWarning && contexte.length >= 20) {
    return { text: FALLBACK_TEXT, warnings };
  }

  return { text: response, warnings: [] };
}

// Le webhook n8n répond normalement en 2-5s (retrieval Qdrant/Ollama), donc
// ces timeouts n'ont pas besoin d'être longs — les garder courts laisse une
// vraie marge à l'appel OpenAI qui suit sous maxDuration=60 (Vercel). Avec
// 40s+15s=55s précédemment, il ne restait presque rien pour OpenAI dès que
// le premier essai traînait un peu, provoquant un FUNCTION_INVOCATION_TIMEOUT
// Vercel (mort silencieuse, sans même passer par notre gestion d'erreur).
const N8N_TIMEOUT_MS = 15000;
const N8N_RETRY_TIMEOUT_MS = 8000;

async function fetchN8n(body: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  let ragContext: RagContext;
  try {
    let upstream: Response;
    try {
      upstream = await fetchN8n(body, N8N_TIMEOUT_MS);
    } catch {
      // Une latence réseau isolée (egress Vercel <-> VPS) peut faire échouer un premier
      // essai alors que le VPS lui-même répond normalement : on retente une fois, avec un
      // budget plus court pour rester sous maxDuration=60s au total (40s + 15s + marge).
      upstream = await fetchN8n(body, N8N_RETRY_TIMEOUT_MS);
    }
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Recherche RAG indisponible (HTTP ${upstream.status}).` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
    ragContext = await upstream.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Impossible de joindre le serveur n8n." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Clé OpenAI non configurée côté serveur." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let openaiRes: Response;
  try {
    openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        stream: true,
        temperature: 0,
        messages: [{ role: "user", content: ragContext.prompt }],
      }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Impossible de joindre OpenAI." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!openaiRes.ok || !openaiRes.body) {
    const errText = await openaiRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `Erreur OpenAI (HTTP ${openaiRes.status}). ${errText}`.trim() }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = openaiRes.body.getReader();

  let fullText = "";
  let sseBuffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();

      if (done) {
        // Post-traitement anti-hallucination sur le texte complet, puis émission finale.
        const { text: finalText, warnings } = finalizeResponse(fullText, ragContext.contexte);

        if (finalText !== fullText) {
          // La validation a déclenché un remplacement (fallback) : le corriger côté client.
          controller.enqueue(
            encoder.encode(
              `event: correction\ndata: ${JSON.stringify({ text: finalText, warnings })}\n\n`,
            ),
          );
        } else if (warnings.length > 0) {
          controller.enqueue(
            encoder.encode(`event: warning\ndata: ${JSON.stringify({ warnings })}\n\n`),
          );
        }

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ response_id: ragContext.response_id, sources: ragContext.sources })}\n\n`,
          ),
        );
        controller.close();

        // Fire-and-forget: log de la réponse finale (ne bloque jamais le flux utilisateur).
        fetch(N8N_LOG_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_id: ragContext.response_id,
            user_id: ragContext.user_id,
            original_question: ragContext.original_question,
            enriched_query: ragContext.enriched_query,
            response: finalText,
          }),
        }).catch(() => {});

        return;
      }

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            controller.enqueue(
              encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: delta })}\n\n`),
            );
          }
        } catch {
          // ligne SSE partielle/non-JSON, ignorée
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

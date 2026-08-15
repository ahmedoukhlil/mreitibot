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

function responseQualityWarnings(response: string, contexte: string): string[] {
  const warnings: string[] = [];
  const maxRef = maxCitationFromContext(contexte);
  const citeRe = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = citeRe.exec(response)) !== null) {
    const n = parseInt(m[1], 10);
    if (maxRef > 0 && n > maxRef) {
      warnings.push("citation_hors_contexte");
      break;
    }
  }
  const low = response.toLowerCase();
  if (/source:\s*blob/.test(low) || /fichier:\s*blob/.test(low)) {
    warnings.push("source_invalide");
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

  if (warnings.length > 0 && contexte.length >= 20) {
    return { text: FALLBACK_TEXT, warnings };
  }

  return { text: response, warnings: [] };
}

const N8N_TIMEOUT_MS = 25000;

async function fetchN8n(body: string): Promise<Response> {
  return fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  let ragContext: RagContext;
  try {
    let upstream: Response;
    try {
      upstream = await fetchN8n(body);
    } catch {
      // Une latence réseau isolée (egress Vercel <-> VPS) peut faire échouer un premier
      // essai alors que le VPS lui-même répond normalement : on retente une fois.
      upstream = await fetchN8n(body);
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
        temperature: 0.2,
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

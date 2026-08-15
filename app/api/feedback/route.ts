import { NextRequest } from "next/server";

export const runtime = "nodejs";

const N8N_FEEDBACK_WEBHOOK = "http://153.75.249.154:5678/webhook/feedback";

export async function POST(req: NextRequest) {
  let body: { response_id?: string; feedback?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalide." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.response_id || (body.feedback !== "up" && body.feedback !== "down")) {
    return new Response(
      JSON.stringify({ error: "response_id et feedback ('up'|'down') requis." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    await fetch(N8N_FEEDBACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_id: body.response_id, feedback: body.feedback }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Le vote n'est qu'un signal de monitoring : un échec réseau vers n8n
    // ne doit pas remonter d'erreur bloquante à l'utilisateur.
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

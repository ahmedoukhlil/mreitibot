import { NextRequest, NextResponse } from "next/server";

const WEBHOOK = "http://163.245.209.96/webhook/chat";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const upstream = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status });
}

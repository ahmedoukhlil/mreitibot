#!/usr/bin/env python3
"""
Exécute le jeu de questions RAG contre le webhook n8n et écrit un CSV de résultats.

Variables d'environnement (optionnel) :
  RAG_EVAL_WEBHOOK_URL   URL du POST (défaut : http://127.0.0.1:5678/webhook/chat)
  RAG_EVAL_DELAY_SEC     Pause entre requêtes (défaut : 0.5) — limite charge / rate limits
  RAG_EVAL_TIMEOUT_SEC   Timeout HTTP (défaut : 180)

Réglages n8n (côté serveur n8n / Docker) pour ajuster retrieval sans rééditer le JSON :
  RAG_PREFETCH_LIMIT       candidats prefetch hybride (défaut 24)
  RAG_FINAL_LIMIT          points après fusion RRF (défaut 10)
  RAG_RERANK_TOP_N         top_n Cohere rerank (défaut 6)
  RAG_MAX_CONTEXT_CHARS    plafond caractères injectés au LLM (défaut 2400)
  RAG_LLM_MAX_CHUNKS       nombre max d'extraits dans le prompt (défaut 8)
  COHERE_RERANK_ENABLED    false | 0 | off pour désactiver Cohere (passe-through hybride)
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone


def post_json(url: str, body: bytes, timeout: float) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.getcode(), resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        return -1, str(e.reason if hasattr(e, "reason") else e)


def main() -> int:
    p = argparse.ArgumentParser(description="Run RAG eval CSV against n8n webhook")
    p.add_argument(
        "--csv",
        default=os.path.join(os.path.dirname(__file__), "..", "tests", "rag_eval_questions.csv"),
        help="Fichier CSV d'entrée (colonnes id, categorie, question, ...)",
    )
    p.add_argument(
        "--out",
        default="",
        help="CSV de sortie (défaut: tests/rag_eval_results_<timestamp>.csv)",
    )
    p.add_argument(
        "--url",
        default=os.environ.get("RAG_EVAL_WEBHOOK_URL", "http://127.0.0.1:5678/webhook/chat"),
        help="URL webhook chat",
    )
    p.add_argument(
        "--delay",
        type=float,
        default=float(os.environ.get("RAG_EVAL_DELAY_SEC", "0.5")),
        help="Secondes entre chaque requête",
    )
    p.add_argument(
        "--timeout",
        type=float,
        default=float(os.environ.get("RAG_EVAL_TIMEOUT_SEC", "180")),
        help="Timeout HTTP par question",
    )
    args = p.parse_args()

    in_path = os.path.abspath(args.csv)
    if not os.path.isfile(in_path):
        print(f"Fichier introuvable: {in_path}", file=sys.stderr)
        return 1

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = args.out or os.path.join(
        os.path.dirname(in_path), f"rag_eval_results_{ts}.csv"
    )
    out_path = os.path.abspath(out_path)

    import json

    rows_out = []
    with open(in_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        extra = [
            "http_status",
            "latency_ms",
            "reponse_bot",
            "erreur",
            "run_at_utc",
        ]
        out_fields = fieldnames + [c for c in extra if c not in fieldnames]

        for row in reader:
            q = (row.get("question") or "").strip()
            run_at = datetime.now(timezone.utc).isoformat()
            if not q:
                row = {**row, "http_status": "", "latency_ms": "", "reponse_bot": "", "erreur": "question vide", "run_at_utc": run_at}
                rows_out.append({k: row.get(k, "") for k in out_fields})
                continue

            body = json.dumps({"chatInput": q}, ensure_ascii=False).encode("utf-8")
            t0 = time.perf_counter()
            code, text = post_json(args.url, body, args.timeout)
            ms = int((time.perf_counter() - t0) * 1000)

            err = ""
            if code != 200:
                err = f"HTTP {code}" if code >= 0 else text[:500]

            row = {
                **row,
                "http_status": str(code),
                "latency_ms": str(ms),
                "reponse_bot": text if code == 200 else "",
                "erreur": err,
                "run_at_utc": run_at,
            }
            rows_out.append({k: row.get(k, "") for k in out_fields})
            time.sleep(max(0.0, args.delay))

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=out_fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows_out)

    print(f"OK — {len(rows_out)} lignes écrites dans {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Vérifie dans Qdrant que des points contiennent certains mots-clés dans le payload
(ex. « 2.5 », « propriété », « bénéficiaire ») — utile pour valider l’ingestion ITIE.

Prérequis : pip install qdrant-client

Usage (même variables que les autres scripts) :
  set QDRANT_URL=http://127.0.0.1:6333
  python scripts/verify_qdrant_ingestion_keywords.py
  python scripts/verify_qdrant_ingestion_keywords.py --collection documents --limit 5000

Sans Qdrant local, exécutez sur la machine où tourne l’instance (VPS).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from qdrant_hybrid_lib import env_qdrant  # noqa: E402


def payload_text(p: dict) -> str:
    if not isinstance(p, dict):
        return ""
    t = p.get("content") or p.get("page_content") or p.get("text") or ""
    return t if isinstance(t, str) else ""


def main() -> None:
    ap = argparse.ArgumentParser(description="Vérifie mots-clés dans les payloads Qdrant")
    ap.add_argument("--collection", default="documents", help="Nom de la collection")
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Nombre max de points à parcourir (0 = tous via scroll)",
    )
    ap.add_argument(
        "--keywords",
        default="2.5,propriété,propriete,bénéficiaire,beneficiaire,exigence 2",
        help="Mots-clés séparés par des virgules (recherche insensible à la casse)",
    )
    args = ap.parse_args()

    client = env_qdrant()
    kws = [k.strip() for k in args.keywords.split(",") if k.strip()]
    if not kws:
        print("Aucun mot-clé.", file=sys.stderr)
        sys.exit(2)

    patterns = [(kw, re.compile(re.escape(kw), re.IGNORECASE)) for kw in kws]

    scanned = 0
    hits: dict[str, int] = {kw: 0 for kw in kws}
    examples: dict[str, list[str]] = {kw: [] for kw in kws}
    offset = None

    while True:
        batch_limit = 256
        if args.limit > 0:
            remaining = args.limit - scanned
            if remaining <= 0:
                break
            batch_limit = min(batch_limit, remaining)

        points, offset = client.scroll(
            collection_name=args.collection,
            limit=batch_limit,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        if not points:
            break

        for pt in points:
            scanned += 1
            p = pt.payload or {}
            text = payload_text(p)
            meta = p.get("metadata") if isinstance(p.get("metadata"), dict) else {}
            source = (
                meta.get("source")
                or meta.get("file_path")
                or p.get("source")
                or "?"
            )

            for kw, rx in patterns:
                m = rx.search(text)
                if m:
                    hits[kw] += 1
                    if len(examples[kw]) < 3:
                        i0 = m.start()
                        snip = text[i0 : i0 + 180]
                        examples[kw].append(f"  [{source}] …{snip.replace(chr(10), ' ')}…")

        if offset is None:
            break
        if args.limit > 0 and scanned >= args.limit:
            break

    info = client.get_collection(args.collection)
    print(f"Collection : {args.collection}")
    print(f"Points (total index) : {info.points_count}")
    print(f"Points parcourus     : {scanned}")
    print()
    for kw in kws:
        print(f"  « {kw} » : {hits[kw]} point(s) avec correspondance dans content/page_content")
        for line in examples[kw]:
            print(line)
        print()

    missing = [kw for kw in kws if hits[kw] == 0]
    if missing:
        print(
            "Aucune occurrence pour :",
            ", ".join(f"« {m} »" for m in missing),
            file=sys.stderr,
        )
        print(
            "→ Vérifier : PDF bien ingéré, chunking, ou reformuler les mots-clés "
            "(ex. « propriété effective », « divulgation des bénéficiaires »).",
            file=sys.stderr,
        )
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()

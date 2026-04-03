#!/usr/bin/env python3
"""
Réindexe une collection Qdrant pour la recherche hybride (dense Ollama + BM25 intégré).

Le nœud LangChain n8n n'écrit qu'un vecteur dense « anonyme » : il ne remplit pas le
sparse BM25. Ce script reconstruit la collection `documents` avec :
  - vecteur nommé \"dense\" (768 dims, cosinus) — recalculé via Ollama si besoin ;
  - vecteur sparse nommé \"text-bm25\" via Document(text=..., model=\"qdrant/bm25\").

Pour une nouvelle base depuis des PDF, préférez plutôt :
  python scripts/ingest_pdfs_qdrant_hybrid.py --pdf-dir /chemin --replace

Prérequis : pip install qdrant-client requests

Variables d'environnement :
  QDRANT_URL      ex. http://127.0.0.1:6333
  QDRANT_API_KEY  optionnel
  OLLAMA_URL      ex. http://127.0.0.1:11434
  OLLAMA_MODEL    défaut : nomic-embed-text:latest

Usage :
  python scripts/reindex_qdrant_hybrid.py --source documents --replace
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from typing import Any

try:
    from qdrant_client import models
except ImportError:
    print("Installez : pip install qdrant-client", file=sys.stderr)
    sys.exit(1)

from qdrant_hybrid_lib import (
    DENSE_NAME,
    SPARSE_NAME,
    bm25_document,
    create_hybrid_collection,
    env_qdrant,
    normalize_legacy_vector,
    ollama_embed,
)


def scroll_all(
    client: Any, collection: str
) -> list[tuple[Any, dict[str, Any], list[float] | None]]:
    out: list[tuple[Any, dict[str, Any], list[float] | None]] = []
    offset = None
    while True:
        records, offset = client.scroll(
            collection_name=collection,
            limit=128,
            offset=offset,
            with_vectors=True,
            with_payload=True,
        )
        for p in records:
            dense = normalize_legacy_vector(p.vector)
            payload = p.payload or {}
            out.append((p.id, payload, dense))
        if offset is None:
            break
    return out


def main() -> None:
    p = argparse.ArgumentParser(description="Réindexation hybride Qdrant")
    p.add_argument("--source", default="documents", help="Collection source (à lire)")
    p.add_argument(
        "--target",
        default="documents",
        help="Collection cible (recréée si --replace)",
    )
    p.add_argument(
        "--replace",
        action="store_true",
        help="Supprime et recrée la cible puis réécrit tous les points",
    )
    args = p.parse_args()

    client = env_qdrant()

    rows = scroll_all(client, args.source)
    if not rows:
        print(f"Aucun point dans {args.source}", file=sys.stderr)
        sys.exit(2)

    sample_dense = next((d for _id, _pl, d in rows if d), None)
    if sample_dense is None:
        print("Aucun vecteur dense dans la source — recalcul Ollama pour chaque chunk.")
        ref_size = len(ollama_embed("test"))
    else:
        ref_size = len(sample_dense)

    if not args.replace and args.target == args.source:
        print("Utilisez --replace pour réécrire la même collection, ou --target autre_nom.")
        sys.exit(3)

    if args.replace:
        create_hybrid_collection(client, args.target, ref_size)

    batch: list[models.PointStruct] = []
    batch_size = 32

    for pid, payload, dense in rows:
        content = (
            (payload.get("content") if isinstance(payload, dict) else None)
            or (payload.get("text") if isinstance(payload, dict) else None)
            or (payload.get("page_content") if isinstance(payload, dict) else None)
            or ""
        )
        if not str(content).strip():
            continue
        if dense is None:
            dense = ollama_embed(content)
        point_id = pid if isinstance(pid, (str, int)) else str(pid)
        if not isinstance(point_id, (int, str)):
            point_id = str(uuid.uuid4())
        vec: dict[str, Any] = {
            DENSE_NAME: dense,
            SPARSE_NAME: bm25_document(str(content)),
        }
        batch.append(models.PointStruct(id=point_id, vector=vec, payload=payload))
        if len(batch) >= batch_size:
            client.upsert(collection_name=args.target, points=batch, wait=True)
            batch = []

    if batch:
        client.upsert(collection_name=args.target, points=batch, wait=True)

    info = client.get_collection(args.target)
    print(
        json.dumps(
            {
                "ok": True,
                "target": args.target,
                "points_count": info.points_count,
                "vector_size": ref_size,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

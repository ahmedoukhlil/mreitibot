#!/usr/bin/env python3
"""
Ingestion PDF → Qdrant avec le même schéma hybride que RAG-chat :
  - vecteur nommé « dense » (Ollama nomic-embed-text ou OLLAMA_MODEL) ;
  - vecteur sparse « text-bm25 » (Document qdrant/bm25).

Recrée la collection « documents » par défaut (--replace) puis indexe tous les PDF
d'un dossier (récursif). Payload aligné avec le retrieval : content + metadata.

Prérequis :
  pip install qdrant-client requests pypdf

Variables d'environnement (identiques à reindex_qdrant_hybrid.py) :
  QDRANT_URL, QDRANT_API_KEY (optionnel), OLLAMA_URL, OLLAMA_MODEL

Usage (VPS) :
  export QDRANT_URL=http://127.0.0.1:6333
  export OLLAMA_URL=http://127.0.0.1:11434
  python scripts/ingest_pdfs_qdrant_hybrid.py --pdf-dir /root/documents --replace

Sur Windows (PowerShell) :
  $env:QDRANT_URL="http://127.0.0.1:6333"
  python scripts/ingest_pdfs_qdrant_hybrid.py --pdf-dir "C:\\chemin\\vers\\pdfs" --replace
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Any

try:
    from qdrant_client import models
except ImportError:
    print("Installez : pip install qdrant-client", file=sys.stderr)
    sys.exit(1)

try:
    from pypdf import PdfReader
except ImportError:
    print("Installez : pip install pypdf", file=sys.stderr)
    sys.exit(1)

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from qdrant_hybrid_lib import (  # noqa: E402
    DENSE_NAME,
    SPARSE_NAME,
    bm25_document,
    create_hybrid_collection,
    env_qdrant,
    ollama_embed,
)


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        try:
            t = page.extract_text()
        except Exception:
            t = ""
        if t:
            parts.append(t)
    return "\n\n".join(parts)


def chunk_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """
    Fenêtre glissante avec chevauchement — même paramètres que le workflow n8n (2000 / 200).
    Couvre tout le texte extrait sans trou.
    """
    text = text.strip()
    if not text:
        return []
    step = max(1, chunk_size - chunk_overlap)
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start += step
    return chunks


def main() -> None:
    p = argparse.ArgumentParser(
        description="Ingestion PDF vers Qdrant (hybride dense + BM25)"
    )
    p.add_argument(
        "--pdf-dir",
        required=True,
        help="Dossier racine ; tous les **/*.pdf sont indexés",
    )
    p.add_argument(
        "--collection",
        default="documents",
        help="Nom de la collection Qdrant",
    )
    p.add_argument(
        "--replace",
        action="store_true",
        help="Supprime et recrée la collection avec le schéma hybride",
    )
    p.add_argument("--chunk-size", type=int, default=2000)
    p.add_argument("--chunk-overlap", type=int, default=200)
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="N'écrit pas dans Qdrant ; affiche le décompte",
    )
    args = p.parse_args()

    root = Path(args.pdf_dir).resolve()
    if not root.is_dir():
        print(f"Dossier introuvable : {root}", file=sys.stderr)
        sys.exit(2)

    pdfs = sorted(root.rglob("*.pdf"))
    if not pdfs:
        print(f"Aucun PDF sous {root}", file=sys.stderr)
        sys.exit(2)

    client = env_qdrant()
    ref_size = len(ollama_embed("test"))

    if args.dry_run:
        n_chunks = 0
        for pdf in pdfs:
            txt = extract_pdf_text(pdf)
            n_chunks += len(
                chunk_text(txt, args.chunk_size, args.chunk_overlap)
            )
        print(
            json.dumps(
                {
                    "dry_run": True,
                    "pdfs": len(pdfs),
                    "chunks_estime": n_chunks,
                    "collection": args.collection,
                },
                indent=2,
            )
        )
        return

    if not args.replace:
        print(
            "Pour une réingestion propre, utilisez --replace "
            "(supprime la collection puis recrée le schéma hybride).",
            file=sys.stderr,
        )
        sys.exit(3)

    create_hybrid_collection(client, args.collection, ref_size)

    batch: list[models.PointStruct] = []
    batch_size = 32
    total_chunks = 0

    for pdf in pdfs:
        try:
            rel = str(pdf.relative_to(root))
        except ValueError:
            rel = pdf.name
        try:
            raw = extract_pdf_text(pdf)
        except Exception as e:
            print(f"[skip] {pdf}: {e}", file=sys.stderr)
            continue
        chunks = chunk_text(raw, args.chunk_size, args.chunk_overlap)
        for i, chunk in enumerate(chunks):
            dense = ollama_embed(chunk)
            payload: dict[str, Any] = {
                "content": chunk,
                "page_content": chunk,
                "metadata": {
                    "source": pdf.name,
                    "file_path": rel,
                    "type": "pdf",
                    "chunk_index": i,
                },
            }
            vec: dict[str, Any] = {
                DENSE_NAME: dense,
                SPARSE_NAME: bm25_document(chunk),
            }
            batch.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vec,
                    payload=payload,
                )
            )
            total_chunks += 1
            if len(batch) >= batch_size:
                client.upsert(
                    collection_name=args.collection, points=batch, wait=True
                )
                batch = []

    if batch:
        client.upsert(collection_name=args.collection, points=batch, wait=True)

    info = client.get_collection(args.collection)
    print(
        json.dumps(
            {
                "ok": True,
                "collection": args.collection,
                "pdfs": len(pdfs),
                "chunks_upserted": total_chunks,
                "points_count": info.points_count,
                "vector_size": ref_size,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

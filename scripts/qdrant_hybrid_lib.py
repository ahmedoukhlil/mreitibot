"""
Utilitaires partagés : schéma hybride Qdrant (dense + BM25) aligné avec RAG-chat.
"""
from __future__ import annotations

import os
from typing import Any

import requests

try:
    from qdrant_client import QdrantClient, models
except ImportError:
    QdrantClient = None  # type: ignore
    models = None  # type: ignore

DENSE_NAME = "dense"
SPARSE_NAME = "text-bm25"


def env_qdrant() -> "QdrantClient":
    if QdrantClient is None:
        raise RuntimeError("Installez : pip install qdrant-client")
    url = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333").rstrip("/")
    key = os.environ.get("QDRANT_API_KEY") or os.environ.get("QDRANT_KEY")
    return QdrantClient(url=url, api_key=key or None)


def ollama_embed(text: str) -> list[float]:
    base = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.environ.get("OLLAMA_MODEL", "nomic-embed-text:latest")
    r = requests.post(
        f"{base}/api/embeddings",
        json={"model": model, "prompt": text},
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    emb = data.get("embedding")
    if not isinstance(emb, list) or not emb:
        raise RuntimeError("Réponse Ollama embeddings invalide")
    return emb


def create_hybrid_collection(client: QdrantClient, collection: str, vector_size: int) -> None:
    exists_fn = getattr(client, "collection_exists", None)
    if exists_fn is not None:
        exists = exists_fn(collection_name=collection)
    else:
        names = [c.name for c in client.get_collections().collections]
        exists = collection in names
    if exists:
        client.delete_collection(collection_name=collection)
    client.create_collection(
        collection_name=collection,
        vectors_config={
            DENSE_NAME: models.VectorParams(
                size=vector_size, distance=models.Distance.COSINE
            )
        },
        sparse_vectors_config={
            SPARSE_NAME: models.SparseVectorParams(modifier=models.Modifier.IDF),
        },
    )


def normalize_legacy_vector(vec: Any) -> list[float] | None:
    if vec is None:
        return None
    if isinstance(vec, list):
        return vec
    if isinstance(vec, dict):
        if DENSE_NAME in vec and isinstance(vec[DENSE_NAME], list):
            return vec[DENSE_NAME]
        for _k, v in vec.items():
            if isinstance(v, list) and v and isinstance(v[0], (int, float)):
                return v
    return None


def bm25_document(text: str) -> Any:
    """Vecteur sparse côté serveur Qdrant (même convention que la query hybride n8n / RAG-chat)."""
    return models.Document(
        model="qdrant/bm25",
        text=str(text),
        options={"language": "french"},
    )

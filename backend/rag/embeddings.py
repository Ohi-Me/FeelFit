"""
FeelFit Medical RAG 2.0 — Embeddings

Embedder protocol + an offline, dependency-free default implementation.

The default `HashingEmbedder` produces deterministic vectors from word tokens
and character trigrams hashed into a fixed-dimension space. It needs no model
download, no API key, and no numpy — so the whole RAG stack boots anywhere.

For production, swap in a real medical embedding model (e.g. a BioLORD /
PubMedBERT sentence encoder, or a hosted embedding API) by implementing the
`Embedder` protocol and registering it with the vector store. Nothing else in
the pipeline changes.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from typing import List, Protocol, runtime_checkable

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


def _char_ngrams(token: str, n: int = 3) -> List[str]:
    t = f"#{token}#"
    if len(t) <= n:
        return [t]
    return [t[i : i + n] for i in range(len(t) - n + 1)]


@runtime_checkable
class Embedder(Protocol):
    dim: int

    def embed(self, text: str) -> List[float]: ...

    def embed_batch(self, texts: List[str]) -> List[List[float]]: ...


class HashingEmbedder:
    """
    Deterministic offline embedder (feature-hashing / "hashing trick").

    Combines whole-word features with character trigrams so that lexical
    variants ("haemoglobin" vs "hemoglobin", "HbA1c" vs "hba1c") land close
    together in vector space — a reasonable stand-in for semantic similarity
    on short clinical strings, with zero dependencies.
    """

    def __init__(self, dim: int = 512):
        self.dim = dim

    def _hash(self, feature: str) -> int:
        h = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        return int.from_bytes(h, "big")

    def embed(self, text: str) -> List[float]:
        vec = [0.0] * self.dim
        toks = _tokens(text)
        if not toks:
            return vec
        for tok in toks:
            features = [f"w:{tok}"] + [f"g:{g}" for g in _char_ngrams(tok)]
            for feat in features:
                hv = self._hash(feat)
                idx = hv % self.dim
                sign = 1.0 if (hv >> 1) & 1 else -1.0
                vec[idx] += sign
        # L2 normalize so cosine == dot product
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed(t) for t in texts]


class SentenceTransformerEmbedder:
    """
    Production embedder backed by a sentence-transformers model.

    Lazy-imports the library so the package still loads when it isn't installed.
    Recommended clinical models: `pritamdeka/S-PubMedBert-MS-MARCO`,
    `FremyCompany/BioLORD-2023`, or a general `all-MiniLM-L6-v2` for a light start.

        pip install sentence-transformers
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
        except Exception as e:  # pragma: no cover - optional dep
            raise RuntimeError(
                "sentence-transformers is not installed. "
                "`pip install sentence-transformers` or use HashingEmbedder."
            ) from e
        self._model = SentenceTransformer(model_name)
        self.dim = int(self._model.get_sentence_embedding_dimension())

    def embed(self, text: str) -> List[float]:
        return [float(x) for x in self._model.encode(text, normalize_embeddings=True)]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        vecs = self._model.encode(texts, normalize_embeddings=True)
        return [[float(x) for x in v] for v in vecs]


def get_default_embedder() -> Embedder:
    """
    Select an embedder from env:
        RAG_EMBEDDER=hashing (default) | sentence-transformers
        RAG_EMBED_MODEL=<model name>   (for sentence-transformers)
    Falls back to the offline HashingEmbedder if the model can't load.
    """
    kind = os.environ.get("RAG_EMBEDDER", "hashing").lower()
    if kind in ("st", "sentence-transformers", "sentence_transformers"):
        model = os.environ.get("RAG_EMBED_MODEL", "all-MiniLM-L6-v2")
        try:
            return SentenceTransformerEmbedder(model)
        except Exception:
            pass
    return HashingEmbedder()


def cosine(a: List[float], b: List[float]) -> float:
    """Cosine similarity for already-or-not-normalized vectors."""
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)

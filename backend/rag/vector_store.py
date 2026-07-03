"""
FeelFit Medical RAG 2.0 — Vector Store

VectorStore protocol + an in-memory cosine implementation.

The in-memory store is the default so the stack runs with no infrastructure.
The `VectorStore` protocol is the seam where you plug in a real backend:

    PostgreSQL + pgvector | Qdrant | Weaviate | Milvus | Pinecone

To add one, implement `upsert` / `search` against the external index and keep
the same return shape. The retriever and orchestrator are agnostic to the
backend.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol, Tuple

from .embeddings import Embedder, HashingEmbedder, cosine, get_default_embedder
from .types import KnowledgeDoc, SourceKind


# ── (de)serialization shared by external stores ──────────────────────────────
def doc_to_payload(doc: KnowledgeDoc) -> Dict[str, Any]:
    return {
        "id": doc.id,
        "source": doc.source.value,
        "title": doc.title,
        "text": doc.text,
        "metadata": doc.metadata,
        "keywords": doc.keywords,
        "version": doc.version,
    }


def payload_to_doc(p: Dict[str, Any]) -> KnowledgeDoc:
    return KnowledgeDoc(
        id=p["id"],
        source=SourceKind(p["source"]),
        title=p["title"],
        text=p["text"],
        metadata=p.get("metadata") or {},
        keywords=p.get("keywords") or [],
        version=p.get("version", "unversioned"),
    )


@dataclass
class _Entry:
    doc: KnowledgeDoc
    vector: List[float]


class VectorStore(Protocol):
    def upsert(self, docs: List[KnowledgeDoc]) -> None: ...

    def search(self, query: str, top_k: int = 5) -> List[Tuple[KnowledgeDoc, float]]: ...

    def __len__(self) -> int: ...


class InMemoryVectorStore:
    """Brute-force cosine search. Fine for tens of thousands of short docs."""

    def __init__(self, embedder: Optional[Embedder] = None):
        self.embedder: Embedder = embedder or HashingEmbedder()
        self._entries: List[_Entry] = []
        self._ids: set[str] = set()

    def upsert(self, docs: List[KnowledgeDoc]) -> None:
        for doc in docs:
            vec = self.embedder.embed(doc.search_blob())
            if doc.id in self._ids:
                for e in self._entries:
                    if e.doc.id == doc.id:
                        e.doc, e.vector = doc, vec
                        break
            else:
                self._entries.append(_Entry(doc=doc, vector=vec))
                self._ids.add(doc.id)

    def search(self, query: str, top_k: int = 5) -> List[Tuple[KnowledgeDoc, float]]:
        if not self._entries:
            return []
        qv = self.embedder.embed(query)
        scored = [(e.doc, cosine(qv, e.vector)) for e in self._entries]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [(d, s) for d, s in scored[:top_k] if s > 0]

    def __len__(self) -> int:
        return len(self._entries)


# ── Qdrant (production) ───────────────────────────────────────────────────────
class QdrantVectorStore:
    """
    Qdrant-backed store. Lazy-imports qdrant-client so the package loads without it.

        pip install qdrant-client
        env: QDRANT_URL (default http://localhost:6333), QDRANT_COLLECTION
    """

    def __init__(self, embedder: Optional[Embedder] = None, collection: str = "feelfit_medical"):
        try:
            from qdrant_client import QdrantClient  # type: ignore
            from qdrant_client.models import Distance, VectorParams  # type: ignore
        except Exception as e:  # pragma: no cover - optional dep
            raise RuntimeError("qdrant-client not installed. `pip install qdrant-client`.") from e
        self.embedder = embedder or get_default_embedder()
        self.collection = os.environ.get("QDRANT_COLLECTION", collection)
        self._client = QdrantClient(url=os.environ.get("QDRANT_URL", "http://localhost:6333"))
        if not self._client.collection_exists(self.collection):
            self._client.create_collection(
                self.collection,
                vectors_config=VectorParams(size=self.embedder.dim, distance=Distance.COSINE),
            )

    def upsert(self, docs: List[KnowledgeDoc]) -> None:
        from qdrant_client.models import PointStruct  # type: ignore
        points = [
            PointStruct(id=abs(hash(d.id)) % (10 ** 18),
                        vector=self.embedder.embed(d.search_blob()),
                        payload=doc_to_payload(d))
            for d in docs
        ]
        self._client.upsert(self.collection, points=points)

    def search(self, query: str, top_k: int = 5) -> List[Tuple[KnowledgeDoc, float]]:
        hits = self._client.search(
            self.collection, query_vector=self.embedder.embed(query), limit=top_k,
        )
        return [(payload_to_doc(h.payload), float(h.score)) for h in hits if h.payload]

    def __len__(self) -> int:
        try:
            return int(self._client.count(self.collection).count)
        except Exception:
            return 0


# ── PostgreSQL + pgvector (production) ────────────────────────────────────────
class PgVectorStore:
    """
    PostgreSQL + pgvector store. Lazy-imports psycopg so the package loads without it.

        pip install "psycopg[binary]" pgvector   (and CREATE EXTENSION vector;)
        env: DATABASE_URL, PGVECTOR_TABLE (default feelfit_medical)
    """

    def __init__(self, embedder: Optional[Embedder] = None, table: str = "feelfit_medical"):
        try:
            import psycopg  # type: ignore  # noqa: F401
        except Exception as e:  # pragma: no cover - optional dep
            raise RuntimeError('psycopg not installed. `pip install "psycopg[binary]" pgvector`.') from e
        self.embedder = embedder or get_default_embedder()
        self.table = os.environ.get("PGVECTOR_TABLE", table)
        self.dsn = os.environ["DATABASE_URL"]
        self._ensure_schema()

    def _conn(self):
        import psycopg  # type: ignore
        return psycopg.connect(self.dsn)

    def _ensure_schema(self) -> None:
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            cur.execute(
                f"CREATE TABLE IF NOT EXISTS {self.table} ("
                f"id text PRIMARY KEY, payload jsonb, embedding vector({self.embedder.dim}));"
            )
            conn.commit()

    def upsert(self, docs: List[KnowledgeDoc]) -> None:
        import json
        with self._conn() as conn, conn.cursor() as cur:
            for d in docs:
                vec = self.embedder.embed(d.search_blob())
                cur.execute(
                    f"INSERT INTO {self.table} (id, payload, embedding) VALUES (%s, %s, %s) "
                    f"ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, embedding = EXCLUDED.embedding;",
                    (d.id, json.dumps(doc_to_payload(d)), str(vec)),
                )
            conn.commit()

    def search(self, query: str, top_k: int = 5) -> List[Tuple[KnowledgeDoc, float]]:
        vec = str(self.embedder.embed(query))
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT payload, 1 - (embedding <=> %s) AS score FROM {self.table} "
                f"ORDER BY embedding <=> %s LIMIT %s;",
                (vec, vec, top_k),
            )
            rows = cur.fetchall()
        return [(payload_to_doc(p), float(s)) for p, s in rows]

    def __len__(self) -> int:
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM {self.table};")
            return int(cur.fetchone()[0])


def get_default_store(embedder: Optional[Embedder] = None) -> "VectorStore":
    """
    Select a vector store from env:
        RAG_VECTOR_STORE=memory (default) | qdrant | pgvector
    Falls back to in-memory if the chosen backend can't initialize.
    """
    kind = os.environ.get("RAG_VECTOR_STORE", "memory").lower()
    emb = embedder or get_default_embedder()
    try:
        if kind == "qdrant":
            return QdrantVectorStore(emb)
        if kind in ("pgvector", "postgres", "pg"):
            return PgVectorStore(emb)
    except Exception:
        pass
    return InMemoryVectorStore(emb)

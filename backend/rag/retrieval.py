"""
FeelFit Medical RAG 2.0 — Hybrid Retriever

Per the spec: "Do not use only vector search." This fuses several signals:

    Semantic search   — vector cosine (subword-aware embeddings)
    Keyword search    — token overlap on the doc search blob
    Metadata search   — exact filters (loinc code, specialty, category)
    Ontology search   — alias / keyword hit (clinical synonyms)

Results are combined with Reciprocal Rank Fusion (RRF), which merges ranked
lists robustly without needing the individual scorers to share a scale.
"""
from __future__ import annotations

import re
from typing import Dict, List

from .types import KnowledgeDoc, RetrievalQuery, RetrievedDoc, SourceKind
from .vector_store import VectorStore

_RRF_K = 60  # standard RRF damping constant
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _toks(text: str) -> set:
    return set(_TOKEN_RE.findall(text.lower()))


class HybridRetriever:
    """Fuses semantic + keyword + metadata + ontology retrieval over a store."""

    def __init__(self, store: VectorStore):
        self.store = store
        self._docs: List[KnowledgeDoc] = []

    def index(self, docs: List[KnowledgeDoc]) -> None:
        self.store.upsert(docs)
        # keep a handle for the lexical / metadata scorers
        known = {d.id for d in self._docs}
        self._docs.extend(d for d in docs if d.id not in known)

    # ── individual rankers (return ordered doc-id lists) ─────────────────────
    def _semantic(self, query: str, k: int) -> List[str]:
        return [d.id for d, _ in self.store.search(query, top_k=k)]

    def _keyword(self, query: str, k: int) -> List[str]:
        q = _toks(query)
        if not q:
            return []
        scored = []
        for d in self._docs:
            overlap = len(q & _toks(d.search_blob()))
            if overlap:
                scored.append((d.id, overlap))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [doc_id for doc_id, _ in scored[:k]]

    def _ontology(self, query: str, k: int) -> List[str]:
        ql = query.lower()
        hits = []
        for d in self._docs:
            if any(kw and kw in ql for kw in d.keywords) or any(kw and ql in kw for kw in d.keywords):
                hits.append(d.id)
        return hits[:k]

    def _metadata(self, query: RetrievalQuery, k: int) -> List[str]:
        """Exact filters: match conditions/specialty mentioned in the query context."""
        wanted = {c.lower() for c in query.conditions}
        if not wanted:
            return []
        hits = []
        for d in self._docs:
            spec = str(d.metadata.get("specialty", "")).lower()
            cat = str(d.metadata.get("category", "")).lower()
            if spec in wanted or cat in wanted or any(w in (spec + " " + cat) for w in wanted):
                hits.append(d.id)
        return hits[:k]

    # ── fusion ───────────────────────────────────────────────────────────────
    def retrieve(self, query: RetrievalQuery) -> List[RetrievedDoc]:
        k = max(query.top_k * 3, 10)
        ranked_lists: Dict[str, List[str]] = {
            "semantic": self._semantic(query.text, k),
            "keyword": self._keyword(query.text, k),
            "ontology": self._ontology(query.text, k),
            "metadata": self._metadata(query, k),
        }

        fused: Dict[str, float] = {}
        matched: Dict[str, List[str]] = {}
        for name, ids in ranked_lists.items():
            for rank, doc_id in enumerate(ids):
                fused[doc_id] = fused.get(doc_id, 0.0) + 1.0 / (_RRF_K + rank + 1)
                matched.setdefault(doc_id, []).append(name)

        if not fused:
            return []

        by_id = {d.id: d for d in self._docs}
        # normalize fused scores to [0,1] for a readable confidence signal
        max_score = max(fused.values())
        out: List[RetrievedDoc] = []
        for doc_id, score in sorted(fused.items(), key=lambda x: x[1], reverse=True):
            doc = by_id.get(doc_id)
            if not doc:
                continue
            if query.sources and doc.source not in query.sources:
                continue
            out.append(RetrievedDoc(
                doc=doc,
                score=score / max_score if max_score else 0.0,
                retriever="hybrid",
                matched_on=matched.get(doc_id, []),
            ))
            if len(out) >= query.top_k:
                break
        return out

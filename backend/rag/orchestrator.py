"""
FeelFit Medical RAG 2.0 — Orchestrator

Ties the pieces together into one queryable Medical Knowledge Engine:

    sources → embeddings → vector store → hybrid retriever
            + knowledge graph
            → multi-layer retrieval → EvidenceBundle (confidence + citations)

Usage:
    rag = get_rag()                      # process-wide singleton, lazily built
    bundle = rag.retrieve("HbA1c 6.7%", age=52, gender="male")
    prompt_block = bundle.to_prompt_block()

The whole stack is offline-capable: it indexes the local LOINC KB + seed
knowledge + knowledge-graph paths at startup with the dependency-free hashing
embedder, so it works with no external services. Swap the embedder/vector store
(see embeddings.py / vector_store.py) for production scale.
"""
from __future__ import annotations

import asyncio
import logging
import os
import threading
from typing import List, Optional

from .knowledge_graph import MedicalKnowledgeGraph
from .layers import DEFAULT_LAYERS, RetrievalLayer
from .retrieval import HybridRetriever
from .sources import load_all
from .types import EvidenceBundle, KnowledgeDoc, RetrievalQuery, RetrievedDoc, SourceKind
from .vector_store import get_default_store

logger = logging.getLogger("feelfit.rag")


def _live_meds_enabled() -> bool:
    return os.environ.get("RAG_LIVE_MEDS", "").lower() in ("1", "true", "yes", "on")


class MedicalRAG:
    def __init__(self, layers: Optional[List[RetrievalLayer]] = None):
        self.layers = layers or DEFAULT_LAYERS
        self.graph = MedicalKnowledgeGraph()
        self.retriever = HybridRetriever(get_default_store())
        self._indexed = False

    def index(self) -> "MedicalRAG":
        if self._indexed:
            return self
        docs = load_all()
        docs.extend(self.graph.as_docs())
        self.retriever.index(docs)
        self._indexed = True
        logger.info(f"MedicalRAG indexed {len(docs)} knowledge docs across "
                    f"{len(self.layers)} layers")
        return self

    def retrieve(
        self,
        text: str,
        *,
        top_k: int = 4,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        conditions: Optional[List[str]] = None,
        medications: Optional[List[str]] = None,
    ) -> EvidenceBundle:
        if not self._indexed:
            self.index()
        base = RetrievalQuery(
            text=text,
            top_k=top_k,
            age=age,
            gender=gender,
            conditions=conditions or [],
            medications=medications or [],
        )
        bundle = EvidenceBundle(query=text)
        for layer in self.layers:
            bundle.layers[layer.name] = layer.retrieve(self.retriever, base)
        return bundle

    async def aretrieve(
        self,
        text: str,
        *,
        top_k: int = 4,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        conditions: Optional[List[str]] = None,
        medications: Optional[List[str]] = None,
        live: Optional[bool] = None,
    ) -> EvidenceBundle:
        """
        Async retrieval that optionally augments the medication layer with LIVE
        OpenFDA + RxNorm data for the patient's current medications.

        Gated by `live` (defaults to the RAG_LIVE_MEDS env flag). When off or on
        failure, returns the same offline bundle as `retrieve()` — additive only.
        """
        bundle = self.retrieve(
            text, top_k=top_k, age=age, gender=gender,
            conditions=conditions, medications=medications,
        )
        use_live = _live_meds_enabled() if live is None else live
        if use_live and medications:
            try:
                live_docs = await self._live_medication_docs(medications)
                if live_docs:
                    existing = bundle.layers.get("medication", [])
                    bundle.layers["medication"] = live_docs + existing
            except Exception as e:  # network / import — stay graceful
                logger.warning(f"Live medication retrieval skipped: {e}")
        return bundle

    async def _live_medication_docs(self, medications: List[str]) -> List[RetrievedDoc]:
        """Fetch live drug intelligence per medication and wrap as RetrievedDocs."""
        from services.medicine_live_service import get_live_medicine_info

        meds = [m.strip() for m in medications if m and m.strip()][:5]
        if not meds:
            return []
        results = await asyncio.gather(
            *(get_live_medicine_info(m) for m in meds), return_exceptions=True
        )
        docs: List[RetrievedDoc] = []
        for med, info in zip(meds, results):
            if isinstance(info, Exception) or not isinstance(info, dict):
                continue
            if info.get("confidence", 0) < 0.5:
                continue
            uses = ", ".join(info.get("commonly_used_for", [])[:3])
            warns = "; ".join(info.get("general_warnings", [])[:2])
            text = (
                f"{info.get('name', med)} "
                f"({info.get('drug_class') or info.get('drug_category', 'medication')}). "
                f"Used for: {uses or 'n/a'}. "
                f"{info.get('how_it_works', '')} "
                f"Warnings: {warns or 'see label'}. "
                f"Sources: {', '.join(info.get('sources', []))}."
            ).strip()
            doc = KnowledgeDoc(
                id=f"drug-live:{med.lower()}",
                source=SourceKind.RXNORM,
                title=f"{info.get('name', med)} (live OpenFDA/RxNorm)",
                text=text,
                keywords=[med.lower()],
                metadata={"rxcui": info.get("rxcui"), "live": True},
                version="rxnorm-openfda-live",
            )
            docs.append(RetrievedDoc(
                doc=doc,
                score=float(info.get("confidence", 0.9)),
                retriever="live_api",
                matched_on=["live"],
            ))
        return docs


# ── Process-wide singleton ────────────────────────────────────────────────────
_rag: Optional[MedicalRAG] = None
_lock = threading.Lock()


def get_rag() -> MedicalRAG:
    global _rag
    if _rag is None:
        with _lock:
            if _rag is None:
                _rag = MedicalRAG().index()
    return _rag

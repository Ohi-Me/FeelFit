"""
FeelFit Medical RAG 2.0 — Core Types

Shared dataclasses for the retrieval-augmented medical intelligence layer.

Design principle (see RAG_ARCHITECTURE.md):
    LLM  = Reasoning Engine
    RAG  = Medical Knowledge Engine
Knowledge must always come from retrieval; reasoning comes from the LLM.

Every value here is plain stdlib so the module imports and runs without any
external dependency (no numpy / no vector DB required to boot).
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class SourceKind(str, Enum):
    """Trusted medical knowledge source families."""
    LOINC = "loinc"            # laboratory test standards
    SNOMED = "snomed_ct"       # clinical terminology
    ICD = "icd"                # diagnosis classification (ICD-10 / ICD-11)
    RXNORM = "rxnorm"          # medication normalization
    DRUG = "drug"              # DrugBank / OpenFDA / DailyMed
    RESEARCH = "research"      # PubMed / NIH / WHO / CDC / guidelines
    INDIAN = "indian_health"   # ICMR / CDSCO / Ayushman Bharat
    GRAPH = "knowledge_graph"  # derived relationships


@dataclass
class KnowledgeDoc:
    """A single retrievable unit of medical knowledge."""
    id: str
    source: SourceKind
    title: str
    text: str                                  # the embeddable / searchable body
    metadata: Dict[str, Any] = field(default_factory=dict)
    keywords: List[str] = field(default_factory=list)   # for keyword + ontology search
    version: str = "unversioned"

    def search_blob(self) -> str:
        """Concatenated text used for keyword / lexical matching."""
        return " ".join([self.title, self.text, " ".join(self.keywords)]).lower()


@dataclass
class RetrievedDoc:
    """A KnowledgeDoc returned by retrieval, with provenance + score."""
    doc: KnowledgeDoc
    score: float                               # fused relevance, higher = better
    retriever: str = "hybrid"                  # which retriever surfaced it
    matched_on: List[str] = field(default_factory=list)  # semantic|keyword|metadata|ontology

    def citation(self) -> "Citation":
        return Citation(
            doc_id=self.doc.id,
            source=self.doc.source.value,
            title=self.doc.title,
            version=self.doc.version,
            score=round(self.score, 4),
        )


@dataclass
class Citation:
    """Transparent provenance shown to the user (Confidence Engine)."""
    doc_id: str
    source: str
    title: str
    version: str
    score: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "source": self.source,
            "title": self.title,
            "version": self.version,
            "score": self.score,
        }


@dataclass
class RetrievalQuery:
    """A retrieval request. Personalized RAG fields are optional context."""
    text: str
    top_k: int = 5
    sources: Optional[List[SourceKind]] = None     # restrict to specific families
    # ── Personalization context (Personalized RAG) ──────────────────────────
    age: Optional[int] = None
    gender: Optional[str] = None
    country: Optional[str] = "IN"
    conditions: List[str] = field(default_factory=list)
    medications: List[str] = field(default_factory=list)

    def personalization_blob(self) -> str:
        bits: List[str] = []
        if self.age:
            bits.append(f"age {self.age}")
        if self.gender:
            bits.append(self.gender)
        if self.conditions:
            bits.append("conditions: " + ", ".join(self.conditions))
        if self.medications:
            bits.append("medications: " + ", ".join(self.medications))
        return " ; ".join(bits)


@dataclass
class EvidenceBundle:
    """
    The output of the multi-layer RAG orchestrator.

    This is the "Confidence Engine" + "Explainable AI Layer" envelope: every
    insight the LLM produces can point back to the evidence captured here.
    """
    query: str
    layers: Dict[str, List[RetrievedDoc]] = field(default_factory=dict)
    knowledge_version: str = "feelfit-kb-2.0"
    retrieved_at: float = field(default_factory=time.time)

    # ── Aggregate views ─────────────────────────────────────────────────────
    def all_docs(self) -> List[RetrievedDoc]:
        out: List[RetrievedDoc] = []
        for docs in self.layers.values():
            out.extend(docs)
        return out

    def citations(self) -> List[Citation]:
        return [r.citation() for r in self.all_docs()]

    def confidence(self) -> float:
        """
        Heuristic confidence from retrieval quality:
          - mean top score across layers (evidence strength)
          - layer coverage (how many layers returned anything)
        Bounded to [0, 1]. The LLM should never exceed this when it lacks
        retrieved support.
        """
        docs = self.all_docs()
        if not docs:
            return 0.0
        top_scores = [max(r.score for r in d) for d in self.layers.values() if d]
        strength = sum(top_scores) / len(top_scores) if top_scores else 0.0
        coverage = len([d for d in self.layers.values() if d]) / max(1, len(self.layers))
        return round(min(1.0, 0.65 * min(1.0, strength) + 0.35 * coverage), 3)

    def validation_status(self) -> str:
        c = self.confidence()
        if c >= 0.7:
            return "evidence_supported"
        if c >= 0.4:
            return "partial_evidence"
        return "insufficient_evidence"

    # ── Rendering ────────────────────────────────────────────────────────────
    def to_prompt_block(self, max_per_layer: int = 3, max_chars: int = 4000) -> str:
        """
        Render retrieved evidence as a grounding block for the LLM prompt.
        The LLM is instructed to reason *only* from this retrieved knowledge.
        """
        lines: List[str] = ["═══ RETRIEVED MEDICAL EVIDENCE (ground your reasoning ONLY in this):"]
        for layer, docs in self.layers.items():
            if not docs:
                continue
            lines.append(f"\n[{layer.upper()}]")
            for r in docs[:max_per_layer]:
                src = r.doc.source.value
                lines.append(f"- ({src}) {r.doc.title}: {r.doc.text}")
        blob = "\n".join(lines)
        return blob[:max_chars]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "knowledge_version": self.knowledge_version,
            "retrieved_at": self.retrieved_at,
            "confidence": self.confidence(),
            "validation_status": self.validation_status(),
            "layers": {
                name: [
                    {
                        "id": r.doc.id,
                        "source": r.doc.source.value,
                        "title": r.doc.title,
                        "text": r.doc.text,
                        "score": round(r.score, 4),
                        "matched_on": r.matched_on,
                    }
                    for r in docs
                ]
                for name, docs in self.layers.items()
            },
            "citations": [c.to_dict() for c in self.citations()],
        }

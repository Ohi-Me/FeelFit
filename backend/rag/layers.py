"""
FeelFit Medical RAG 2.0 — Multi-Layer Retrieval

The five retrieval layers from the spec. Each layer is the same hybrid
retriever scoped to the source families relevant to its purpose, so adding a
real data source (e.g. RxNorm for the medication layer) automatically lights up
the corresponding layer with zero orchestration changes.

    Layer 1  LOINC Retrieval       → exact laboratory test meaning
    Layer 2  Medication Retrieval  → drug info, interactions, warnings
    Layer 3  Disease Retrieval     → condition context, guidelines, risks
    Layer 4  Specialist Retrieval  → finding → specialist mapping
    Layer 5  Research Retrieval    → latest evidence / guidelines
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from .retrieval import HybridRetriever
from .types import RetrievalQuery, RetrievedDoc, SourceKind


@dataclass
class RetrievalLayer:
    name: str
    sources: List[SourceKind]
    top_k: int = 4

    def retrieve(self, retriever: HybridRetriever, base: RetrievalQuery) -> List[RetrievedDoc]:
        q = RetrievalQuery(
            text=base.text,
            top_k=self.top_k,
            sources=self.sources,
            age=base.age,
            gender=base.gender,
            country=base.country,
            conditions=base.conditions,
            medications=base.medications,
        )
        return retriever.retrieve(q)


DEFAULT_LAYERS: List[RetrievalLayer] = [
    RetrievalLayer("loinc", [SourceKind.LOINC]),
    RetrievalLayer("medication", [SourceKind.RXNORM, SourceKind.DRUG]),
    RetrievalLayer("disease", [SourceKind.SNOMED, SourceKind.ICD]),
    RetrievalLayer("specialist", [SourceKind.GRAPH]),
    RetrievalLayer("research", [SourceKind.RESEARCH, SourceKind.INDIAN]),
]

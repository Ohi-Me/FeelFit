"""
FeelFit Medical RAG 2.0 — Retrieval-Augmented Medical Intelligence

    LLM  = Reasoning Engine
    RAG  = Medical Knowledge Engine

Public API:
    from rag import get_rag
    bundle = get_rag().retrieve("HbA1c 6.7%", age=52, gender="male")
    prompt_block = bundle.to_prompt_block()
    evidence = bundle.to_dict()   # confidence + citations + validation status

See RAG_ARCHITECTURE.md for the full design.
"""
from .orchestrator import MedicalRAG, get_rag
from .types import (
    Citation,
    EvidenceBundle,
    KnowledgeDoc,
    RetrievalQuery,
    RetrievedDoc,
    SourceKind,
)

__all__ = [
    "MedicalRAG",
    "get_rag",
    "EvidenceBundle",
    "RetrievalQuery",
    "RetrievedDoc",
    "KnowledgeDoc",
    "Citation",
    "SourceKind",
]

"""
FeelFit Medical RAG 2.0 — Medical Knowledge Graph

A lightweight, typed relationship graph:

    Test → Condition → Medication → Specialist → Lifestyle → Risk

It is seeded from the local LOINC KB (test → category → specialty) plus a small
hand-curated relationship table for the most common Indian-clinic biomarkers
(HbA1c, lipids, thyroid, etc.). The graph is queryable (`neighbors`, `path`)
and can emit `KnowledgeDoc`s so graph relationships are themselves retrievable.

Production target: millions of relationships hydrated from SNOMED CT, RxNorm,
and curated guideline edges.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set, Tuple

from .types import KnowledgeDoc, SourceKind

_KB_PATH = Path(__file__).parent.parent / "medical_kb.json"

# node_type → relationship → node_type chain order used for path building
CHAIN = ["test", "condition", "medication", "specialist", "lifestyle", "risk"]

# Curated seed edges for high-value biomarkers. (subject, relation, object)
_SEED_EDGES: List[Tuple[str, str, str]] = [
    ("hemoglobin", "may_indicate", "anemia"),
    ("anemia", "managed_by", "General Physician"),
    ("anemia", "lifestyle", "Iron-rich diet"),
    ("anemia", "risk", "Fatigue / reduced oxygen delivery"),
    ("glycated_hemoglobin", "may_indicate", "diabetes"),
    ("diabetes", "treated_with", "Metformin"),
    ("diabetes", "managed_by", "Endocrinologist"),
    ("diabetes", "lifestyle", "Weight management"),
    ("diabetes", "risk", "Cardiovascular risk"),
    ("ldl_cholesterol", "may_indicate", "dyslipidemia"),
    ("dyslipidemia", "managed_by", "Cardiologist"),
    ("dyslipidemia", "lifestyle", "Low saturated-fat diet"),
    ("dyslipidemia", "risk", "Atherosclerosis"),
    ("thyroid_stimulating_hormone", "may_indicate", "thyroid dysfunction"),
    ("thyroid dysfunction", "managed_by", "Endocrinologist"),
    ("creatinine", "may_indicate", "kidney dysfunction"),
    ("kidney dysfunction", "managed_by", "Nephrologist"),
    ("kidney dysfunction", "risk", "Chronic kidney disease"),
]


class MedicalKnowledgeGraph:
    def __init__(self) -> None:
        # adjacency: node -> list of (relation, neighbor)
        self._adj: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
        self._nodes: Set[str] = set()
        self._build()

    def _add(self, s: str, rel: str, o: str) -> None:
        self._adj[s].append((rel, o))
        self._nodes.update([s, o])

    def _build(self) -> None:
        # 1) seed edges
        for s, rel, o in _SEED_EDGES:
            self._add(s, rel, o)
        # 2) hydrate test → specialist from the LOINC KB
        try:
            kb: Dict[str, dict] = json.loads(_KB_PATH.read_text())
        except Exception:
            kb = {}
        for e in kb.values():
            canon = e.get("canonical")
            spec = e.get("specialty")
            if canon and spec:
                self._add(canon, "reviewed_by", spec)

    # ── queries ───────────────────────────────────────────────────────────────
    def neighbors(self, node: str) -> List[Tuple[str, str]]:
        return self._adj.get(node.lower().strip(), [])

    def expand(self, node: str, depth: int = 2) -> List[Tuple[str, str, str]]:
        """BFS expansion returning (subject, relation, object) triples."""
        node = node.lower().strip()
        seen: Set[str] = {node}
        frontier = [node]
        triples: List[Tuple[str, str, str]] = []
        for _ in range(depth):
            nxt: List[str] = []
            for n in frontier:
                for rel, o in self._adj.get(n, []):
                    triples.append((n, rel, o))
                    if o.lower() not in seen:
                        seen.add(o.lower())
                        nxt.append(o.lower())
            frontier = nxt
        return triples

    def as_docs(self) -> List[KnowledgeDoc]:
        """Emit graph paths as retrievable knowledge docs."""
        docs: List[KnowledgeDoc] = []
        for node in self._nodes:
            triples = self.expand(node, depth=2)
            if not triples:
                continue
            text = "; ".join(f"{s} {rel.replace('_', ' ')} {o}" for s, rel, o in triples)
            docs.append(KnowledgeDoc(
                id=f"graph:{node.replace(' ', '_')}",
                source=SourceKind.GRAPH,
                title=f"Knowledge graph around '{node}'",
                text=text,
                keywords=[node],
                metadata={"node": node},
                version="kg-seed-v1",
            ))
        return docs

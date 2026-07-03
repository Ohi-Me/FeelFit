"""
FeelFit Medical RAG 2.0 — Knowledge Sources

A `KnowledgeSource` turns a trusted medical dataset into `KnowledgeDoc`s that
can be indexed and retrieved. The registry below wires up the sources we can
serve today from local data, with clear extension hooks for the rest.

Implemented now (offline, from repo data):
    • LoincSource          — built from backend/medical_kb.json (41 tests today,
                             designed to scale to the 20,000+ LOINC catalogue)
    • DiseaseSeedSource    — small SNOMED/ICD-style condition notes seeded from
                             the LOINC KB's clinical notes + specialty mapping
    • SpecialistSeedSource — finding → specialist mapping

Stubbed (return [] until wired to live data / a real index):
    • RxNormSource, ResearchSource, IndianHealthSource
These have docstrings describing exactly what to connect (RxNorm/OpenFDA,
PubMed/WHO/CDC, ICMR/CDSCO). Wiring them is purely additive.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Protocol

from .types import KnowledgeDoc, SourceKind

logger = logging.getLogger("feelfit.rag.sources")

_KB_PATH = Path(__file__).parent.parent / "medical_kb.json"


class KnowledgeSource(Protocol):
    kind: SourceKind
    version: str

    def load(self) -> List[KnowledgeDoc]: ...


# ── LOINC ────────────────────────────────────────────────────────────────────
class LoincSource:
    """Laboratory test standards from the local LOINC knowledge base."""

    kind = SourceKind.LOINC
    version = "loinc-kb-local-v9"

    def load(self) -> List[KnowledgeDoc]:
        try:
            kb: Dict[str, dict] = json.loads(_KB_PATH.read_text())
        except Exception as e:  # pragma: no cover - defensive
            logger.warning(f"LoincSource load failed: {e}")
            return []

        docs: List[KnowledgeDoc] = []
        for code, e in kb.items():
            ranges = e.get("ranges", {})
            range_txt = "; ".join(
                f"{grp}: {r.get('low')}-{r.get('high')} {e.get('units','')}"
                for grp, r in ranges.items()
            )
            text = (
                f"{e.get('long', e.get('canonical',''))}. "
                f"Category: {e.get('category','')}. Units: {e.get('units','')}. "
                f"Reference ranges — {range_txt}. "
                f"Low: {e.get('clinical_note_low','')} "
                f"High: {e.get('clinical_note_high','')}"
            ).strip()
            docs.append(KnowledgeDoc(
                id=f"loinc:{code}",
                source=SourceKind.LOINC,
                title=f"{e.get('short', e.get('canonical',''))} (LOINC {code})",
                text=text,
                keywords=[a.lower() for a in e.get("aliases", [])]
                         + [e.get("canonical", ""), e.get("short", "").lower()],
                metadata={
                    "loinc": code,
                    "category": e.get("category"),
                    "specialty": e.get("specialty"),
                    "units": e.get("units"),
                },
                version=self.version,
            ))
        return docs


# ── Disease / condition notes (SNOMED/ICD-flavoured seed) ─────────────────────
class DiseaseSeedSource:
    """
    Condition context seeded from the LOINC KB's clinical notes + specialty.

    Production target: SNOMED CT concepts + ICD-10/11 classification with
    guideline-backed risk factors and monitoring recommendations.
    """

    kind = SourceKind.SNOMED
    version = "disease-seed-v1"

    def load(self) -> List[KnowledgeDoc]:
        try:
            kb: Dict[str, dict] = json.loads(_KB_PATH.read_text())
        except Exception:
            return []
        docs: List[KnowledgeDoc] = []
        for code, e in kb.items():
            note_lo = e.get("clinical_note_low", "")
            note_hi = e.get("clinical_note_high", "")
            if not (note_lo or note_hi):
                continue
            docs.append(KnowledgeDoc(
                id=f"cond:{code}",
                source=SourceKind.SNOMED,
                title=f"Conditions associated with {e.get('short', code)}",
                text=f"Possible associations — abnormally low: {note_lo} "
                     f"Abnormally high: {note_hi}",
                keywords=[e.get("canonical", ""), e.get("category", "").lower()],
                metadata={"loinc": code, "specialty": e.get("specialty")},
                version=self.version,
            ))
        return docs


# ── Finding → specialist mapping ──────────────────────────────────────────────
class SpecialistSeedSource:
    """Maps a clinical category/finding to the specialist who manages it."""

    kind = SourceKind.GRAPH
    version = "specialist-seed-v1"

    def load(self) -> List[KnowledgeDoc]:
        try:
            kb: Dict[str, dict] = json.loads(_KB_PATH.read_text())
        except Exception:
            return []
        by_specialty: Dict[str, set] = {}
        for e in kb.values():
            spec = e.get("specialty") or "General Physician"
            by_specialty.setdefault(spec, set()).add(e.get("category", ""))
        docs: List[KnowledgeDoc] = []
        for spec, cats in by_specialty.items():
            cats_txt = ", ".join(sorted(c for c in cats if c))
            docs.append(KnowledgeDoc(
                id=f"spec:{spec.lower().replace(' ', '_')}",
                source=SourceKind.GRAPH,
                title=f"Specialist: {spec}",
                text=f"{spec} typically reviews findings in: {cats_txt}.",
                keywords=[spec.lower()] + [c.lower() for c in cats if c],
                metadata={"specialty": spec},
                version=self.version,
            ))
        return docs


# ── Medication knowledge (RxNorm / DrugBank flavoured seed) ───────────────────
# Curated, educational drug facts for the common medicines surfaced in the app.
# Production target: live RxNorm + OpenFDA + DailyMed (see services/medicine_live_service).
_DRUG_SEED: List[dict] = [
    {"name": "Metformin", "cls": "Biguanide antidiabetic", "use": "type 2 diabetes / high HbA1c",
     "note": "Lowers blood glucose; commonly first-line for type 2 diabetes. May cause GI upset; rare lactic acidosis in kidney impairment.",
     "interacts": "contrast dye, alcohol"},
    {"name": "Atorvastatin", "cls": "Statin (HMG-CoA reductase inhibitor)", "use": "high LDL cholesterol / dyslipidemia",
     "note": "Lowers LDL cholesterol and cardiovascular risk. Watch for muscle pain (myopathy) and liver enzyme changes.",
     "interacts": "grapefruit juice, certain antibiotics"},
    {"name": "Levothyroxine", "cls": "Thyroid hormone", "use": "hypothyroidism / high TSH",
     "note": "Replaces thyroid hormone. Taken on an empty stomach; dose guided by TSH levels.",
     "interacts": "calcium, iron, antacids"},
    {"name": "Amlodipine", "cls": "Calcium channel blocker", "use": "hypertension",
     "note": "Relaxes blood vessels to lower blood pressure. May cause ankle swelling.",
     "interacts": "grapefruit juice"},
    {"name": "Aspirin", "cls": "Antiplatelet / NSAID", "use": "cardiovascular risk reduction",
     "note": "Reduces clot formation. Bleeding risk; used cautiously with other blood thinners.",
     "interacts": "warfarin, other NSAIDs"},
    {"name": "Vitamin D3", "cls": "Fat-soluble vitamin", "use": "vitamin D deficiency",
     "note": "Supports calcium absorption and bone health. Common deficiency in low sun exposure.",
     "interacts": "thiazide diuretics"},
]


class RxNormSource:
    """Educational medication knowledge (RxNorm/DrugBank-style seed).

    Wire-up for live data: `services/medicine_live_service.get_live_medicine_info`
    already returns RxNorm/OpenFDA payloads — index those docs here per drug.
    """
    kind = SourceKind.DRUG
    version = "drug-seed-v1"

    def load(self) -> List[KnowledgeDoc]:
        docs: List[KnowledgeDoc] = []
        for d in _DRUG_SEED:
            docs.append(KnowledgeDoc(
                id=f"drug:{d['name'].lower()}",
                source=SourceKind.DRUG,
                title=f"{d['name']} ({d['cls']})",
                text=f"{d['name']} — class: {d['cls']}. Commonly used for {d['use']}. "
                     f"{d['note']} Notable interactions: {d['interacts']}.",
                keywords=[d["name"].lower(), d["cls"].lower(), d["use"].lower()],
                metadata={"drug_class": d["cls"]},
                version=self.version,
            ))
        return docs


# ── Research / guideline knowledge (PubMed/WHO/CDC/Mayo flavoured seed) ────────
_RESEARCH_SEED: List[dict] = [
    {"topic": "HbA1c and diabetes", "src": "WHO / ADA guidelines",
     "text": "HbA1c >= 6.5% supports a diabetes classification; 5.7-6.4% is the prediabetes range. "
             "Reflects ~3-month average glycemia. Lifestyle and monitoring reduce progression."},
    {"topic": "Low ferritin / iron deficiency", "src": "NIH / WHO",
     "text": "Low ferritin is the most specific marker of depleted iron stores and a common cause of "
             "iron-deficiency anemia. Causes include inadequate intake, blood loss, and malabsorption."},
    {"topic": "Vitamin D deficiency", "src": "Endocrine Society / Mayo Clinic",
     "text": "Serum 25-OH vitamin D below 20 ng/mL indicates deficiency, linked to bone and muscle health. "
             "Common in low sunlight exposure; addressed with diet, sunlight, and supplementation."},
    {"topic": "LDL cholesterol and cardiovascular risk", "src": "AHA / WHO",
     "text": "Elevated LDL cholesterol is a major modifiable cardiovascular risk factor. "
             "Diet, exercise, and clinician-guided therapy lower risk of atherosclerosis."},
    {"topic": "Thyroid (TSH) interpretation", "src": "ATA guidelines",
     "text": "High TSH commonly suggests an underactive thyroid (hypothyroidism); low TSH may suggest an "
             "overactive thyroid. Confirmed alongside free T4 by a clinician."},
    {"topic": "Elevated creatinine / kidney function", "src": "KDIGO / NIH",
     "text": "Rising creatinine and reduced eGFR may indicate reduced kidney filtration. "
             "Hydration, blood pressure, and medication review are part of monitoring."},
    {"topic": "High uric acid and gout", "src": "ACR guidelines",
     "text": "Elevated serum urate is associated with gout and kidney-stone risk. Hydration and "
             "limiting red meat, alcohol, and sugary drinks are common lifestyle measures."},
    {"topic": "PSA and prostate screening", "src": "USPSTF / NIH",
     "text": "Prostate-specific antigen (PSA) may be elevated in benign or malignant prostate conditions. "
             "Screening decisions are individualized and discussed with a clinician."},
    {"topic": "Insulin resistance / metabolic syndrome", "src": "ADA / WHO",
     "text": "High fasting insulin with high glucose may indicate insulin resistance, a component of "
             "metabolic syndrome. Weight management and reduced refined carbohydrate intake help."},
]


class ResearchSource:
    """Educational guideline summaries (PubMed/NIH/WHO/CDC/Mayo-style seed).

    Wire-up for live data: index PubMed abstracts / guideline documents into the
    vector store as KnowledgeDocs with the same shape.
    """
    kind = SourceKind.RESEARCH
    version = "research-seed-v1"

    def load(self) -> List[KnowledgeDoc]:
        docs: List[KnowledgeDoc] = []
        for i, r in enumerate(_RESEARCH_SEED):
            docs.append(KnowledgeDoc(
                id=f"research:{i}",
                source=SourceKind.RESEARCH,
                title=f"{r['topic']} ({r['src']})",
                text=r["text"],
                keywords=[r["topic"].lower()],
                metadata={"guideline_source": r["src"]},
                version=self.version,
            ))
        return docs


# ── Indian healthcare knowledge (ICMR / CDSCO / Ayushman Bharat seed) ──────────
_INDIAN_SEED: List[dict] = [
    {"topic": "ICMR dietary guidelines", "text": "ICMR-NIN recommends balanced diets emphasising whole grains, "
     "pulses, vegetables, and limited salt/sugar/oil to manage diabetes, hypertension, and dyslipidemia in India."},
    {"topic": "Ayushman Bharat (PM-JAY)", "text": "India's national health protection scheme provides cashless "
     "secondary and tertiary care coverage for eligible families, improving access to specialist care."},
    {"topic": "National programmes", "text": "Programmes such as NPCDCS target non-communicable diseases — "
     "diabetes, cardiovascular disease, and cancer screening — through public health centres."},
    {"topic": "Indian reference context", "text": "Vitamin D and B12 deficiency and anemia are highly prevalent "
     "in the Indian population; results are best interpreted with local reference and dietary context."},
]


class IndianHealthSource:
    """Indian healthcare context (ICMR / CDSCO / Ayushman Bharat seed)."""
    kind = SourceKind.INDIAN
    version = "indian-seed-v1"

    def load(self) -> List[KnowledgeDoc]:
        docs: List[KnowledgeDoc] = []
        for i, r in enumerate(_INDIAN_SEED):
            docs.append(KnowledgeDoc(
                id=f"indian:{i}",
                source=SourceKind.INDIAN,
                title=r["topic"],
                text=r["text"],
                keywords=[r["topic"].lower(), "india"],
                metadata={"region": "IN"},
                version=self.version,
            ))
        return docs


# ── Registry ──────────────────────────────────────────────────────────────────
DEFAULT_SOURCES: List[KnowledgeSource] = [
    LoincSource(),
    DiseaseSeedSource(),
    SpecialistSeedSource(),
    RxNormSource(),
    ResearchSource(),
    IndianHealthSource(),
]


def load_all(sources: List[KnowledgeSource] | None = None) -> List[KnowledgeDoc]:
    sources = sources or DEFAULT_SOURCES
    docs: List[KnowledgeDoc] = []
    for src in sources:
        loaded = src.load()
        if loaded:
            logger.info(f"RAG source {src.kind.value}: {len(loaded)} docs")
        docs.extend(loaded)
    return docs

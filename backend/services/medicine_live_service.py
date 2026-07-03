"""
FeelFit v11 — Live Medicine Intelligence Service
Real-time drug data from OpenFDA, RxNorm, DailyMed + AI enrichment
No API key required for OpenFDA / RxNorm.
"""
from __future__ import annotations
import asyncio
import json
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger("feelfit.medicine_live")

# ── API Endpoints ──────────────────────────────────────────────────────────────
OPENFDA_URL   = "https://api.fda.gov/drug/label.json"
RXNORM_SEARCH = "https://rxnav.nlm.nih.gov/REST/drugs.json"
RXNORM_SPELL  = "https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json"
RXNORM_PROPS  = "https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/properties.json"
RXNORM_RELS   = "https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json"
DAILYMED_URL  = "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json"
RXNORM_INTER  = "https://rxnav.nlm.nih.gov/REST/interaction/list.json"


# ── India brand → generic map ──────────────────────────────────────────────────
# RxNorm/OpenFDA index by generic/US names. Indian users search by local brand
# names, so we normalise common Indian brands to their active ingredient before
# the live lookup. This is how we "add Indian sources" without a paid India API.
INDIA_BRAND_MAP: dict[str, str] = {
    # Pain / fever
    "crocin": "acetaminophen", "dolo": "acetaminophen", "calpol": "acetaminophen",
    "saridon": "acetaminophen", "sumo": "acetaminophen", "pacimol": "acetaminophen",
    "combiflam": "ibuprofen", "brufen": "ibuprofen", "ibugesic": "ibuprofen",
    "disprin": "aspirin", "ecosprin": "aspirin",
    "meftal": "mefenamic acid", "meftal spas": "mefenamic acid",
    "zerodol": "aceclofenac", "nimulid": "nimesulide", "nise": "nimesulide",
    "volini": "diclofenac", "voveran": "diclofenac",
    # Acidity / gut
    "pan": "pantoprazole", "pantop": "pantoprazole", "pantocid": "pantoprazole",
    "omez": "omeprazole", "ocid": "omeprazole", "rantac": "ranitidine",
    "razo": "rabeprazole", "nexpro": "esomeprazole", "duphalac": "lactulose",
    "udiliv": "ursodiol", "domstal": "domperidone", "emeset": "ondansetron",
    # Allergy / cold / respiratory
    "cetzine": "cetirizine", "alerid": "cetirizine", "okacet": "cetirizine",
    "allegra": "fexofenadine", "avil": "pheniramine", "montair": "montelukast",
    "montek": "montelukast", "asthalin": "albuterol", "levolin": "levalbuterol",
    "sinarest": "acetaminophen", "vicks action 500": "acetaminophen",
    # Antibiotics
    "azithral": "azithromycin", "azee": "azithromycin", "augmentin": "amoxicillin clavulanate",
    "clavam": "amoxicillin clavulanate", "mox": "amoxicillin", "cifran": "ciprofloxacin",
    "ciplox": "ciprofloxacin", "norflox": "norfloxacin", "taxim o": "cefixime",
    "cefix": "cefixime", "monocef": "ceftriaxone", "metrogyl": "metronidazole",
    # Diabetes / heart / cholesterol
    "glycomet": "metformin", "gluconorm": "metformin", "amaryl": "glimepiride",
    "januvia": "sitagliptin", "telma": "telmisartan", "amlong": "amlodipine",
    "amlodac": "amlodipine", "losar": "losartan", "stamlo": "amlodipine",
    "atorva": "atorvastatin", "storvas": "atorvastatin", "lipikind": "atorvastatin",
    "rosuvas": "rosuvastatin", "crestor": "rosuvastatin",
    # Thyroid / vitamins / supplements
    "thyronorm": "levothyroxine", "eltroxin": "levothyroxine", "shelcal": "calcium carbonate",
    "becosules": "vitamin b complex", "neurobion": "vitamin b complex", "limcee": "vitamin c",
    "uprise d3": "cholecalciferol", "calcirol": "cholecalciferol",
}


def normalize_india_brand(name: str) -> str:
    """Return the generic name for a known Indian brand, else the original name."""
    key = re.sub(r"[^a-z ]", " ", name.lower()).strip()
    key = re.sub(r"\s+", " ", key)
    if key in INDIA_BRAND_MAP:
        return INDIA_BRAND_MAP[key]
    tokens = key.split()
    # try the first token (handles "Dolo 650", "Pan 40", "Telma 40")
    if tokens and tokens[0] in INDIA_BRAND_MAP:
        return INDIA_BRAND_MAP[tokens[0]]
    # try any known brand appearing as a whole word
    for brand, generic in INDIA_BRAND_MAP.items():
        if brand in tokens or key.startswith(brand + " "):
            return generic
    return name


async def rxnorm_search(name: str) -> Optional[str]:
    """Return RxCUI for a drug name, or None."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(RXNORM_SEARCH, params={"name": name})
        data = r.json()
        groups = data.get("drugGroup", {}).get("conceptGroup", [])
        for group in groups:
            props = group.get("conceptProperties", [])
            if props:
                return str(props[0].get("rxcui", ""))
    except Exception as e:
        logger.warning(f"RxNorm search error for {name}: {e}")
    return None


async def rxnorm_spelling(name: str) -> list[str]:
    """Get spelling suggestions for a misspelled drug name."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(RXNORM_SPELL, params={"name": name})
        data = r.json()
        return data.get("suggestionGroup", {}).get("suggestionList", {}).get("suggestion", [])[:5]
    except Exception:
        return []


def _name_tokens(s: str) -> set[str]:
    return {t for t in re.sub(r"[^a-z0-9 ]", " ", s.lower()).split() if len(t) >= 4}


def _openfda_result_matches(name: str, result: dict) -> bool:
    """Guards the broad (unqualified) OpenFDA fallback query below, which
    searches ALL label text (indications, descriptions, etc.) and can match a
    completely unrelated drug by free-text coincidence — e.g. searching the
    Indian combination brand "Rablet-D" once matched "Mekinist", a cancer
    chemotherapy drug, with no relation at all. Requires the candidate's own
    brand/generic/substance name to actually share a real token with the
    search term before we trust it."""
    openfda = result.get("openfda", {})
    candidate = " ".join(openfda.get("brand_name", []) + openfda.get("generic_name", []) + openfda.get("substance_name", []))
    search_tokens = _name_tokens(name)
    if not search_tokens:
        return True
    return bool(search_tokens & _name_tokens(candidate))


async def openfda_search(name: str) -> Optional[dict]:
    """Search OpenFDA drug labels for a medicine name."""
    queries = [
        f'brand_name:"{name}"',
        f'generic_name:"{name}"',
        f'substance_name:"{name}"',
        name,  # broad fallback — validated below, see _openfda_result_matches
    ]
    async with httpx.AsyncClient(timeout=10.0) as client:
        for i, q in enumerate(queries):
            try:
                r = await client.get(OPENFDA_URL, params={"search": q, "limit": 1})
                if r.status_code == 200:
                    results = r.json().get("results", [])
                    if results:
                        is_broad_query = (i == len(queries) - 1)
                        if is_broad_query and not _openfda_result_matches(name, results[0]):
                            logger.warning(f"OpenFDA broad match for {name!r} rejected as unrelated (got {results[0].get('openfda', {}).get('brand_name')})")
                            continue
                        return results[0]
            except Exception as e:
                logger.warning(f"OpenFDA error with query '{q}': {e}")
                continue
    return None


def extract_fda_field(data: dict, field: str, max_chars: int = 1000) -> str:
    """Safely extract and truncate a field from OpenFDA label data."""
    val = data.get(field, [])
    if isinstance(val, list):
        text = " ".join(val)
    else:
        text = str(val)
    return text[:max_chars].strip()


def parse_side_effects(warnings_text: str, adverse_text: str) -> tuple[list[str], list[str]]:
    """Extract common and serious side effects from FDA label text."""
    combined = (adverse_text + " " + warnings_text).lower()
    common_keywords = ["nausea", "headache", "dizziness", "fatigue", "diarrhea",
                       "constipation", "rash", "insomnia", "dry mouth", "vomiting",
                       "abdominal pain", "back pain", "cough", "fever", "weight gain"]
    serious_keywords = ["anaphylaxis", "hepatotoxicity", "liver damage", "kidney failure",
                        "cardiac arrest", "seizure", "stroke", "agranulocytosis",
                        "stevens-johnson", "suicidal", "QT prolongation", "pancreatitis"]
    common = [kw.title() for kw in common_keywords if kw in combined][:6]
    serious = [kw.title() for kw in serious_keywords if kw in combined][:4]
    return common, serious


async def rxnorm_interactions(rxcuis: list[str]) -> list[dict]:
    """Get drug-drug interaction data from RxNav."""
    if len(rxcuis) < 2:
        return []
    try:
        params = [("rxcuis", rxcui) for rxcui in rxcuis]
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(RXNORM_INTER, params=params)
        data = r.json()
        interactions = []
        full = data.get("fullInteractionTypeGroup", [])
        for group in full:
            for itype in group.get("fullInteractionType", []):
                pair = itype.get("minConceptItem", [])
                if len(pair) >= 2:
                    desc = ""
                    pairs = itype.get("interactionPair", [])
                    if pairs:
                        desc = pairs[0].get("description", "")
                        severity = pairs[0].get("severity", "unknown")
                    else:
                        severity = "unknown"
                    interactions.append({
                        "medicine_a": pair[0].get("name", ""),
                        "medicine_b": pair[1].get("name", "") if len(pair) > 1 else "",
                        "severity": severity.lower(),
                        "description": desc,
                        "general_advice": "Discuss with your pharmacist or doctor before combining these medicines.",
                        "source": "rxnorm",
                    })
        return interactions[:10]
    except Exception as e:
        logger.warning(f"RxNorm interaction error: {e}")
        return []


async def get_live_medicine_info(medicine_name: str, user_conditions: Optional[list] = None) -> dict:
    """
    Unified medicine info fetch:
    1. RxNorm CUI lookup
    2. OpenFDA label data
    3. Merge + return structured response
    Falls through gracefully — always returns something.
    """
    name = medicine_name.strip()

    # Indian brand → generic so the US-based APIs can find it (e.g. "Dolo 650" → paracetamol)
    lookup = normalize_india_brand(name)
    india_brand = lookup.lower() != name.lower()

    # Run RxNorm and OpenFDA in parallel (on the resolved generic name)
    rxcui_task = rxnorm_search(lookup)
    fda_task = openfda_search(lookup)
    rxcui, fda_data = await asyncio.gather(rxcui_task, fda_task)

    result: dict = {
        "query": name,
        "name": name,
        "generic_name": lookup if india_brand else "",
        "matched_brand": name if india_brand else "",
        "matched_generic": lookup if india_brand else "",
        "drug_class": "",
        "commonly_used_for": [],
        "how_it_works": "",
        "typical_dosage_info": "",
        "common_side_effects": [],
        "serious_side_effects": [],
        "general_warnings": [],
        "food_interactions": [],
        "storage": "",
        "otc_or_prescription": "Unknown",
        "drug_category": "Other",
        "typical_price_inr": "",
        "confidence": 0.5,
        "rxcui": rxcui,
        "sources": [],
        "spelling_suggestions": [],
    }

    if india_brand:
        result["sources"].append("india_brand_map")
        result["confidence"] = max(result["confidence"], 0.6)

    if rxcui:
        result["confidence"] = max(result["confidence"], 0.75)
        result["sources"].append("rxnorm")

    if fda_data:
        result["sources"].append("openfda")
        openfda_section = fda_data.get("openfda", {})

        # Brand and generic names
        brands = openfda_section.get("brand_name", [])
        generics = openfda_section.get("generic_name", [])
        substances = openfda_section.get("substance_name", [])

        if brands:
            result["name"] = brands[0].title()
        if generics:
            result["generic_name"] = generics[0].title()
        elif substances:
            result["generic_name"] = substances[0].title()

        # Drug class from pharm class
        pharm_class = openfda_section.get("pharm_class_epc", [])
        if pharm_class:
            result["drug_class"] = pharm_class[0].replace("[EPC]", "").strip().title()

        # Product type (OTC vs Rx)
        product_type = openfda_section.get("product_type", [])
        if product_type:
            pt = product_type[0].upper()
            if "OTC" in pt or "OVER THE COUNTER" in pt:
                result["otc_or_prescription"] = "OTC"
            elif "PRESCRIPTION" in pt or "RX" in pt:
                result["otc_or_prescription"] = "Prescription"

        # Indications
        indications = extract_fda_field(fda_data, "indications_and_usage", 600)
        if indications:
            # Extract bullet points / sentences
            sentences = re.split(r'[.;\n•]', indications)
            uses = [s.strip() for s in sentences if 10 < len(s.strip()) < 150][:5]
            result["commonly_used_for"] = uses if uses else [indications[:200]]

        # Mechanism
        mechanism = extract_fda_field(fda_data, "mechanism_of_action", 500)
        if mechanism:
            result["how_it_works"] = mechanism[:300]

        # Dosage
        dosage = extract_fda_field(fda_data, "dosage_and_administration", 400)
        if dosage:
            result["typical_dosage_info"] = dosage[:300] + " (Educational only — not a prescription)"

        # Side effects
        adverse = extract_fda_field(fda_data, "adverse_reactions", 800)
        warnings = extract_fda_field(fda_data, "warnings_and_cautions", 800)
        common_se, serious_se = parse_side_effects(warnings, adverse)
        result["common_side_effects"] = common_se
        result["serious_side_effects"] = serious_se

        # Warnings
        warn_text = extract_fda_field(fda_data, "boxed_warning", 500) or extract_fda_field(fda_data, "warnings", 500)
        if warn_text:
            warn_sentences = [s.strip() for s in warn_text.split(".") if 10 < len(s.strip()) < 200][:4]
            result["general_warnings"] = warn_sentences

        # Drug interactions (food)
        food_ints = extract_fda_field(fda_data, "drug_interactions", 500)
        if food_ints:
            food_sentences = [s.strip() for s in food_ints.split(".") if "food" in s.lower() or "alcohol" in s.lower() or "grapefruit" in s.lower()][:3]
            result["food_interactions"] = food_sentences if food_sentences else []

        # Storage
        storage = extract_fda_field(fda_data, "storage_and_handling", 200)
        result["storage"] = storage[:200] if storage else "Store at room temperature, away from moisture and heat."

        result["confidence"] = 0.90

    # If no data found at all, get spelling suggestions
    if not fda_data and not rxcui:
        suggestions = await rxnorm_spelling(name)
        result["spelling_suggestions"] = suggestions
        result["confidence"] = 0.0

    # Drug category inference
    name_lower = name.lower()
    generic_lower = result.get("generic_name", "").lower()
    combined = name_lower + " " + generic_lower + " " + result.get("drug_class", "").lower()
    if any(w in combined for w in ["metformin", "insulin", "glimepiride", "glipizide", "sitagliptin"]):
        result["drug_category"] = "Antidiabetic"
    elif any(w in combined for w in ["amlodipine", "losartan", "atenolol", "lisinopril", "ramipril"]):
        result["drug_category"] = "Antihypertensive"
    elif any(w in combined for w in ["atorvastatin", "rosuvastatin", "simvastatin"]):
        result["drug_category"] = "Cardiovascular"
    elif any(w in combined for w in ["amoxicillin", "azithromycin", "ciprofloxacin", "doxycycline", "antibiotic"]):
        result["drug_category"] = "Antibiotic"
    elif any(w in combined for w in ["acetaminophen", "ibuprofen", "diclofenac", "naproxen", "acetaminophen"]):
        result["drug_category"] = "Pain & Fever"
    elif any(w in combined for w in ["levothyroxine", "thyroid"]):
        result["drug_category"] = "Thyroid"
    elif any(w in combined for w in ["vitamin", "supplement", "calcium", "iron", "folate"]):
        result["drug_category"] = "Supplement"
    elif any(w in combined for w in ["omeprazole", "pantoprazole", "ranitidine", "antacid"]):
        result["drug_category"] = "Digestive Health"
    elif any(w in combined for w in ["salbutamol", "montelukast", "budesonide", "asthma", "inhaler"]):
        result["drug_category"] = "Respiratory"
    elif any(w in combined for w in ["fluoxetine", "sertraline", "escitalopram", "antidepressant"]):
        result["drug_category"] = "Mental Health"

    return result


async def check_live_interactions(medicines: list[str]) -> dict:
    """
    Check drug interactions using RxNorm where possible,
    with a structured fallback response.
    """
    # Get RxCUIs for all medicines
    rxcui_tasks = [rxnorm_search(m) for m in medicines]
    rxcuis = await asyncio.gather(*rxcui_tasks)

    valid_pairs = [(m, rxcui) for m, rxcui in zip(medicines, rxcuis) if rxcui]
    valid_rxcuis = [rxcui for _, rxcui in valid_pairs]

    interactions = []
    if len(valid_rxcuis) >= 2:
        interactions = await rxnorm_interactions(valid_rxcuis)

    return {
        "medicines_checked": medicines,
        "rxcuis_found": {m: rxcui for m, rxcui in zip(medicines, rxcuis) if rxcui},
        "interactions": interactions,
        "total_interactions": len(interactions),
        "source": "rxnorm" if interactions else "none",
        "disclaimer": "This is general educational information only. Always consult your doctor or pharmacist about your specific medications.",
        "overall_note": (
            f"Found {len(interactions)} potential interaction(s) between these medicines. "
            "Severity levels are indicative — individual responses vary. "
            "Always discuss your complete medicine list with your healthcare provider."
        ) if interactions else (
            "No specific interactions found in the database for this combination. "
            "This does not guarantee safety — consult your pharmacist or doctor."
        ),
    }

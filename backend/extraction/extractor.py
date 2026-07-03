"""
FeelFit v4 — Extraction Layer
PDF: pdfplumber (layout-aware) + PyMuPDF fallback
Images: Tesseract OCR with preprocessing pipeline
"""
from __future__ import annotations
import io
import logging
import re
from typing import Optional

logger = logging.getLogger("feelfit.extraction")


# ── PDF Extraction ─────────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Layout-aware PDF extraction using pdfplumber.
    Preserves table structure and column alignment.
    Falls back to PyMuPDF if pdfplumber fails.
    """
    text = _extract_pdfplumber(file_bytes)
    if not text or len(text.strip()) < 50:
        logger.info("pdfplumber returned minimal text, trying PyMuPDF fallback")
        text = _extract_pymupdf(file_bytes) or text
    logger.info(f"PDF extraction: {len(text)} chars")
    return text


def _extract_pdfplumber(file_bytes: bytes) -> str:
    try:
        import pdfplumber
        parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                # Text with layout tolerance
                txt = page.extract_text(x_tolerance=3, y_tolerance=3)
                if txt:
                    parts.append(f"[Page {i}]\n{txt}")
                # Tables
                tables = page.extract_tables() or []
                for table in tables:
                    if table:
                        rows = []
                        for row in table:
                            cleaned = "\t".join(str(c or "").strip() for c in row)
                            if cleaned.strip():
                                rows.append(cleaned)
                        if rows:
                            parts.append(f"[Table Page {i}]\n" + "\n".join(rows))
        return "\n\n".join(parts)
    except ImportError:
        logger.warning("pdfplumber not installed")
        return ""
    except Exception as e:
        logger.error(f"pdfplumber error: {e}")
        return ""


def _extract_pymupdf(file_bytes: bytes) -> str:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        parts = []
        for i, page in enumerate(doc, 1):
            txt = page.get_text("text")
            if txt:
                parts.append(f"[Page {i}]\n{txt}")
        return "\n\n".join(parts)
    except ImportError:
        logger.warning("PyMuPDF not installed")
        return ""
    except Exception as e:
        logger.error(f"PyMuPDF error: {e}")
        return ""


# ── Image OCR Extraction ───────────────────────────────────────────────────────

# PaddleOCR is far better than Tesseract on dense lab-report tables. It is heavy,
# so we load it lazily once and cache it. If it isn't installed, we fall back to
# the Tesseract pipeline below — the app works either way.
_PADDLE_OCR = None
_PADDLE_TRIED = False


def _get_paddle():
    global _PADDLE_OCR, _PADDLE_TRIED
    if _PADDLE_TRIED:
        return _PADDLE_OCR
    _PADDLE_TRIED = True
    try:
        from paddleocr import PaddleOCR
        # angle classification handles tilted phone photos; English model
        _PADDLE_OCR = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        logger.info("PaddleOCR initialised (table-grade OCR enabled)")
    except Exception as e:
        logger.warning(f"PaddleOCR unavailable, will use Tesseract: {e}")
        _PADDLE_OCR = None
    return _PADDLE_OCR


def _ocr_paddle(file_bytes: bytes) -> str:
    """
    High-quality OCR via PaddleOCR. Reconstructs reading order by grouping
    detected text boxes into rows (by vertical position) so table columns stay
    on the same line — critical for matching test → value → range.
    """
    ocr = _get_paddle()
    if ocr is None:
        return ""
    try:
        import cv2
        import numpy as np

        arr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            img = _load_via_pillow(file_bytes)
        if img is None:
            return ""

        # Upscale small images for better recognition
        h, w = img.shape[:2]
        if max(h, w) < 1600:
            scale = 2.0 if max(h, w) < 900 else 1.5
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        raw = ocr.ocr(img, cls=True)
        if not raw or not raw[0]:
            return ""

        # Each item: [box(4 pts), (text, confidence)]
        items = []
        for line in raw[0]:
            try:
                box, (txt, conf) = line[0], line[1]
                if not txt or conf < 0.4:
                    continue
                ys = [p[1] for p in box]
                xs = [p[0] for p in box]
                items.append((sum(ys) / 4.0, sum(xs) / 4.0, txt))
            except Exception:
                continue

        if not items:
            return ""

        # Group into rows by y proximity, then sort each row left→right
        items.sort(key=lambda t: t[0])
        rows, current, last_y = [], [], None
        row_gap = 18  # px tolerance for "same line"
        for y, x, txt in items:
            if last_y is None or abs(y - last_y) <= row_gap:
                current.append((x, txt))
            else:
                rows.append(current)
                current = [(x, txt)]
            last_y = y
        if current:
            rows.append(current)

        lines = []
        for row in rows:
            row.sort(key=lambda t: t[0])
            lines.append("  ".join(t for _, t in row))
        text = "\n".join(lines)
        logger.info(f"PaddleOCR extracted {len(text)} chars across {len(rows)} rows")
        return text.strip()
    except Exception as e:
        logger.error(f"PaddleOCR error: {e}")
        return ""


def extract_text_from_image(file_bytes: bytes) -> str:
    """
    OCR for images. Tries PaddleOCR first (table-grade, much better on lab reports),
    then falls back to the Tesseract preprocessing pipeline.
    """
    paddle_text = _ocr_paddle(file_bytes)
    if paddle_text and len(paddle_text) >= 40:
        return paddle_text
    logger.info("Falling back to Tesseract OCR")
    return _ocr_tesseract(file_bytes)


def _ocr_tesseract(file_bytes: bytes) -> str:
    """
    Tesseract OCR pipeline with preprocessing:
    1. Grayscale 2. Upscale 3. Denoise 4. Adaptive threshold 5. Deskew 6. OCR
    """
    try:
        import cv2
        import numpy as np
        import pytesseract

        # Decode image
        arr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if img is None:
            img = _load_via_pillow(file_bytes)
        if img is None:
            logger.warning("Could not decode image")
            return ""

        # Step 1: Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Step 2: Upscale if too small (better OCR accuracy)
        h, w = gray.shape
        if max(h, w) < 1500:
            scale = 2.0 if max(h, w) < 800 else 1.5
            gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            logger.info(f"Upscaled image by {scale}x for OCR")

        # Step 3: Noise removal
        denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

        # Step 4: Adaptive threshold (handles uneven lighting)
        thresh = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=11, C=2
        )

        # Step 5: Deskew if needed
        thresh = _deskew(thresh)

        # Step 6: OCR with best config for medical text
        config = "--oem 3 --psm 6 -l eng -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/()%-+ "
        text = pytesseract.image_to_string(thresh, config=config)

        logger.info(f"OCR extracted {len(text)} chars")
        return text.strip()

    except ImportError as e:
        logger.warning(f"OCR dependencies missing: {e}")
        return ""
    except Exception as e:
        logger.error(f"OCR error: {e}")
        return ""


def _load_via_pillow(file_bytes: bytes):
    """Fallback image loading via Pillow."""
    try:
        import cv2
        import numpy as np
        from PIL import Image
        pil = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def _deskew(image):
    """Attempt to correct skewed scans for better OCR."""
    try:
        import cv2
        import numpy as np
        coords = np.column_stack(np.where(image < 127))
        if len(coords) < 10:
            return image
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = 90 + angle
        if abs(angle) < 0.5:  # Skip tiny corrections
            return image
        (h, w) = image.shape
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        return cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_REPLICATE)
    except Exception:
        return image


# ── Dispatcher ────────────────────────────────────────────────────────────────

def extract_text(file_bytes: bytes, mime_type: str) -> str:
    """Route to correct extractor based on MIME type."""
    if mime_type == "application/pdf":
        return extract_text_from_pdf(file_bytes)
    return extract_text_from_image(file_bytes)


# ── Text Cleaning ──────────────────────────────────────────────────────────────

def clean_extracted_text(text: str) -> str:
    """
    Post-extraction cleanup:
    - Remove repeated whitespace
    - Fix common OCR substitutions
    - Normalize line breaks
    """
    if not text:
        return ""
    # Fix common OCR artifacts
    substitutions = {
        r"\|": "I",
        r"0(?=[a-zA-Z])": "O",  # 0 next to letters is likely O
        r"(?<=[a-zA-Z])0": "O",
    }
    for pattern, repl in substitutions.items():
        text = re.sub(pattern, repl, text)

    # Normalize whitespace
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    text = "\n".join(lines)

    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

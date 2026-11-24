"""
AralSync Python AI Microservice — FastAPI

Endpoints:
  POST /omr/detect       — OpenCV bubble-sheet OMR detection
  POST /reading/analyze  — Librosa reading audio analysis
  POST /cluster          — scikit-learn K-Means learner clustering

Runs on port 8000 (configurable via PORT env var).
"""

import os
import re
import traceback
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .omr import detect_omr_sheet, build_name_collages
from .reading import analyze_reading_audio
from .cluster import cluster_learners

# ── App Setup ───────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AralSync AI Service",
    description="OpenCV OMR, Librosa reading analysis, scikit-learn clustering",
    version="1.0.0",
)

# CORS: allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "aralsync-ai", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── OMR Detection ───────────────────────────────────────────────────────────────

@app.post("/omr/detect")
async def omr_detect(
    file: UploadFile = File(...),
    num_questions: int = Form(50),
    answer_key: Optional[str] = Form(None),
):
    """
    Detect answers from a scanned OMR bubble sheet.

    Accepts: PNG/JPEG image of a filled bubble sheet.
    Optional: answer_key as JSON string (e.g. '["A", "B", "C"]' or '[0, 1, 2]')
    Returns: Per-question detected answer (A/B/C/D) or blank, with correct/incorrect visual feedback.
    """
    try:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(400, "File must be an image (PNG, JPEG)")

        image_bytes = await file.read()
        if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(400, "Image too large (max 10MB)")

        # Parse optional answer key for color annotations (Green = Correct, Red = Incorrect)
        parsed_key = None
        if answer_key:
            try:
                import json
                from .omr import OPTION_LABELS
                raw_k = json.loads(answer_key)
                if isinstance(raw_k, list):
                    parsed_key = []
                    for item in raw_k:
                        if isinstance(item, int) and 0 <= item < 4:
                            parsed_key.append(item)
                        elif isinstance(item, str) and item.strip().upper() in OPTION_LABELS:
                            parsed_key.append(OPTION_LABELS.index(item.strip().upper()))
                        else:
                            parsed_key.append(None)
            except Exception:
                parsed_key = None

        result = detect_omr_sheet(image_bytes, num_questions, answer_key=parsed_key)
        return result
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=f"OMR Detection Error: {str(e)}")


@app.post("/omr/detect-pdf")
async def omr_detect_pdf(
    file: UploadFile = File(...),
    num_questions: int = Form(50),
):
    """
    Detect answers from each page of a scanned multi-page PDF bubble sheet document.
    Renders each page to PNG pixmap and detects answers.
    Returns: list of results per page, with base64 encoded PNG for preview.
    """
    import pymupdf
    import base64

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(400, "PDF too large (max 50MB)")

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Failed to parse PDF document: {str(e)}")

    pages = []
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        pix = page.get_pixmap(dpi=150)
        png_bytes = pix.tobytes("png")
        res = detect_omr_sheet(png_bytes, num_questions)
        pages.append({
            "page_index": page_idx,
            "png_base64": base64.b64encode(png_bytes).decode("ascii"),
            "answers": res.get("answers", []),
            "detected_count": res.get("detected_count", 0),
            "name_crop_base64": res.get("name_crop_base64", None),
            "warped_image_base64": res.get("warped_image_base64", None),
        })

    return {"success": True, "page_count": len(pages), "pages": pages}


class BuildCollagesRequest(BaseModel):
    crops: list[dict]
    max_per_collage: Optional[int] = 8


@app.post("/omr/build-collages")
async def omr_build_collages(payload: BuildCollagesRequest):
    """Build composite vertical collage strips from cropped student name boxes."""
    collages = build_name_collages(payload.crops, payload.max_per_collage or 8)
    return {"success": True, "collages": collages}


# ── Learning Material PDF Helpers & Document Parser ────────────────────────────

def _resolve_safe_pdf_path(raw_path: str) -> str:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    allowed_dir = os.path.abspath(os.path.join(repo_root, "public"))

    if not os.path.isabs(raw_path):
        clean_rel = raw_path.replace("\\", "/").lstrip("/")
        candidate = os.path.join(allowed_dir, clean_rel)
        if not os.path.exists(candidate):
            candidate_alt = os.path.join(repo_root, clean_rel)
            path = candidate_alt if os.path.exists(candidate_alt) else candidate
        else:
            path = candidate
    else:
        path = raw_path

    real_path = os.path.realpath(path)
    real_allowed = os.path.realpath(allowed_dir)
    real_repo = os.path.realpath(repo_root)

    if not (real_path == real_allowed or real_path.startswith(real_allowed + os.sep) or real_path.startswith(real_repo + os.sep)):
        raise HTTPException(403, "Access to path outside project directory is forbidden.")

    if not real_path.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")

    if not os.path.exists(real_path) or not os.path.isfile(real_path):
        raise HTTPException(404, f"PDF file not found at: {raw_path}")

    return real_path


class RenderPageRequest(BaseModel):
    file_path: str
    page_number: int = 1  # 1-indexed


@app.post("/material/render-page")
async def render_pdf_page(payload: RenderPageRequest):
    """
    Renders a single page of a local PDF file into a base64-encoded PNG/JPEG image
    for OpenAI Vision analysis.
    """
    import pymupdf
    import base64

    real_path = _resolve_safe_pdf_path(payload.file_path)

    try:
        doc = pymupdf.open(real_path)
        total_pages = len(doc)
        page_idx = max(0, min(payload.page_number - 1, total_pages - 1))
        page = doc[page_idx]

        # Clamp max dimensions to 1024px and encode as JPEG for low token usage
        rect = page.rect
        max_dim = max(rect.width, rect.height)
        scale = min(1024.0 / max_dim, 2.0) if max_dim > 0 else 1.0
        mat = pymupdf.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        jpeg_bytes = pix.tobytes("jpeg", jpg_quality=80)
        b64_str = base64.b64encode(jpeg_bytes).decode("utf-8")

        return {
            "success": True,
            "page": page_idx + 1,
            "totalPages": total_pages,
            "image": f"data:image/jpeg;base64,{b64_str}"
        }
    except Exception as e:
        raise HTTPException(500, f"PyMuPDF render error: {str(e)}")


class ExtractDocumentRequest(BaseModel):
    file_path: str
    page_start: Optional[int] = 1
    page_end: Optional[int] = None
    max_pages: Optional[int] = 50
    grade: Optional[int] = None
    subject: Optional[str] = "Reading"
    language: Optional[str] = "en"


@app.post("/material/extract-document-text")
async def extract_document_text(payload: ExtractDocumentRequest):
    """
    Dynamically extracts raw text, structure, reading passages, sections, and embedded questions
    from an uploaded reading material PDF using PyMuPDF.
    """
    import pymupdf

    real_path = _resolve_safe_pdf_path(payload.file_path)

    try:
        doc = pymupdf.open(real_path)
    except Exception as e:
        raise HTTPException(400, f"Failed to open PDF document: {str(e)}")

    total_pages = len(doc)
    start_p = max(0, (payload.page_start or 1) - 1)
    end_p = min(total_pages - 1, (payload.page_end - 1)) if payload.page_end else min(total_pages - 1, start_p + (payload.max_pages or 50) - 1)

    is_phil_iri = bool(re.search(r"phil[-_]?iri", real_path, re.IGNORECASE))
    is_filipino = bool(
        (payload.subject and payload.subject.lower() in ("filipino", "reading - filipino")) or
        (payload.language and payload.language.lower() in ("tl", "fil", "filipino"))
    )

    if is_phil_iri and payload.grade:
        g = int(payload.grade)
        if is_filipino:
            if g == 8:
                start_p, end_p = 145, 155  # p146-156
            elif g == 9:
                start_p, end_p = 156, 166  # p157-167
            elif g == 10:
                start_p, end_p = 167, 178  # p168-179
            else:
                start_p, end_p = 133, 144  # p134-145 (Grade 7 Filipino)
        else:
            if g == 8:
                start_p, end_p = 24, 33  # p25-34
            elif g == 9:
                start_p, end_p = 34, 43  # p35-44
            elif g == 10:
                start_p, end_p = 44, 54  # p45-55 (p56 is answer sheet)
            else:
                start_p, end_p = 14, 23  # p15-24 (Grade 7 English)
    elif payload.grade and total_pages > 25 and (payload.page_start or 1) == 1 and not payload.page_end:
        g = int(payload.grade)
        for i in range(total_pages):
            txt = doc[i].get_text("text")
            if "TABLE OF CONTENTS" in txt.upper() or "TALAAN NG NILALAMAN" in txt.upper():
                continue
            if re.search(rf"Group\s+Screening\s+Test[\s\n]+(?:English|Filipino)?\s*{g}\b", txt, re.IGNORECASE) or \
               re.search(rf"Pangkatang\s+Pagtatasa[\s\n]+(?:English|Filipino)?\s*{g}\b", txt, re.IGNORECASE):
                start_p = i
                end_p = min(total_pages - 1, start_p + 14)
                for j in range(start_p + 1, end_p + 1):
                    next_txt = doc[j].get_text("text")
                    if "TABLE OF CONTENTS" in next_txt.upper():
                        continue
                    if re.search(r"Group\s+Screening\s+Test[\s\n]+(?:English|Filipino)?\s*\d+\b", next_txt, re.IGNORECASE) or \
                       re.search(r"Pangkatang\s+Pagtatasa[\s\n]+(?:English|Filipino)?\s*\d+\b", next_txt, re.IGNORECASE):
                        end_p = j - 1
                        break
                break

    pages_data = []
    full_text_parts = []
    for p in range(start_p, end_p + 1):
        txt = doc[p].get_text("text")
        pages_data.append({"page": p + 1, "text": txt})
        full_text_parts.append(f"--- PAGE {p + 1} ---\n{txt}")

    full_text = "\n\n".join(full_text_parts)

    # 1. Search for official Key to Correction if present in this manual
    detected_key = {}
    grade_to_search = payload.grade or 7
    for p in range(total_pages):
        key_txt = doc[p].get_text("text")
        target_token = f"Filipino {grade_to_search}" if is_filipino else f"English {grade_to_search}"
        if ("Key to Correction" in key_txt or "Sipi ng Guro" in key_txt) and target_token in key_txt:
            section_txt = key_txt.split(target_token, 1)[1]
            next_grade = re.search(r"\b(?:English|Filipino)\s+(?:7|8|9|10)\b", section_txt)
            if next_grade:
                section_txt = section_txt[:next_grade.start()]
            
            # Match Filipino format "1. A (L)" or English format "1. Literal - A"
            if is_filipino:
                fil_matches = re.findall(r"(\d{1,2})\.\s*([A-D])\s*\(([A-Za-z]+)\)", section_txt)
                for num, letter, domain in fil_matches:
                    dom_name = "Literal" if domain == "L" else "Inferential" if domain in ("I", "Inf") else "Critical" if domain in ("C", "Cr") else "Literal"
                    detected_key[int(num)] = {"answer": letter.upper(), "domain": dom_name}
            else:
                matches = re.findall(r"(\d{1,2})\.\s*([A-Za-z]+)?\s*[-–—\s\\?]+\s*([A-D])\b", section_txt)
                for num, domain, letter in matches:
                    dom_name = "Literal" if domain == "L" else "Inferential" if domain in ("I", "Inf") else "Critical" if domain in ("Cr", "C") else "Literal"
                    detected_key[int(num)] = {"answer": letter.upper(), "domain": dom_name}
            if detected_key:
                break

    # 2. Detect selections / reading passages
    PHIL_IRI_SELECTION_META = {
        7: [
            {"letter": "A", "title": "What Little Things!"},
            {"letter": "B", "title": "Plant Intelligence"},
            {"letter": "C", "title": "Get to Know PAGASA's Rainfall Warnings"},
            {"letter": "D", "title": "Solid Waste Management"},
        ],
        8: [
            {"letter": "A", "title": "Africa's Plea"},
            {"letter": "B", "title": "Dinagsa Festival: Colorful Hues of Gaiety"},
            {"letter": "C", "title": "The Negro Speaks of Rivers"},
            {"letter": "D", "title": "Deforestation"},
        ],
        9: [
            {"letter": "A", "title": "The Road Not Taken"},
            {"letter": "B", "title": "Depression: How Serious Can It Get?"},
            {"letter": "C", "title": "Tsunamis"},
            {"letter": "D", "title": "Brain Aneurysms"},
        ],
        10: [
            {"letter": "A", "title": "Still I Rise"},
            {"letter": "B", "title": "Mental Health, Too"},
            {"letter": "C", "title": "Arachne"},
            {"letter": "D", "title": "Transforming Philippine Agriculture"},
        ],
    }

    PHIL_IRI_FILIPINO_SELECTION_META = {
        7: [
            {"letter": "A", "title": "Isandaang Piso"},
            {"letter": "B", "title": "Gen Z at Millennials vs. Kulturang Pilipino"},
            {"letter": "C", "title": "Fiesta Filipinas: Ang Kulay at Musika ng Pista sa Pilipinas"},
            {"letter": "D", "title": "Wikang Filipino"},
        ],
        8: [
            {"letter": "A", "title": "Foul"},
            {"letter": "B", "title": "Pistang Bol-anon"},
            {"letter": "C", "title": "Casa San Miguel: Pugad ng mga Manlilikha"},
            {"letter": "D", "title": "DOH Pneumonia"},
        ],
        9: [
            {"letter": "A", "title": "Estudyante"},
            {"letter": "B", "title": "Echoserang Palaka"},
            {"letter": "C", "title": "Ink-clusive: Karapatan sa Karunungan ng May Kapansanan"},
            {"letter": "D", "title": "Emergency Supply Kit"},
        ],
        10: [
            {"letter": "A", "title": "Abal-abal"},
            {"letter": "B", "title": "Mapa at Direksiyon ng Paglikas"},
            {"letter": "C", "title": "'Di Ako Maglalabas"},
            {"letter": "D", "title": "Big C, Noon at Ngayon"},
        ],
    }

    passages = []

    if is_phil_iri:
        g = int(payload.grade or 7)
        source_meta = PHIL_IRI_FILIPINO_SELECTION_META if is_filipino else PHIL_IRI_SELECTION_META
        if g not in source_meta:
            g = 7
        meta_list = source_meta[g]

        clean_txt = re.sub(r"--- PAGE \d+ ---\n?", "", full_text)
        clean_txt = re.sub(r"^\s*\d+\s*$", "", clean_txt, flags=re.MULTILINE)
        q_blocks = re.split(r"\n\s*(\d{1,2})\.\s*", "\n" + clean_txt)

        questions_by_num = {}
        for q_i in range(1, len(q_blocks), 2):
            num = int(q_blocks[q_i])
            if 1 <= num <= 40:
                q_body = q_blocks[q_i + 1]
                c_parts = re.split(r"\n\s*([A-D])\.\s+", q_body)
                prompt = c_parts[0].strip().replace("\n", " ")
                choices = []
                if len(c_parts) >= 9:
                    for c_idx in range(1, 9, 2):
                        choices.append(c_parts[c_idx + 1].strip().replace("\n", " "))
                key_info = detected_key.get(num, {})
                questions_by_num[num] = {
                    "number": num,
                    "prompt": prompt,
                    "choices": choices if len(choices) == 4 else ["A", "B", "C", "D"],
                    "correctAnswer": key_info.get("answer", "A"),
                    "domain": key_info.get("domain", "Literal"),
                }

        ranges = [(1, 10), (11, 20), (21, 30), (31, 40)]
        for idx, (s_num, e_num) in enumerate(ranges):
            meta = meta_list[idx]
            p_questions = [questions_by_num[n] for n in range(s_num, e_num + 1) if n in questions_by_num]
            passages.append({
                "id": f"passage-{idx+1}",
                "selectionLetter": meta["letter"],
                "title": meta["title"],
                "text": f"Reading Selection {meta['letter']}: {meta['title']}",
                "wordCount": 150,
                "hasQuestions": len(p_questions) > 0,
                "questions": p_questions,
            })
    else:
        selection_pattern = re.compile(
            r"(?:^|\n)\s*(?:Selection\s+([A-D0-9]+)[:\.\s]*|([A-D])\.\s*)\n+([^\n]+(?:\n[^\n]+)?)",
            re.MULTILINE
        )
        matches = list(selection_pattern.finditer(full_text))

        if len(matches) >= 2:
            for idx, m in enumerate(matches):
                letter = m.group(1) or m.group(2) or chr(65 + idx)
                raw_title = m.group(3).strip()
                title_lines = [line.strip() for line in raw_title.split("\n") if line.strip()]
                title = title_lines[0] if title_lines else f"Selection {letter}"
                if title.lower().startswith("by ") and len(title_lines) > 1:
                    title = title_lines[1]

                start_pos = m.end()
                end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(full_text)
                chunk = full_text[start_pos:end_pos].strip()

                q_match = re.search(r"(?:^|\n)\s*(?:\d{1,2}\.|\bQ\d+[:\.])\s+", chunk)
                if q_match:
                    p_text = chunk[:q_match.start()].strip()
                    q_text = chunk[q_match.start():].strip()
                else:
                    p_text = chunk
                    q_text = ""

                p_text = re.sub(r"--- PAGE \d+ ---\n?", "", p_text)
                p_text = re.sub(r"\n\s*\d+\s*\n", "\n", p_text).strip()

                # Parse questions under this passage chunk if any
                parsed_questions = []
                if q_text:
                    q_clean = re.sub(r"--- PAGE \d+ ---\n?", "", q_text)
                    q_clean = re.sub(r"^\s*\d+\s*$", "", q_clean, flags=re.MULTILINE)
                    q_blocks = re.split(r"\n\s*(\d{1,2})\.\s+", "\n" + q_clean)
                    for q_i in range(1, len(q_blocks), 2):
                        num = int(q_blocks[q_i])
                        q_body = q_blocks[q_i + 1]
                        c_parts = re.split(r"\n\s*([A-D])\.\s+", q_body)
                        prompt = c_parts[0].strip().replace("\n", " ")
                        choices = []
                        if len(c_parts) >= 9:
                            for c_idx in range(1, 9, 2):
                                choices.append(c_parts[c_idx + 1].strip().replace("\n", " "))
                        key_info = detected_key.get(num, {})
                        parsed_questions.append({
                            "number": num,
                            "prompt": prompt,
                            "choices": choices if len(choices) == 4 else ["A", "B", "C", "D"],
                            "correctAnswer": key_info.get("answer", "A"),
                            "domain": key_info.get("domain", "Literal"),
                        })

                words = p_text.split()
                if len(words) >= 15 or len(parsed_questions) > 0:
                    if "Infographic" in title or "http" in title or "emb.gov.ph" in title:
                        title = "Solid Waste Management Infographic" if "waste" in chunk.lower() else f"Selection {letter}: Visual Material"
                    passages.append({
                        "id": f"passage-{idx+1}",
                        "selectionLetter": letter,
                        "title": title,
                        "text": p_text if len(p_text.strip()) > 0 else f"[Infographic / Visual Reading Material: {title}]",
                        "wordCount": len(words),
                        "hasQuestions": len(parsed_questions) > 0,
                        "questions": parsed_questions,
                    })

    # Fallback if no explicit Selection A/B/C/D markers: treat reading blocks as passages
    if not passages:
        clean_full = re.sub(r"--- PAGE \d+ ---\n?", "", full_text).strip()
        words = clean_full.split()
        if len(words) >= 20:
            first_line = clean_full.split("\n")[0].strip()[:60]
            title = first_line if len(first_line) > 3 else "Reading Selection"
            passages.append({
                "id": "passage-1",
                "selectionLetter": "A",
                "title": title,
                "text": clean_full[:3500],
                "wordCount": min(len(words), 500),
                "hasQuestions": False,
                "questions": [],
            })

    # Build sections
    roman_numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
    sections = []
    item_cursor = 1
    for s_idx, p in enumerate(passages):
        q_count = len(p.get("questions", []))
        if q_count == 0:
            q_count = 10  # default 10 items per passage
        start_item = item_cursor
        end_item = item_cursor + q_count - 1
        part_num = roman_numerals[s_idx] if s_idx < len(roman_numerals) else str(s_idx + 1)
        sections.append({
            "partNumber": part_num,
            "title": f"PART {part_num}: {p['title']} (Items {start_item}–{end_item})",
            "topic": p["title"],
            "passageTitle": p["title"],
            "passageText": p["text"],
            "startItem": start_item,
            "endItem": end_item,
            "itemRange": f"Items {start_item}–{end_item}",
            "instructions": f"Directions: Read the selection '{p['title']}' carefully. Choose the letter of the correct answer for items {start_item}–{end_item}.",
        })
        item_cursor = end_item + 1

    return {
        "success": True,
        "file_path": payload.file_path,
        "total_pages": total_pages,
        "page_range": [start_p + 1, end_p + 1],
        "raw_text": full_text[:10000],
        "passages": passages,
        "sections": sections,
        "detected_answer_key": detected_key,
    }


# ── Reading Audio Analysis ──────────────────────────────────────────────────────

@app.post("/reading/analyze")
async def reading_analyze(
    file: UploadFile = File(...),
    input_format: str = Form("webm"),
):
    """
    Analyze a reading audio recording using Librosa.

    Accepts: WebM, MP3, WAV, OGG audio file.
    Returns: Duration, pauses, silence, pacing, hesitation features.
    Whisper STT is handled separately by the Next.js layer.
    """
    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(400, "Audio file too large (max 50MB)")

    result = analyze_reading_audio(audio_bytes, input_format)
    return result


# ── K-Means Clustering ─────────────────────────────────────────────────────────

class ClusterRequest(BaseModel):
    vectors: list[list[float]]
    k: int = 3
    feature_names: Optional[list[str]] = None
    learner_ids: Optional[list[str]] = None


@app.post("/cluster")
async def cluster_endpoint(req: ClusterRequest):
    """
    Cluster learners using K-Means++ (scikit-learn).

    Body: { vectors: [[...], ...], k: 3, feature_names?: [...], learner_ids?: [...] }
    Returns: labels, centroids, cluster names, learner mapping.
    """
    if not req.vectors:
        raise HTTPException(400, "No vectors provided")

    result = cluster_learners(
        vectors=req.vectors,
        k=req.k,
        feature_names=req.feature_names,
        learner_ids=req.learner_ids,
    )
    return result


# ── Run ─────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)

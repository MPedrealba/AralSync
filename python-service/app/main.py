"""
AralSync Python AI Microservice — FastAPI

Endpoints:
  POST /omr/detect       — OpenCV bubble-sheet OMR detection
  POST /reading/analyze  — Librosa reading audio analysis
  POST /cluster          — scikit-learn K-Means learner clustering

Runs on port 8000 (configurable via PORT env var).
"""

import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .omr import detect_omr_sheet
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
):
    """
    Detect answers from a scanned OMR bubble sheet.

    Accepts: PNG/JPEG image of a filled bubble sheet.
    Returns: Per-question detected answer (A/B/C/D) or blank.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (PNG, JPEG)")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "Image too large (max 10MB)")

    result = detect_omr_sheet(image_bytes, num_questions)
    return result


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
        })

    return {"success": True, "page_count": len(pages), "pages": pages}


# ── Learning Material PDF Renderer ──────────────────────────────────────────

class RenderPageRequest(BaseModel):
    file_path: str
    page_number: int = 1  # 1-indexed


@app.post("/material/render-page")
async def render_pdf_page(payload: RenderPageRequest):
    """
    Renders a single page of a local PDF file into a base64-encoded PNG image
    for OpenAI Vision analysis.
    """
    import pymupdf
    import base64
    import os

    # Resolve absolute path with repo root fallbacks
    path = os.path.abspath(payload.file_path)
    if not os.path.exists(path):
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        clean_rel = payload.file_path.replace("\\", "/").lstrip("/")
        candidate1 = os.path.join(repo_root, clean_rel)
        candidate2 = os.path.join(repo_root, "public", clean_rel)
        if os.path.exists(candidate1):
            path = candidate1
        elif os.path.exists(candidate2):
            path = candidate2
        else:
            raise HTTPException(404, f"PDF file not found at: {payload.file_path}")

    try:
        doc = pymupdf.open(path)
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

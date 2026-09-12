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

"""
Reading audio analysis using Librosa.

Extracts acoustic features from a reading recording:
- Reading duration (total & speech-only)
- Pause analysis (count, total duration, average length)
- Silence analysis (total silence, ratio to total duration, longest silence)
- Pacing analysis (inter-syllable/word timing consistency via onset detection)
- Hesitation patterns (repeated onsets / stutters / micro-pauses)

Whisper STT stays in the Next.js layer (Groq API).
This module focuses on the acoustic/signal features that Librosa provides.
"""

import subprocess
import tempfile
import os
import json
from pathlib import Path
from typing import Optional

import numpy as np
import librosa
import soundfile as sf


# ── ffmpeg Path ──────────────────────────────────────────────────────────────────

def _find_ffmpeg() -> str:
    """
    Locate ffmpeg binary. Checks:
    1. python-service/ffmpeg/bin/ffmpeg.exe (portable, in repo)
    2. System PATH fallback
    """
    # Portable ffmpeg in repo
    repo_ffmpeg = Path(__file__).parent.parent / "ffmpeg" / "bin" / "ffmpeg.exe"
    if repo_ffmpeg.exists():
        return str(repo_ffmpeg)

    # Linux/macOS variant
    repo_ffmpeg_unix = Path(__file__).parent.parent / "ffmpeg" / "bin" / "ffmpeg"
    if repo_ffmpeg_unix.exists():
        return str(repo_ffmpeg_unix)

    # System PATH fallback
    return "ffmpeg"


FFMPEG_PATH = _find_ffmpeg()


# ── Audio Decoding ──────────────────────────────────────────────────────────────

def decode_to_wav(input_bytes: bytes, input_format: str = "webm") -> str:
    """
    Decode any audio format (WebM, Opus, MP3, etc.) to WAV using ffmpeg.
    Returns path to the temporary WAV file (caller should clean up).
    """
    tmp_input = tempfile.NamedTemporaryFile(delete=False, suffix=f".{input_format}")
    tmp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp_input_name = tmp_input.name
    tmp_output_name = tmp_output.name
    tmp_input.close()
    tmp_output.close()

    try:
        # Write input bytes by reopening the (now closed) temp file
        with open(tmp_input_name, "wb") as f:
            f.write(input_bytes)

        cmd = [
            FFMPEG_PATH, "-y",
            "-i", tmp_input_name,
            "-ar", "22050",    # Librosa default sample rate
            "-ac", "1",        # mono
            "-f", "wav",
            tmp_output_name
        ]

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30
        )

        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg decode failed: {result.stderr[:500]}")

        return tmp_output_name

    finally:
        # Clean up input temp file
        try:
            os.unlink(tmp_input_name)
        except OSError:
            pass


# ── Feature Extraction ──────────────────────────────────────────────────────────

def extract_reading_features(audio_path: str) -> dict:
    """
    Extract comprehensive reading features from a WAV file using Librosa.

    Returns dict with:
        - duration_sec: total audio duration
        - speech_duration_sec: estimated speech-only duration
        - pause_count: number of pauses (>0.5s gaps)
        - pause_total_sec: total time spent pausing
        - pause_avg_sec: average pause length
        - silence_total_sec: total silence (librosa silence detection)
        - silence_ratio: silence / total duration
        - silence_longest_sec: longest continuous silence
        - pacing_mean: mean inter-onset interval (speech rhythm)
        - pacing_cv: coefficient of variation of IOIs (consistency)
        - hesitations: count of detected hesitation patterns
        - onset_times: list of onset timestamps (for downstream analysis)
    """
    # Load audio
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    if duration < 0.1:
        return _empty_features(duration)

    # ── Onset Detection (speech rhythm / pacing) ────────────────────────────
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(
        y=y, sr=sr, onset_envelope=onset_env,
        backtrack=True, pre_max=3, post_max=3, pre_avg=3, post_avg=5,
        delta=0.2, wait=2
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr).tolist()

    # ── Inter-Onset Intervals (IOI) — pacing metric ─────────────────────────
    if len(onset_times) >= 2:
        iois = np.diff(onset_times)
        # Filter out very short IOIs (< 0.05s = likely sub-word) and very long (> 3s = pause)
        speech_iois = iois[(iois > 0.05) & (iois < 3.0)]

        if len(speech_iois) > 0:
            pacing_mean = float(np.mean(speech_iois))
            pacing_cv = float(np.std(speech_iois) / np.mean(speech_iois)) if np.mean(speech_iois) > 0 else 0.0
        else:
            pacing_mean = 0.0
            pacing_cv = 0.0
    else:
        pacing_mean = 0.0
        pacing_cv = 0.0

    # ── Pause Detection (gaps between speech segments) ──────────────────────
    # Using non-silent intervals with a threshold
    intervals = librosa.effects.split(y, top_db=25)

    pause_count = 0
    pause_total = 0.0
    pause_lengths = []

    if len(intervals) > 1:
        for i in range(1, len(intervals)):
            gap_start = intervals[i-1][1] / sr
            gap_end = intervals[i][0] / sr
            gap_duration = gap_end - gap_start

            if gap_duration > 0.5:  # pause threshold: 0.5 seconds
                pause_count += 1
                pause_total += gap_duration
                pause_lengths.append(gap_duration)

    pause_avg = pause_total / pause_count if pause_count > 0 else 0.0

    # ── Speech Duration ─────────────────────────────────────────────────────
    speech_duration = sum((end - start) / sr for start, end in intervals)

    # ── Silence Analysis (Librosa non-silent segment detection) ──────────────
    # More granular: detect all silence below threshold
    silence_threshold_db = -35
    non_silent = librosa.effects.split(y, top_db=abs(silence_threshold_db))

    # Build silence intervals (complement of non-silent)
    silence_intervals = []
    prev_end = 0
    for start, end in non_silent:
        if start > prev_end:
            silence_intervals.append((prev_end, start))
        prev_end = end
    if prev_end < len(y):
        silence_intervals.append((prev_end, len(y)))

    silence_total = sum((end - start) / sr for start, end in silence_intervals)
    silence_longest = max(((end - start) / sr for start, end in silence_intervals), default=0.0)
    silence_ratio = silence_total / duration if duration > 0 else 0.0

    # ── Hesitation Detection ────────────────────────────────────────────────
    # Hesitations = micro-pauses (0.1–0.5s) between onsets + repeated very short IOIs
    hesitation_count = 0

    if len(onset_times) >= 2:
        iois = np.diff(onset_times)
        # Micro-pauses between words (hesitation indicator)
        micro_pauses = iois[(iois >= 0.1) & (iois <= 0.5)]
        hesitation_count += len(micro_pauses)

        # Repeated very short IOIs (< 0.08s) suggest stuttering/repetition
        very_short = iois[iois < 0.08]
        hesitation_count += len(very_short)

    return {
        "duration_sec": round(duration, 2),
        "speech_duration_sec": round(speech_duration, 2),
        "pause_count": pause_count,
        "pause_total_sec": round(pause_total, 2),
        "pause_avg_sec": round(pause_avg, 2),
        "silence_total_sec": round(silence_total, 2),
        "silence_ratio": round(silence_ratio, 4),
        "silence_longest_sec": round(silence_longest, 2),
        "pacing_mean": round(pacing_mean, 4),
        "pacing_cv": round(pacing_cv, 4),
        "hesitations": hesitation_count,
        "onset_times": [round(t, 3) for t in onset_times],
    }


def _empty_features(duration: float) -> dict:
    """Return empty features for very short/empty audio."""
    return {
        "duration_sec": round(duration, 2),
        "speech_duration_sec": 0.0,
        "pause_count": 0,
        "pause_total_sec": 0.0,
        "pause_avg_sec": 0.0,
        "silence_total_sec": 0.0,
        "silence_ratio": 0.0,
        "silence_longest_sec": 0.0,
        "pacing_mean": 0.0,
        "pacing_cv": 0.0,
        "hesitations": 0,
        "onset_times": [],
    }


# ── Public API ──────────────────────────────────────────────────────────────────

def analyze_reading_audio(audio_bytes: bytes, input_format: str = "webm") -> dict:
    """
    Main entry point: analyze a reading recording.

    Args:
        audio_bytes: Raw audio file bytes (WebM, MP3, WAV, etc.)
        input_format: Format hint for ffmpeg (webm, mp3, wav, ogg, etc.)

    Returns:
        dict with success flag + features or error message
    """
    wav_path = None
    try:
        wav_path = decode_to_wav(audio_bytes, input_format)
        features = extract_reading_features(wav_path)
        return {"success": True, "features": features, "errors": []}

    except Exception as e:
        return {"success": False, "features": None, "errors": [str(e)]}

    finally:
        if wav_path:
            try:
                os.unlink(wav_path)
            except OSError:
                pass


def analyze_reading_file(file_path: str) -> dict:
    """Convenience wrapper for local file path."""
    ext = Path(file_path).suffix.lstrip(".")
    with open(file_path, "rb") as f:
        return analyze_reading_audio(f.read(), ext or "wav")

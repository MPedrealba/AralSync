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

try:
    import noisereduce as nr
    NOISEREDUCE_AVAILABLE = True
except ImportError:
    NOISEREDUCE_AVAILABLE = False


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

    # ── Spectral Gating Noise Cancellation ──────────────────────────────────
    # Filters out continuous background noise (classroom fans, AC drone, computer hum)
    # using non-destructive stationary spectral gating before feature extraction.
    denoise_applied = False
    y_clean = y
    if NOISEREDUCE_AVAILABLE and duration >= 0.5:
        try:
            y_clean = nr.reduce_noise(
                y=y,
                sr=sr,
                stationary=True,
                prop_decrease=0.75,
                n_fft=1024,
                hop_length=512,
            )
            denoise_applied = True
        except Exception:
            y_clean = y

    # ── Onset Detection (speech rhythm / pacing) ────────────────────────────
    onset_env = librosa.onset.onset_strength(y=y_clean, sr=sr)
    onset_frames = librosa.onset.onset_detect(
        y=y_clean, sr=sr, onset_envelope=onset_env,
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

    # ── Dynamic RMS Noise Floor Adaptation ──────────────────────────────────
    # Classroom environments often have background ambient noise (fans, distance chatter).
    # Measure the RMS energy distribution on the cleaned audio to dynamically adapt top_db.
    rms = librosa.feature.rms(y=y_clean, frame_length=2048, hop_length=512)[0]
    if len(rms) > 0 and np.max(rms) > 1e-5:
        rms_db = librosa.amplitude_to_db(rms, ref=np.max)
        # 15th percentile approximates background noise floor; 85th percentile approximates active speech
        noise_floor_db = float(np.percentile(rms_db, 15))
        speech_level_db = float(np.percentile(rms_db, 85))
        # Target a split threshold positioned between noise floor and speech level
        # Clamped between 14 dB (noisy classroom) and 35 dB (clean audio)
        adaptive_top_db = float(np.clip(abs(speech_level_db - noise_floor_db) * 0.65 + 6.0, 14.0, 35.0))
    else:
        adaptive_top_db = 25.0

    intervals = librosa.effects.split(y_clean, top_db=adaptive_top_db)

    # ── Pause Detection (Phil-IRI Standardized Thresholds) ──────────────────
    # Phil-IRI standard: >= 2.0 seconds represents significant hesitation / block.
    # Gaps between 0.5s and 1.5s (or < 2.0s) represent natural cadence and micro-pauses.
    pause_count = 0
    pause_total = 0.0
    pause_lengths = []
    cadence_micro_pauses = 0

    if len(intervals) > 1:
        for i in range(1, len(intervals)):
            gap_start = intervals[i-1][1] / sr
            gap_end = intervals[i][0] / sr
            gap_duration = gap_end - gap_start

            if gap_duration >= 2.0:
                # Phil-IRI meaningful reading pause (significant hesitation)
                pause_count += 1
                pause_total += gap_duration
                pause_lengths.append(gap_duration)
            elif 0.5 <= gap_duration < 2.0:
                # Natural cadence / micro-pause
                cadence_micro_pauses += 1

    pause_avg = pause_total / pause_count if pause_count > 0 else 0.0

    # ── Speech Duration ─────────────────────────────────────────────────────
    speech_duration = sum((end - start) / sr for start, end in intervals)

    # ── Silence Analysis (granular silence intervals) ───────────────────────
    silence_threshold_db = min(-30.0, -adaptive_top_db - 5.0)
    non_silent = librosa.effects.split(y, top_db=abs(silence_threshold_db))

    silence_intervals = []
    prev_end = 0
    for start, end in non_silent:
        if start > prev_end:
            silence_intervals.append((prev_end, start))
        prev_end = end
    if prev_end < len(y):
        silence_intervals.append((prev_end, len(y)))

    silence_total = sum((end - start) / sr for start, end in silence_intervals)
    silence_longest = max(
        max(((end - start) / sr for start, end in silence_intervals), default=0.0),
        max(pause_lengths, default=0.0)
    )
    silence_ratio = silence_total / duration if duration > 0 else 0.0

    # ── Hesitation Detection ────────────────────────────────────────────────
    # Combines cadence micro-pauses (0.5s - 1.5s) with stutter/repetition onsets (< 0.08s)
    hesitation_count = cadence_micro_pauses

    if len(onset_times) >= 2:
        iois = np.diff(onset_times)
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
        "micro_pauses": cadence_micro_pauses,
        "adaptive_top_db": round(adaptive_top_db, 1),
        "noise_cancellation_applied": denoise_applied,
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
        "noise_cancellation_applied": False,
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

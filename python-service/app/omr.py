"""
OMR (Optical Mark Recognition) bubble-sheet detection using OpenCV.

Workflow:
1. Load image (scanned bubble sheet)
2. Detect 4 fiducial registration marks (filled black circles in corners)
3. Perspective-warp to rectangular grid
4. Locate bubble rows/columns
5. Determine if each bubble is filled (dark pixel ratio > threshold)
6. Return per-question answer (first filled bubble) or blank

The bubble sheet layout (printed by the Next.js BubbleSheetPrint component):
- 50 questions max, 5 columns × 10 rows
- Each question has 4 option bubbles (A/B/C/D) arranged horizontally
- 4 fiducial marks: top-left, top-right, bottom-left, bottom-right corners
"""

import cv2
import numpy as np
from typing import Optional


# ── Configuration ──────────────────────────────────────────────────────────────

# Grid layout matching BubbleSheetPrint (50 questions: 5 cols × 10 rows)
NUM_COLS = 5       # question columns per page section
NUM_ROWS = 10      # questions per column section
OPTIONS_PER_Q = 4  # A/B/C/D bubbles per question

# Bubble detection thresholds
FILL_THRESHOLD = 0.35   # ratio of dark pixels to consider bubble "filled"
MIN_BUBBLE_AREA = 200   # minimum contour area to consider as a bubble
FIDUCIAL_SIZE_RATIO = 0.02  # fiducial mark diameter as fraction of image width


# ── Fiducial Mark Detection ────────────────────────────────────────────────────

def detect_fiducials(img_gray: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect the 4 corner registration marks (filled black circles).
    Returns 4 corner points in order: [TL, TR, BL, BR] or None if not found.
    """
    h, w = img_gray.shape

    # Threshold to binary (fiducials are dark/black on white background)
    _, binary = cv2.threshold(img_gray, 120, 255, cv2.THRESH_BINARY_INV)

    # Find contours
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Filter for circular-ish blobs of expected size
    expected_area = np.pi * ((h * FIDUCIAL_SIZE_RATIO) / 2) ** 2
    min_area = expected_area * 0.3
    max_area = expected_area * 5.0

    candidates = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if min_area < area < max_area:
            # Check circularity
            perimeter = cv2.arcLength(cnt, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter ** 2)
                if circularity > 0.5:  # somewhat circular
                    M = cv2.moments(cnt)
                    if M["m00"] > 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        candidates.append((cx, cy, area))

    if len(candidates) < 4:
        return None

    # Sort by area descending, take top 4
    candidates.sort(key=lambda c: c[2], reverse=True)
    top4 = candidates[:4]

    # Assign to corners based on position
    points = np.array([[c[0], c[1]] for c in top4], dtype=np.float32)
    xs = points[:, 0]
    ys = points[:, 1]

    # TL = smallest (x+y); BR = largest (x+y); TR = largest (x−y); BL = smallest (x−y)
    s = xs + ys
    d = xs - ys

    tl = points[int(np.argmin(s))]
    br = points[int(np.argmax(s))]
    tr = points[int(np.argmax(d))]
    bl = points[int(np.argmin(d))]

    return np.array([tl, tr, bl, br], dtype=np.float32)


# ── Perspective Warp ────────────────────────────────────────────────────────────

def warp_to_grid(img: np.ndarray, corners: np.ndarray,
                  target_w: int = 800, target_h: int = 1000) -> np.ndarray:
    """Apply perspective transform to get a flat rectangular view."""
    dst = np.array([
        [0, 0],
        [target_w - 1, 0],
        [0, target_h - 1],
        [target_w - 1, target_h - 1]
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(corners, dst)
    return cv2.warpPerspective(img, M, (target_w, target_h))


# ── Bubble Grid Detection ───────────────────────────────────────────────────────

def find_bubble_grid(warped_gray: np.ndarray,
                      num_questions: int = 50) -> list[list[tuple[int, int, int, int]]]:
    """
    Locate the bubble grid in the warped image.
    Returns a list of rows, each row is a list of (cx, cy, radius, question_index) tuples.

    Layout assumption: questions arranged in columns (top-to-bottom, left-to-right),
    each question has 4 bubbles (A/B/C/D) left-to-right.
    """
    h, w = warped_gray.shape

    # Binarize
    _, binary = cv2.threshold(warped_gray, 140, 255, cv2.THRESH_BINARY_INV)

    # Find all circular contours (bubbles)
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    bubbles = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < MIN_BUBBLE_AREA:
            continue
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter ** 2)
        if circularity < 0.5:
            continue
        M = cv2.moments(cnt)
        if M["m00"] == 0:
            continue
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        radius = int(np.sqrt(area / np.pi))
        bubbles.append((cx, cy, radius))

    if not bubbles:
        return []

    # ── Deduplicate coincident contours ──
    # findContours returns both the outer ring and the inner hole of each bubble
    # as separate circles at the same (cx, cy). Collapse pairs that overlap
    # within a small distance, keeping the larger-radius contour (the outer ring).
    merged: list[tuple[int, int, int]] = []
    for b in sorted(bubbles, key=lambda b: (b[1], b[0], b[2])):
        if merged:
            cx0, cy0, _ = merged[-1]
            if abs(b[0] - cx0) <= 4 and abs(b[1] - cy0) <= 4:
                # Same spot → keep the larger radius (outer ring)
                if b[2] > merged[-1][2]:
                    merged[-1] = b
                continue
        merged.append(b)
    bubbles = merged

    # Sort bubbles: group by row (y-coordinate), then by column (x-coordinate)
    bubbles.sort(key=lambda b: (b[1], b[0]))

    # Cluster into rows using y-coordinate gaps
    rows = []
    current_row = [bubbles[0]]
    y_threshold = (bubbles[0][2]) * 2  # gap = 2× bubble radius

    for b in bubbles[1:]:
        if abs(b[1] - current_row[-1][1]) > y_threshold:
            rows.append(sorted(current_row, key=lambda x: x[0]))
            current_row = [b]
        else:
            current_row.append(b)
    rows.append(sorted(current_row, key=lambda x: x[0]))

    # Map to questions: each row of bubbles = OPTIONS_PER_Q bubbles per question
    # Questions are arranged in columns: col 0 has Q1-Q10, col 1 has Q11-Q20, etc.
    grid = []
    q_idx = 0

    for row_bubbles in rows:
        # Group into sets of 4 (A/B/C/D per question)
        for q_start in range(0, len(row_bubbles), OPTIONS_PER_Q):
            q_bubbles = row_bubbles[q_start:q_start + OPTIONS_PER_Q]
            if len(q_bubbles) == OPTIONS_PER_Q and q_idx < num_questions:
                grid.append([(b[0], b[1], b[2], q_idx) for b in q_bubbles])
                q_idx += 1

    return grid


# ── Bubble Reading ──────────────────────────────────────────────────────────────

def read_bubbles(warped_gray: np.ndarray,
                  grid: list[list[tuple[int, int, int, int]]]) -> list[Optional[int]]:
    """
    For each question in the grid, determine which bubble(s) are filled.
    Returns a list of answers: index of filled option (0=A, 1=B, 2=C, 3=D) or None.

    Uses adaptive thresholding + dark pixel ratio for robust detection.
    """
    # Adaptive binary for uneven lighting
    binary = cv2.adaptiveThreshold(
        warped_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 51, 10
    )

    answers = []

    for question_bubbles in grid:
        fill_scores = []
        for cx, cy, radius, _ in question_bubbles:
            # Sample the inner disk of the bubble (excludes the border ring)
            r = max(int(radius * 0.95), 6)
            y1 = max(0, cy - r)
            y2 = min(binary.shape[0], cy + r)
            x1 = max(0, cx - r)
            x2 = min(binary.shape[1], cx + r)

            roi = binary[y1:y2, x1:x2]
            if roi.size == 0:
                fill_scores.append(0.0)
                continue

            # Circular mask: only count pixels inside the bubble disk
            yy, xx = np.ogrid[:roi.shape[0], :roi.shape[1]]
            center = (cy - y1, cx - x1)
            mask = (xx - center[1]) ** 2 + (yy - center[0]) ** 2 <= r * r
            disk = roi[mask]
            if disk.size == 0:
                fill_scores.append(0.0)
                continue

            # Ratio of dark pixels inside the disk
            fill_ratio = np.count_nonzero(disk) / disk.size
            fill_scores.append(fill_ratio)

        # Determine answer: highest fill ratio, but must exceed threshold
        if not fill_scores:
            answers.append(None)
            continue

        max_score = max(fill_scores)
        if max_score >= FILL_THRESHOLD:
            # Check for multiple fills (ambiguous)
            filled_count = sum(1 for s in fill_scores if s >= FILL_THRESHOLD)
            if filled_count == 1:
                answers.append(fill_scores.index(max_score))
            else:
                # Multiple fills = invalid/blank
                answers.append(None)
        else:
            answers.append(None)

    return answers


# ── Public API ──────────────────────────────────────────────────────────────────

OPTION_LABELS = ["A", "B", "C", "D"]


def detect_omr_sheet(image_bytes: bytes, num_questions: int = 50) -> dict:
    """
    Main entry point: process an OMR bubble sheet image.

    Args:
        image_bytes: Raw image file bytes (PNG, JPEG, etc.)
        num_questions: Expected number of questions on the sheet

    Returns:
        dict with:
            - success: bool
            - answers: list of {question, answer_label, answer_index, filled: bool}
            - detected_questions: int
            - errors: list of error messages (if any)
    """
    # Decode image from bytes
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"success": False, "answers": [], "detected_questions": 0,
                "errors": ["Could not decode image. Supported formats: PNG, JPEG."]}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Step 1: Find registration marks
    corners = detect_fiducials(gray)
    if corners is None:
        # Fallback: assume image is already aligned, use full image
        # Try grid detection on raw image
        warped = cv2.resize(gray, (800, 1000))
    else:
        # Step 2: Warp to rectangular grid
        warped = warp_to_grid(img, corners)
        warped = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

    # Step 3: Find bubble grid
    grid = find_bubble_grid(warped, num_questions)

    if not grid:
        return {"success": False, "answers": [], "detected_questions": 0,
                "errors": ["No bubble grid detected. Ensure the sheet has registration marks "
                          "and is scanned clearly."]}

    # Step 4: Read bubbles
    raw_answers = read_bubbles(warped, grid)

    # Build result
    results = []
    errors = []
    filled_count = 0

    for i, answer_idx in enumerate(raw_answers):
        entry = {
            "question": i + 1,
            "answer_index": answer_idx,
            "answer_label": OPTION_LABELS[answer_idx] if answer_idx is not None else None,
            "filled": answer_idx is not None,
        }
        results.append(entry)
        if answer_idx is not None:
            filled_count += 1

    # Quality warnings
    if filled_count < num_questions * 0.5:
        errors.append(f"Only {filled_count}/{num_questions} bubbles detected as filled. "
                     "Image quality may be insufficient.")

    if len(grid) < num_questions:
        errors.append(f"Expected {num_questions} questions but grid shows {len(grid)}. "
                     "Layout may not match expected format.")

    return {
        "success": True,
        "answers": results,
        "detected_questions": len(grid),
        "filled_count": filled_count,
        "errors": errors,
    }


def detect_omr_sheet_path(image_path: str, num_questions: int = 50) -> dict:
    """Convenience wrapper for file path input."""
    with open(image_path, "rb") as f:
        return detect_omr_sheet(f.read(), num_questions)

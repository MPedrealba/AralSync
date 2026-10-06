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
MIN_BUBBLE_AREA = 45    # minimum contour area to consider as a bubble
FIDUCIAL_SIZE_RATIO = 0.02  # fiducial mark diameter as fraction of image width


# ── Fiducial Mark Detection ────────────────────────────────────────────────────

def detect_fiducials(img_gray: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect the corner registration marks (solid black squares/circles).
    Only returns corners if actual registration fiducials are found:
    - Bounding area between 800 and 20000 px
    - Aspect ratio between 0.65 and 1.5
    - Strictly within outer < 7% corner margins of the image width and height
    If not found, returns None so unwarped pages are not falsely distorted.
    """
    h, w = img_gray.shape
    candidates = []

    for thresh_mode in [120, 'otsu']:
        if thresh_mode == 'otsu':
            _, binary = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        else:
            _, binary = cv2.threshold(img_gray, 120, 255, cv2.THRESH_BINARY_INV)

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 800 or area > 20000:
                continue
            x, y, bw, bh = cv2.boundingRect(cnt)
            if not (0.65 <= bw / max(bh, 1) <= 1.5):
                continue
            cx = x + bw // 2
            cy = y + bh // 2
            # Extreme outer corner margins (< 7% of width/height)
            is_extreme = (
                (cx < 0.07 * w and cy < 0.07 * h) or
                (cx > 0.93 * w and cy < 0.07 * h) or
                (cx < 0.07 * w and cy > 0.93 * h) or
                (cx > 0.93 * w and cy > 0.93 * h)
            )
            if is_extreme:
                candidates.append((cx, cy, area))
        if len(candidates) >= 4:
            break

    if len(candidates) < 3:
        return None

    tl = tr = bl = br = None
    min_d_tl = min_d_tr = min_d_bl = min_d_br = float('inf')

    for cx, cy, _ in candidates:
        if cx < 0.07 * w and cy < 0.07 * h:
            d = cx**2 + cy**2
            if d < min_d_tl:
                min_d_tl = d
                tl = np.array([cx, cy], dtype=np.float32)
        elif cx > 0.93 * w and cy < 0.07 * h:
            d = (w - cx)**2 + cy**2
            if d < min_d_tr:
                min_d_tr = d
                tr = np.array([cx, cy], dtype=np.float32)
        elif cx < 0.07 * w and cy > 0.93 * h:
            d = cx**2 + (h - cy)**2
            if d < min_d_bl:
                min_d_bl = d
                bl = np.array([cx, cy], dtype=np.float32)
        elif cx > 0.93 * w and cy > 0.93 * h:
            d = (w - cx)**2 + (h - cy)**2
            if d < min_d_br:
                min_d_br = d
                br = np.array([cx, cy], dtype=np.float32)

    found = sum(1 for c in [tl, tr, bl, br] if c is not None)
    if found == 4:
        return np.array([tl, tr, bl, br], dtype=np.float32)
    if found == 3:
        if br is None:
            br = tr + bl - tl
        elif bl is None:
            bl = tl + br - tr
        elif tr is None:
            tr = tl + br - bl
        elif tl is None:
            tl = tr + bl - br
        return np.array([tl, tr, bl, br], dtype=np.float32)

    return None


# ── Perspective Warp ────────────────────────────────────────────────────────────

def warp_to_grid(img: np.ndarray, corners: np.ndarray,
                  target_w: int = 1275, target_h: int = 1650) -> np.ndarray:
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
    Locate the bubble grid in the sheet image with column-first ordering.
    In DepEd ARAL standardized 50-item sheets:
      - Column 1: Questions 1 to 17 (approx X in [180, 360])
      - Column 2: Questions 18 to 34 (approx X in [540, 720])
      - Column 3: Questions 35 to 50 (approx X in [880, 1080])
    Returns a list of questions, each having 4 (cx, cy, radius, question_index) tuples.
    """
    h, w = warped_gray.shape

    # 1. Primary bubble detection via Hough Circle Transform
    blurred = cv2.GaussianBlur(warped_gray, (5, 5), 0)
    hc = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT,
        dp=1, minDist=18, param1=50, param2=18, minRadius=10, maxRadius=32
    )

    all_bubbles: list[tuple[int, int, int]] = []
    if hc is not None:
        for pt in hc[0]:
            cx, cy, r = int(pt[0]), int(pt[1]), int(pt[2])
            if cy > 480:  # Below header
                all_bubbles.append((cx, cy, r))

    # 2. Combined with contour detection to capture shaded/faint bubbles
    _, binary = cv2.threshold(warped_gray, 140, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 150 or area > 1400:
            continue
        p = cv2.arcLength(cnt, True)
        if p == 0:
            continue
        circ = 4 * np.pi * area / (p * p)
        if circ < 0.35:
            continue
        M = cv2.moments(cnt)
        if M["m00"] == 0:
            continue
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        r = int(np.sqrt(area / np.pi))
        if cy > 480:
            if not any(abs(cx - b[0]) <= 10 and abs(cy - b[1]) <= 10 for b in all_bubbles):
                all_bubbles.append((cx, cy, r))

    if not all_bubbles:
        return []

    # Check if standard DepEd ARAL 3-column layout matches (Col 1 in [180, 360])
    c1_candidates = [b for b in all_bubbles if 180 <= b[0] <= 360]

    grid = []
    q_idx = 0

    if len(c1_candidates) >= 12:
        # Standard DepEd ARAL 3-column layout
        col_ranges = [
            (180, 360, 17),
            (540, 720, 17),
            (880, 1080, 16),
        ]
        for x_min, x_max, max_q_in_col in col_ranges:
            col_b = [b for b in all_bubbles if x_min <= b[0] <= x_max]
            if not col_b:
                continue

            col_b.sort(key=lambda b: (b[1], b[0]))
            raw_rows: list[list[tuple[int, int, int]]] = []
            curr_row: list[tuple[int, int, int]] = [col_b[0]]

            for b in col_b[1:]:
                if abs(b[1] - curr_row[-1][1]) > 25:
                    raw_rows.append(sorted(curr_row, key=lambda x: x[0]))
                    curr_row = [b]
                else:
                    curr_row.append(b)
            raw_rows.append(sorted(curr_row, key=lambda x: x[0]))

            valid_rows = [r for r in raw_rows if len(r) >= 3][:max_q_in_col]
            four_rows = [r for r in valid_rows if len(r) == OPTIONS_PER_Q]
            ref_x = [int(np.median([r[i][0] for r in four_rows])) for i in range(OPTIONS_PER_Q)] if four_rows else None
            delta_x = int(np.median([r[1][0] - r[0][0] for r in four_rows])) if four_rows else 42

            for r in valid_rows:
                if q_idx >= num_questions:
                    break

                if len(r) == OPTIONS_PER_Q:
                    q_bubbles = r
                elif len(r) == 3:
                    avg_y = int(np.mean([b[1] for b in r]))
                    avg_r = int(np.mean([b[2] for b in r]))
                    if ref_x:
                        matched = {min(range(OPTIONS_PER_Q), key=lambda i: abs(b[0] - ref_x[i])) for b in r}
                        missing_slot = list(set(range(OPTIONS_PER_Q)) - matched)
                        slot = missing_slot[0] if missing_slot else 3
                        missing_x = ref_x[slot]
                    else:
                        missing_x = r[2][0] + delta_x
                    q_bubbles = sorted(r + [(missing_x, avg_y, avg_r)], key=lambda b: b[0])
                else:
                    if ref_x:
                        best_4 = sorted(list({min(r, key=lambda b: abs(b[0] - xt)) for xt in ref_x}), key=lambda b: b[0])
                        q_bubbles = best_4 if len(best_4) == OPTIONS_PER_Q else r[:OPTIONS_PER_Q]
                    else:
                        q_bubbles = r[:OPTIONS_PER_Q]

                grid.append([(b[0], b[1], b[2], q_idx) for b in q_bubbles])
                q_idx += 1

    else:
        # Fallback dynamic column clustering by X gaps (> 60px) for non-standard sheets
        filtered = [b for b in all_bubbles if 0.05 * h < b[1] < 0.95 * h and 0.04 * w < b[0] < 0.96 * w]
        if not filtered:
            filtered = all_bubbles

        # Deduplicate coincident bubbles within 6px
        merged: list[tuple[int, int, int]] = []
        for b in sorted(filtered, key=lambda b: (b[1], b[0], b[2])):
            if merged:
                cx0, cy0, _ = merged[-1]
                if abs(b[0] - cx0) <= 6 and abs(b[1] - cy0) <= 6:
                    if b[2] > merged[-1][2]:
                        merged[-1] = b
                    continue
            merged.append(b)

        sorted_by_x = sorted(merged, key=lambda b: b[0])
        col_clusters: list[list[tuple[int, int, int]]] = []
        curr_col: list[tuple[int, int, int]] = [sorted_by_x[0]]

        for b in sorted_by_x[1:]:
            if b[0] - curr_col[-1][0] > 60:
                col_clusters.append(curr_col)
                curr_col = [b]
            else:
                curr_col.append(b)
        col_clusters.append(curr_col)

        for col_bubbles in col_clusters:
            col_bubbles.sort(key=lambda b: (b[1], b[0]))
            raw_rows = []
            curr_row = [col_bubbles[0]]

            for b in col_bubbles[1:]:
                if abs(b[1] - curr_row[-1][1]) > 20:
                    raw_rows.append(sorted(curr_row, key=lambda x: x[0]))
                    curr_row = [b]
                else:
                    curr_row.append(b)
            raw_rows.append(sorted(curr_row, key=lambda x: x[0]))

            four_rows = [r for r in raw_rows if len(r) == OPTIONS_PER_Q]
            ref_x = [int(np.median([r[i][0] for r in four_rows])) for i in range(OPTIONS_PER_Q)] if four_rows else None
            delta_x = int(np.median([r[1][0] - r[0][0] for r in four_rows])) if four_rows else 45

            for r in raw_rows:
                if q_idx >= num_questions:
                    break

                if len(r) == OPTIONS_PER_Q:
                    grid.append([(b[0], b[1], b[2], q_idx) for b in r])
                    q_idx += 1
                elif len(r) == 3:
                    avg_y = int(np.mean([b[1] for b in r]))
                    avg_r = int(np.mean([b[2] for b in r]))
                    if ref_x:
                        matched = {min(range(OPTIONS_PER_Q), key=lambda i: abs(b[0] - ref_x[i])) for b in r}
                        missing_slot = list(set(range(OPTIONS_PER_Q)) - matched)
                        slot = missing_slot[0] if missing_slot else 3
                        missing_x = ref_x[slot]
                    else:
                        missing_x = r[2][0] + delta_x
                    r_est = sorted(r + [(missing_x, avg_y, avg_r)], key=lambda b: b[0])
                    grid.append([(b[0], b[1], b[2], q_idx) for b in r_est])
                    q_idx += 1
                elif len(r) > OPTIONS_PER_Q:
                    if ref_x:
                        best_4 = sorted(list({min(r, key=lambda b: abs(b[0] - xt)) for xt in ref_x}), key=lambda b: b[0])
                        q_bubbles = best_4 if len(best_4) == OPTIONS_PER_Q else r[:OPTIONS_PER_Q]
                    else:
                        q_bubbles = r[:OPTIONS_PER_Q]
                    grid.append([(b[0], b[1], b[2], q_idx) for b in q_bubbles])
                    q_idx += 1

    return grid


# ── Bubble Reading ──────────────────────────────────────────────────────────────

def read_bubbles(warped_gray: np.ndarray,
                  grid: list[list[tuple[int, int, int, int]]]) -> list[Optional[int]]:
    """
    For each question in the grid, determine which bubble(s) are filled.
    Returns a list of answers: index of filled option (0=A, 1=B, 2=C, 3=D) or None.

    Calculates the mean grayscale pixel intensity (0-255) of the inner circular disk
    for each bubble and uses relative darkness (darkest vs median of others) to detect answers.
    """
    h, w = warped_gray.shape
    answers = []
    DIFF_THRESHOLD = 18.0   # Grayscale intensity difference threshold (0-255)
    RATIO_THRESHOLD = 1.25  # Darker ratio compared to median of other bubbles

    for question_bubbles in grid:
        intensities = []
        for cx, cy, radius, _ in question_bubbles:
            # Sample the inner disk of the bubble (75% radius to avoid outer border ring)
            r = max(int(radius * 0.75), 5)
            y1 = max(0, cy - r)
            y2 = min(h, cy + r)
            x1 = max(0, cx - r)
            x2 = min(w, cx + r)

            roi = warped_gray[y1:y2, x1:x2]
            if roi.size == 0:
                intensities.append(255.0)
                continue

            # Circular mask: only measure pixels inside the inner bubble disk
            yy, xx = np.ogrid[:roi.shape[0], :roi.shape[1]]
            mask = (xx - (cx - x1)) ** 2 + (yy - (cy - y1)) ** 2 <= r * r
            disk = roi[mask]
            if disk.size == 0:
                intensities.append(255.0)
                continue

            # Mean grayscale intensity (0 = black/shaded, 255 = white/unshaded)
            mean_intensity = float(np.mean(disk))
            intensities.append(mean_intensity)

        if len(intensities) < OPTIONS_PER_Q:
            answers.append(None)
            continue

        sorted_indices = np.argsort(intensities)
        darkest_idx = int(sorted_indices[0])
        runner_up_idx = int(sorted_indices[1])

        i_dark = intensities[darkest_idx]
        i_runner = intensities[runner_up_idx]

        other_3 = [intensities[i] for i in range(OPTIONS_PER_Q) if i != darkest_idx]
        other_median = float(np.median(other_3))

        diff = other_median - i_dark
        ratio = other_median / max(i_dark, 1.0)

        # The selected answer must be significantly darker than the median of the other 3 bubbles
        is_dark_enough = (diff > DIFF_THRESHOLD) or (ratio >= RATIO_THRESHOLD)

        # Ambiguous multi-fill check: if the runner-up is also significantly darker than the rest
        remaining_2 = [intensities[i] for i in range(OPTIONS_PER_Q) if i not in (darkest_idx, runner_up_idx)]
        rem_median = float(np.median(remaining_2)) if remaining_2 else 255.0
        is_double_fill = (rem_median - i_runner > DIFF_THRESHOLD) and (i_runner - i_dark < 15.0)

        if is_dark_enough and not is_double_fill:
            answers.append(darkest_idx)
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
    h_orig, w_orig = gray.shape

    # Step 1: Find registration marks
    corners = detect_fiducials(gray)
    if corners is None:
        # Normalize resolution to standard (1275, 1650) to keep coordinate scales consistent
        if (h_orig, w_orig) != (1650, 1275):
            warped = cv2.resize(gray, (1275, 1650))
        else:
            warped = gray.copy()
    else:
        # Step 2: Warp to standard rectangular grid
        warped = warp_to_grid(gray, corners, target_w=1275, target_h=1650)

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

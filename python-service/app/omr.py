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

import base64
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


# ── Document Paper Boundary & Corner Detection ───────────────────────────────

def order_corners(pts: np.ndarray) -> np.ndarray:
    """
    Sort the 4 detected corners in order: [top-left, top-right, bottom-left, bottom-right].
    pts shape: (4, 2)
    """
    pts = np.array(pts, dtype=np.float32).reshape((4, 2))
    rect = np.zeros((4, 2), dtype=np.float32)

    # Top-left has smallest sum (x + y), bottom-right has largest sum (x + y)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left
    rect[3] = pts[np.argmax(s)]   # bottom-right

    # Top-right has smallest diff (y - x), bottom-left has largest diff (y - x)
    diff = pts[:, 1] - pts[:, 0]
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[2] = pts[np.argmax(diff)]  # bottom-left

    return rect


def detect_document_contour(img_gray: np.ndarray) -> Optional[np.ndarray]:
    """
    Automatic Document Paper Contour Detection.
    - Downscales for speed, applies Gaussian blur and edge detection / adaptive thresholding.
    - Finds the largest 4-sided contour (cv2.approxPolyDP with 4 vertices, or cv2.minAreaRect)
      that covers > 20% of the image area.
    - Sorts the 4 detected corners in order: [top-left, top-right, bottom-left, bottom-right].
    - Returns None if no clear document boundary covering > 20% is found.
    """
    h, w = img_gray.shape

    # Downscale for speed (target max dimension ~800px)
    max_dim = max(h, w)
    scale = 800.0 / max_dim if max_dim > 800 else 1.0
    if scale < 1.0:
        target_w = int(w * scale)
        target_h = int(h * scale)
        resized = cv2.resize(img_gray, (target_w, target_h), interpolation=cv2.INTER_AREA)
    else:
        resized = img_gray.copy()

    resized_h, resized_w = resized.shape
    resized_area = float(resized_h * resized_w)

    blurred = cv2.GaussianBlur(resized, (5, 5), 0)

    # Multi-method contour candidate extraction
    candidate_contours = []

    # 1. Canny edges + morphological close
    edged = cv2.Canny(blurred, 30, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel, iterations=2)
    cnts1, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidate_contours.extend(cnts1)

    # 2. Adaptive thresholding for varied/shadowed lighting
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    thresh_inv = cv2.bitwise_not(thresh)
    thresh_closed = cv2.morphologyEx(thresh_inv, cv2.MORPH_CLOSE, kernel, iterations=2)
    cnts2, _ = cv2.findContours(thresh_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidate_contours.extend(cnts2)

    # 3. Otsu thresholding
    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    otsu_closed = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel, iterations=2)
    cnts3, _ = cv2.findContours(otsu_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidate_contours.extend(cnts3)

    # 4. Multi-level search: look for the printed outer black rectangle frame first
    # Using RETR_LIST captures internal contours (such as the printed frame inside the paper sheet)
    cnts_frame_edge, _ = cv2.findContours(closed, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cnts_frame_thresh, _ = cv2.findContours(thresh_closed, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    frame_candidates = list(cnts_frame_edge) + list(cnts_frame_thresh)
    frame_candidates.sort(key=cv2.contourArea, reverse=True)

    # Step A: Look for the printed outer black rectangle frame first
    for cnt in frame_candidates:
        area = cv2.contourArea(cnt)
        if area < 0.20 * resized_area or area > 0.98 * resized_area:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            pts = approx.reshape((4, 2))
            ordered = order_corners(pts)
            w_top = np.linalg.norm(ordered[1] - ordered[0])
            w_bot = np.linalg.norm(ordered[3] - ordered[2])
            h_left = np.linalg.norm(ordered[2] - ordered[0])
            h_right = np.linalg.norm(ordered[3] - ordered[1])
            avg_w = max(float((w_top + w_bot) / 2.0), 1.0)
            avg_h = max(float((h_left + h_right) / 2.0), 1.0)
            aspect = avg_h / avg_w if avg_h >= avg_w else avg_w / avg_h
            if 1.05 <= aspect <= 1.65:
                orig_pts = ordered / scale if scale < 1.0 else ordered
                return order_corners(orig_pts)

    if not candidate_contours:
        return None

    # Step B: Fallback to largest convex paper boundary contour (> 20% area)
    candidate_contours.sort(key=cv2.contourArea, reverse=True)

    for cnt in candidate_contours:
        area = cv2.contourArea(cnt)
        # Must cover > 20% of image area
        if area < 0.20 * resized_area:
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        pts = None
        if len(approx) == 4 and cv2.isContourConvex(approx):
            pts = approx.reshape((4, 2))
        else:
            # Fallback to minAreaRect for 4 vertices
            rect = cv2.minAreaRect(cnt)
            box = cv2.boxPoints(rect)
            box_area = cv2.contourArea(box)
            if box_area >= 0.20 * resized_area:
                pts = box

        if pts is not None:
            # Rescale points to original resolution
            orig_pts = pts / scale if scale < 1.0 else pts
            return order_corners(orig_pts)

    return None


# ── Fiducial Mark Detection ────────────────────────────────────────────────────

def detect_fiducials(img_gray: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect the corner registration marks (solid black squares/circles).
    Only returns corners if actual registration fiducials are found:
    - Bounding area between 300 and 25000 px
    - Aspect ratio between 0.65 and 1.5
    - Strictly within outer < 9% corner margins of the image width and height
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
            if area < 300 or area > 25000:
                continue
            x, y, bw, bh = cv2.boundingRect(cnt)
            if not (0.65 <= bw / max(bh, 1) <= 1.5):
                continue
            cx = x + bw // 2
            cy = y + bh // 2
            # Extreme outer corner margins (< 9% of width/height)
            is_extreme = (
                (cx < 0.09 * w and cy < 0.09 * h) or
                (cx > 0.91 * w and cy < 0.09 * h) or
                (cx < 0.09 * w and cy > 0.91 * h) or
                (cx > 0.91 * w and cy > 0.91 * h)
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
        if cx < 0.09 * w and cy < 0.09 * h:
            d = cx**2 + cy**2
            if d < min_d_tl:
                min_d_tl = d
                tl = np.array([cx, cy], dtype=np.float32)
        elif cx > 0.91 * w and cy < 0.09 * h:
            d = (w - cx)**2 + cy**2
            if d < min_d_tr:
                min_d_tr = d
                tr = np.array([cx, cy], dtype=np.float32)
        elif cx < 0.09 * w and cy > 0.91 * h:
            d = cx**2 + (h - cy)**2
            if d < min_d_bl:
                min_d_bl = d
                bl = np.array([cx, cy], dtype=np.float32)
        elif cx > 0.91 * w and cy > 0.91 * h:
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

    M = cv2.getPerspectiveTransform(corners.astype(np.float32), dst)
    return cv2.warpPerspective(img, M, (target_w, target_h))


# ── Bubble Grid Detection ───────────────────────────────────────────────────────

def find_bubble_grid(warped_gray: np.ndarray,
                      num_questions: int = 50) -> list[list[tuple[int, int, int, int]]]:
    """
    Locate the bubble grid dynamically using relative X column clustering and Y row spacing.
    Eliminates rigid hardcoded pixel boundaries so minor print scaling, perspective shifts,
    or photo warps do not break question indexing.
    """
    h, w = warped_gray.shape

    # 0. Pre-process: CLAHE normalize to handle uneven lighting for detection
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    equalized = clahe.apply(warped_gray)

    # 1. Primary bubble detection via Hough Circle Transform (on both raw and CLAHE)
    blurred = cv2.GaussianBlur(warped_gray, (5, 5), 0)
    blurred_eq = cv2.GaussianBlur(equalized, (5, 5), 0)

    all_bubbles: list[tuple[int, int, int]] = []

    for src in [blurred, blurred_eq]:
        hc = cv2.HoughCircles(
            src, cv2.HOUGH_GRADIENT,
            dp=1, minDist=18, param1=50, param2=18, minRadius=10, maxRadius=32
        )
        if hc is not None:
            for pt in hc[0]:
                cx, cy, r = int(pt[0]), int(pt[1]), int(pt[2])
                if 0.08 * h < cy < 0.98 * h and 0.04 * w < cx < 0.96 * w:
                    if not any(abs(cx - b[0]) <= 8 and abs(cy - b[1]) <= 8 for b in all_bubbles):
                        all_bubbles.append((cx, cy, r))

    # 2. Combined with contour detection to capture shaded/faint bubbles
    # Use multiple threshold levels to catch both light pencil and dark pen marks
    for thresh_val in [140, 160, 120]:
        _, binary = cv2.threshold(warped_gray, thresh_val, 255, cv2.THRESH_BINARY_INV)
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
            if 0.08 * h < cy < 0.98 * h and 0.04 * w < cx < 0.96 * w:
                if not any(abs(cx - b[0]) <= 8 and abs(cy - b[1]) <= 8 for b in all_bubbles):
                    all_bubbles.append((cx, cy, r))

    if not all_bubbles:
        return []

    # 3. Filter bubbles inside content boundaries
    filtered = [b for b in all_bubbles if 0.08 * h < b[1] < 0.98 * h and 0.04 * w < b[0] < 0.96 * w]
    if not filtered:
        filtered = all_bubbles

    # 4. Deduplicate coincident bubbles within 6px
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
    if not sorted_by_x:
        return []

    # 5. Dynamic Column Clustering by Relative X gaps (> 65px)
    gap_threshold = max(65, int(0.05 * w))
    raw_col_clusters: list[list[tuple[int, int, int]]] = []
    curr_col: list[tuple[int, int, int]] = [sorted_by_x[0]]

    for b in sorted_by_x[1:]:
        if b[0] - curr_col[-1][0] > gap_threshold:
            raw_col_clusters.append(curr_col)
            curr_col = [b]
        else:
            curr_col.append(b)
    raw_col_clusters.append(curr_col)

    # Retain columns that contain sufficient bubbles (at least 8 bubbles for valid questions)
    col_clusters = [col for col in raw_col_clusters if len(col) >= 8]
    if not col_clusters:
        col_clusters = raw_col_clusters

    # Sort columns left-to-right based on median X coordinate
    col_clusters.sort(key=lambda col: float(np.median([b[0] for b in col])))

    grid: list[list[tuple[int, int, int, int]]] = []
    q_idx = 0

    # Determine maximum questions per column:
    # Proportional column distribution for 3-column, 2-column, or single-column layouts:
    # - 50 items across 3 cols: [17, 17, 16]
    # - 40 items across 3 cols: [14, 13, 13]
    # - General: dynamically distribute remainder across leading columns
    num_cols = len(col_clusters)
    if num_cols == 3:
        if num_questions == 50:
            col_capacities = [17, 17, 16]
        elif num_questions == 40:
            col_capacities = [14, 13, 13]
        else:
            base = num_questions // 3
            rem = num_questions % 3
            col_capacities = [base + (1 if i < rem else 0) for i in range(3)]
    elif num_cols == 2:
        base = num_questions // 2
        rem = num_questions % 2
        col_capacities = [base + (1 if i < rem else 0) for i in range(2)]
    else:
        col_capacities = [num_questions]

    row_gap_threshold = max(18, int(0.012 * h))

    for col_idx, col_bubbles in enumerate(col_clusters):
        if q_idx >= num_questions:
            break

        max_in_col = col_capacities[col_idx] if col_idx < len(col_capacities) else 20

        # Sort bubbles in this column top-to-bottom by Y, then X
        col_bubbles.sort(key=lambda b: (b[1], b[0]))
        raw_rows: list[list[tuple[int, int, int]]] = []
        curr_row: list[tuple[int, int, int]] = [col_bubbles[0]]

        for b in col_bubbles[1:]:
            row_avg_y = float(np.mean([item[1] for item in curr_row]))
            y_diff = abs(b[1] - row_avg_y)
            has_x_collision = any(abs(b[0] - item[0]) < 22 for item in curr_row)
            is_row_full = len(curr_row) >= 4

            if is_row_full or has_x_collision or y_diff > 12:
                raw_rows.append(sorted(curr_row, key=lambda x: x[0]))
                curr_row = [b]
            else:
                curr_row.append(b)

        if curr_row:
            raw_rows.append(sorted(curr_row, key=lambda x: x[0]))

        # Filter rows with at least 2 candidate bubbles
        valid_rows = [r for r in raw_rows if len(r) >= 2][:max_in_col]
        four_rows = [r for r in valid_rows if len(r) == OPTIONS_PER_Q]

        ref_x = [int(np.median([r[i][0] for r in four_rows])) for i in range(OPTIONS_PER_Q)] if four_rows else None
        delta_x = int(np.median([r[1][0] - r[0][0] for r in four_rows])) if len(four_rows) > 0 and len(four_rows[0]) >= 2 else 42

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
            elif len(r) == 2 and ref_x:
                avg_y = int(np.mean([b[1] for b in r]))
                avg_r = int(np.mean([b[2] for b in r]))
                matched = {min(range(OPTIONS_PER_Q), key=lambda i: abs(b[0] - ref_x[i])) for b in r}
                missing_slots = sorted(list(set(range(OPTIONS_PER_Q)) - matched))
                reconstructed = list(r)
                for slot in missing_slots:
                    reconstructed.append((ref_x[slot], avg_y, avg_r))
                q_bubbles = sorted(reconstructed, key=lambda b: b[0])
            else:
                if ref_x:
                    best_4 = sorted(list({min(r, key=lambda b: abs(b[0] - xt)) for xt in ref_x}), key=lambda b: b[0])
                    q_bubbles = best_4 if len(best_4) == OPTIONS_PER_Q else r[:OPTIONS_PER_Q]
                else:
                    q_bubbles = r[:OPTIONS_PER_Q]

            grid.append([(b[0], b[1], b[2], q_idx) for b in q_bubbles])
            q_idx += 1

    return grid


# ── Bubble Reading ──────────────────────────────────────────────────────────────

def _snap_bubble_center(warped_gray: np.ndarray, cx: int, cy: int,
                         radius: int, search_px: int = 8) -> tuple[int, int]:
    """
    Sub-pixel center snapping: search a ±search_px window around the nominal
    center and snap to the pixel with the highest local dark-mass concentration.
    This corrects for 5-15 px drift caused by perspective warp inaccuracies.
    """
    h, w = warped_gray.shape
    r = max(int(radius * 0.6), 4)
    best_cx, best_cy = cx, cy
    best_score = float('inf')

    for dy in range(-search_px, search_px + 1, 2):
        for dx in range(-search_px, search_px + 1, 2):
            nx, ny = cx + dx, cy + dy
            y1 = max(0, ny - r)
            y2 = min(h, ny + r)
            x1 = max(0, nx - r)
            x2 = min(w, nx + r)
            roi = warped_gray[y1:y2, x1:x2]
            if roi.size == 0:
                continue
            score = float(np.mean(roi))  # lower = darker = better centered on a filled mark
            if score < best_score:
                best_score = score
                best_cx, best_cy = nx, ny

    return best_cx, best_cy


def _clahe_normalize(warped_gray: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to normalize
    uneven lighting across the sheet — handles phone camera shadows, glare,
    and variable column illumination.
    """
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(warped_gray)


def read_bubbles(warped_gray: np.ndarray,
                  grid: list[list[tuple[int, int, int, int]]]) -> list[Optional[int]]:
    """
    For each question in the grid, determine which bubble(s) are filled.
    Returns a list of answers: index of filled option (0=A, 1=B, 2=C, 3=D) or None.

    Uses adaptive local contrast comparison with sub-pixel center snapping and
    CLAHE-normalized intensity to handle pen/pencil marks, variable lighting,
    shadows, and slight perspective misalignment.
    """
    h, w = warped_gray.shape

    # Pre-process: normalize lighting across the entire sheet
    normalized = _clahe_normalize(warped_gray)

    answers = []

    # Adaptive thresholds — deliberately lenient for pen/pencil marks
    DIFF_THRESHOLD = 15.0    # Grayscale intensity difference (lowered from 25)
    RATIO_THRESHOLD = 1.12   # Darker ratio vs median of others (lowered from 1.25)
    # Absolute darkness gate: a filled bubble must have mean intensity < this
    # on the CLAHE-normalized image (prevents false positives on uniformly dark areas)
    ABS_DARK_CEILING = 210.0

    for question_bubbles in grid:
        intensities_raw = []
        intensities_norm = []
        snapped_centers = []

        for cx, cy, radius, _ in question_bubbles:
            # 1. Snap center to actual darkest local region (corrects warp drift)
            snapped_cx, snapped_cy = _snap_bubble_center(normalized, cx, cy, radius, search_px=8)
            snapped_centers.append((snapped_cx, snapped_cy))

            # 2. Sample the inner disk (70% radius to avoid outer border ring)
            r = max(int(radius * 0.70), 5)
            y1 = max(0, snapped_cy - r)
            y2 = min(h, snapped_cy + r)
            x1 = max(0, snapped_cx - r)
            x2 = min(w, snapped_cx + r)

            # Measure on BOTH raw and CLAHE-normalized images
            roi_raw = warped_gray[y1:y2, x1:x2]
            roi_norm = normalized[y1:y2, x1:x2]

            if roi_raw.size == 0:
                intensities_raw.append(255.0)
                intensities_norm.append(255.0)
                continue

            # Circular mask: only measure pixels inside the inner bubble disk
            yy, xx = np.ogrid[:roi_raw.shape[0], :roi_raw.shape[1]]
            mask = (xx - (snapped_cx - x1)) ** 2 + (yy - (snapped_cy - y1)) ** 2 <= r * r
            disk_raw = roi_raw[mask]
            disk_norm = roi_norm[mask]

            if disk_raw.size == 0:
                intensities_raw.append(255.0)
                intensities_norm.append(255.0)
                continue

            # Use the lower 60th percentile of pixel values (ignores specular highlights
            # and partial un-filled areas — focuses on the darkest ink region)
            sorted_raw = np.sort(disk_raw)
            sorted_norm = np.sort(disk_norm)
            cutoff = max(1, int(len(sorted_raw) * 0.6))
            mean_raw = float(np.mean(sorted_raw[:cutoff]))
            mean_norm = float(np.mean(sorted_norm[:cutoff]))

            intensities_raw.append(mean_raw)
            intensities_norm.append(mean_norm)

        if len(intensities_norm) < OPTIONS_PER_Q:
            answers.append(None)
            continue

        # --- Decision logic using BOTH raw and normalized intensities ---

        # Primary: use normalized intensities (handles lighting variation)
        sorted_indices = np.argsort(intensities_norm)
        darkest_idx = int(sorted_indices[0])
        runner_up_idx = int(sorted_indices[1])

        i_dark_norm = intensities_norm[darkest_idx]
        i_runner_norm = intensities_norm[runner_up_idx]

        other_3_norm = [intensities_norm[i] for i in range(OPTIONS_PER_Q) if i != darkest_idx]
        other_median_norm = float(np.median(other_3_norm))

        diff_norm = other_median_norm - i_dark_norm
        ratio_norm = other_median_norm / max(i_dark_norm, 1.0)

        # Secondary: cross-check on raw intensities
        i_dark_raw = intensities_raw[darkest_idx]
        other_3_raw = [intensities_raw[i] for i in range(OPTIONS_PER_Q) if i != darkest_idx]
        other_median_raw = float(np.median(other_3_raw))
        diff_raw = other_median_raw - i_dark_raw
        ratio_raw = other_median_raw / max(i_dark_raw, 1.0)

        # Accept if EITHER normalized OR raw channel shows clear separation
        is_dark_enough = (
            (diff_norm > DIFF_THRESHOLD) or
            (ratio_norm >= RATIO_THRESHOLD) or
            (diff_raw > DIFF_THRESHOLD) or
            (ratio_raw >= RATIO_THRESHOLD)
        )

        # Absolute darkness gate: the darkest bubble must actually be reasonably dark
        # (prevents selecting a bubble when ALL bubbles are blank/white)
        is_absolutely_dark = i_dark_norm < ABS_DARK_CEILING

        # Ambiguous multi-fill check: if the runner-up is also significantly darker
        remaining_2 = [intensities_norm[i] for i in range(OPTIONS_PER_Q) if i not in (darkest_idx, runner_up_idx)]
        rem_median = float(np.median(remaining_2)) if remaining_2 else 255.0
        is_double_fill = (rem_median - i_runner_norm > DIFF_THRESHOLD) and (i_runner_norm - i_dark_norm < 10.0)

        if is_dark_enough and is_absolutely_dark and not is_double_fill:
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

    # Step 1: Automatic Document Paper Contour Detection & Perspective Warp
    paper_corners = detect_document_contour(gray)
    if paper_corners is not None:
        warped = warp_to_grid(gray, paper_corners, target_w=1275, target_h=1650)
    else:
        # Fallback if no distinct document boundary detected
        corners = detect_fiducials(gray)
        if corners is not None:
            warped = warp_to_grid(gray, corners, target_w=1275, target_h=1650)
        elif (h_orig, w_orig) != (1650, 1275):
            warped = cv2.resize(gray, (1275, 1650))
        else:
            warped = gray.copy()

    # Step 1.5: If fiducial marks exist on the warped sheet, refine warp for sub-pixel accuracy
    refined_corners = detect_fiducials(warped)
    if refined_corners is not None:
        warped = warp_to_grid(warped, refined_corners, target_w=1275, target_h=1650)

    # Step 2.5: Extract Name & Section Header Crop
    name_crop_base64 = extract_name_crop(warped)

    # Step 3: Find bubble grid
    grid = find_bubble_grid(warped, num_questions)

    if not grid:
        return {"success": False, "answers": [], "detected_questions": 0,
                "name_crop_base64": name_crop_base64,
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
        "name_crop_base64": name_crop_base64,
        "errors": errors,
    }


def extract_name_crop(warped_img: np.ndarray) -> Optional[str]:
    """
    Extracts the handwritten Name & Class/Section box from the standardized 1275x1650 warped grid.
    Coordinates: Y in [260, 420], X in [80, 860].
    Returns base64-encoded JPEG image string.
    """
    try:
        h, w = warped_img.shape[:2]
        y1, y2 = int(260 * h / 1650), int(420 * h / 1650)
        x1, x2 = int(80 * w / 1275), int(860 * w / 1275)
        crop = warped_img[y1:y2, x1:x2]
        if crop.size == 0:
            return None
        _, buf = cv2.imencode('.jpg', crop, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        return base64.b64encode(buf).decode('utf-8')
    except Exception as e:
        print(f"Error extracting name crop: {e}")
        return None


def build_name_collages(crop_items: list[dict], max_per_collage: int = 8) -> list[dict]:
    """
    Stitches cropped name boxes into labeled vertical composite collages.
    Each item in crop_items:
      - 'index': int (0-based sheet index)
      - 'image_base64': str
    Returns a list of collages:
      - 'collage_base64': str
      - 'indices': list[int]
    """
    collages = []
    target_w = 780
    target_h = 140
    sep = np.full((4, target_w), 140, dtype=np.uint8)

    for i in range(0, len(crop_items), max_per_collage):
        chunk = crop_items[i : i + max_per_collage]
        labeled_crops = []
        chunk_indices = []

        for item in chunk:
            idx = item.get("index", 0)
            b64 = item.get("image_base64")
            if not b64:
                continue
            try:
                img_data = base64.b64decode(b64)
                np_arr = np.frombuffer(img_data, np.uint8)
                crop_img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
                if crop_img is None:
                    continue
                resized = cv2.resize(crop_img, (target_w, target_h))
                cv2.rectangle(resized, (0, 0), (64, target_h), (245, 245, 245), -1)
                cv2.rectangle(resized, (0, 0), (64, target_h), (180, 180, 180), 1)
                cv2.putText(resized, f"#{idx + 1}", (8, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (20, 20, 20), 2)
                labeled_crops.append(resized)
                chunk_indices.append(idx)
            except Exception as e:
                print(f"Error processing crop for collage: {e}")
                continue

        if labeled_crops:
            stacked = []
            for c_idx, c in enumerate(labeled_crops):
                if c_idx > 0:
                    stacked.append(sep)
                stacked.append(c)
            composite = np.vstack(stacked)
            _, buf = cv2.imencode('.jpg', composite, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            collages.append({
                "collage_base64": base64.b64encode(buf).decode('utf-8'),
                "indices": chunk_indices,
            })

    return collages


def detect_omr_sheet_path(image_path: str, num_questions: int = 50) -> dict:
    """Convenience wrapper for file path input."""
    with open(image_path, "rb") as f:
        return detect_omr_sheet(f.read(), num_questions)

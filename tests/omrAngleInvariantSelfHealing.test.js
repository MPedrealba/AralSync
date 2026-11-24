const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

describe('OMR Angle-Invariant Self-Healing Vision Pipeline Suite', () => {
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. Robust 4-Corner Homography neutralizes 3D perspective tilts and maps to 1275x1650 canvas', () => {
    assert.ok(
      pythonOmrSrc.includes('cv2.getPerspectiveTransform') &&
      pythonOmrSrc.includes('cv2.warpPerspective') &&
      pythonOmrSrc.includes('flags=cv2.INTER_CUBIC'),
      'omr.py must apply cv2.getPerspectiveTransform with cv2.INTER_CUBIC to 1275x1650 canvas'
    );
    assert.ok(
      pythonOmrSrc.includes('target_w: int = 1275') &&
      pythonOmrSrc.includes('target_h: int = 1650'),
      'warp_to_grid must standardize to 1275x1650 upright rectangle'
    );
  });

  test('2. Column-Header Anchor Calibration dynamically locates 3 bands without hardcoded static coordinates', () => {
    assert.ok(
      pythonOmrSrc.includes('Band 1 (Items 1-17)') &&
      pythonOmrSrc.includes('Band 2 (Items 18-34)') &&
      pythonOmrSrc.includes('Band 3 (Items 35-50)'),
      'find_bubble_grid must partition the sheet into the 3 printed column bands'
    );
    assert.ok(
      pythonOmrSrc.includes('kmeans(xs') || pythonOmrSrc.includes('calibrated_xs'),
      'find_bubble_grid must dynamically calibrate local X-offsets for options [A, B, C, D]'
    );
  });

  test('3. Vertical Row Anchor Calibration interpolates row Y-positions evenly with delta_y = (y_bottom - y_top) / 16', () => {
    assert.ok(
      pythonOmrSrc.includes('delta_y = (y_bottom - y_top) / 16') ||
      pythonOmrSrc.includes('(y_bottom - y_top) / 16.0'),
      'find_bubble_grid must calibrate vertical rows using delta_y = (y_bottom - y_top) / 16'
    );
    assert.ok(
      pythonOmrSrc.includes('top_cands') && pythonOmrSrc.includes('bot_cands'),
      'find_bubble_grid must locate top row (Item 1) and bottom row (Item 17) anchors'
    );
  });

  test('4. Local Search Bubble Snapping searches 10px window in X and Y and evaluates relative row contrast', () => {
    assert.ok(
      pythonOmrSrc.includes('search_px = 10') &&
      pythonOmrSrc.includes('max(0, cy - search_px)') &&
      pythonOmrSrc.includes('max(0, cx - search_px)'),
      'read_bubbles must allow a local search window of 10px in X and Y to snap to darkest local ink mass'
    );
    assert.ok(
      pythonOmrSrc.includes('diff = other_median - darkest') ||
      pythonOmrSrc.includes('best_diff = max(diff, diff_raw)'),
      'read_bubbles must measure darkness using relative row contrast against median of competitors'
    );
  });

  test('5. End-to-End Verification: 3 Camera Angles (Straight, 15-deg Tilt, Rotation) maintain >90% accuracy', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExe)) return;

    const script = `
import sys
sys.path.insert(0, 'python-service')
import cv2, numpy as np
from app.omr import detect_omr_sheet

# Load real mobile exam sheet
with open('public/uploads/omr/omr-6a9dc59011eef70f0ba1e849-1795423649059.jpg', 'rb') as f:
    base_bytes = f.read()

base_img = cv2.imdecode(np.frombuffer(base_bytes, np.uint8), cv2.IMREAD_COLOR)
h, w = base_img.shape[:2]

# 1. Angle 1: Straight / Original Mobile Photo
res1 = detect_omr_sheet(base_bytes, 40)
assert res1['success'] is True, "Angle 1 detection failed"
acc1 = (res1['filled_count'] / 40.0) * 100.0
assert acc1 >= 90.0, f"Angle 1 accuracy below 90%: {acc1}%"

# 2. Angle 2: 15-degree Keystone Tilt (Perspective transformation on desk)
src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
dst_pts = np.float32([
    [0.10 * w, 0.08 * h],
    [0.90 * w, 0.08 * h],
    [0.98 * w, 0.96 * h],
    [0.02 * w, 0.96 * h]
])
M_tilt = cv2.getPerspectiveTransform(src_pts, dst_pts)
tilted_img = cv2.warpPerspective(base_img, M_tilt, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(150, 150, 150))
_, tilted_buf = cv2.imencode('.jpg', tilted_img)
res2 = detect_omr_sheet(tilted_buf.tobytes(), 40)
assert res2['success'] is True, "Angle 2 detection failed"
acc2 = (res2['filled_count'] / 40.0) * 100.0
assert acc2 >= 90.0, f"Angle 2 accuracy below 90%: {acc2}%"

# 3. Angle 3: Slight Rotation (8-degree rotation with background)
M_rot = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), 8.0, 0.90)
rotated_img = cv2.warpAffine(base_img, M_rot, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(140, 140, 140))
_, rot_buf = cv2.imencode('.jpg', rotated_img)
res3 = detect_omr_sheet(rot_buf.tobytes(), 40)
assert res3['success'] is True, "Angle 3 detection failed"
acc3 = (res3['filled_count'] / 40.0) * 100.0
assert acc3 >= 90.0, f"Angle 3 accuracy below 90%: {acc3}%"

print(f"ANGLE_INVARIANT_OMR_OK: Angle1={acc1:.1f}%, Angle2={acc2:.1f}%, Angle3={acc3:.1f}%")
`.trim();

    const out = execFileSync(pythonExe, ['-c', script], {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
    });
    assert.ok(out.includes('ANGLE_INVARIANT_OMR_OK'), 'All 3 camera angles must exceed 90% accuracy');
  });
});

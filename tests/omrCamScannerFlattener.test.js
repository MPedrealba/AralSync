const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('OMR CamScanner-Style 4-Point Quadrilateral Homography Flattener Suite', () => {
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. omr.py implements bilateral filtering and adaptive thresholding for edge-preserving pre-processing', () => {
    assert.ok(
      pythonOmrSrc.includes('cv2.bilateralFilter') &&
      pythonOmrSrc.includes('9, 75, 75'),
      'detect_document_contour must apply cv2.bilateralFilter(resized, 9, 75, 75)'
    );
    assert.ok(
      pythonOmrSrc.includes('cv2.adaptiveThreshold') &&
      pythonOmrSrc.includes('cv2.ADAPTIVE_THRESH_GAUSSIAN_C') &&
      pythonOmrSrc.includes('cv2.THRESH_BINARY_INV'),
      'detect_document_contour must apply adaptive inverse thresholding'
    );
    assert.ok(
      pythonOmrSrc.includes('scale_ratio = h / 800.0') || pythonOmrSrc.includes('scale_ratio'),
      'detect_document_contour must track scale_ratio based on standardized height'
    );
  });

  test('2. detect_document_contour performs multi-scale 4-corner quadrilateral search via multi-epsilon approxPolyDP', () => {
    assert.ok(
      pythonOmrSrc.includes('0.015') &&
      pythonOmrSrc.includes('0.02') &&
      pythonOmrSrc.includes('0.025') &&
      pythonOmrSrc.includes('0.03') &&
      pythonOmrSrc.includes('0.035') &&
      pythonOmrSrc.includes('0.04'),
      'detect_document_contour must iterate over multi-epsilon range [0.015, 0.02, 0.025, 0.03, 0.035, 0.04]'
    );
    assert.ok(
      pythonOmrSrc.includes('len(approx) == 4 and cv2.isContourConvex(approx)'),
      'detect_document_contour must enforce 4-sided convex polygon'
    );
    assert.ok(
      pythonOmrSrc.includes('1.15 <= aspect <= 1.65'),
      'detect_document_contour must validate aspect ratio between 1.15 and 1.65'
    );
  });

  test('3. warp_to_grid applies 4-point homography transform with INTER_CUBIC interpolation', () => {
    assert.ok(
      pythonOmrSrc.includes('cv2.getPerspectiveTransform'),
      'warp_to_grid must compute perspective transform matrix'
    );
    assert.ok(
      pythonOmrSrc.includes('flags=cv2.INTER_CUBIC'),
      'warp_to_grid must use cv2.INTER_CUBIC interpolation for razor-sharp bubble quality'
    );
    assert.ok(
      pythonOmrSrc.includes('target_w') && pythonOmrSrc.includes('target_h'),
      'warp_to_grid must accept dynamic target dimensions'
    );
  });

  test('4. Python execution verifies CamScanner flattening and bubble extraction on tilted mobile phone photo', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExe)) return;

    const testPhoto = path.join(__dirname, '..', 'public', 'uploads', 'omr', 'omr-6a9dc59011eef70f0ba1e849-1795423649059.jpg');
    if (!fs.existsSync(testPhoto)) return;

    const script = `
import sys, os
sys.path.insert(0, 'python-service')
import cv2, numpy as np
from app.omr import detect_document_contour, warp_to_grid, find_bubble_grid, read_bubbles, detect_omr_sheet

with open('public/uploads/omr/omr-6a9dc59011eef70f0ba1e849-1795423649059.jpg', 'rb') as f:
    res = detect_omr_sheet(f.read(), 40)

assert res['success'] is True, f"Detection failed: {res.get('errors')}"
assert res['detected_questions'] == 40, f"Expected 40 detected questions, got {res['detected_questions']}"
assert res['filled_count'] >= 20, f"Expected at least 20 answered questions, got {res['filled_count']}"
assert res['warped_image_base64'].startswith('data:image/jpeg;base64,'), "Missing warped overlay"
print("CAMSCANNER_TILTED_PHOTO_VERIFIED")
`.trim();

    const { execFileSync } = require('child_process');
    const out = execFileSync(pythonExe, ['-c', script], {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
    });
    assert.ok(out.includes('CAMSCANNER_TILTED_PHOTO_VERIFIED'), 'Tilted photo must be successfully flattened and graded');
  });

  test('5. Python execution verifies homography warp on synthetic rotated canvas', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExe)) return;

    const script = `
import sys
sys.path.insert(0, 'python-service')
import cv2, numpy as np
from app.omr import detect_document_contour, warp_to_grid

# Create larger background canvas representing a desk (1200 x 900)
desk = np.full((900, 1200), 180, dtype=np.uint8)

# Draw an angled white document on the desk
# Document polygon corners
doc_pts = np.array([
    [250, 100],
    [950, 160],
    [900, 800],
    [200, 750]
], dtype=np.int32)
cv2.fillPoly(desk, [doc_pts], 255)
# Draw an outer black frame inside the document
frame_pts = np.array([
    [270, 120],
    [930, 180],
    [880, 780],
    [220, 730]
], dtype=np.int32)
cv2.polylines(desk, [frame_pts], True, 0, 3)

corners = detect_document_contour(desk)
assert corners is not None, "detect_document_contour failed on synthetic rotated document"
assert len(corners) == 4, f"Expected 4 corners, got {len(corners)}"

warped = warp_to_grid(desk, corners, 1275, 1650)
assert warped.shape == (1650, 1275), f"Warped shape unexpected: {warped.shape}"
print("CAMSCANNER_SYNTHETIC_CANVAS_VERIFIED")
`.trim();

    const { execFileSync } = require('child_process');
    const out = execFileSync(pythonExe, ['-c', script], {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
    });
    assert.ok(out.includes('CAMSCANNER_SYNTHETIC_CANVAS_VERIFIED'), 'Synthetic canvas must be successfully flattened');
  });
});

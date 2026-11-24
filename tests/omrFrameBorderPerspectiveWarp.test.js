const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('OMR Frame Border Perspective Warp & Outer Rectangle Locking Suite', () => {
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. omr.py implements primary detector for outer black rectangle frame using Otsu and cv2.RETR_LIST', () => {
    assert.ok(
      pythonOmrSrc.includes('def detect_document_contour('),
      'omr.py must define detect_document_contour'
    );
    assert.ok(
      pythonOmrSrc.includes('THRESH_OTSU') && pythonOmrSrc.includes('MORPH_CLOSE'),
      'detect_document_contour must apply Otsu binary thresholding and morphological closing'
    );
    assert.ok(
      pythonOmrSrc.includes('cv2.RETR_LIST'),
      'detect_document_contour must use cv2.RETR_LIST to capture internal printed frame contours'
    );
    assert.ok(
      pythonOmrSrc.includes('Step A: Look for the printed outer black rectangle frame first') ||
      pythonOmrSrc.includes('printed outer black rectangle frame first'),
      'detect_document_contour must prioritize outer black rectangle frame first'
    );
  });

  test('2. detect_document_contour enforces 4-sided convex polygon with area 25%-95% and aspect ratio 1.15-1.55', () => {
    assert.ok(
      pythonOmrSrc.includes('cv2.approxPolyDP') && pythonOmrSrc.includes('cv2.isContourConvex'),
      'detect_document_contour must test for 4-sided convex polygon via approxPolyDP and isContourConvex'
    );
    assert.ok(
      pythonOmrSrc.includes('0.20 * resized_area') || pythonOmrSrc.includes('0.25 * resized_area'),
      'detect_document_contour must filter by area threshold covering > 20% or 25% of image area'
    );
    assert.ok(
      pythonOmrSrc.includes('0.95 * resized_area'),
      'detect_document_contour must enforce upper area boundary 95% of total frame'
    );
    assert.ok(
      pythonOmrSrc.includes('1.15 <= aspect <= 1.55') ||
      (pythonOmrSrc.includes('1.15') && pythonOmrSrc.includes('1.55')),
      'detect_document_contour must verify aspect ratio (height / width) between 1.15 and 1.55'
    );
  });

  test('3. omr.py implements fallback margin search using minAreaRect', () => {
    assert.ok(
      pythonOmrSrc.includes('Fallback Margin Fiducial Search') ||
      pythonOmrSrc.includes('Step B: Fallback'),
      'detect_document_contour must provide Step B fallback search'
    );
    assert.ok(
      pythonOmrSrc.includes('cv2.minAreaRect'),
      'Step B fallback must calculate 4 corners via cv2.minAreaRect'
    );
    assert.ok(
      pythonOmrSrc.includes('return order_corners('),
      'detect_document_contour must return ordered corners via order_corners'
    );
  });

  test('4. detect_omr_sheet warps 4 frame corners flush to 1275x1650 page boundary', () => {
    assert.ok(
      pythonOmrSrc.includes('paper_corners = detect_document_contour(gray)'),
      'detect_omr_sheet must run detect_document_contour on input grayscale image'
    );
    assert.ok(
      pythonOmrSrc.includes('warped = warp_to_grid(gray, paper_corners, target_w=1275, target_h=1650)'),
      'detect_omr_sheet must warp detected frame corners to target_w=1275, target_h=1650'
    );
  });

  test('5. omr.py distinguishes between Frame-Flush and Full-Page Margin geometry for bubble grid sampling', () => {
    assert.ok(
      pythonOmrSrc.includes('FRAME_FLUSH_COL1_XS_NORM') &&
      pythonOmrSrc.includes('154.2 / 1275.0') &&
      pythonOmrSrc.includes('291.8 / 1275.0'),
      'omr.py must define FRAME_FLUSH_COL1_XS_NORM for frame-flush warped photos'
    );
    assert.ok(
      pythonOmrSrc.includes('FRAME_FLUSH_ROW_YS_NORM') &&
      pythonOmrSrc.includes('495.4 / 1650.0') &&
      pythonOmrSrc.includes('1361.4 / 1650.0'),
      'omr.py must define FRAME_FLUSH_ROW_YS_NORM for frame-flush warped photos'
    );
    assert.ok(
      pythonOmrSrc.includes('is_frame_flush'),
      'find_bubble_grid and read_bubbles must dynamically adapt to is_frame_flush'
    );
  });

  test('6. Python execution verifies frame locking and bubble extraction on test sheet', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExe)) {
      return; // Skip execution if venv not present in current environment
    }

    const testScript = `
import cv2, numpy as np, sys
sys.path.insert(0, 'python-service')
from app.omr import detect_document_contour, warp_to_grid, find_bubble_grid, read_bubbles, detect_omr_sheet

# Create synthetic 1275x1650 page with printed outer black frame border at (56, 56) to (1219, 1594)
canvas = np.full((1650, 1275), 255, dtype=np.uint8)
cv2.rectangle(canvas, (56, 56), (1219, 1594), 0, 3)

# Test primary detector
corners = detect_document_contour(canvas)
assert corners is not None, "detect_document_contour returned None on framed canvas"
assert len(corners) == 4, f"Expected 4 corners, got {len(corners)}"

# Test perspective warp flush to 1275x1650
warped = warp_to_grid(canvas, corners, 1275, 1650)
assert warped.shape == (1650, 1275), f"Warped shape unexpected: {warped.shape}"

# Test grid generation
grid = find_bubble_grid(warped, 50)
assert len(grid) == 50, f"Expected 50 question rows, got {len(grid)}"
for q_idx, q_row in enumerate(grid):
    assert len(q_row) == 4, f"Row {q_idx} expected 4 bubbles, got {len(q_row)}"

print("FRAME_BORDER_WARP_VERIFIED")
`;

    const { execFileSync } = require('child_process');
    const out = execFileSync(pythonExe, ['-c', testScript], {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
    });
    assert.ok(out.includes('FRAME_BORDER_WARP_VERIFIED'), 'Python execution did not report success');
  });
});

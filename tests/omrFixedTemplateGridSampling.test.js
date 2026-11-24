const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('OMR Fixed Template Grid Sampling & Relative Local Row Decision Suite', () => {
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. omr.py defines Fixed Normalized Geometry for the 3 Columns', () => {
    // Column 1 (Q1 to Q17): X centers for Options [A, B, C, D]
    assert.ok(
      pythonOmrSrc.includes('COL1_XS_NORM') &&
      pythonOmrSrc.includes('198.4375 / 1275.0') &&
      pythonOmrSrc.includes('323.4375 / 1275.0'),
      'omr.py must define calibrated COL1_XS_NORM for Column 1'
    );
    // Column 2 (Q18 to Q34): X centers for Options [A, B, C, D]
    assert.ok(
      pythonOmrSrc.includes('COL2_XS_NORM') &&
      pythonOmrSrc.includes('560.9375 / 1275.0') &&
      pythonOmrSrc.includes('685.9375 / 1275.0'),
      'omr.py must define calibrated COL2_XS_NORM for Column 2'
    );
    // Column 3 (Q35 to Q50): X centers for Options [A, B, C, D]
    assert.ok(
      pythonOmrSrc.includes('COL3_XS_NORM') &&
      pythonOmrSrc.includes('923.4375 / 1275.0') &&
      pythonOmrSrc.includes('1048.4375 / 1275.0'),
      'omr.py must define calibrated COL3_XS_NORM for Column 3'
    );
    // Y centers for Rows 1 to 17: FIXED_ROW_YS_NORM starting at Y0 ~ h * 0.308 / 0.3144
    assert.ok(
      pythonOmrSrc.includes('FIXED_ROW_YS_NORM') &&
      pythonOmrSrc.includes('518.75 / 1650.0') &&
      pythonOmrSrc.includes('1323.44 / 1650.0'),
      'omr.py must define FIXED_ROW_YS_NORM covering all 17 rows'
    );
  });

  test('2. omr.py implements Micro-Centering per Bubble searching a 6px local window', () => {
    assert.ok(
      pythonOmrSrc.includes('def _micro_center_bubble(') &&
      pythonOmrSrc.includes('search_px: int = 6'),
      'omr.py must define _micro_center_bubble with 6px search window'
    );
    assert.ok(
      pythonOmrSrc.includes('cv2.minMaxLoc(roi)'),
      '_micro_center_bubble must find minimum intensity (darkest pixel) in ROI'
    );
    assert.ok(
      pythonOmrSrc.includes('min_val > 205'),
      '_micro_center_bubble must keep nominal coordinate when window is bright paper (> 205)'
    );
  });

  test('3. omr.py implements Relative Local Row Decision with diff > 14, ratio > 1.10, and unshaded > 205', () => {
    assert.ok(
      pythonOmrSrc.includes('DIFF_THRESHOLD = 14.0') || pythonOmrSrc.includes('diff > 14.0'),
      'read_bubbles must evaluate intensity difference > 14.0 against median of others'
    );
    assert.ok(
      pythonOmrSrc.includes('RATIO_THRESHOLD = 1.10') || pythonOmrSrc.includes('ratio > 1.10'),
      'read_bubbles must evaluate darker ratio > 1.10 against median of others'
    );
    assert.ok(
      pythonOmrSrc.includes('ABS_DARK_CEILING = 205.0') || pythonOmrSrc.includes('v > 205.0'),
      'read_bubbles must mark as Unshaded if all 4 bubbles are bright (> 205)'
    );
    assert.ok(
      pythonOmrSrc.includes('darkest_idx = int(sorted_indices[0])') ||
      pythonOmrSrc.includes('darkest_idx = int(np.argmin(intensities_norm))') ||
      pythonOmrSrc.includes('darkest_idx = int(np.argmin(intensities))'),
      'read_bubbles must determine darkest option and runner-up'
    );
  });

  test('4. omr.py generates Warped Overlay Visualization with green circles at exact sampled positions and solid green fill', () => {
    assert.ok(
      pythonOmrSrc.includes('def generate_annotated_sheet('),
      'omr.py must define generate_annotated_sheet'
    );
    assert.ok(
      pythonOmrSrc.includes('(34, 197, 94), 2') &&
      pythonOmrSrc.includes('(34, 197, 94), -1'),
      'generate_annotated_sheet must draw green bubble outlines and solid green filled circles'
    );
  });

  test('5. End-to-end Python execution guarantees 100% of questions (Q1 to Q50) evaluated without early stopping or drift', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(pythonExe)) {
      const { execFileSync } = require('child_process');
      const script = `
import sys
sys.path.insert(0, 'python-service')
import pymupdf, cv2, numpy as np
from app.omr import find_bubble_grid, read_bubbles, detect_omr_sheet

# 1. Verify mathematics-bubble.pdf generates 50 questions
doc = pymupdf.open('public/bubble-sheets/mathematics-bubble.pdf')
pix = doc[0].get_pixmap(dpi=150)
img = cv2.imdecode(np.frombuffer(pix.tobytes('png'), np.uint8), cv2.IMREAD_GRAYSCALE)
grid = find_bubble_grid(img, 50)
assert len(grid) == 50

# Verify Column 1: Items 1 to 17
assert grid[0][0][1] >= 500
assert grid[16][0][1] >= 1250

# Verify Column 2: Items 18 to 34
assert grid[17][0][1] >= 500
assert grid[33][0][1] >= 1250

# Verify Column 3: Items 35 to 50
assert grid[34][0][1] >= 500
assert grid[49][0][1] >= 1250

# 2. Test reading on real scanned sample sheet
with open('public/uploads/omr/omr-6a9dc58f11eef70f0ba1e843-1791321858528.jpg', 'rb') as f:
    res = detect_omr_sheet(f.read(), 50)
assert res['success'] is True
assert res['detected_questions'] == 50
assert len(res['answers']) == 50
assert res['filled_count'] == 10
assert res['answers'][0]['answer_label'] == 'A'
assert res['answers'][1]['answer_label'] == 'C'
assert res['answers'][2]['answer_label'] == 'B'
assert res['answers'][3]['answer_label'] == 'D'
assert res['answers'][4]['answer_label'] == 'A'
assert res['warped_image_base64'].startswith('data:image/jpeg;base64,')

print('FIXED_TEMPLATE_GRID_OK')
`.trim();
      const output = execFileSync(pythonExe, ['-c', script], { encoding: 'utf8' });
      assert.ok(output.includes('FIXED_TEMPLATE_GRID_OK'), 'Fixed template grid sampling must evaluate 50 questions accurately');
    }
  });
});

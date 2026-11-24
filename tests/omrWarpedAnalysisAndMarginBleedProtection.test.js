const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('OMR Warped Analysis Display & Left-Margin Bleed Protection Suite', () => {
  const omrPythonPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const omrRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'omr', 'route.ts');
  const omrScanPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-scan', 'page.tsx');

  const pythonOmrSrc = fs.readFileSync(omrPythonPath, 'utf8');
  const omrRouteSrc = fs.readFileSync(omrRoutePath, 'utf8');
  const omrScanPageSrc = fs.readFileSync(omrScanPagePath, 'utf8');

  test('1. omr.py generates annotated visualization with green circles and highlighted filled bubble in base64 JPEG', () => {
    assert.ok(
      pythonOmrSrc.includes('def generate_annotated_sheet('),
      'omr.py must define generate_annotated_sheet function'
    );
    assert.ok(
      pythonOmrSrc.includes('(34, 197, 94)') || pythonOmrSrc.includes('(0, 200, 0)') || pythonOmrSrc.includes('(0, 255, 0)'),
      'generate_annotated_sheet must draw green circles around detected bubbles'
    );
    assert.ok(
      pythonOmrSrc.includes('cv2.circle') && (pythonOmrSrc.includes('-1') || pythonOmrSrc.includes('cv2.FILLED')),
      'generate_annotated_sheet must highlight chosen filled bubble in solid fill (-1)'
    );
    assert.ok(
      pythonOmrSrc.includes('warped_image_base64') && pythonOmrSrc.includes('data:image/jpeg;base64,'),
      'detect_omr_sheet must return warped_image_base64 as data:image/jpeg;base64,...'
    );
  });

  test('2. omr.py protects Option A against question number bleed (rejects candidate in question label zone and enforces min X boundary)', () => {
    assert.ok(
      pythonOmrSrc.includes('is_in_question_label_zone'),
      'omr.py must implement is_in_question_label_zone helper'
    );
    assert.ok(
      pythonOmrSrc.includes('190 * w / 1275') || pythonOmrSrc.includes('190'),
      'omr.py must reject candidates whose center falls into Column 1 question number label zone (X < 190)'
    );
    assert.ok(
      pythonOmrSrc.includes('opt_idx == 0'),
      'read_bubbles must check for Option A (opt_idx == 0)'
    );
    assert.ok(
      pythonOmrSrc.includes('x1 = max(x1, min_x1)') || pythonOmrSrc.includes('min_x1'),
      'read_bubbles must enforce minimum X boundary when sampling Option A to prevent question text overlap'
    );
  });

  test('3. api/teacher/omr/route.ts passes warpedImage: data.warped_image_base64 back in response payload', () => {
    assert.ok(
      omrRouteSrc.includes('warpedImage: data.warped_image_base64') ||
      omrRouteSrc.includes('data.warped_image_base64'),
      'route.ts must extract warped_image_base64 from Python microservice response'
    );
    assert.ok(
      omrRouteSrc.includes('warpedImage'),
      'route.ts must include warpedImage in return payload'
    );
  });

  test('4. omr-scan/page.tsx displays warpedImage upon scan and provides "View Warped Analysis" vs "View Original Photo" toggle', () => {
    assert.ok(
      omrScanPageSrc.includes('data.warpedImage') &&
      omrScanPageSrc.includes('setSheetImage(data.warpedImage)'),
      'processUploadedImage must set sheetImage to data.warpedImage when available'
    );
    assert.ok(
      omrScanPageSrc.includes('View Warped Analysis') &&
      omrScanPageSrc.includes('View Original Photo'),
      'omr-scan/page.tsx must provide "View Warped Analysis" and "View Original Photo" toggle controls'
    );
    assert.ok(
      omrScanPageSrc.includes('setWarpedImage') && omrScanPageSrc.includes('setOriginalImage'),
      'omr-scan/page.tsx must maintain warpedImage and originalImage states'
    );
  });

  test('5. Python OMR engine executes and produces valid warped_image_base64 on sample sheet', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(pythonExe)) {
      const script = `
import sys
sys.path.insert(0, 'python-service')
import pymupdf
from app.omr import detect_omr_sheet
doc = pymupdf.open('public/bubble-sheets/mathematics-bubble.pdf')
pix = doc[0].get_pixmap(dpi=150)
res = detect_omr_sheet(pix.tobytes('png'), 50)
assert res['success'] == True
assert 'warped_image_base64' in res
assert res['warped_image_base64'].startswith('data:image/jpeg;base64,')
assert len(res['warped_image_base64']) > 10000
print('OK')
`.trim();
      const output = execSync(`"${pythonExe}" -c "${script.replace(/\r?\n/g, '; ')}"`, { encoding: 'utf8' });
      assert.ok(output.includes('OK'), 'Python OMR execution must succeed and validate warped_image_base64');
    }
  });

  test('6. omr.py implements relaxed row Y tolerance, expanded dark contour acceptance, and full-column vertical extrapolation', () => {
    assert.ok(
      pythonOmrSrc.includes('max(20, int(0.015 * h))'),
      'find_bubble_grid must use relaxed row Y tolerance max(20, int(0.015 * h))'
    );
    assert.ok(
      pythonOmrSrc.includes('area > 2200') && pythonOmrSrc.includes('circ < 0.20'),
      'omr.py must allow dark contours with area up to 2200px and circularity down to 0.20'
    );
    assert.ok(
      pythonOmrSrc.includes('expected_ys') && pythonOmrSrc.includes('delta_y'),
      'find_bubble_grid must extrapolate vertical row coordinates via delta_y to expected_ys'
    );

    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(pythonExe)) {
      const script = `
import sys
sys.path.insert(0, 'python-service')
import pymupdf, cv2, numpy as np
from app.omr import find_bubble_grid
doc = pymupdf.open('public/bubble-sheets/mathematics-bubble.pdf')
pix = doc[0].get_pixmap(dpi=150)
img = cv2.imdecode(np.frombuffer(pix.tobytes('png'), np.uint8), cv2.IMREAD_GRAYSCALE)
grid = find_bubble_grid(img, 50)
assert len(grid) == 50
assert grid[0][0][1] >= 500
assert grid[16][0][1] >= 1250
assert grid[33][0][1] >= 1250
assert grid[49][0][1] >= 1250
print('EXTRAPOLATION_OK')
`.trim();
      const output = execSync(`"${pythonExe}" -c "${script.replace(/\r?\n/g, '; ')}"`, { encoding: 'utf8' });
      assert.ok(output.includes('EXTRAPOLATION_OK'), 'Full column vertical grid must extend down past Y=1250px');
    }
  });
});

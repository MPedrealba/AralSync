const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('OMR Row Clustering, Bubble Grid Detection & Adaptive Thresholds Suite', () => {
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. omr.py eliminates hardcoded cy > 450 and enforces dynamic vertical range 0.08 * h to 0.98 * h', () => {
    assert.ok(
      !pythonOmrSrc.includes('if cy > 450:'),
      'omr.py must not have hardcoded cy > 450 header exclusion'
    );
    assert.ok(
      pythonOmrSrc.includes('0.08 * h < cy < 0.98 * h'),
      'Hough circles and contour loops must filter bubbles between 0.08 * h and 0.98 * h'
    );
    assert.ok(
      pythonOmrSrc.includes('0.08 * h < b[1] < 0.98 * h'),
      'filtered bubbles array must keep bubbles between 0.08 * h and 0.98 * h'
    );
  });

  test('2. omr.py prevents row chaining with max 4 bubbles, X-collision < 22px, and avg Y diff <= 12px', () => {
    assert.ok(
      pythonOmrSrc.includes('is_row_full = len(curr_row) >= 4'),
      'find_bubble_grid must enforce maximum 4 bubbles per row'
    );
    assert.ok(
      pythonOmrSrc.includes('has_x_collision = any(abs(b[0] - item[0]) < 22 for item in curr_row)'),
      'find_bubble_grid must check for X-slot collision within 22px'
    );
    assert.ok(
      pythonOmrSrc.includes('row_avg_y = float(np.mean([item[1] for item in curr_row]))') ||
      pythonOmrSrc.includes('np.mean([item[1] for item in curr_row])'),
      'find_bubble_grid must calculate average Y of current row'
    );
    assert.ok(
      pythonOmrSrc.includes('y_diff = abs(b[1] - row_avg_y)'),
      'find_bubble_grid must measure vertical distance against row average Y'
    );
    assert.ok(
      pythonOmrSrc.includes('if is_row_full or has_x_collision or y_diff > 12:'),
      'find_bubble_grid must finalize row if row is full, X collides, or Y diff exceeds 12px'
    );
  });

  test('3. omr.py maps 3-column question capacities proportionally: [14, 13, 13] for 40 items and [17, 17, 16] for 50 items', () => {
    assert.ok(
      pythonOmrSrc.includes('num_questions == 40') && pythonOmrSrc.includes('[14, 13, 13]'),
      'find_bubble_grid must map 40-item exams to [14, 13, 13]'
    );
    assert.ok(
      pythonOmrSrc.includes('num_questions == 50') && pythonOmrSrc.includes('[17, 17, 16]'),
      'find_bubble_grid must maintain [17, 17, 16] for 50-item exams'
    );
    assert.ok(
      pythonOmrSrc.includes('base = num_questions // 3') && pythonOmrSrc.includes('rem = num_questions % 3'),
      'find_bubble_grid must dynamically distribute items for general counts'
    );
  });

  test('4. read_bubbles uses adaptive dark-bubble intensity thresholding (diff > 25.0 or ratio >= 1.25)', () => {
    assert.ok(
      pythonOmrSrc.includes('DIFF_THRESHOLD = 25.0'),
      'read_bubbles must set DIFF_THRESHOLD to 25.0'
    );
    assert.ok(
      pythonOmrSrc.includes('RATIO_THRESHOLD = 1.25'),
      'read_bubbles must set RATIO_THRESHOLD to 1.25'
    );
    assert.ok(
      pythonOmrSrc.includes('diff = other_median - i_dark'),
      'read_bubbles must calculate difference between unshaded median and darkest bubble'
    );
    assert.ok(
      pythonOmrSrc.includes('(diff > DIFF_THRESHOLD) or (ratio >= RATIO_THRESHOLD)'),
      'read_bubbles must register shaded mark if diff > DIFF_THRESHOLD or ratio >= RATIO_THRESHOLD'
    );
  });

  test('5. Python OMR engine compiles without syntax or import errors', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(pythonExe)) {
      const compileCmd = `"${pythonExe}" -m py_compile "${pythonOmrPath}"`;
      const output = execSync(compileCmd, { encoding: 'utf8' });
      assert.equal(output.trim(), '', 'py_compile should produce no output on success');
    }
  });
});

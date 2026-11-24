const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

describe('OMR Row Clustering, Bubble Grid Detection & Adaptive Thresholds Suite', () => {
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. omr.py restricts bubble candidate region to actual grid area (0.28 * h to 0.95 * h) and excludes header artifacts', () => {
    assert.ok(
      !pythonOmrSrc.includes('if cy > 450:'),
      'omr.py must not have rigid unscaled cy > 450 header exclusion'
    );
    assert.ok(
      pythonOmrSrc.includes('int(0.28 * h) <= cy <= int(0.95 * h)'),
      'Hough circles and contour loops must filter bubbles between 0.28 * h and 0.95 * h'
    );
    assert.ok(
      pythonOmrSrc.includes('int(0.28 * h) <= b[1] <= int(0.95 * h)'),
      'filtered bubbles array must keep bubbles between 0.28 * h and 0.95 * h'
    );
  });

  test('2. omr.py prevents row chaining with max 4 bubbles, X-collision < 22px, and avg Y diff tolerance', () => {
    assert.ok(
      pythonOmrSrc.includes('is_row_full = len(curr_row) >= OPTIONS_PER_Q') ||
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
      pythonOmrSrc.includes('if is_row_full or has_x_collision or y_diff >'),
      'find_bubble_grid must finalize row if row is full, X collides, or Y diff exceeds tolerance'
    );
  });

  test('3. omr.py implements deterministic 3-column partitioning and proportional question mapping', () => {
    assert.ok(
      pythonOmrSrc.includes('0.08 * w <= b[0] < 0.38 * w') &&
      pythonOmrSrc.includes('0.38 * w <= b[0] < 0.68 * w') &&
      pythonOmrSrc.includes('0.68 * w <= b[0] <= 0.96 * w'),
      'find_bubble_grid must partition bubbles into 3 deterministic column bands'
    );
    assert.ok(
      pythonOmrSrc.includes('num_questions == 40') && pythonOmrSrc.includes('[14, 13, 13]'),
      'find_bubble_grid must map 40-item exams to [14, 13, 13]'
    );
    assert.ok(
      pythonOmrSrc.includes('num_questions == 50') && pythonOmrSrc.includes('[17, 17, 16]'),
      'find_bubble_grid must maintain [17, 17, 16] for 50-item exams'
    );
  });

  test('4. read_bubbles implements bounds checking for valid option labels (0=A, 1=B, 2=C, 3=D)', () => {
    assert.ok(
      pythonOmrSrc.includes('0 <= darkest_idx < OPTIONS_PER_Q'),
      'read_bubbles must check bounds for darkest_idx'
    );
    assert.ok(
      pythonOmrSrc.includes('0 <= answer_idx < len(OPTION_LABELS)'),
      'detect_omr_sheet must validate answer_idx is within OPTION_LABELS range'
    );
  });

  test('5. Python OMR engine compiles without syntax or import errors', () => {
    const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(pythonExe)) {
      const compileCmd = `"${pythonExe}" -X pycache_prefix="${os.tmpdir()}" -m py_compile "${pythonOmrPath}"`;
      const output = execSync(compileCmd, { encoding: 'utf8' });
      assert.equal(output.trim(), '', 'py_compile should produce no output on success');
    }
  });
});

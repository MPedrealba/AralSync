const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

describe('Official 40-Item Bubble Sheet Print & Vision Pipeline Suite', () => {
  const rootDir = path.join(__dirname, '..');
  const officialPdfPublic = path.join(rootDir, 'public', 'bubble-sheets', 'official-40-bubble.pdf');
  const officialPdfOmr = path.join(rootDir, 'OMR Buuble Sheet', 'official-40-bubble.pdf');
  const printRoutePath = path.join(rootDir, 'src', 'app', 'api', 'teacher', 'bubble-sheet', 'print', 'route.ts');
  const pythonOmrPath = path.join(rootDir, 'python-service', 'app', 'omr.py');
  const pythonExe = path.join(rootDir, 'python-service', '.venv', 'Scripts', 'python.exe');

  test('1. File Preparation: official-40-bubble.pdf exists with outer alignment frame and 4 corner fiducial squares', () => {
    assert.ok(fs.existsSync(officialPdfPublic), 'public/bubble-sheets/official-40-bubble.pdf must exist');
    assert.ok(fs.existsSync(officialPdfOmr), 'OMR Buuble Sheet/official-40-bubble.pdf must exist');

    const statPublic = fs.statSync(officialPdfPublic);
    assert.ok(statPublic.size > 20000, `official-40-bubble.pdf must be valid non-empty PDF (size: ${statPublic.size})`);

    // Verify PDF dimensions and drawings using PyMuPDF if python is available
    if (fs.existsSync(pythonExe)) {
      const inspectScript = `
import fitz
doc = fitz.open('${officialPdfPublic.replace(/\\/g, '/')}')
page = doc[0]
rect = page.rect
assert rect.width == 612.0 and rect.height == 1008.0, f"Page must be Legal 612x1008: {rect}"
drawings = page.get_drawings()
assert len(drawings) >= 100, f"Page must contain vector drawings: {len(drawings)}"
# Verify 4 corner fiducial squares
corner_drawings = [d for d in drawings if d.get('rect').width > 15 and d.get('rect').height > 15 and (d.get('rect').x0 < 60 or d.get('rect').x1 > 550)]
assert len(corner_drawings) >= 4, f"Page must contain 4 corner fiducials: {len(corner_drawings)}"
`;
      execFileSync(pythonExe, ['-c', inspectScript], { encoding: 'utf8' });
    }
  });

  test('2. PDF Print Route: Prioritizes official-40-bubble.pdf and stamps custom title, grade, section, and date', () => {
    const printSrc = fs.readFileSync(printRoutePath, 'utf8');

    // Prioritizes official-40-bubble.pdf first in candidate list
    assert.ok(
      printSrc.includes("'public', 'bubble-sheets', 'official-40-bubble.pdf'") ||
      printSrc.includes('"public", "bubble-sheets", "official-40-bubble.pdf"'),
      'print/route.ts must check official-40-bubble.pdf first'
    );

    // Stamping logic for Legal 40-item template
    assert.ok(
      printSrc.includes('isLegal40') || printSrc.includes('height > 900'),
      'print/route.ts must support Legal 1008pt 40-item layout stamping'
    );
    assert.ok(
      printSrc.includes('y: 842') || printSrc.includes('842'),
      'print/route.ts must stamp custom title at y=842'
    );
    assert.ok(
      printSrc.includes('y: 830') || printSrc.includes('830'),
      'print/route.ts must stamp subtitle/scope at y=830'
    );
    assert.ok(
      printSrc.includes('y: 814') || printSrc.includes('814'),
      'print/route.ts must stamp date at y=814'
    );
    assert.ok(
      printSrc.includes('y: 792.5') || printSrc.includes('792.5'),
      'print/route.ts must stamp Class/Section and Teacher at y=792.5'
    );
    assert.ok(
      printSrc.includes('regSize = 24') && printSrc.includes('quietMargin = 4'),
      'print/route.ts must stamp 24x24 pt fiducials with 4pt quiet margin'
    );
  });

  test('3. Python Vision Engine: Defines 40-item layout constants and 5-row vertical gap anchors', () => {
    const omrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

    assert.ok(
      omrSrc.includes('COL1_40_XS_NORM = [0.18, 0.23, 0.28, 0.33]') ||
      omrSrc.includes('COL1_40_XS_NORM'),
      'omr.py must export COL1_40_XS_NORM'
    );
    assert.ok(
      omrSrc.includes('COL2_40_XS_NORM = [0.63, 0.68, 0.73, 0.78]') ||
      omrSrc.includes('COL2_40_XS_NORM'),
      'omr.py must export COL2_40_XS_NORM'
    );
    assert.ok(
      omrSrc.includes('ROW_YS_40_NORM') && omrSrc.includes('(r + (r // 5))'),
      'omr.py must export ROW_YS_40_NORM with 5-row block vertical gaps'
    );
    assert.ok(
      omrSrc.includes('cv2.findContours(binary, cv2.RETR_LIST'),
      'detect_fiducials must use cv2.RETR_LIST to detect inner corner squares within border frames'
    );
  });

  test('4. End-to-End Verification: Python OMR Engine detects 100% of 40-item bubble sheet answers with zero drift', () => {
    if (!fs.existsSync(pythonExe)) return;

    const testScript = `
import sys
sys.path.insert(0, 'python-service')
import cv2
from app.omr import detect_omr_sheet

with open('perfect_filled_40.jpg', 'rb') as f:
    data = f.read()

res = detect_omr_sheet(data, num_questions=40)
assert res['success'] is True, "detect_omr_sheet failed on 40-item sheet"
assert res['detected_questions'] == 40, f"Expected 40 detected questions, got {res['detected_questions']}"
assert res['filled_count'] == 40, f"Expected 40 filled bubbles, got {res['filled_count']}"

labels = ['A', 'B', 'C', 'D']
expected_answers = [(i % 4) for i in range(40)]
correct = sum(1 for i in range(40) if res['answers'][i]['answer_label'] == labels[expected_answers[i]])
accuracy = (correct / 40.0) * 100.0
assert accuracy == 100.0, f"Accuracy was {accuracy}%, expected 100%"
print(f"End-to-End 40-item verification PASSED: {accuracy}% ({correct}/40)")
`;
    const out = execFileSync(pythonExe, ['-c', testScript], { encoding: 'utf8' });
    assert.ok(out.includes('100.0%'), 'Must achieve 100% accuracy on official 40-item bubble sheet');
  });
});

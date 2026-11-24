const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

describe('OMR CamScanner Mobile Viewfinder & Guide-Aligned Auto-Crop Suite', () => {
  const omrScanPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-scan', 'page.tsx');
  const pythonExe = path.join(__dirname, '..', 'python-service', '.venv', 'Scripts', 'python.exe');
  const omrScanSrc = fs.readFileSync(omrScanPagePath, 'utf8');

  test('1. Unblock Top Brackets: Removes floating popup from inside video feed and relocates guidance hint above capture button', () => {
    // Must NOT have floating popup at top-3 inside video container
    assert.ok(
      !omrScanSrc.includes('absolute top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70'),
      'Must remove floating popup from inside the video feed container so it never covers top brackets'
    );

    // Relocated guidance hint in control panel
    assert.ok(
      omrScanSrc.includes('py-1 text-emerald-400 text-xs font-semibold') &&
      omrScanSrc.includes('animate-pulse') &&
      omrScanSrc.includes('Align all 4 sheet corners inside the green brackets'),
      'Guidance hint must be relocated to control panel directly above the capture button'
    );
  });

  test('2. True Portrait Viewfinder: Modal video container uses responsive portrait aspect-[3/4] sm:aspect-[4/3] and h-[72vh]', () => {
    assert.ok(
      omrScanSrc.includes('h-[72vh]') &&
      omrScanSrc.includes('max-h-[640px]') &&
      omrScanSrc.includes('aspect-[3/4]') &&
      omrScanSrc.includes('sm:aspect-[4/3]'),
      'Video container must use responsive portrait styling: h-[72vh] max-h-[640px] w-full aspect-[3/4] sm:aspect-[4/3]'
    );
  });

  test('3. Viewfinder Guide Box: Portrait aspect-[1/1.35] filling 85% height with glowing 10x10 corner brackets', () => {
    assert.ok(
      omrScanSrc.includes('h-[85%]') && omrScanSrc.includes('aspect-[1/1.35]'),
      'Viewfinder guide box must be portrait aspect-[1/1.35] filling ~85% height'
    );
    assert.ok(
      omrScanSrc.includes('-top-1 -left-1') &&
      omrScanSrc.includes('-top-1 -right-1') &&
      omrScanSrc.includes('-bottom-1 -left-1') &&
      omrScanSrc.includes('-bottom-1 -right-1'),
      'Guide brackets must be positioned at outer corners (-top-1 -left-1, -top-1 -right-1, etc.)'
    );
    assert.ok(
      omrScanSrc.includes('h-10 w-10') &&
      omrScanSrc.includes('border-emerald-400 rounded-lg shadow-[0_0_12px_rgba(52,211,153,0.7)]'),
      'Corner brackets must have size h-10 w-10 border-emerald-400 rounded-lg with glowing shadow'
    );
  });

  test('4. Client-Side Guide-Aligned Auto-Crop in capturePhoto(): Insets by ~10% horizontal and ~12% vertical', () => {
    assert.ok(
      omrScanSrc.includes('0.10') && omrScanSrc.includes('0.12'),
      'capturePhoto must calculate normalized bounding box inset by ~10% horizontal and ~12% vertical'
    );
    assert.ok(
      omrScanSrc.includes('cropW') && omrScanSrc.includes('cropH') &&
      omrScanSrc.includes('canvas.width = cropW') &&
      omrScanSrc.includes('canvas.height = cropH'),
      'capturePhoto must size canvas to the cropped viewfinder bounding box'
    );
    assert.ok(
      omrScanSrc.includes('ctx.drawImage(') &&
      omrScanSrc.includes('cropX,') &&
      omrScanSrc.includes('cropY,'),
      'capturePhoto must crop the canvas directly to the viewfinder bounding rectangle before generating blob'
    );
  });

  test('5. End-to-End Verification: Guide-cropped mobile sheet is accurately flattened and graded by Python OMR engine', () => {
    if (!fs.existsSync(pythonExe)) return;

    const pythonScript = `
import sys
sys.path.insert(0, 'python-service')
import cv2
import numpy as np
from app.omr import detect_omr_sheet

# Load sample sheet and simulate client-side guide-aligned auto-crop (inset 10% H, 12% V)
with open('public/uploads/omr/omr-6a9dc59011eef70f0ba1e849-1795423649059.jpg', 'rb') as f:
    full_bytes = f.read()

img = cv2.imdecode(np.frombuffer(full_bytes, np.uint8), cv2.IMREAD_COLOR)
h, w = img.shape[:2]

# Crop directly to viewfinder bounding rectangle (simulating client-side capturePhoto)
crop_x = int(w * 0.10)
crop_y = int(h * 0.12)
crop_w = int(w * 0.80)
crop_h = int(h * 0.76)
cropped_guide = img[crop_y:crop_y + crop_h, crop_x:crop_x + crop_w]

_, cropped_buf = cv2.imencode('.jpg', cropped_guide, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
cropped_bytes = cropped_buf.tobytes()

# Process cropped image in OMR engine
res = detect_omr_sheet(cropped_bytes, num_questions=40)
assert res['success'] is True, "Cropped sheet detection failed"
assert res['detected_questions'] == 40, f"Expected 40 detected questions, got {res['detected_questions']}"
assert res['filled_count'] >= 30, f"Expected >= 30 filled bubbles on sample exam, got {res['filled_count']}"
print(f"CamScanner auto-cropped sheet graded successfully: {res['filled_count']}/40 filled")
`;
    const out = execFileSync(pythonExe, ['-c', pythonScript], { encoding: 'utf8' });
    assert.ok(out.includes('CamScanner auto-cropped sheet graded successfully'), 'Cropped sheet must be successfully flattened and graded');
  });
});

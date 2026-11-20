const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('OMR Frame Indicator & Camera Viewfinder HUD Suite', () => {
  const printRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'bubble-sheet', 'print', 'route.ts');
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');
  const omrScanPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-scan', 'page.tsx');

  const printRouteSrc = fs.readFileSync(printRoutePath, 'utf8');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');
  const omrScanSrc = fs.readFileSync(omrScanPagePath, 'utf8');

  test('1. bubble-sheet/print stamps solid outer framing border (borderWidth: 1.5 or 2)', () => {
    assert.ok(
      (printRouteSrc.includes('width: width - 56') || printRouteSrc.includes('width: width - 40')) &&
      (printRouteSrc.includes('height: height - 56') || printRouteSrc.includes('height: height - 40')),
      'print/route.ts must draw outer framing border around page margins'
    );
    assert.ok(
      (printRouteSrc.includes('borderWidth: 1.5') || printRouteSrc.includes('borderWidth: 2')) &&
      printRouteSrc.includes('borderColor: rgb(0, 0, 0)'),
      'print/route.ts must draw solid black border'
    );
  });

  test('2. bubble-sheet/print stamps 4 solid black anchor marks (24x24 pt) directly anchored at frame corners', () => {
    assert.ok(
      printRouteSrc.includes('regSize = 24'),
      'print/route.ts must specify 24x24 pt anchor mark size'
    );
    assert.ok(
      printRouteSrc.includes('regMargin = 24') || printRouteSrc.includes('regMargin = 20'),
      'print/route.ts must specify margin to anchor marks to outer frame'
    );
    assert.ok(
      printRouteSrc.includes('color: rgb(0, 0, 0)'),
      'print/route.ts must draw solid black corner marks'
    );
  });

  test('3. omr.py looks for printed outer black rectangle frame first before paper boundaries', () => {
    assert.ok(
      pythonOmrSrc.includes('Step A: Look for the printed outer black rectangle frame first') ||
      pythonOmrSrc.includes('printed outer black rectangle frame first'),
      'detect_document_contour must look for printed outer black rectangle frame first'
    );
    assert.ok(
      pythonOmrSrc.includes('warp_to_grid(gray, paper_corners, target_w=1275, target_h=1650)'),
      'detect_omr_sheet must warp detected frame/paper to 1275x1650'
    );
    assert.ok(
      pythonOmrSrc.includes('cv2.getPerspectiveTransform'),
      'warp_to_grid must use cv2.getPerspectiveTransform'
    );
  });

  test('4. omr-scan/page.tsx displays floating helper badge: "Align the 4 sheet corners inside the green brackets"', () => {
    assert.ok(
      omrScanSrc.includes('Align the 4 sheet corners inside the green brackets'),
      'Camera modal must contain floating helper badge with instruction'
    );
  });

  test('5. omr-scan/page.tsx renders 4 emerald green corner brackets & aspect-[1/1.3] guide box', () => {
    assert.ok(
      omrScanSrc.includes('aspect-[1/1.3]'),
      'Camera modal must center an aspect-ratio-locked (Letter/A4 1:1.3) guide box'
    );
    assert.ok(
      omrScanSrc.includes('border-t-4 border-l-4 border-emerald-400') &&
      omrScanSrc.includes('border-t-4 border-r-4 border-emerald-400') &&
      omrScanSrc.includes('border-b-4 border-l-4 border-emerald-400') &&
      omrScanSrc.includes('border-b-4 border-r-4 border-emerald-400'),
      'Camera modal must render 4 emerald green corner brackets'
    );
    assert.ok(
      !omrScanSrc.includes('border-2 border-dashed border-white/40'),
      'Camera modal must replace the old faint dashed outline'
    );
  });
});

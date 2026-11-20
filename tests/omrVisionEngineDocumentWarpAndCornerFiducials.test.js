const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('OMR Vision Engine Document Boundary Warp & Corner Registration Suite', () => {
  const printRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'bubble-sheet', 'print', 'route.ts');
  const pythonOmrPath = path.join(__dirname, '..', 'python-service', 'app', 'omr.py');

  const printRouteSrc = fs.readFileSync(printRoutePath, 'utf8');
  const pythonOmrSrc = fs.readFileSync(pythonOmrPath, 'utf8');

  test('1. bubble-sheet/print/route.ts stamps outer framing border & 4 solid black corner anchor marks', () => {
    assert.ok(
      printRouteSrc.includes('regSize = 24') || printRouteSrc.includes('regSize = 22'),
      'print/route.ts must specify 24x24 pt (or 22x22 pt) registration square size'
    );
    assert.ok(
      printRouteSrc.includes('regMargin = 24') || printRouteSrc.includes('regMargin = 20') || printRouteSrc.includes('regMargin = 18'),
      'print/route.ts must specify 24pt (or 20pt/18pt) margin from page edges'
    );
    assert.ok(
      printRouteSrc.includes('firstPage.drawRectangle'),
      'print/route.ts must draw registration marks with drawRectangle'
    );
    assert.ok(
      printRouteSrc.includes('color: rgb(0, 0, 0)'),
      'print/route.ts must draw solid black marks'
    );
    assert.ok(
      (printRouteSrc.includes('borderWidth: 1.5') || printRouteSrc.includes('borderWidth: 2')) &&
      (printRouteSrc.includes('width: width - 56') || printRouteSrc.includes('width: width - 40')),
      'print/route.ts must draw outer framing border around margins'
    );
  });

  test('2. omr.py implements order_corners with [top-left, top-right, bottom-left, bottom-right] ordering', () => {
    assert.ok(
      pythonOmrSrc.includes('def order_corners('),
      'omr.py must define order_corners'
    );
    assert.ok(
      pythonOmrSrc.includes('rect[0] = pts[np.argmin(s)]') &&
      pythonOmrSrc.includes('rect[3] = pts[np.argmax(s)]'),
      'order_corners must assign top-left with min(sum) and bottom-right with max(sum)'
    );
    assert.ok(
      pythonOmrSrc.includes('rect[1] = pts[np.argmin(diff)]') &&
      pythonOmrSrc.includes('rect[2] = pts[np.argmax(diff)]'),
      'order_corners must assign top-right with min(diff) and bottom-left with max(diff)'
    );
  });

  test('3. omr.py implements detect_document_contour covering > 20% area', () => {
    assert.ok(
      pythonOmrSrc.includes('def detect_document_contour('),
      'omr.py must define detect_document_contour'
    );
    assert.ok(
      pythonOmrSrc.includes('0.20 * resized_area'),
      'detect_document_contour must verify contour covers > 20% of image area'
    );
    assert.ok(
      pythonOmrSrc.includes('cv2.approxPolyDP') &&
      pythonOmrSrc.includes('cv2.minAreaRect'),
      'detect_document_contour must use approxPolyDP with minAreaRect fallback'
    );
    assert.ok(
      pythonOmrSrc.includes('return order_corners('),
      'detect_document_contour must return sorted corners via order_corners'
    );
  });

  test('4. detect_omr_sheet warps paper contour to standard upright 1275x1650 page', () => {
    assert.ok(
      pythonOmrSrc.includes('paper_corners = detect_document_contour(gray)'),
      'detect_omr_sheet must run detect_document_contour'
    );
    assert.ok(
      pythonOmrSrc.includes('warped = warp_to_grid(gray, paper_corners, target_w=1275, target_h=1650)'),
      'detect_omr_sheet must warp detected paper to 1275x1650'
    );
    assert.ok(
      pythonOmrSrc.includes('refined_corners = detect_fiducials(warped)'),
      'detect_omr_sheet must refine alignment using detect_fiducials on warped sheet'
    );
  });

  test('5. find_bubble_grid dynamically clusters bubbles by relative X gaps and Y row spacing', () => {
    // Rigid hardcoded pixel ranges must be eliminated
    assert.ok(
      !pythonOmrSrc.includes('col_ranges = [') &&
      !pythonOmrSrc.includes('(180, 360, 17)'),
      'find_bubble_grid must eliminate rigid hardcoded X ranges (180, 360)'
    );
    assert.ok(
      pythonOmrSrc.includes('gap_threshold = max(65, int(0.05 * w))'),
      'find_bubble_grid must use dynamic relative X gap threshold'
    );
    assert.ok(
      pythonOmrSrc.includes('row_gap_threshold = max(18, int(0.012 * h))'),
      'find_bubble_grid must use dynamic relative Y row spacing threshold'
    );
    assert.ok(
      pythonOmrSrc.includes('if not sorted_by_x:\n        return []') ||
      pythonOmrSrc.includes('if not sorted_by_x:'),
      'find_bubble_grid must guard against empty sorted_by_x'
    );
  });
});

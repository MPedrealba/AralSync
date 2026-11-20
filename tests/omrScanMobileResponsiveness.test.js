const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('OMR Scan Workstation Mobile Responsiveness Suite', () => {
  const omrScanPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-scan', 'page.tsx');
  const omrScanSrc = fs.readFileSync(omrScanPagePath, 'utf8');

  test('1. omr-scan/page.tsx declares isMobileConfigOpen state and mobileSetupSummary', () => {
    assert.ok(
      omrScanSrc.includes('const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);') ||
      omrScanSrc.includes('isMobileConfigOpen'),
      'omr-scan/page.tsx must have isMobileConfigOpen state initialized to false'
    );
    assert.ok(
      omrScanSrc.includes('mobileSetupSummary'),
      'omr-scan/page.tsx must compute mobileSetupSummary for collapsed header'
    );
  });

  test('2. Configuration panel wraps 6 inputs in collapsible accordion with summary & toggle', () => {
    assert.ok(
      omrScanSrc.includes('Edit Setup ⚙️') && omrScanSrc.includes('Hide Setup'),
      'omr-scan/page.tsx must provide "Edit Setup ⚙️" / "Hide Setup" toggle button'
    );
    assert.ok(
      omrScanSrc.includes('isMobileConfigOpen ? "block" : "hidden sm:block"'),
      'omr-scan/page.tsx must wrap configuration inputs in collapsible container visible on mobile when toggled and always visible on sm: screens'
    );
  });

  test('3. Selecting student or answer key auto-collapses mobile setup panel', () => {
    assert.ok(
      omrScanSrc.includes('setIsMobileConfigOpen(false)'),
      'omr-scan/page.tsx must close mobile config accordion upon selection'
    );
  });

  test('4. Main viewport applies safe bottom padding and touch scrolling without scroll traps', () => {
    assert.ok(
      omrScanSrc.includes('pb-20 sm:pb-8'),
      'omr-scan/page.tsx main viewport must include safe pb-20 sm:pb-8 bottom padding for sticky bar'
    );
    assert.ok(
      omrScanSrc.includes('WebkitOverflowScrolling: "touch"') ||
      omrScanSrc.includes("WebkitOverflowScrolling: 'touch'"),
      'omr-scan/page.tsx main viewport must enable smooth momentum scrolling'
    );
    assert.ok(
      omrScanSrc.includes('p-4 sm:p-8'),
      'Intake card must reduce mobile padding to p-4 sm:p-8 for 336px-400px viewports'
    );
  });

  test('5. Primary intake scan buttons are prominent and full-width on mobile', () => {
    assert.ok(
      omrScanSrc.includes('Scan with Camera'),
      'Intake card must contain "Scan with Camera" button'
    );
    assert.ok(
      omrScanSrc.includes('Upload Sheet Image'),
      'Intake card must contain "Upload Sheet Image" button'
    );
    assert.ok(
      omrScanSrc.includes('Try Sample Sheet'),
      'Intake card must contain "Try Sample Sheet" button'
    );
    assert.ok(
      omrScanSrc.includes('w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-800'),
      'Scan with Camera must be full-width on mobile and h-11'
    );
  });

  test('6. Sticky mobile quick-action bar renders at bottom on small screens in intake mode', () => {
    assert.ok(
      omrScanSrc.includes('sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shadow-lg'),
      'Intake mode must include fixed sticky quick-action bar on mobile (< 640px)'
    );
    assert.ok(
      omrScanSrc.includes('Take Photo &amp; Scan') || omrScanSrc.includes('Take Photo & Scan'),
      'Sticky mobile quick-action bar must include Take Photo & Scan action'
    );
    assert.ok(
      omrScanSrc.includes('Upload Sheet'),
      'Sticky mobile quick-action bar must include Upload Sheet action'
    );
  });

  test('7. Split-screen verification container and panels allow seamless touch scrolling on mobile', () => {
    assert.ok(
      omrScanSrc.includes('overflow-visible lg:overflow-hidden min-h-[400px] lg:min-h-[calc(100vh-280px)]'),
      'Split-screen container must be overflow-visible on mobile and lg:overflow-hidden on desktop'
    );
    assert.ok(
      omrScanSrc.includes('flex flex-1 flex-col overflow-visible lg:overflow-hidden bg-white lg:w-[45%]'),
      'Interactive scoring panel (right column) must be overflow-visible on mobile to avoid scroll-trapping'
    );
  });

  test('8. Save & Finalize Assessment button is sticky at bottom on mobile viewports', () => {
    assert.ok(
      omrScanSrc.includes('sticky lg:static bottom-0 left-0 right-0 z-20 shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 sm:p-4 shadow-lg lg:shadow-none'),
      'Save & Finalize Assessment footer must be sticky on mobile (< lg) and static on desktop'
    );
  });
});

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Phil-IRI Stage 1: Group Screening Test (GST) Module Tests', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('1. Sidebar contains GST navigation for both English and Filipino portals', () => {
    const sidebarPath = path.join(rootDir, 'src', 'components', 'Sidebar.tsx');
    assert.ok(fs.existsSync(sidebarPath), 'Sidebar.tsx must exist');

    const content = fs.readFileSync(sidebarPath, 'utf8');

    // ClipboardCheck icon imported
    assert.ok(content.includes('ClipboardCheck'), 'Sidebar must import ClipboardCheck icon');

    // English portal item under ASSESSMENTS
    assert.ok(
      content.includes("name: 'Group Screening Test (GST)'") || content.includes('name: "Group Screening Test (GST)"'),
      'Sidebar must have "Group Screening Test (GST)" in English navigation'
    );
    assert.ok(
      content.includes("href: '/dashboard/gst'") || content.includes('href: "/dashboard/gst"'),
      'English GST link must point to /dashboard/gst'
    );

    // Filipino portal item under MGA PAGTATASA
    assert.ok(
      content.includes("name: 'Pangkatang Pagtatasa (GST)'") || content.includes('name: "Pangkatang Pagtatasa (GST)"'),
      'Sidebar must have "Pangkatang Pagtatasa (GST)" in Filipino navigation'
    );
    assert.ok(
      content.includes('/dashboard/gst?stream=filipino'),
      'Filipino GST link must point to /dashboard/gst?stream=filipino'
    );

    // Reordered order: GST (1), Oral Reading (2), OMR Assessments (3), OMR Scan (4)
    const gstIdx = content.indexOf('/dashboard/gst');
    const oralIdx = content.indexOf('/dashboard/reading-fluency');
    const omrAssessIdx = content.indexOf('/dashboard/omr-assessments');
    const omrScanIdx = content.indexOf('/dashboard/omr-scan?scan=1');

    assert.ok(gstIdx !== -1, 'GST link must exist');
    assert.ok(oralIdx !== -1, 'Oral reading link must exist');
    assert.ok(omrAssessIdx !== -1, 'OMR assessments link must exist');
    assert.ok(omrScanIdx !== -1, 'OMR scan link must exist');

    assert.ok(gstIdx < oralIdx, 'GST must precede Oral Reading in sidebar');
    assert.ok(oralIdx < omrAssessIdx, 'Oral Reading must precede General OMR Assessments');
    assert.ok(omrAssessIdx < omrScanIdx, 'General OMR Assessments must precede OMR Scan');

    // No legacy standalone /dashboard/comprehension link
    assert.ok(
      !content.includes("href: '/dashboard/comprehension'") && !content.includes('href: "/dashboard/comprehension"'),
      'Sidebar must not contain standalone /dashboard/comprehension link'
    );
  });

  test('2. DepEd Phil-IRI Stage 1 Formula and Starting Level Evaluation', () => {
    const { evaluateGstScore } = require('../src/lib/reading.ts');
    assert.ok(typeof evaluateGstScore === 'function', 'evaluateGstScore must be exported from reading.ts');

    // Cutoff >= 28: Grade-Ready (Exempt from Stage 2)
    const pass28 = evaluateGstScore(28, 7);
    assert.strictEqual(pass28.isGradeReady, true);
    assert.strictEqual(pass28.gstStatus, 'Grade-Ready');
    assert.strictEqual(pass28.recommendedStartingGrade, null);

    const pass40 = evaluateGstScore(40, 9);
    assert.strictEqual(pass40.isGradeReady, true);
    assert.strictEqual(pass40.gstStatus, 'Grade-Ready');
    assert.strictEqual(pass40.recommendedStartingGrade, null);

    // Score 16-27: 2 grade levels below (floor Grade 4)
    const midG7 = evaluateGstScore(20, 7);
    assert.strictEqual(midG7.isGradeReady, false);
    assert.strictEqual(midG7.gstStatus, 'Needs Individualized Assessment');
    assert.strictEqual(midG7.recommendedStartingGrade, 5); // 7 - 2 = 5

    const midG8 = evaluateGstScore(16, 8);
    assert.strictEqual(midG8.isGradeReady, false);
    assert.strictEqual(midG8.recommendedStartingGrade, 6); // 8 - 2 = 6

    const midG9 = evaluateGstScore(27, 9);
    assert.strictEqual(midG9.isGradeReady, false);
    assert.strictEqual(midG9.recommendedStartingGrade, 7); // 9 - 2 = 7

    const midG10 = evaluateGstScore(25, 10);
    assert.strictEqual(midG10.isGradeReady, false);
    assert.strictEqual(midG10.recommendedStartingGrade, 8); // 10 - 2 = 8

    // Score 0-15: 3 grade levels below (floor Grade 4)
    const lowG7 = evaluateGstScore(12, 7);
    assert.strictEqual(lowG7.isGradeReady, false);
    assert.strictEqual(lowG7.recommendedStartingGrade, 4); // 7 - 3 = 4

    const lowG8 = evaluateGstScore(5, 8);
    assert.strictEqual(lowG8.isGradeReady, false);
    assert.strictEqual(lowG8.recommendedStartingGrade, 5); // 8 - 3 = 5

    const lowG9 = evaluateGstScore(0, 9);
    assert.strictEqual(lowG9.isGradeReady, false);
    assert.strictEqual(lowG9.recommendedStartingGrade, 6); // 9 - 3 = 6

    const lowG10 = evaluateGstScore(15, 10);
    assert.strictEqual(lowG10.isGradeReady, false);
    assert.strictEqual(lowG10.recommendedStartingGrade, 7); // 10 - 3 = 7

    // Floor at Grade 4 even if arithmetic yields lower
    const floorCheck = evaluateGstScore(2, 5);
    assert.strictEqual(floorCheck.recommendedStartingGrade, 4);
  });

  test('3. Stage 2 Handoff Integration in Reading Fluency page', () => {
    const readingFluencyPath = path.join(rootDir, 'src', 'app', 'dashboard', 'reading-fluency', 'page.tsx');
    const content = fs.readFileSync(readingFluencyPath, 'utf8');

    // Must accept studentId and startingLevel from query parameters
    assert.ok(content.includes('studentId'), 'Reading Fluency must read studentId parameter');
    assert.ok(content.includes('startingLevel'), 'Reading Fluency must read startingLevel parameter');
    assert.ok(content.includes('initialStudentId'), 'Reading Fluency must pass initialStudentId prop');
    assert.ok(content.includes('initialStartingLevel'), 'Reading Fluency must pass initialStartingLevel prop');
  });

  test('4. GST Booklet Data conforms to 40 items across 4 standardized selections', () => {
    const { getGstBookletData } = require('../src/lib/gstBookletData.ts');
    assert.ok(typeof getGstBookletData === 'function', 'getGstBookletData must be exported');

    // Test Grade 7 English
    const g7En = getGstBookletData(7, 'english');
    assert.strictEqual(g7En.gradeLevel, 7);
    assert.strictEqual(g7En.stream, 'english');
    assert.strictEqual(g7En.totalItems, 40);
    assert.strictEqual(g7En.selections.length, 4);
    assert.strictEqual(g7En.allQuestions.length, 40);

    // Verify selection types
    assert.strictEqual(g7En.selections[0].letter, 'A');
    assert.strictEqual(g7En.selections[0].type, 'poem');
    assert.strictEqual(g7En.selections[0].itemStart, 1);
    assert.strictEqual(g7En.selections[0].itemEnd, 10);
    assert.strictEqual(g7En.selections[0].questions.length, 10);

    assert.strictEqual(g7En.selections[1].letter, 'B');
    assert.strictEqual(g7En.selections[1].type, 'article');
    assert.strictEqual(g7En.selections[1].itemStart, 11);
    assert.strictEqual(g7En.selections[1].itemEnd, 20);

    assert.strictEqual(g7En.selections[2].letter, 'C');
    assert.strictEqual(g7En.selections[2].type, 'advisory');
    assert.strictEqual(g7En.selections[2].itemStart, 21);
    assert.strictEqual(g7En.selections[2].itemEnd, 30);

    assert.strictEqual(g7En.selections[3].letter, 'D');
    assert.strictEqual(g7En.selections[3].type, 'infographic');
    assert.strictEqual(g7En.selections[3].itemStart, 31);
    assert.strictEqual(g7En.selections[3].itemEnd, 40);

    // Verify questions have required properties
    g7En.allQuestions.forEach((q, idx) => {
      assert.strictEqual(q.number, idx + 1, `Question ${idx + 1} must have matching sequential number`);
      assert.ok(q.prompt && q.prompt.length > 5, `Question ${idx + 1} must have a valid prompt`);
      assert.strictEqual(q.choices.length, 4, `Question ${idx + 1} must have 4 choices`);
      assert.ok(['A', 'B', 'C', 'D'].includes(q.correctAnswer), `Question ${idx + 1} must have valid correctAnswer`);
      assert.ok(['Literal', 'Inferential', 'Critical'].includes(q.domain), `Question ${idx + 1} must have valid domain`);
    });

    // Test Grade 7 Filipino
    const g7Fil = getGstBookletData(7, 'filipino');
    assert.strictEqual(g7Fil.stream, 'filipino');
    assert.strictEqual(g7Fil.allQuestions.length, 40);
    assert.strictEqual(g7Fil.selections.length, 4);

    // Test Grades 8, 9, 10 for both languages
    [8, 9, 10].forEach((g) => {
      const en = getGstBookletData(g, 'english');
      assert.strictEqual(en.allQuestions.length, 40, `Grade ${g} English must have 40 questions`);
      assert.strictEqual(en.selections.length, 4, `Grade ${g} English must have 4 selections`);

      const fil = getGstBookletData(g, 'filipino');
      assert.strictEqual(fil.allQuestions.length, 40, `Grade ${g} Filipino must have 40 questions`);
      assert.strictEqual(fil.selections.length, 4, `Grade ${g} Filipino must have 4 selections`);
    });
  });

  test('5. Dedicated GST Section Page and API Route Exist', () => {
    const pagePath = path.join(rootDir, 'src', 'app', 'dashboard', 'gst', 'page.tsx');
    assert.ok(fs.existsSync(pagePath), 'src/app/dashboard/gst/page.tsx must exist');

    const pageContent = fs.readFileSync(pagePath, 'utf8');
    assert.ok(pageContent.includes('Phil-IRI Form 1A'), 'Page must contain Phil-IRI Form 1A references');
    assert.ok(pageContent.includes('booklet'), 'Page must contain booklet tab');
    assert.ok(pageContent.includes('entry'), 'Page must contain quick score entry tab');
    assert.ok(pageContent.includes('/dashboard/reading-fluency?studentId='), 'Page must provide Stage 2 handoff link');
    assert.ok(pageContent.includes('window.print()'), 'Page must provide print capabilities');

    const routePath = path.join(rootDir, 'src', 'app', 'api', 'teacher', 'gst', 'route.ts');
    assert.ok(fs.existsSync(routePath), 'src/app/api/teacher/gst/route.ts must exist');

    const routeContent = fs.readFileSync(routePath, 'utf8');
    assert.ok(routeContent.includes('export async function GET'), 'API route must export GET handler');
    assert.ok(routeContent.includes('export async function POST'), 'API route must export POST handler');
    assert.ok(routeContent.includes('evaluateGstScore'), 'API route must call evaluateGstScore');
    assert.ok(routeContent.includes('philIriEnglish'), 'API route must handle philIriEnglish');
    assert.ok(routeContent.includes('philIriFilipino'), 'API route must handle philIriFilipino');
  });

  test('6. GST Booklet Refactor: Desk Container, DepEd Header, 5-Page Standard Layout, Bubble Sheet & Answer Key', () => {
    const pagePath = path.join(rootDir, 'src', 'app', 'dashboard', 'gst', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // 1. 2-Column Responsive Layout & Desk Preview Container
    assert.ok(content.includes('lg:grid-cols-12'), 'Must use 12-column responsive grid layout');
    assert.ok(content.includes('lg:col-span-4'), 'Must have left column vertical controls');
    assert.ok(content.includes('lg:col-span-8'), 'Must have right column document desk preview');
    assert.ok(content.includes('id="gst-booklet-desk-container"'), 'Must have desk container element');
    assert.ok(content.includes('bg-slate-100/90'), 'Desk preview container must have bg-slate-100/90 background');
    assert.ok(content.includes('max-w-3xl mx-auto') || content.includes('max-w-4xl mx-auto'), 'Paper preview must enforce max-w-3xl mx-auto constraint');

    // 2. DepEd Authority Header & School Name
    assert.ok(content.includes('src="/aral-logo.png"'), 'DepEd header must use /aral-logo.png');
    assert.ok(content.includes('GEN. EMILIO AGUINALDO INTEGRATED SCHOOL'), 'Must feature Gen. Emilio Aguinaldo Integrated School');
    assert.ok(content.includes('Department of Education') || content.includes('Kagawaran ng Edukasyon'), 'Must include DepEd authority line');

    // 3. Student Information Grid with 2 columns and dashed underlines
    assert.ok(content.includes('RAW SCORE:'), 'Student info grid must contain RAW SCORE field');
    assert.ok(content.includes('border-dashed'), 'Student info lines must use dashed underlines');

    // 4. Compact 2-column question options layout
    assert.ok(content.includes('grid grid-cols-2 gap-x-2') || content.includes('grid grid-cols-2 gap-2 text-xs'), 'Question choices must be in compact 2-column grid');

    // 5. 5-Page Booklet Structure with Page Breaks
    assert.ok(content.includes('pageBreakAfter: "always"') || content.includes('page-break-after: always'), 'Booklet pages must enforce print page breaks');
    assert.ok(content.includes('booklet-page'), 'Booklet pages must use booklet-page CSS class');

    // 6. 40-Item Bubble Sheet with corner fiducial marks and Student Number shading grid
    assert.ok(content.includes('w-5 h-5 bg-slate-950') || content.includes('Fiducial Marks'), 'Bubble sheet must render 4 corner fiducial marks');
    assert.ok(content.includes('Student Number Shading Grid'), 'Bubble sheet must feature 8-digit Student Number shading grid');
    assert.ok(content.includes('getStampedBubbleSheetUrl'), 'Must import getStampedBubbleSheetUrl for official PDF download');

    // 7. Compact 4-Column Answer Key Matrix with domain distribution
    assert.ok(content.includes('Literal') && content.includes('Inferential') && content.includes('Critical'), 'Answer key must categorize cognitive domains');
    assert.ok(content.includes('grid-cols-4'), 'Answer key table must display across 4 compact columns');

    // 8. Standardized Toolbar Actions & Document Header (Clean Professional Design, No Emojis)
    assert.ok(content.includes('Download Official Bubble Sheet PDF') || content.includes('Download Bubble Sheet PDF'), 'Toolbar must contain bubble sheet PDF download button');
    assert.ok(content.includes('Print Selected Document'), 'Toolbar must contain Print Selected Document button');
    assert.ok(content.includes('Start Scanning Sheets'), 'Right column actions must link to scanning sheets');
    assert.ok(content.includes('Assessment Configuration') || content.includes('Configure GST Booklet'), 'Left column must include assessment configuration title');
    assert.ok(content.includes('SELECTION COVERAGE') || content.includes('Reading Selection Coverage'), 'Left column must include selection coverage');
    assert.ok(content.includes('Official Phil-IRI Standard:') && content.includes('40 Multiple-Choice items'), 'Must include official status callout bar');

    // 9. Authentic Lucide Icons & Real Topic Summaries (Zero AI Slop / Emojis)
    assert.ok(content.includes('ScanLine') && content.includes('KeyRound'), 'Layout view must use clean ScanLine and KeyRound Lucide icons');
    assert.ok(content.includes('topicsSummary'), 'Must compute dynamic real selection topic summaries instead of bracketed placeholders');
    const emojis = content.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || [];
    assert.strictEqual(emojis.length, 0, 'Page must contain 0 emojis');
  });

  test('7. Scoped Print Engine: Clean Assessment Paper Printing & UI Isolation', () => {
    const pagePath = path.join(rootDir, 'src', 'app', 'dashboard', 'gst', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // 1. Scoped print stylesheet with @media print rules
    assert.ok(content.includes('@media print'), 'Must include @media print stylesheet');
    assert.ok(content.includes('visibility: hidden !important'), 'Print stylesheet must hide entire app UI by default');
    assert.ok(content.includes('#gst-printable-area'), 'Print stylesheet must target #gst-printable-area');
    assert.ok(content.includes('visibility: visible !important'), 'Print stylesheet must make #gst-printable-area visible');

    // 2. Document position reset to top-left
    assert.ok(content.includes('position: absolute !important'), 'Print area must be positioned absolute');
    assert.ok(content.includes('top: 0 !important') && content.includes('left: 0 !important'), 'Print area must start at top 0, left 0');

    // 3. Strict portrait paper margins
    assert.ok(content.includes('size: portrait'), 'Must enforce portrait paper orientation');
    assert.ok(content.includes('margin: 0.5cm') || content.includes('margin: 0.8cm'), 'Must enforce compact paper margin');

    // 4. Page breaks, 27cm single-page enforcement, and avoid breaks
    assert.ok(content.includes('.print-page-break'), 'Must define .print-page-break class');
    assert.ok(content.includes('.print-avoid-break'), 'Must define .print-avoid-break class');
    assert.ok(content.includes('.print-booklet-page'), 'Must define .print-booklet-page class');
    assert.ok(content.includes('height: 27cm !important'), 'Must enforce 27cm height per booklet page');
    assert.ok(content.includes('className="print-booklet-page') || content.includes("print-booklet-page"), 'Booklet pages must use print-booklet-page class');
    assert.ok(content.includes('print-avoid-break'), 'Question items must use print-avoid-break class');
    assert.ok(content.includes('Shade your answers cleanly on your official 40-Item OMR Answer Sheet'), 'Page 1 must include compact inline direction');

    // 5. Hide non-print buttons and bars
    assert.ok(content.includes('nav') && content.includes('aside') && content.includes('button') && content.includes('.gst-no-print'), 'Must hide nav, aside, header, button, and .gst-no-print on print');

    // 6. Dynamic target: Desk booklet preview vs Form 1A modal
    assert.ok(content.includes('!showForm1AModal ? "gst-printable-area" : "gst-desk-preview"'), 'Desk container must dynamically adopt gst-printable-area when Form 1A is closed');
    assert.ok(content.includes('showForm1AModal ? "gst-printable-area" : "gst-form1a-preview"'), 'Form 1A modal must dynamically adopt gst-printable-area when modal is open');
  });
});

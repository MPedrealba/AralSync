const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Standard Default Institutional Header & Print Margins Across Assessments Suite', () => {
  const gstPath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'gst', 'page.tsx');
  const omrPath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');

  const gstContent = fs.readFileSync(gstPath, 'utf8');
  const omrContent = fs.readFileSync(omrPath, 'utf8');

  test('1. Completely removes boxed Phil-IRI top-right badge from GST and OMR assessment pages', () => {
    // There must be NO top-right boxed Phil-IRI badge in either file
    const badgePattern = /absolute\s+top-0\s+right-0\s+border\s+border-black\s+rounded[^>]*>\s*Phil-IRI/i;
    assert.ok(!badgePattern.test(gstContent), 'GST page must not contain top-right Phil-IRI boxed badge');
    assert.ok(!badgePattern.test(omrContent), 'OMR assessments page must not contain top-right Phil-IRI boxed badge');
  });

  test('2. Enforces @page { margin: 10mm 16mm } in GST print styles and handlers', () => {
    assert.ok(gstContent.includes('margin: 10mm 16mm;'), 'GST page must enforce 10mm 16mm margin in @page');
    assert.ok(gstContent.includes('padding: 6mm 14mm !important;'), 'GST page must enforce 6mm 14mm padding on print booklet page');
  });

  test('3. Enforces @page { margin: 10mm 16mm } and 6mm 14mm padding in OMR assessments print styles', () => {
    assert.ok(omrContent.includes('margin: 10mm 16mm'), 'OMR assessments must enforce 10mm 16mm margin in @page');
    assert.ok(omrContent.includes('padding: 6mm 14mm !important'), 'OMR assessments must enforce 6mm 14mm container padding');
    assert.ok(omrContent.includes('questionnaire-print-container'), 'OMR assessments must apply questionnaire-print-container class');
  });

  test('4. GST Page 1 implements Standard Default Institutional Header & Student Meta', () => {
    assert.ok(gstContent.includes('Kagawaran ng Edukasyon'), 'GST must have Filipino DepEd header');
    assert.ok(gstContent.includes('Department of Education'), 'GST must have English DepEd header');
    assert.ok(gstContent.includes('GEN. EMILIO AGUINALDO INTEGRATED SCHOOL'), 'GST must feature school name');
    assert.ok(gstContent.includes('{isFilipino ? "Pangalan:" : "Name:"}'), 'GST must feature Name field');
    assert.ok(gstContent.includes('{isFilipino ? "Pangkat:" : "Section:"}'), 'GST must feature Section field');
    assert.ok(gstContent.includes('{isFilipino ? "Petsa:" : "Date:"}'), 'GST must feature Date field');
    assert.ok(gstContent.includes('{isFilipino ? "Guro:" : "Teacher:"}'), 'GST must feature Teacher field');
    assert.ok(
      gstContent.includes('Panuto: Basahin ang bawat aytem. Piliin at itiman ang titik ng tamang sagot sa official OMR Answer Sheet. Huwag susulatan ang booklet na ito.'),
      'GST must have standard Filipino directions'
    );
    assert.ok(
      gstContent.includes('Directions: Read each question carefully. Select and shade the letter of the correct answer clearly on your official OMR Answer Sheet. Do not write on this booklet.'),
      'GST must have standard English directions'
    );
  });

  test('5. OMR Assessments unifies standard institutional header across all subjects (Math, Science, Reading)', () => {
    assert.ok(omrContent.includes('Kagawaran ng Edukasyon'), 'OMR assessments must have Filipino DepEd header');
    assert.ok(omrContent.includes('Department of Education'), 'OMR assessments must have English DepEd header');
    assert.ok(omrContent.includes('GEN. EMILIO AGUINALDO INTEGRATED SCHOOL'), 'OMR assessments must feature school name');
    assert.ok(omrContent.includes('Pangalan:') && omrContent.includes('Name:'), 'OMR assessments must feature Name/Pangalan');
    assert.ok(omrContent.includes('Pangkat:') && omrContent.includes('Section:'), 'OMR assessments must feature Section/Pangkat');
    assert.ok(omrContent.includes('Petsa:') && omrContent.includes('Date:'), 'OMR assessments must feature Date/Petsa');
    assert.ok(omrContent.includes('Guro:') && omrContent.includes('Teacher:'), 'OMR assessments must feature Teacher/Guro');
    assert.ok(
      omrContent.includes('Directions: Read each question carefully. Select and shade the letter of the correct answer clearly on your official OMR Answer Sheet. Do not write on this booklet.'),
      'OMR assessments must have standard English directions'
    );
  });
});

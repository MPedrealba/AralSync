const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Coordinator Uploaded Learning Materials Visibility Suite', () => {
  const apiRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'learning-materials', 'route.ts');
  const sidebarPath = path.join(__dirname, '..', 'src', 'components', 'Sidebar.tsx');
  const interventionsPath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'interventions', 'page.tsx');
  const omrAssessmentsPath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
  const materialsHubPath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'learning-materials', 'page.tsx');

  test('1. api/learning-materials/route.ts normalizes & bridges subjects (Reading, English, Filipino)', () => {
    assert.ok(fs.existsSync(apiRoutePath), 'route.ts must exist');
    const content = fs.readFileSync(apiRoutePath, 'utf8');

    // Subject expansion helper check
    assert.ok(
      content.includes('expandSubject') || content.includes('Reading') && content.includes('English') && content.includes('Filipino'),
      'Must contain subject expansion/bridging logic'
    );
    assert.ok(content.includes('Reading - English') || content.includes('Literacy'), 'Must include reading aliases');
    assert.ok(content.includes('Mathematics') || content.includes('Numeracy'), 'Must include math aliases');

    // Key stage filter check - must NOT hardcode {$nin: ['KS1', 'KS2']} by default
    assert.ok(
      !content.includes("query.keyStage = { $nin: ['KS1', 'KS2'] };"),
      'Must not permanently filter out KS1 and KS2 materials by default'
    );

    // Flexible grade matching check
    assert.ok(
      content.includes('$size: 0') || content.includes('$exists: false'),
      'Must include flexible grade matching allowing materials with empty/null gradeLevels'
    );
  });

  test('2. interventions/page.tsx bridges English/Filipino teachers to Reading materials & supports attachMaterial', () => {
    assert.ok(fs.existsSync(interventionsPath), 'interventions/page.tsx must exist');
    const content = fs.readFileSync(interventionsPath, 'utf8');

    assert.ok(
      content.includes('isReadingSubj') || content.includes('English') && content.includes('Filipino'),
      'Must check if subject is English, Filipino, or Reading'
    );
    assert.ok(
      content.includes('attachMaterial'),
      'Must support attachMaterial query parameter to pre-select workbook'
    );
  });

  test('3. omr-assessments/page.tsx availableMaterials memo includes reading aliases and flexible grades', () => {
    assert.ok(fs.existsSync(omrAssessmentsPath), 'omr-assessments/page.tsx must exist');
    const content = fs.readFileSync(omrAssessmentsPath, 'utf8');

    assert.ok(
      content.includes('isReadingQuery') && content.includes('isReadingMaterial'),
      'Must define isReadingQuery and isReadingMaterial'
    );
    assert.ok(
      content.includes('!m.gradeLevels') || content.includes('m.gradeLevels.length === 0'),
      'Must allow general/curriculum-wide workbooks with empty or missing gradeLevels'
    );
  });

  test('4. Sidebar.tsx includes Learning Materials link in English and Filipino nav sections', () => {
    assert.ok(fs.existsSync(sidebarPath), 'Sidebar.tsx must exist');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    assert.ok(
      content.includes('/dashboard/learning-materials'),
      'Sidebar must include link to /dashboard/learning-materials'
    );
    assert.ok(
      content.includes('Learning Materials'),
      'Sidebar must have English label "Learning Materials"'
    );
    assert.ok(
      content.includes('Mga Kagamitan sa Pagkatuto'),
      'Sidebar must have Filipino label "Mga Kagamitan sa Pagkatuto"'
    );
  });

  test('5. dashboard/learning-materials/page.tsx exists and renders teacher repository interface', () => {
    assert.ok(fs.existsSync(materialsHubPath), 'learning-materials/page.tsx must exist');
    const content = fs.readFileSync(materialsHubPath, 'utf8');

    assert.ok(content.includes('Learning Materials & Workbooks'), 'Must include header title');
    assert.ok(content.includes('SUBJECT_OPTIONS') || content.includes('selectedSubject'), 'Must support subject filter');
    assert.ok(content.includes('GRADE_OPTIONS') || content.includes('selectedGrade'), 'Must support grade filter');
    assert.ok(content.includes('searchQuery') || content.includes('setSearchQuery'), 'Must support search input');
    assert.ok(content.includes('sessionDirectory') || content.includes('Session'), 'Must render session directory accordion');
    assert.ok(content.includes('View PDF'), 'Must have View PDF button');
    assert.ok(content.includes('Create Intervention Task'), 'Must have Create Intervention Task button');
    assert.ok(content.includes('/dashboard/interventions?attachMaterial='), 'Must link to interventions with attachMaterial');
  });
});

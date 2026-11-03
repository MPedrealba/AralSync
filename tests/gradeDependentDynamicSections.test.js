import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Helper for normalized grade matching across all components
function resolveSectionsForGrade(gradeSectionsMap, selectedGrade, allSections = []) {
  if (!selectedGrade || selectedGrade === 'all' || selectedGrade === 'All') {
    return allSections;
  }
  const digitsKey = String(selectedGrade).replace(/\D/g, '');
  return (
    gradeSectionsMap[selectedGrade] ||
    gradeSectionsMap[digitsKey] ||
    gradeSectionsMap[`Grade ${digitsKey}`] ||
    []
  );
}

// Helper simulating filter grade change with automatic section reset
function handleGradeFilterChange({ newGrade, currentSection, gradeSectionsMap, allSections = [], resetValue = 'all' }) {
  let nextSection = currentSection;
  if (!newGrade || newGrade === 'all' || newGrade === 'All') {
    if (currentSection !== resetValue && !allSections.includes(currentSection)) {
      nextSection = resetValue;
    }
    return { grade: newGrade, section: nextSection };
  }

  const digitsKey = String(newGrade).replace(/\D/g, '');
  const validSections =
    gradeSectionsMap[newGrade] ||
    gradeSectionsMap[digitsKey] ||
    gradeSectionsMap[`Grade ${digitsKey}`] ||
    [];

  if (currentSection !== resetValue && !validSections.includes(currentSection)) {
    nextSection = resetValue;
  }

  return { grade: newGrade, section: nextSection };
}

describe('Grade-Dependent Dynamic Section Filtering System-Wide Suite', () => {
  const sampleGradeSectionsMap = {
    '7': ['Rosal', 'Sampaguita'],
    '8': ['Diamond', 'Emerald', 'Ruby'],
    '9': ['Einstein', 'Newton'],
    '10': [], // Cohort with 0 enrolled sections
  };

  const sampleAllSections = ['Diamond', 'Einstein', 'Emerald', 'Newton', 'Rosal', 'Ruby', 'Sampaguita'];

  it('normalizes grade keys from numbers, digits, and formatted strings ("Grade 7", "7", 7)', () => {
    const resFormatted = resolveSectionsForGrade(sampleGradeSectionsMap, 'Grade 7', sampleAllSections);
    const resStringDigit = resolveSectionsForGrade(sampleGradeSectionsMap, '7', sampleAllSections);
    const resNumber = resolveSectionsForGrade(sampleGradeSectionsMap, 7, sampleAllSections);

    assert.deepEqual(resFormatted, ['Rosal', 'Sampaguita']);
    assert.deepEqual(resStringDigit, ['Rosal', 'Sampaguita']);
    assert.deepEqual(resNumber, ['Rosal', 'Sampaguita']);
  });

  it('strictly scopes sections so Grade 7 sections never appear in Grade 8 or vice-versa', () => {
    const g7Sections = resolveSectionsForGrade(sampleGradeSectionsMap, '7', sampleAllSections);
    const g8Sections = resolveSectionsForGrade(sampleGradeSectionsMap, '8', sampleAllSections);

    assert.deepEqual(g7Sections, ['Rosal', 'Sampaguita']);
    assert.deepEqual(g8Sections, ['Diamond', 'Emerald', 'Ruby']);

    // Complete isolation: No section overlaps between distinct grades
    const overlap = g7Sections.filter((s) => g8Sections.includes(s));
    assert.equal(overlap.length, 0, 'Sections must never leak across grade levels');
  });

  it('displays an empty list for a grade with 0 enrolled sections without falling back to all sections', () => {
    const g10Sections = resolveSectionsForGrade(sampleGradeSectionsMap, '10', sampleAllSections);
    assert.deepEqual(g10Sections, [], 'Must return empty array for 0 enrolled sections, never all school sections');
    assert.notDeepEqual(g10Sections, sampleAllSections);
  });

  it('displays all cohort sections when "all" or empty string is selected', () => {
    const all1 = resolveSectionsForGrade(sampleGradeSectionsMap, 'all', sampleAllSections);
    const all2 = resolveSectionsForGrade(sampleGradeSectionsMap, '', sampleAllSections);
    assert.deepEqual(all1, sampleAllSections);
    assert.deepEqual(all2, sampleAllSections);
  });

  it('automatically resets section to "all" when changing grade and the previous section is invalid in the new grade', () => {
    // Currently on Grade 7 with section Rosal; user switches to Grade 8
    const result = handleGradeFilterChange({
      newGrade: 'Grade 8',
      currentSection: 'Rosal',
      gradeSectionsMap: sampleGradeSectionsMap,
      allSections: sampleAllSections,
      resetValue: 'all',
    });

    assert.equal(result.grade, 'Grade 8');
    assert.equal(result.section, 'all', 'Must auto-reset to "all" because Rosal does not exist in Grade 8');
  });

  it('automatically resets section to "" when resetValue is empty string (e.g., Progress Monitoring / Intervention Modal)', () => {
    // Currently on Grade 8 with section Diamond; user switches to Grade 9
    const result = handleGradeFilterChange({
      newGrade: '9',
      currentSection: 'Diamond',
      gradeSectionsMap: sampleGradeSectionsMap,
      allSections: sampleAllSections,
      resetValue: '',
    });

    assert.equal(result.grade, '9');
    assert.equal(result.section, '', 'Must auto-reset to "" when section is invalid in Grade 9');
  });

  it('preserves section if it legitimately exists in both grades (e.g. shared cohort name)', () => {
    const sharedMap = {
      '7': ['Sampaguita', 'Rosal'],
      '8': ['Sampaguita', 'Diamond'],
    };
    const result = handleGradeFilterChange({
      newGrade: '8',
      currentSection: 'Sampaguita',
      gradeSectionsMap: sharedMap,
      allSections: ['Diamond', 'Rosal', 'Sampaguita'],
      resetValue: 'all',
    });

    assert.equal(result.grade, '8');
    assert.equal(result.section, 'Sampaguita', 'Must preserve section if present in newly selected grade');
  });

  it('verifies static source code: no hardcoded section fallback arrays exist in critical modules', () => {
    const rootDir = process.cwd();
    const filesToCheck = [
      'src/app/coordinator/learners/page.tsx',
      'src/app/api/coordinator/learners/route.ts',
      'src/app/dashboard/learners/page.tsx',
      'src/app/dashboard/learning-recovery/page.tsx',
      'src/app/dashboard/progress-monitoring/page.tsx',
      'src/app/api/teacher/progress-monitoring/route.ts',
      'src/app/dashboard/interventions/page.tsx',
      'src/components/AddLearnerModal.tsx',
      'src/components/ClassRecordMatrix.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Target file exists: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf8');

      // 1. Must not define hardcoded static arrays like ["Rosal", "Sampaguita", "Ilang-Ilang"]
      const hardcodedPattern = /\[\s*['"`](Rosal|Sampaguita|Ilang-Ilang|Camia)['"`]/;
      assert.equal(
        hardcodedPattern.test(content),
        false,
        `File ${relPath} should not contain hardcoded section arrays like ['Rosal', ...]`
      );

      // 2. Must not contain SECTIONS_LIST
      assert.equal(
        content.includes('SECTIONS_LIST'),
        false,
        `File ${relPath} should not define or reference SECTIONS_LIST`
      );

      // 3. Must not contain fake defaultSections fallback injection
      assert.equal(
        content.includes('defaultSections'),
        false,
        `File ${relPath} should not contain defaultSections fallback`
      );
    }
  });

  it('verifies /api/teacher/progress-monitoring route returns sectionsByGrade', () => {
    const routePath = path.join(process.cwd(), 'src/app/api/teacher/progress-monitoring/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');
    assert.ok(
      content.includes('sectionsByGrade'),
      'Progress monitoring route must aggregate and return sectionsByGrade'
    );
  });
});

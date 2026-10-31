import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Helper replicating the database cohort aggregation logic used in /api/class-record/cohorts
function buildGradeSectionsMap(records) {
  const gradeSectionsMap = {};
  const gradesSet = new Set();

  for (const r of records) {
    const g = r.gradeLevel;
    const s = (r.section || '').trim();
    if (g != null && s) {
      const gKey = String(g);
      gradesSet.add(gKey);
      if (!gradeSectionsMap[gKey]) {
        gradeSectionsMap[gKey] = [];
      }
      if (!gradeSectionsMap[gKey].includes(s)) {
        gradeSectionsMap[gKey].push(s);
      }
    }
  }

  for (const g of Object.keys(gradeSectionsMap)) {
    gradeSectionsMap[g].sort((a, b) => a.localeCompare(b));
  }

  const standardGrades = ['7', '8', '9', '10'];
  standardGrades.forEach((g) => {
    gradesSet.add(g);
    if (!gradeSectionsMap[g]) {
      gradeSectionsMap[g] = [];
    }
  });

  const availableGrades = Array.from(gradesSet).sort((a, b) => Number(a) - Number(b));

  return { gradeSectionsMap, availableGrades };
}

// Helper replicating the section synchronization handler on grade change
function simulateGradeChange({ newGrade, currentSection, isCustomSection, gradeSectionsMap }) {
  let updatedSection = currentSection;
  let updatedIsCustom = isCustomSection;

  updatedIsCustom = false;
  const sectionsForGrade = gradeSectionsMap[newGrade] || [];
  if (sectionsForGrade.length > 0) {
    if (!sectionsForGrade.includes(currentSection)) {
      updatedSection = sectionsForGrade[0];
    }
  } else {
    updatedSection = '';
  }

  return { section: updatedSection, isCustomSection: updatedIsCustom };
}

describe('Class Record Matrix Dynamic Cohort & Filter Synchronization Suite', () => {
  const mockDatabaseRecords = [
    { gradeLevel: 7, section: 'Rosal' },
    { gradeLevel: 7, section: 'Sampaguita' },
    { gradeLevel: 7, section: 'Camia' },
    { gradeLevel: 7, section: 'Daisy' },
    { gradeLevel: 8, section: 'Dahlia' },
    { gradeLevel: 8, section: 'Jasmine' },
    { gradeLevel: 8, section: 'Tulip' },
    { gradeLevel: 8, section: 'Orchid' },
    { gradeLevel: 9, section: 'Everlasting' },
    { gradeLevel: 9, section: 'Ilang-Ilang' },
    { gradeLevel: 9, section: 'Gumamela' },
    { gradeLevel: 9, section: 'Sunflower' },
    { gradeLevel: 10, section: 'Kamagong' },
    { gradeLevel: 10, section: 'Molave' },
    { gradeLevel: 10, section: 'Narra' },
    { gradeLevel: 10, section: 'Acacia' },
  ];

  it('dynamically aggregates distinct sections by grade from database records', () => {
    const { gradeSectionsMap, availableGrades } = buildGradeSectionsMap(mockDatabaseRecords);

    assert.deepEqual(availableGrades, ['7', '8', '9', '10']);
    assert.deepEqual(gradeSectionsMap['7'], ['Camia', 'Daisy', 'Rosal', 'Sampaguita']);
    assert.deepEqual(gradeSectionsMap['8'], ['Dahlia', 'Jasmine', 'Orchid', 'Tulip']);
    assert.deepEqual(gradeSectionsMap['9'], ['Everlasting', 'Gumamela', 'Ilang-Ilang', 'Sunflower']);
    assert.deepEqual(gradeSectionsMap['10'], ['Acacia', 'Kamagong', 'Molave', 'Narra']);
  });

  it('guarantees complete section isolation across grade levels', () => {
    const { gradeSectionsMap } = buildGradeSectionsMap(mockDatabaseRecords);

    // Grade 8 sections must NOT contain Grade 7 sections
    assert.equal(gradeSectionsMap['8'].includes('Rosal'), false);
    assert.equal(gradeSectionsMap['8'].includes('Camia'), false);

    // Grade 9 sections must NOT contain Grade 8 sections
    assert.equal(gradeSectionsMap['9'].includes('Dahlia'), false);
    assert.equal(gradeSectionsMap['9'].includes('Tulip'), false);

    // Grade 10 sections must NOT contain Grade 9 sections
    assert.equal(gradeSectionsMap['10'].includes('Everlasting'), false);
    assert.equal(gradeSectionsMap['10'].includes('Ilang-Ilang'), false);
  });

  it('automatically resets section to first valid section when switching to another grade', () => {
    const { gradeSectionsMap } = buildGradeSectionsMap(mockDatabaseRecords);

    // User is currently viewing Grade 7 Rosal
    const changeToGrade8 = simulateGradeChange({
      newGrade: '8',
      currentSection: 'Rosal',
      isCustomSection: false,
      gradeSectionsMap,
    });
    // Rosal is not in Grade 8, so it must auto-select the first section of Grade 8 ("Dahlia")
    assert.equal(changeToGrade8.section, 'Dahlia');
    assert.equal(changeToGrade8.isCustomSection, false);

    // Switching from Grade 8 Dahlia to Grade 9
    const changeToGrade9 = simulateGradeChange({
      newGrade: '9',
      currentSection: changeToGrade8.section,
      isCustomSection: false,
      gradeSectionsMap,
    });
    assert.equal(changeToGrade9.section, 'Everlasting');

    // Switching from Grade 9 to Grade 10
    const changeToGrade10 = simulateGradeChange({
      newGrade: '10',
      currentSection: changeToGrade9.section,
      isCustomSection: false,
      gradeSectionsMap,
    });
    assert.equal(changeToGrade10.section, 'Acacia');
  });

  it('preserves section if it exists in the target grade', () => {
    const { gradeSectionsMap } = buildGradeSectionsMap([
      { gradeLevel: 7, section: 'Sampaguita' },
      { gradeLevel: 8, section: 'Sampaguita' },
      { gradeLevel: 8, section: 'Dahlia' },
    ]);

    const result = simulateGradeChange({
      newGrade: '8',
      currentSection: 'Sampaguita',
      isCustomSection: false,
      gradeSectionsMap,
    });

    // Sampaguita exists in both Grade 7 and Grade 8, so it stays selected
    assert.equal(result.section, 'Sampaguita');
  });

  it('handles grades with 0 enrolled sections cleanly', () => {
    const { gradeSectionsMap } = buildGradeSectionsMap([
      { gradeLevel: 7, section: 'Rosal' },
    ]);

    // Grade 8 has no sections enrolled yet
    const result = simulateGradeChange({
      newGrade: '8',
      currentSection: 'Rosal',
      isCustomSection: false,
      gradeSectionsMap,
    });

    assert.equal(result.section, '');
    assert.equal(result.isCustomSection, false);
  });

  it('resets custom section mode when switching grade levels', () => {
    const { gradeSectionsMap } = buildGradeSectionsMap(mockDatabaseRecords);

    const result = simulateGradeChange({
      newGrade: '7',
      currentSection: 'Special-Cohort-A',
      isCustomSection: true,
      gradeSectionsMap,
    });

    assert.equal(result.isCustomSection, false);
    assert.equal(result.section, 'Camia'); // First section in Grade 7
  });

  it('verifies ClassRecordMatrix.tsx source has ZERO hardcoded section arrays', () => {
    const componentPath = path.resolve(process.cwd(), 'src/components/ClassRecordMatrix.tsx');
    const source = fs.readFileSync(componentPath, 'utf8');

    // Must NOT have DEFAULT_SECTIONS array
    assert.equal(source.includes('DEFAULT_SECTIONS'), false, 'DEFAULT_SECTIONS should be deleted');
    assert.equal(source.includes('["Rosal", "Sampaguita", "Ilang-Ilang", "Camia", "Daisy"]'), false, 'Hardcoded section array must not exist');

    // Must fetch /api/class-record/cohorts
    assert.equal(source.includes('/api/class-record/cohorts'), true, 'Must query cohorts endpoint');

    // Must use dynamic gradeSectionsMap in section select
    assert.equal(source.includes('gradeSectionsMap[gradeLevel]'), true, 'Must index sections by selected grade');
  });
});

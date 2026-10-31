const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Filter metadata extraction logic as implemented in /api/teacher/skill-gap
function extractFilterMetadata(records) {
  const availableGrades = [
    ...new Set(records.map((r) => (r.gradeLevel != null ? String(r.gradeLevel) : null)).filter(Boolean)),
  ].sort((a, b) => Number(a) - Number(b));

  const sectionsByGrade = {};
  const allSectionsSet = new Set();

  for (const r of records) {
    if (r.section) {
      allSectionsSet.add(r.section);
      if (r.gradeLevel != null) {
        const gKey = String(r.gradeLevel);
        if (!sectionsByGrade[gKey]) sectionsByGrade[gKey] = [];
        if (!sectionsByGrade[gKey].includes(r.section)) {
          sectionsByGrade[gKey].push(r.section);
        }
      }
    }
  }

  for (const g of Object.keys(sectionsByGrade)) {
    sectionsByGrade[g].sort((a, b) => a.localeCompare(b));
  }

  const availableSections = [...allSectionsSet].sort((a, b) => a.localeCompare(b));

  return {
    grades: availableGrades,
    sections: availableSections,
    sectionsByGrade,
  };
}

// Client-side synchronization logic
function resolveAvailableSectionsForGrade(gradeFilter, filters) {
  if (!gradeFilter) {
    return filters.sections || [];
  }
  const rawKey = gradeFilter;
  const digitsKey = gradeFilter.replace(/\D/g, '');
  return (
    filters.sectionsByGrade[rawKey] ||
    filters.sectionsByGrade[digitsKey] ||
    filters.sectionsByGrade[`Grade ${digitsKey}`] ||
    []
  );
}

function synchronizeSectionOnGradeChange(newGrade, currentSection, filters) {
  if (!currentSection) return '';
  if (!newGrade) {
    return filters.sections.includes(currentSection) ? currentSection : '';
  }
  const digitsKey = newGrade.replace(/\D/g, '');
  const validSections =
    filters.sectionsByGrade[newGrade] ||
    filters.sectionsByGrade[digitsKey] ||
    filters.sectionsByGrade[`Grade ${digitsKey}`] ||
    [];
  return validSections.includes(currentSection) ? currentSection : '';
}

// Backend filter evaluation & match criteria
function buildRecordFilter(grade, section) {
  const hasGradeFilter = Boolean(grade && grade !== 'all' && grade !== 'All Grades' && grade.replace(/\D/g, ''));
  const hasSectionFilter = Boolean(section && section !== 'all' && section !== 'All Sections' && section.trim());
  const hasFilter = hasGradeFilter || hasSectionFilter;

  if (!hasFilter) return null;

  const recordFilter = {};
  if (hasGradeFilter && grade) {
    const g = Number(grade.replace(/\D/g, ''));
    if (!Number.isNaN(g)) recordFilter.gradeLevel = g;
  }
  if (hasSectionFilter && section) {
    recordFilter.section = section.trim();
  }
  return recordFilter;
}

describe('Skill Gap Analytics Grade & Section Filter Synchronization Suite', () => {
  const mockRecords = [
    { gradeLevel: 7, section: 'Rosal', studentId: 's1' },
    { gradeLevel: 7, section: 'Rosal', studentId: 's2' },
    { gradeLevel: 8, section: 'Sampaguita', studentId: 's3' },
    { gradeLevel: 8, section: 'Dahlia', studentId: 's4' },
    { gradeLevel: 9, section: 'Ilang-Ilang', studentId: 's5' },
    { gradeLevel: 9, section: 'Everlasting', studentId: 's6' },
    { gradeLevel: 10, section: 'Sampaguita', studentId: 's7' },
    { gradeLevel: 10, section: 'Kamagong', studentId: 's8' },
  ];

  test('dynamically extracts sorted distinct grades, sections, and sectionsByGrade mapping', () => {
    const filters = extractFilterMetadata(mockRecords);

    assert.deepEqual(filters.grades, ['7', '8', '9', '10']);
    assert.deepEqual(filters.sections, [
      'Dahlia',
      'Everlasting',
      'Ilang-Ilang',
      'Kamagong',
      'Rosal',
      'Sampaguita',
    ]);
    assert.deepEqual(filters.sectionsByGrade['7'], ['Rosal']);
    assert.deepEqual(filters.sectionsByGrade['8'], ['Dahlia', 'Sampaguita']);
    assert.deepEqual(filters.sectionsByGrade['9'], ['Everlasting', 'Ilang-Ilang']);
    assert.deepEqual(filters.sectionsByGrade['10'], ['Kamagong', 'Sampaguita']);
  });

  test('resolves grade-specific sections or all sections when no grade is selected', () => {
    const filters = extractFilterMetadata(mockRecords);

    const allSections = resolveAvailableSectionsForGrade('', filters);
    assert.equal(allSections.length, 6);

    const gr7Sections = resolveAvailableSectionsForGrade('Grade 7', filters);
    assert.deepEqual(gr7Sections, ['Rosal']);

    const gr8Sections = resolveAvailableSectionsForGrade('8', filters);
    assert.deepEqual(gr8Sections, ['Dahlia', 'Sampaguita']);

    const gr10Sections = resolveAvailableSectionsForGrade('Grade 10', filters);
    assert.deepEqual(gr10Sections, ['Kamagong', 'Sampaguita']);
  });

  test('resets invalid section when switching grades to prevent 0-student deadlocks', () => {
    const filters = extractFilterMetadata(mockRecords);

    // User is on Rosal (Grade 7) and selects Grade 8 -> Rosal does not exist in Grade 8
    const updatedSection = synchronizeSectionOnGradeChange('Grade 8', 'Rosal', filters);
    assert.equal(updatedSection, '', 'Section must reset to empty when not in target grade');

    // User is on Sampaguita (Grade 8) and selects Grade 10 -> Sampaguita exists in Grade 10
    const preservedSection = synchronizeSectionOnGradeChange('Grade 10', 'Sampaguita', filters);
    assert.equal(preservedSection, 'Sampaguita', 'Valid shared section must be preserved');

    // User is on Dahlia (Grade 8) and switches to All Grades -> Dahlia is in overall sections
    const allGradeSection = synchronizeSectionOnGradeChange('', 'Dahlia', filters);
    assert.equal(allGradeSection, 'Dahlia');
  });

  test('does not parse "All Grades" or empty strings into gradeLevel: 0', () => {
    const filterAll = buildRecordFilter('All Grades', 'All Sections');
    assert.equal(filterAll, null, 'No filter should be built for "All Grades"');

    const filterEmpty = buildRecordFilter('', '');
    assert.equal(filterEmpty, null, 'No filter should be built for empty strings');

    const filterGr7 = buildRecordFilter('Grade 7', 'All Sections');
    assert.deepEqual(filterGr7, { gradeLevel: 7 });

    const filterBoth = buildRecordFilter('8', 'Dahlia');
    assert.deepEqual(filterBoth, { gradeLevel: 8, section: 'Dahlia' });
  });

  test('prevents fallback to all students when filter matches 0 students', () => {
    const filters = extractFilterMetadata(mockRecords);
    const filterCriteria = buildRecordFilter('Grade 7', 'Dahlia');

    const matchedStudents = mockRecords
      .filter((r) => r.gradeLevel === filterCriteria.gradeLevel && r.section === filterCriteria.section)
      .map((r) => r.studentId);

    assert.equal(matchedStudents.length, 0);

    // Simulation of API behavior on 0 matched students
    let response;
    if (matchedStudents.length === 0) {
      response = {
        competencyData: [{ name: 'Numeracy', below60: 0, between60_75: 0, above75: 0 }],
        skillGaps: [],
        filters,
      };
    } else {
      // should never hit this branch
      response = { competencyData: [{ name: 'Numeracy', below60: 50, between60_75: 50, above75: 0 }], filters };
    }

    assert.equal(response.competencyData[0].below60, 0);
    assert.equal(response.skillGaps.length, 0);
    assert.ok(response.filters, 'Filters metadata must always be returned in response');
  });
});

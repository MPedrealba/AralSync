const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Grade 10 Grade & Section Isolation & Cascading Filter Suite', () => {
  const seedPath = path.join(__dirname, '..', 'database', 'seedUsers.js');
  const coordRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'coordinator', 'learners', 'route.ts');
  const addModalPath = path.join(__dirname, '..', 'src', 'components', 'AddLearnerModal.tsx');
  const teacherLearnersPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'learners', 'page.tsx');
  const coordLearnersPagePath = path.join(__dirname, '..', 'src', 'app', 'coordinator', 'learners', 'page.tsx');
  const learningRecoveryPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'learning-recovery', 'page.tsx');

  const seedSrc = fs.readFileSync(seedPath, 'utf8');
  const coordRouteSrc = fs.readFileSync(coordRoutePath, 'utf8');
  const addModalSrc = fs.readFileSync(addModalPath, 'utf8');
  const teacherLearnersSrc = fs.readFileSync(teacherLearnersPagePath, 'utf8');
  const coordLearnersSrc = fs.readFileSync(coordLearnersPagePath, 'utf8');
  const learningRecoverySrc = fs.readFileSync(learningRecoveryPagePath, 'utf8');

  test('1. seedUsers.js defines authentic Grade 10 sections (Molave & Acacia)', () => {
    assert.ok(
      seedSrc.includes("name: 'Rosa Garcia', grade: 10, section: 'Molave'"),
      'Rosa Garcia must be seeded in section Molave'
    );
    assert.ok(
      seedSrc.includes("name: 'Luis Cruz', grade: 10, section: 'Acacia'"),
      'Luis Cruz must be seeded in section Acacia'
    );
  });

  test('2. coordinator/learners API provides self-healing migration and initializes standard grades', () => {
    // Migration checks for Grade 10 legacy sections
    assert.ok(
      coordRouteSrc.includes('gradeLevel: 10') && coordRouteSrc.includes("'Molave'"),
      'API route must perform migration to Molave for Grade 10 legacy sections'
    );
    assert.ok(
      coordRouteSrc.includes('gradeLevel: 10') && coordRouteSrc.includes("'Acacia'"),
      'API route must perform migration to Acacia for Grade 10 legacy sections'
    );

    // Standard grades initialization
    assert.ok(
      coordRouteSrc.includes("const standardGrades = ['7', '8', '9', '10']"),
      'API route must declare standardGrades array'
    );
    assert.ok(
      coordRouteSrc.includes('standardGrades.forEach'),
      'API route must initialize standardGrades in gradeSectionsMap'
    );
  });

  test('3. AddLearnerModal removes unsafe availableSections fallbacks and shows empty state', () => {
    // Check that sectionsForGrade does NOT fallback to availableSections
    assert.ok(
      !addModalSrc.includes('return availableSections;'),
      'sectionsForGrade must not return availableSections as fallback'
    );
    assert.ok(
      !addModalSrc.includes('|| availableSections;'),
      'handleGradeChange must not fallback to availableSections'
    );
    assert.ok(
      addModalSrc.includes('gradeSectionsMap[gradeLevel] || gradeSectionsMap[gKey] || []'),
      'sectionsForGrade must strictly map to gradeSectionsMap or empty array'
    );
    assert.ok(
      addModalSrc.includes('<option value="" disabled>No sections enrolled</option>'),
      'AddLearnerModal must render disabled "No sections enrolled" when grade has no sections'
    );
  });

  test('4. Filter dropdowns strictly cascade and show "No sections enrolled" for empty cohorts', () => {
    // Teacher learners page
    assert.ok(
      teacherLearnersSrc.includes('No sections enrolled'),
      'Teacher learners page must display "No sections enrolled" option'
    );
    assert.ok(
      teacherLearnersSrc.includes('emptyOption={gradeFilter ? "No sections enrolled" : undefined}'),
      'Teacher learners FilterSelect must receive emptyOption when gradeFilter is selected'
    );

    // Coordinator learners page
    assert.ok(
      coordLearnersSrc.includes('filterAvailableSections.length === 0 && selectedGrade !== "all"'),
      'Coordinator learners page must check for empty section list when grade is filtered'
    );
    assert.ok(
      coordLearnersSrc.includes('<option value="" disabled>No sections enrolled</option>'),
      'Coordinator learners page must render "No sections enrolled"'
    );

    // Learning recovery page
    assert.ok(
      learningRecoverySrc.includes('availableSections.length === 0 && gradeFilter'),
      'Learning recovery page must check for empty section list when grade is filtered'
    );
    assert.ok(
      learningRecoverySrc.includes('<option value="" disabled>No sections enrolled</option>'),
      'Learning recovery page must render "No sections enrolled"'
    );
  });
});

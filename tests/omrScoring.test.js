const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// OMR & Mastery Evaluation Logic
function computeMasteryBand(percentage) {
  if (percentage >= 90) return 'Proficient';
  if (percentage >= 75) return 'Approaching';
  if (percentage >= 50) return 'Developing';
  return 'Beginning';
}

function gradeMultipleChoice(detectedAnswers, keyAnswers) {
  const totalItems = keyAnswers.length;
  let mcCorrect = 0;
  const flaggedIndices = [];

  for (let i = 0; i < totalItems; i++) {
    const detected = detectedAnswers[i];
    const key = keyAnswers[i];

    if (detected && detected.toUpperCase() === key.toUpperCase()) {
      mcCorrect++;
    }

    if (!detected || !['A', 'B', 'C', 'D'].includes(detected.toUpperCase())) {
      flaggedIndices.push(i);
    }
  }

  const scorePct = totalItems > 0 ? Math.round((mcCorrect / totalItems) * 100) : 0;
  const masteryLevel = computeMasteryBand(scorePct);

  return {
    scorePct,
    mcCorrect,
    totalItems,
    masteryLevel,
    flaggedIndices,
  };
}

function alignBatchSheetsWithRoster(sheets, roster) {
  return sheets.map((sheet, index) => {
    const student = roster[index] || null;
    return {
      ...sheet,
      studentId: student ? student._id : '',
      studentName: student ? student.name : 'Unassigned',
    };
  });
}

function detectDuplicateAssignments(alignedSheets) {
  const counts = {};
  alignedSheets.forEach((s) => {
    if (s.studentId) {
      counts[s.studentId] = (counts[s.studentId] || 0) + 1;
    }
  });
  return Object.keys(counts).filter((id) => counts[id] > 1);
}

describe('OMR Bubble Sheet Grading & Batch Alignment Suite', () => {
  const sampleKey = ['A', 'C', 'D', 'B', 'A', 'B', 'D', 'C', 'A', 'B'];

  test('grades student answers perfectly against key answers', () => {
    const perfectAnswers = ['A', 'C', 'D', 'B', 'A', 'B', 'D', 'C', 'A', 'B'];
    const result = gradeMultipleChoice(perfectAnswers, sampleKey);

    assert.equal(result.scorePct, 100);
    assert.equal(result.mcCorrect, 10);
    assert.equal(result.masteryLevel, 'Proficient');
    assert.equal(result.flaggedIndices.length, 0);
  });

  test('correctly calculates partial scores and identifies mastery tier', () => {
    // 7 correct out of 10 -> 70% -> Developing
    const mixedAnswers = ['A', 'C', 'D', 'B', 'A', 'B', 'D', 'A', 'C', 'D'];
    const result = gradeMultipleChoice(mixedAnswers, sampleKey);

    assert.equal(result.scorePct, 70);
    assert.equal(result.mcCorrect, 7);
    assert.equal(result.masteryLevel, 'Developing');
  });

  test('flags faint, blank, or unrecognized bubble markings', () => {
    // Blank marks at index 2 and index 5, invalid character at index 8
    const ambiguousAnswers = ['A', 'C', null, 'B', 'A', '', 'D', 'C', 'X', 'B'];
    const result = gradeMultipleChoice(ambiguousAnswers, sampleKey);

    assert.deepEqual(result.flaggedIndices, [2, 5, 8]);
  });

  test('maps mastery percentages to four-tier DepEd proficiency standards', () => {
    assert.equal(computeMasteryBand(95), 'Proficient');
    assert.equal(computeMasteryBand(90), 'Proficient');
    assert.equal(computeMasteryBand(89), 'Approaching');
    assert.equal(computeMasteryBand(75), 'Approaching');
    assert.equal(computeMasteryBand(74), 'Developing');
    assert.equal(computeMasteryBand(50), 'Developing');
    assert.equal(computeMasteryBand(49), 'Beginning');
    assert.equal(computeMasteryBand(10), 'Beginning');
  });

  test('aligns batch sheets 1-to-1 in alphabetical roster order', () => {
    const mockSheets = [
      { sheetIndex: 0, originalFilename: 'sheet_01.png' },
      { sheetIndex: 1, originalFilename: 'sheet_02.png' },
      { sheetIndex: 2, originalFilename: 'sheet_03.png' },
    ];

    const mockRoster = [
      { _id: 'id-ana', name: 'Ana Reyes' },
      { _id: 'id-carlos', name: 'Carlos Mendoza' },
      { _id: 'id-juan', name: 'Juan dela Cruz' },
    ];

    const aligned = alignBatchSheetsWithRoster(mockSheets, mockRoster);
    assert.equal(aligned[0].studentId, 'id-ana');
    assert.equal(aligned[1].studentId, 'id-carlos');
    assert.equal(aligned[2].studentId, 'id-juan');
  });

  test('detects duplicate student assignments across class exam sheets', () => {
    const sheetsWithCollision = [
      { sheetIndex: 0, studentId: 'student-juan' },
      { sheetIndex: 1, studentId: 'student-carlos' },
      { sheetIndex: 2, studentId: 'student-juan' }, // duplicate!
    ];

    const duplicates = detectDuplicateAssignments(sheetsWithCollision);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0], 'student-juan');
  });
});

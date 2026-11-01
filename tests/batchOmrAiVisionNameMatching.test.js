import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Batch OMR AI Vision Name Matching & Teacher Correction Suite', () => {
  // Mock cohort roster
  const mockRoster = [
    { _id: 'id-alyssa', name: 'Alyssa Cabrera', lrn: '136860100041', section: 'Rosal', gradeLevel: 7 },
    { _id: 'id-juan', name: 'Juan Dela Cruz', lrn: '136860100042', section: 'Rosal', gradeLevel: 7 },
    { _id: 'id-mark', name: 'Mark Santos', lrn: '136860100043', section: 'Rosal', gradeLevel: 7 },
    { _id: 'id-maria', name: 'Maria Santos', lrn: '136860100044', section: 'Rosal', gradeLevel: 7 },
  ];

  const mockOtherCohortStudents = [
    { _id: 'id-carlos', name: 'Carlos Mendoza', lrn: '136860100050', section: 'Sampaguita', gradeLevel: 7 },
    { _id: 'id-bea', name: 'Bea De Leon', lrn: '136860100051', section: 'Camia', gradeLevel: 7 },
  ];

  it('groups sheet name crops into collage chunks of up to 8 items', () => {
    const totalSheets = 20;
    const crops = Array.from({ length: totalSheets }, (_, i) => ({
      index: i,
      image_base64: `base64-data-sheet-${i}`,
    }));

    const maxPerCollage = 8;
    const chunks = [];
    for (let i = 0; i < crops.length; i += maxPerCollage) {
      chunks.push(crops.slice(i, i + maxPerCollage));
    }

    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 8);
    assert.equal(chunks[1].length, 8);
    assert.equal(chunks[2].length, 4);
    assert.deepEqual(chunks[0].map((c) => c.index), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(chunks[2].map((c) => c.index), [16, 17, 18, 19]);
  });

  it('maps AI-detected handwriting text to closest roster student with confidence scoring', () => {
    function resolveMatch(detectedText, roster) {
      const normDetected = detectedText.toLowerCase().replace(/[^a-z]/g, '');
      let bestMatch = null;
      let highestSim = 0;

      for (const student of roster) {
        const normName = student.name.toLowerCase().replace(/[^a-z]/g, '');
        // Simple token overlap / inclusion similarity
        if (normName === normDetected) {
          return { studentId: student._id, confidence: 0.98, detectedText };
        }
        if (normName.includes(normDetected) || normDetected.includes(normName)) {
          return { studentId: student._id, confidence: 0.90, detectedText };
        }
        // Surname match
        const parts = student.name.toLowerCase().split(/\s+/);
        const surname = parts[parts.length - 1];
        if (normDetected.includes(surname)) {
          const sim = 0.85;
          if (sim > highestSim) {
            highestSim = sim;
            bestMatch = { studentId: student._id, confidence: sim, detectedText };
          }
        }
      }
      return bestMatch || { studentId: null, confidence: 0.1, detectedText };
    }

    // Exact match
    const match1 = resolveMatch('Alyssa Cabrera', mockRoster);
    assert.equal(match1.studentId, 'id-alyssa');
    assert.ok(match1.confidence >= 0.95);

    // Minor spacing / punctuation
    const match2 = resolveMatch('Dela Cruz, Juan', mockRoster);
    assert.equal(match2.studentId, 'id-juan');
    assert.ok(match2.confidence >= 0.85);

    // Unlisted name from outside roster
    const match3 = resolveMatch('Unknown Transfer Student', mockRoster);
    assert.equal(match3.studentId, null);
    assert.ok(match3.confidence < 0.5);
  });

  it('supports cross-section learner assignment from other cohorts', () => {
    const allStudents = [...mockRoster, ...mockOtherCohortStudents];
    const selectedSection = 'Rosal';

    const currentCohort = allStudents.filter((s) => s.section === selectedSection);
    const otherCohort = allStudents.filter((s) => s.section !== selectedSection);

    assert.equal(currentCohort.length, 4);
    assert.equal(otherCohort.length, 2);
    assert.ok(otherCohort.some((s) => s.name === 'Carlos Mendoza'));

    // Reassigning sheet #3 to Carlos Mendoza from another section
    let sheet = {
      sheetIndex: 2,
      studentId: 'id-mark',
      isManuallyOverridden: false,
    };

    sheet = {
      ...sheet,
      studentId: 'id-carlos',
      isManuallyOverridden: true,
    };

    assert.equal(sheet.studentId, 'id-carlos');
    assert.equal(sheet.isManuallyOverridden, true);
  });

  it('validates teacher edit payload for student profile correction', () => {
    function validateLearnerUpdate(payload) {
      if (!payload.name || payload.name.trim() === '') {
        return { valid: false, error: 'Student name cannot be empty.' };
      }
      if (payload.gradeLevel && (isNaN(Number(payload.gradeLevel)) || Number(payload.gradeLevel) < 7 || Number(payload.gradeLevel) > 12)) {
        return { valid: false, error: 'Invalid grade level.' };
      }
      if (payload.lrn && !/^\d{11,12}$/.test(payload.lrn.trim())) {
        return { valid: false, error: 'LRN must be an 11 or 12 digit number.' };
      }
      return { valid: true };
    }

    // Valid edit
    const validEdit = validateLearnerUpdate({
      name: 'Alyssa M. Cabrera',
      gradeLevel: '7',
      section: 'Sampaguita',
      lrn: '136860100041',
    });
    assert.equal(validEdit.valid, true);

    // Blank name rejected
    const blankNameEdit = validateLearnerUpdate({
      name: '   ',
      gradeLevel: '7',
      section: 'Rosal',
    });
    assert.equal(blankNameEdit.valid, false);
    assert.match(blankNameEdit.error, /cannot be empty/i);

    // Invalid grade rejected
    const invalidGradeEdit = validateLearnerUpdate({
      name: 'Juan Dela Cruz',
      gradeLevel: '99',
      section: 'Rosal',
    });
    assert.equal(invalidGradeEdit.valid, false);
  });

  it('distinguishes confidence badge thresholds correctly in workstation view', () => {
    function getConfidencePill(confidence, isManuallyOverridden) {
      if (isManuallyOverridden) return { label: 'Manually Verified', color: 'blue', icon: '✍️' };
      if (confidence >= 0.85) return { label: 'AI Match High', color: 'emerald', icon: '🟢' };
      if (confidence >= 0.50) return { label: 'AI Match Review', color: 'amber', icon: '🟡' };
      return { label: 'Unassigned', color: 'slate', icon: '⚪' };
    }

    assert.equal(getConfidencePill(0.98, false).icon, '🟢');
    assert.equal(getConfidencePill(0.70, false).icon, '🟡');
    assert.equal(getConfidencePill(0.30, false).icon, '⚪');
    assert.equal(getConfidencePill(0.98, true).icon, '✍️');
  });
});

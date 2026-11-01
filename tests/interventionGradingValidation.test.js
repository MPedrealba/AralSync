const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Grade Score Validation Logic under ARAL Program (RA 12028)
 * Mirrors validation in ClassRecordMatrix.tsx and /api/teacher/interventions/[id]/grade
 */
function evaluateGradeInput(gradeInput, maxAllowed = 100, saving = false) {
  const isScoreEmpty = gradeInput === undefined || gradeInput === null || (typeof gradeInput === 'string' && gradeInput.trim() === '');
  const numericScore = Number(gradeInput);
  const isScoreOutOfRange = !isScoreEmpty && (isNaN(numericScore) || numericScore < 0 || numericScore > maxAllowed);
  const isSaveDisabled = saving || isScoreEmpty || isScoreOutOfRange;

  return {
    isScoreEmpty,
    numericScore,
    maxAllowed,
    isScoreOutOfRange,
    isSaveDisabled,
  };
}

describe('ARAL Intervention Task Mandatory Grade Score Validation Suite', () => {
  test('disables save button when score input is untouched or empty string', () => {
    const emptyResult = evaluateGradeInput('');
    assert.equal(emptyResult.isScoreEmpty, true);
    assert.equal(emptyResult.isSaveDisabled, true);

    const whitespaceResult = evaluateGradeInput('   ');
    assert.equal(whitespaceResult.isScoreEmpty, true);
    assert.equal(whitespaceResult.isSaveDisabled, true);

    const nullResult = evaluateGradeInput(null);
    assert.equal(nullResult.isScoreEmpty, true);
    assert.equal(nullResult.isSaveDisabled, true);

    const undefinedResult = evaluateGradeInput(undefined);
    assert.equal(undefinedResult.isScoreEmpty, true);
    assert.equal(undefinedResult.isSaveDisabled, true);
  });

  test('rejects non-numeric input values and keeps save button disabled', () => {
    const textResult = evaluateGradeInput('abc', 100);
    assert.equal(textResult.isScoreEmpty, false);
    assert.equal(textResult.isScoreOutOfRange, true);
    assert.equal(textResult.isSaveDisabled, true);

    const slashFormat = evaluateGradeInput('95/100', 100);
    assert.equal(slashFormat.isScoreEmpty, false);
    assert.equal(slashFormat.isScoreOutOfRange, true);
    assert.equal(slashFormat.isSaveDisabled, true);
  });

  test('rejects negative numbers below 0', () => {
    const negativeResult = evaluateGradeInput('-1', 50);
    assert.equal(negativeResult.isScoreOutOfRange, true);
    assert.equal(negativeResult.isSaveDisabled, true);

    const negativeFraction = evaluateGradeInput('-0.5', 100);
    assert.equal(negativeFraction.isScoreOutOfRange, true);
    assert.equal(negativeFraction.isSaveDisabled, true);
  });

  test('rejects scores exceeding maxAllowed points', () => {
    const overMax100 = evaluateGradeInput('101', 100);
    assert.equal(overMax100.isScoreOutOfRange, true);
    assert.equal(overMax100.isSaveDisabled, true);

    const overMax25 = evaluateGradeInput('26', 25);
    assert.equal(overMax25.isScoreOutOfRange, true);
    assert.equal(overMax25.isSaveDisabled, true);
  });

  test('successfully validates and enables save button on valid boundary and fractional scores', () => {
    // 0 is valid minimum
    const zeroResult = evaluateGradeInput('0', 50);
    assert.equal(zeroResult.isScoreEmpty, false);
    assert.equal(zeroResult.isScoreOutOfRange, false);
    assert.equal(zeroResult.isSaveDisabled, false);
    assert.equal(zeroResult.numericScore, 0);

    // Exact maxPoints is valid maximum
    const maxResult = evaluateGradeInput('50', 50);
    assert.equal(maxResult.isScoreEmpty, false);
    assert.equal(maxResult.isScoreOutOfRange, false);
    assert.equal(maxResult.isSaveDisabled, false);
    assert.equal(maxResult.numericScore, 50);

    // Decimal score
    const decimalResult = evaluateGradeInput('42.5', 50);
    assert.equal(decimalResult.isScoreEmpty, false);
    assert.equal(decimalResult.isScoreOutOfRange, false);
    assert.equal(decimalResult.isSaveDisabled, false);
    assert.equal(decimalResult.numericScore, 42.5);
  });

  test('keeps save button disabled during in-flight save operation', () => {
    const inFlightResult = evaluateGradeInput('90', 100, true);
    assert.equal(inFlightResult.isScoreOutOfRange, false);
    assert.equal(inFlightResult.isSaveDisabled, true);
  });

  describe('Intervention Drawer Reviewing Modal Validation Suite', () => {
    function validateDrawerGradeInput(drawerGradeInput, drawerGradingSaving = false) {
      const cleanScoreNum = (() => {
        if (!drawerGradeInput || drawerGradeInput.trim() === '') return null;
        const raw = drawerGradeInput.trim();
        const parsed = raw.includes('/') ? Number(raw.split('/')[0].trim()) : Number(raw);
        return isNaN(parsed) ? null : parsed;
      })();

      const isGradeInputEmpty = !drawerGradeInput || drawerGradeInput.trim() === '';
      const isGradeInputInvalid = !isGradeInputEmpty && (cleanScoreNum === null || cleanScoreNum < 0 || cleanScoreNum > 100);
      const isSaveGradeDisabled = drawerGradingSaving || isGradeInputEmpty || isGradeInputInvalid;

      return { cleanScoreNum, isGradeInputEmpty, isGradeInputInvalid, isSaveGradeDisabled };
    }

    test('disables drawer buttons on blank, empty, or whitespace score', () => {
      assert.equal(validateDrawerGradeInput('').isSaveGradeDisabled, true);
      assert.equal(validateDrawerGradeInput('   ').isSaveGradeDisabled, true);
      assert.equal(validateDrawerGradeInput(null).isSaveGradeDisabled, true);
      assert.equal(validateDrawerGradeInput(undefined).isSaveGradeDisabled, true);
    });

    test('disables drawer buttons on invalid score formats', () => {
      assert.equal(validateDrawerGradeInput('abc').isSaveGradeDisabled, true);
      assert.equal(validateDrawerGradeInput('-5').isSaveGradeDisabled, true);
      assert.equal(validateDrawerGradeInput('105').isSaveGradeDisabled, true);
    });

    test('extracts numerator and enables drawer buttons on valid slash format e.g. 95/100', () => {
      const slashResult = validateDrawerGradeInput('95/100');
      assert.equal(slashResult.cleanScoreNum, 95);
      assert.equal(slashResult.isGradeInputInvalid, false);
      assert.equal(slashResult.isSaveGradeDisabled, false);

      const slashResult10 = validateDrawerGradeInput('10/10');
      assert.equal(slashResult10.cleanScoreNum, 10);
      assert.equal(slashResult10.isGradeInputInvalid, false);
      assert.equal(slashResult10.isSaveGradeDisabled, false);
    });

    test('enables drawer buttons on valid numbers 0 to 100', () => {
      assert.equal(validateDrawerGradeInput('0').isSaveGradeDisabled, false);
      assert.equal(validateDrawerGradeInput('85').isSaveGradeDisabled, false);
      assert.equal(validateDrawerGradeInput('100').isSaveGradeDisabled, false);
    });

    test('disables drawer buttons while save operation is in-flight', () => {
      assert.equal(validateDrawerGradeInput('95', true).isSaveGradeDisabled, true);
    });
  });
});

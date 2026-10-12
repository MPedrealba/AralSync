const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Phil-IRI Pure Evaluation Logic
function computeOralAccuracy(wordsAttempted, miscueTotal) {
  if (!wordsAttempted || wordsAttempted <= 0) return 0;
  if (miscueTotal >= wordsAttempted) return 0;
  return Math.round(((wordsAttempted - miscueTotal) / wordsAttempted) * 100);
}

function classifyOralReadingLevel(accuracy) {
  if (accuracy >= 96) return 'Independent';
  if (accuracy >= 91) return 'Instructional';
  if (accuracy >= 80) return 'Frustration';
  return 'Non-Reader';
}

function classifyComprehensionLevel(score) {
  if (score >= 80) return 'Independent';
  if (score >= 59) return 'Instructional';
  return 'Frustration';
}

function calculateCombinedReadingLevel(oralLevel, compLevel) {
  if (oralLevel === 'Independent' && compLevel === 'Independent') return 'Independent';
  if (oralLevel === 'Frustration' || compLevel === 'Frustration') return 'Frustration';
  if (oralLevel === 'Non-Reader') return 'Non-Reader';
  return 'Instructional';
}

function calculateRiskLevelFromScore(percentage) {
  if (percentage < 50) return 'High Risk';
  if (percentage < 75) return 'Moderate Risk';
  return 'Low Risk';
}

describe('Phil-IRI Oral Reading Fluency Scoring Engine', () => {
  test('accurately calculates oral reading accuracy from attempted words and miscues', () => {
    // 100 words, 4 miscues -> 96%
    assert.equal(computeOralAccuracy(100, 4), 96);
    // 100 words, 0 miscues -> 100%
    assert.equal(computeOralAccuracy(100, 0), 100);
    // 85 words, 9 miscues -> ((85 - 9) / 85) * 100 = 89.41 -> 89%
    assert.equal(computeOralAccuracy(85, 9), 89);
    // 0 words attempted -> 0%
    assert.equal(computeOralAccuracy(0, 0), 0);
    // More miscues than words attempted -> 0%
    assert.equal(computeOralAccuracy(50, 60), 0);
  });

  test('correctly maps accuracy percentages to Phil-IRI four-tier reading levels', () => {
    assert.equal(classifyOralReadingLevel(100), 'Independent');
    assert.equal(classifyOralReadingLevel(96), 'Independent');
    assert.equal(classifyOralReadingLevel(95), 'Instructional');
    assert.equal(classifyOralReadingLevel(91), 'Instructional');
    assert.equal(classifyOralReadingLevel(90), 'Frustration');
    assert.equal(classifyOralReadingLevel(80), 'Frustration');
    assert.equal(classifyOralReadingLevel(79), 'Non-Reader');
    assert.equal(classifyOralReadingLevel(45), 'Non-Reader');
  });

  test('correctly maps comprehension scores to Phil-IRI comprehension levels', () => {
    assert.equal(classifyComprehensionLevel(100), 'Independent');
    assert.equal(classifyComprehensionLevel(80), 'Independent');
    assert.equal(classifyComprehensionLevel(79), 'Instructional');
    assert.equal(classifyComprehensionLevel(59), 'Instructional');
    assert.equal(classifyComprehensionLevel(58), 'Frustration');
    assert.equal(classifyComprehensionLevel(20), 'Frustration');
  });

  test('calculates accurate combined Phil-IRI reading profile', () => {
    assert.equal(calculateCombinedReadingLevel('Independent', 'Independent'), 'Independent');
    assert.equal(calculateCombinedReadingLevel('Independent', 'Instructional'), 'Instructional');
    assert.equal(calculateCombinedReadingLevel('Instructional', 'Instructional'), 'Instructional');
    assert.equal(calculateCombinedReadingLevel('Instructional', 'Frustration'), 'Frustration');
    assert.equal(calculateCombinedReadingLevel('Frustration', 'Independent'), 'Frustration');
    assert.equal(calculateCombinedReadingLevel('Non-Reader', 'Instructional'), 'Non-Reader');
  });

  test('derives DepEd learning recovery risk levels from assessment percentage', () => {
    assert.equal(calculateRiskLevelFromScore(95), 'Low Risk');
    assert.equal(calculateRiskLevelFromScore(75), 'Low Risk');
    assert.equal(calculateRiskLevelFromScore(74), 'Moderate Risk');
    assert.equal(calculateRiskLevelFromScore(50), 'Moderate Risk');
    assert.equal(calculateRiskLevelFromScore(49), 'High Risk');
    assert.equal(calculateRiskLevelFromScore(25), 'High Risk');
  });
});

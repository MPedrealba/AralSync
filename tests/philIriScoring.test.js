const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Phil-IRI Pure Evaluation Logic
function computeOralAccuracy(wordsAttempted, miscueTotal) {
  if (!wordsAttempted || wordsAttempted <= 0) return 0;
  if (miscueTotal >= wordsAttempted) return 0;
  return Math.round(((wordsAttempted - miscueTotal) / wordsAttempted) * 100);
}

function classifyOralReadingLevel(accuracy) {
  if (accuracy >= 97) return 'Independent';
  if (accuracy >= 90) return 'Instructional';
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

function calculateSilentReadingWpm(wordCount, elapsedSeconds) {
  if (!wordCount || wordCount <= 0) return 0;
  const sec = Math.max(elapsedSeconds || 1, 1);
  return Math.round((wordCount / sec) * 60);
}

function groupQuestionsByPhilIriDomain(questions) {
  const parts = {
    'Part I: Literal Comprehension': [],
    'Part II: Inferential Comprehension': [],
    'Part III: Vocabulary & Word Study': [],
    'Part IV: Critical & Evaluative': [],
  };

  questions.forEach(q => {
    const domain = (q.domain || q.competency || '').toLowerCase();
    if (domain.includes('literal')) {
      parts['Part I: Literal Comprehension'].push(q);
    } else if (domain.includes('infer')) {
      parts['Part II: Inferential Comprehension'].push(q);
    } else if (domain.includes('vocab')) {
      parts['Part III: Vocabulary & Word Study'].push(q);
    } else {
      parts['Part IV: Critical & Evaluative'].push(q);
    }
  });

  return parts;
}

describe('Phil-IRI 2024 Oral Reading Fluency Scoring Engine', () => {
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

  test('correctly maps accuracy percentages to Phil-IRI 2024 four-tier reading levels', () => {
    assert.equal(classifyOralReadingLevel(100), 'Independent');
    assert.equal(classifyOralReadingLevel(97), 'Independent');
    assert.equal(classifyOralReadingLevel(96), 'Instructional');
    assert.equal(classifyOralReadingLevel(90), 'Instructional');
    assert.equal(classifyOralReadingLevel(89), 'Frustration');
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

  test('calculates silent reading speed (WPM) accurately with zero protection', () => {
    // 300 words read in 120 seconds -> 150 WPM
    assert.equal(calculateSilentReadingWpm(300, 120), 150);
    // 180 words read in 60 seconds -> 180 WPM
    assert.equal(calculateSilentReadingWpm(180, 60), 180);
    // 250 words read in 0 seconds (boundary protection) -> 15000 WPM without NaN/infinite throw
    assert.equal(calculateSilentReadingWpm(250, 0), 15000);
    // 0 words -> 0 WPM
    assert.equal(calculateSilentReadingWpm(0, 45), 0);
  });

  test('properly partitions 40 items across the 4 DepEd Phil-IRI domain parts', () => {
    const mockQuestions = Array.from({ length: 40 }, (_, i) => ({
      itemNumber: i + 1,
      domain: i < 10 ? 'Literal' : i < 20 ? 'Inferential' : i < 30 ? 'Vocabulary' : 'Critical/Evaluative',
      question: `Question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      answer: 'A',
    }));

    const grouped = groupQuestionsByPhilIriDomain(mockQuestions);
    assert.equal(grouped['Part I: Literal Comprehension'].length, 10);
    assert.equal(grouped['Part II: Inferential Comprehension'].length, 10);
    assert.equal(grouped['Part III: Vocabulary & Word Study'].length, 10);
    assert.equal(grouped['Part IV: Critical & Evaluative'].length, 10);
  });
});


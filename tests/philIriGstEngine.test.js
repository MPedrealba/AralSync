const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Phil-IRI 2024 Stage 1 (GST) Engine Evaluation Logic Mirror
function evaluateGstScore(rawScore, studentGrade) {
  const clampedScore = Math.max(0, Math.min(40, Math.round(Number(rawScore) || 0)));
  const grade = Math.max(1, Math.round(Number(studentGrade) || 7));

  // Step 1 Cut-off evaluation: 28/40 is the mastery cut-off
  const isGradeReady = clampedScore >= 28;

  if (isGradeReady) {
    return {
      isGradeReady: true,
      gstStatus: 'Grade-Ready',
      recommendedStartingGrade: null,
      levelOffset: 0,
      explanation: `Learner scored ${clampedScore}/40 (>= 28 cut-off). Marked as Grade-Ready; individualized graded passages are not required under DepEd Phil-IRI guidelines.`,
    };
  }

  // Raw score < 28: Needs Individualized Assessment
  // Score 0-15: 3 grade levels below, floor at Grade 4
  // Score 16-27: 2 grade levels below, floor at Grade 4
  const levelOffset = clampedScore <= 15 ? 3 : 2;
  const calculatedGrade = grade - levelOffset;
  const recommendedStartingGrade = Math.max(4, calculatedGrade);

  const explanation =
    clampedScore <= 15
      ? `Learner scored ${clampedScore}/40 (range 0–15). Starting passage is 3 grade levels below Grade ${grade} (Floor: Grade 4) -> Starting at Grade ${recommendedStartingGrade}.`
      : `Learner scored ${clampedScore}/40 (range 16–27). Starting passage is 2 grade levels below Grade ${grade} (Floor: Grade 4) -> Starting at Grade ${recommendedStartingGrade}.`;

  return {
    isGradeReady: false,
    gstStatus: 'Needs Individualized Assessment',
    recommendedStartingGrade,
    levelOffset,
    explanation,
  };
}

describe('DepEd Phil-IRI 2024 Stage 1 (GST) Recommendation Engine Suite', () => {
  describe('GST Cut-Off Evaluation (40-Item Test, Pages 8-9)', () => {
    test('marks learner with score >= 28 as Grade-Ready with null recommended starting grade', () => {
      const result28 = evaluateGstScore(28, 7);
      assert.equal(result28.isGradeReady, true);
      assert.equal(result28.gstStatus, 'Grade-Ready');
      assert.equal(result28.recommendedStartingGrade, null);
      assert.equal(result28.levelOffset, 0);

      const result40 = evaluateGstScore(40, 10);
      assert.equal(result40.isGradeReady, true);
      assert.equal(result40.gstStatus, 'Grade-Ready');
      assert.equal(result40.recommendedStartingGrade, null);
    });

    test('marks learner with score < 28 as Needs Individualized Assessment', () => {
      const result27 = evaluateGstScore(27, 7);
      assert.equal(result27.isGradeReady, false);
      assert.equal(result27.gstStatus, 'Needs Individualized Assessment');

      const result0 = evaluateGstScore(0, 7);
      assert.equal(result0.isGradeReady, false);
      assert.equal(result0.gstStatus, 'Needs Individualized Assessment');
    });
  });

  describe('Automated Stage 2 Starting Passage Determination (Floor Grade 4)', () => {
    test('raw score 0–15: starting passage is 3 grade levels below learner grade', () => {
      // Grade 7 with score 14 -> Grade 4
      const g7 = evaluateGstScore(14, 7);
      assert.equal(g7.recommendedStartingGrade, 4);
      assert.equal(g7.levelOffset, 3);

      // Grade 8 with score 10 -> Grade 5
      const g8 = evaluateGstScore(10, 8);
      assert.equal(g8.recommendedStartingGrade, 5);
      assert.equal(g8.levelOffset, 3);

      // Grade 9 with score 5 -> Grade 6
      const g9 = evaluateGstScore(5, 9);
      assert.equal(g9.recommendedStartingGrade, 6);
      assert.equal(g9.levelOffset, 3);

      // Grade 10 with score 15 -> Grade 7
      const g10 = evaluateGstScore(15, 10);
      assert.equal(g10.recommendedStartingGrade, 7);
      assert.equal(g10.levelOffset, 3);
    });

    test('raw score 16–27: starting passage is 2 grade levels below learner grade', () => {
      // Grade 7 with score 20 -> Grade 5
      const g7 = evaluateGstScore(20, 7);
      assert.equal(g7.recommendedStartingGrade, 5);
      assert.equal(g7.levelOffset, 2);

      // Grade 8 with score 25 -> Grade 6
      const g8 = evaluateGstScore(25, 8);
      assert.equal(g8.recommendedStartingGrade, 6);
      assert.equal(g8.levelOffset, 2);

      // Grade 9 with score 16 -> Grade 7
      const g9 = evaluateGstScore(16, 9);
      assert.equal(g9.recommendedStartingGrade, 7);
      assert.equal(g9.levelOffset, 2);

      // Grade 10 with score 27 -> Grade 8
      const g10 = evaluateGstScore(27, 10);
      assert.equal(g10.recommendedStartingGrade, 8);
      assert.equal(g10.levelOffset, 2);
    });

    test('enforces strict floor at Grade 4 when offset drops below 4', () => {
      // Grade 6 student with score 12 (6 - 3 = 3) -> floor at Grade 4
      const g6 = evaluateGstScore(12, 6);
      assert.equal(g6.recommendedStartingGrade, 4);

      // Grade 5 student with score 20 (5 - 2 = 3) -> floor at Grade 4
      const g5 = evaluateGstScore(20, 5);
      assert.equal(g5.recommendedStartingGrade, 4);

      // Grade 4 student with score 2 -> floor at Grade 4
      const g4 = evaluateGstScore(2, 4);
      assert.equal(g4.recommendedStartingGrade, 4);
    });
  });

  describe('Edge Cases and Input Clamping', () => {
    test('clamps negative raw scores to 0', () => {
      const res = evaluateGstScore(-5, 8);
      assert.equal(res.isGradeReady, false);
      assert.equal(res.levelOffset, 3);
      assert.equal(res.recommendedStartingGrade, 5);
    });

    test('clamps raw scores > 40 to 40 (Grade-Ready)', () => {
      const res = evaluateGstScore(45, 8);
      assert.equal(res.isGradeReady, true);
      assert.equal(res.gstStatus, 'Grade-Ready');
    });

    test('handles string and null inputs safely', () => {
      const strRes = evaluateGstScore('20', '8');
      assert.equal(strRes.recommendedStartingGrade, 6);

      const nullRes = evaluateGstScore(null, null);
      assert.equal(nullRes.isGradeReady, false);
      assert.equal(nullRes.gstStatus, 'Needs Individualized Assessment');
    });
  });

  describe('Source Code Schema & File Integration Integrity', () => {
    test('LearnerRecord schema contains all 4 GST tracking fields', () => {
      const modelPath = path.join(__dirname, '..', 'models', 'LearnerRecord.js');
      const content = fs.readFileSync(modelPath, 'utf8');

      assert.ok(content.includes('gstScore:'), 'LearnerRecord missing gstScore field');
      assert.ok(content.includes('gstStatus:'), 'LearnerRecord missing gstStatus field');
      assert.ok(content.includes('recommendedStartingLevel:'), 'LearnerRecord missing recommendedStartingLevel field');
      assert.ok(content.includes('needsIndividualAssessment:'), 'LearnerRecord missing needsIndividualAssessment field');
      assert.ok(content.includes("'Grade-Ready'"), 'LearnerRecord missing Grade-Ready enum');
      assert.ok(content.includes("'Needs Individualized Assessment'"), 'LearnerRecord missing Needs Individualized Assessment enum');
    });

    test('Assessment schema supports GST category and tracking fields', () => {
      const modelPath = path.join(__dirname, '..', 'models', 'Assessment.js');
      const content = fs.readFileSync(modelPath, 'utf8');

      assert.ok(content.includes("'gst'"), 'Assessment missing gst category enum');
      assert.ok(content.includes('gstRawScore:'), 'Assessment missing gstRawScore field');
      assert.ok(content.includes('gstStage:'), 'Assessment missing gstStage field');
    });

    test('src/lib/reading.ts exports evaluateGstScore and GstEvaluation', () => {
      const libPath = path.join(__dirname, '..', 'src', 'lib', 'reading.ts');
      const content = fs.readFileSync(libPath, 'utf8');

      assert.ok(content.includes('export function evaluateGstScore'), 'reading.ts does not export evaluateGstScore');
      assert.ok(content.includes('export interface GstEvaluation'), 'reading.ts does not export GstEvaluation');
    });

    test('src/lib/philIriSync.ts re-exports evaluateGstScore', () => {
      const syncPath = path.join(__dirname, '..', 'src', 'lib', 'philIriSync.ts');
      const content = fs.readFileSync(syncPath, 'utf8');

      assert.ok(content.includes('evaluateGstScore'), 'philIriSync.ts does not re-export evaluateGstScore');
    });

    test('Teacher reading fluency page has GST auto-selection and banner', () => {
      const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'reading-fluency', 'page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      assert.ok(content.includes('selectedStudentObj'), 'page.tsx missing selectedStudentObj');
      assert.ok(content.includes('recommendedStartingLevel'), 'page.tsx missing recommendedStartingLevel reference');
      assert.ok(content.includes('Phil-IRI 2024 Stage 1'), 'page.tsx missing Phil-IRI 2024 Stage 1 banner');
      assert.ok(content.includes('keyStage=All'), 'page.tsx does not request all key stage passages');
    });
  });
});

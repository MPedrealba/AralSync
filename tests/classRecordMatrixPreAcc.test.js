const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('e-Class Record Matrix PRE-ACC% & Pre-Test/Post-Test Tagging Suite', () => {
  const root = path.resolve(__dirname, '..');
  const matrixSrc = fs.readFileSync(path.join(root, 'src/app/api/class-record/matrix/route.ts'), 'utf8');
  const analyzeSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/reading/analyze/route.ts'), 'utf8');
  const patchSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/assessments/[id]/route.ts'), 'utf8');
  const pageSrc = fs.readFileSync(path.join(root, 'src/app/dashboard/reading-fluency/page.tsx'), 'utf8');

  test('matrix route queries approved READING_FLUENCY chronologically and applies GST/oralAccuracy fallbacks', () => {
    assert.ok(matrixSrc.includes("type: 'READING_FLUENCY'") && matrixSrc.includes("status: 'approved'"));
    assert.ok(matrixSrc.includes('.sort({ date: 1, createdAt: 1 })'));
    assert.ok(matrixSrc.includes('learner.gstScore'));
    assert.ok(matrixSrc.includes('learner.philIriEnglish?.oralAccuracy'));
    assert.ok(matrixSrc.includes('learner.philIriEnglish?.wpm'));
    assert.ok(matrixSrc.includes("approvedFluency.find((a: any) => a.assessmentCategory !== 'post-test')"));
    assert.ok(matrixSrc.includes('approvedFluency.length >= 2'));
  });

  test('teacher reading analyze and assessment PATCH routes accept and persist assessmentCategory', () => {
    assert.ok(analyzeSrc.includes("formData.get('assessmentCategory')"));
    assert.ok(analyzeSrc.includes("['pre-test', 'post-test', 'quiz'].includes(rawCat)"));
    assert.ok(analyzeSrc.includes('assessmentCategory,'));

    assert.ok(patchSrc.includes('assessmentCategory,'));
    assert.ok(patchSrc.includes('updateFields.assessmentCategory = cat;'));
    assert.ok(patchSrc.includes('pairedUpdate.assessmentCategory = updateFields.assessmentCategory;'));
  });

  test('reading-fluency UI includes Pre-Test / Post-Test selector defaulting to pre-test and sends assessmentCategory', () => {
    assert.ok(pageSrc.includes('useState<"pre-test" | "post-test" | "quiz">("pre-test")'));
    assert.ok(pageSrc.includes('fd.append("assessmentCategory", assessmentCategory);'));
    assert.ok(pageSrc.includes('aria-label="Assessment Phase"'));
    assert.ok(/const assessmentPayload = \{[\s\S]*?assessmentCategory,/.test(pageSrc));
  });
});

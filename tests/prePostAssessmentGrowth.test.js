import test from 'node:test';
import assert from 'node:assert/strict';

// Helper matching category resolution across OMR grading routes, progress trends, and questionnaires
function resolveAssessmentCategory(assessment) {
  const directCat = assessment.assessmentCategory || assessment.assessmentType;
  if (directCat && ['quiz', 'exam', 'pre-test', 'post-test'].includes(directCat)) {
    return directCat;
  }
  const title = (assessment.title || '').toLowerCase();
  if (title.includes('pre-test') || title.includes('pretest') || title.includes('baseline')) {
    return 'pre-test';
  }
  if (title.includes('post-test') || title.includes('posttest') || title.includes('endline')) {
    return 'post-test';
  }
  if (title.includes('exam')) {
    return 'exam';
  }
  return 'quiz';
}

// Helper matching learner profile prePostGrowth computation
function computePrePostGrowth(omrAssessments) {
  const preAssessments = omrAssessments.filter((a) => a.category === 'pre-test');
  const postAssessments = omrAssessments.filter((a) => a.category === 'post-test');

  const baselineScore = preAssessments.length > 0 ? preAssessments[preAssessments.length - 1].score : null;
  const postTestScore = postAssessments.length > 0 ? postAssessments[0].score : null;

  let gainDelta = null;
  let gainStatus = 'no_data';

  if (baselineScore != null && postTestScore != null) {
    gainDelta = Math.round(postTestScore - baselineScore);
    gainStatus = gainDelta > 0 ? 'improved' : gainDelta < 0 ? 'declined' : 'maintained';
  } else if (baselineScore != null && postTestScore == null) {
    gainStatus = 'pending_post';
  }

  const bySubject = {};
  ['Math', 'Reading', 'Science'].forEach((subj) => {
    const subPre = omrAssessments.filter((a) => a.subject === subj && a.category === 'pre-test');
    const subPost = omrAssessments.filter((a) => a.subject === subj && a.category === 'post-test');
    const bScore = subPre.length > 0 ? subPre[subPre.length - 1].score : null;
    const pScore = subPost.length > 0 ? subPost[0].score : null;
    const delta = bScore != null && pScore != null ? Math.round(pScore - bScore) : null;
    const status = delta != null ? (delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'maintained') : bScore != null ? 'pending_post' : 'not_started';
    bySubject[subj] = {
      baseline: bScore,
      postTest: pScore,
      delta,
      status,
    };
  });

  return {
    hasData: preAssessments.length > 0 || postAssessments.length > 0,
    baselineScore,
    postTestScore,
    gainDelta,
    gainStatus,
    bySubject,
  };
}

test.describe('Pre-Test & Post-Test Assessment & Learning Recovery Engine', () => {
  test('correctly identifies pre-test, post-test, exam, and quiz categories from fields and title keywords', () => {
    assert.equal(
      resolveAssessmentCategory({ assessmentType: 'pre-test', title: 'Quarter 1 Assessment' }),
      'pre-test'
    );
    assert.equal(
      resolveAssessmentCategory({ assessmentCategory: 'post-test', title: 'Reading Check' }),
      'post-test'
    );
    assert.equal(
      resolveAssessmentCategory({ title: 'ARAL Diagnostic Pre-Test in Numeracy' }),
      'pre-test'
    );
    assert.equal(
      resolveAssessmentCategory({ title: 'ARAL Endline Evaluation Post-Test' }),
      'post-test'
    );
    assert.equal(
      resolveAssessmentCategory({ title: 'Grade 7 Second Periodical Exam in Science' }),
      'exam'
    );
    assert.equal(
      resolveAssessmentCategory({ title: 'Weekly Quiz #3 — Linear Equations' }),
      'quiz'
    );
  });

  test('calculates accurate net learning recovery gain delta and status when both pre-test and post-test exist', () => {
    const assessments = [
      { id: '1', title: 'Post-Test in Reading', subject: 'Reading', score: 85, category: 'post-test' },
      { id: '2', title: 'Pre-Test in Reading', subject: 'Reading', score: 45, category: 'pre-test' },
    ];

    const growth = computePrePostGrowth(assessments);
    assert.equal(growth.hasData, true);
    assert.equal(growth.baselineScore, 45);
    assert.equal(growth.postTestScore, 85);
    assert.equal(growth.gainDelta, 40);
    assert.equal(growth.gainStatus, 'improved');
    assert.equal(growth.bySubject.Reading.baseline, 45);
    assert.equal(growth.bySubject.Reading.postTest, 85);
    assert.equal(growth.bySubject.Reading.delta, 40);
    assert.equal(growth.bySubject.Reading.status, 'improved');
  });

  test('flags pending_post status when baseline diagnostic is administered but post-test is pending', () => {
    const assessments = [
      { id: '1', title: 'ARAL Diagnostic Pre-Test in Numeracy', subject: 'Math', score: 50, category: 'pre-test' },
    ];

    const growth = computePrePostGrowth(assessments);
    assert.equal(growth.hasData, true);
    assert.equal(growth.baselineScore, 50);
    assert.equal(growth.postTestScore, null);
    assert.equal(growth.gainDelta, null);
    assert.equal(growth.gainStatus, 'pending_post');
    assert.equal(growth.bySubject.Math.status, 'pending_post');
    assert.equal(growth.bySubject.Reading.status, 'not_started');
  });

  test('preserves backwards compatibility for unscored learners with no_data status', () => {
    const assessments = [
      { id: '1', title: 'Weekly Quiz #1', subject: 'Math', score: 70, category: 'quiz' },
    ];

    const growth = computePrePostGrowth(assessments);
    assert.equal(growth.hasData, false);
    assert.equal(growth.baselineScore, null);
    assert.equal(growth.postTestScore, null);
    assert.equal(growth.gainDelta, null);
    assert.equal(growth.gainStatus, 'no_data');
  });
});

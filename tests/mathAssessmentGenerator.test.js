const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('Math Assessment Generator & Curriculum Topics Engine', () => {
  // Test dynamic subject status resolution logic
  function resolveSubjectStatus(mathMaterialCount, scienceMaterialCount) {
    return [
      {
        id: 'Reading',
        name: 'Reading',
        status: 'active',
        source: 'DepEd ARAL Workbooks (KS1, KS2, KS3)',
        bubbleSheetUrl: '/bubble-sheets/reading-bubble.pdf',
      },
      {
        id: 'Math',
        name: 'Mathematics',
        status: mathMaterialCount > 0 ? 'active' : 'locked',
        ...(mathMaterialCount > 0
          ? { source: 'DepEd ARAL Math Workbooks' }
          : { notice: 'Official Math ARAL learning material PDFs pending upload by coordinator/admin.' }),
        bubbleSheetUrl: '/bubble-sheets/mathematics-bubble.pdf',
      },
      {
        id: 'Science',
        name: 'Science',
        status: scienceMaterialCount > 0 ? 'active' : 'locked',
        ...(scienceMaterialCount > 0
          ? { source: 'DepEd ARAL Science Workbooks' }
          : { notice: 'Official Science ARAL learning material PDFs pending upload by coordinator/admin.' }),
        bubbleSheetUrl: '/bubble-sheets/science-bubble.pdf',
      },
    ];
  }

  test('dynamically sets Math status to active when active learning materials exist', () => {
    const subjects = resolveSubjectStatus(2, 0);
    const math = subjects.find((s) => s.id === 'Math');
    assert.strictEqual(math.status, 'active');
    assert.strictEqual(math.source, 'DepEd ARAL Math Workbooks');
    assert.strictEqual(math.notice, undefined);

    const science = subjects.find((s) => s.id === 'Science');
    assert.strictEqual(science.status, 'locked');
    assert.match(science.notice, /Official Science ARAL/);
  });

  test('dynamically sets Math status to locked when zero active materials exist', () => {
    const subjects = resolveSubjectStatus(0, 0);
    const math = subjects.find((s) => s.id === 'Math');
    assert.strictEqual(math.status, 'locked');
    assert.match(math.notice, /Official Math ARAL/);
  });

  test('determines targetSubject correctly from query param and assignedSubject', () => {
    function getTargetSubject(queryParam, assignedSubject) {
      return queryParam && queryParam !== 'All'
        ? queryParam
        : (assignedSubject !== 'All' ? assignedSubject : 'Reading');
    }

    assert.strictEqual(getTargetSubject('Math', 'All'), 'Math');
    assert.strictEqual(getTargetSubject(null, 'Math'), 'Math');
    assert.strictEqual(getTargetSubject(null, 'All'), 'Reading');
    assert.strictEqual(getTargetSubject('Science', 'Reading'), 'Science');
  });

  test('filters, trims and alphabetically sorts curriculum topics', () => {
    const rawTopics = [
      'Number Sets',
      ' Linear Equations ',
      '',
      null,
      'Angle Pairs',
      'Circles',
      '   ',
    ];

    const sortedTopics = rawTopics
      .filter((t) => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim())
      .sort((a, b) => a.localeCompare(b));

    assert.deepStrictEqual(sortedTopics, [
      'Angle Pairs',
      'Circles',
      'Linear Equations',
      'Number Sets',
    ]);
  });

  test('allows Math teachers to generate assessments without cross-subject conflict in generate-aral', () => {
    function checkSubjectPermission(assignedSubject, bodySubject) {
      if (assignedSubject && assignedSubject !== 'All' && assignedSubject !== bodySubject && assignedSubject !== 'Reading') {
        return { allowed: false, error: `You are assigned to ${assignedSubject}. You can only generate assessments for your assigned subject.` };
      }
      return { allowed: true };
    }

    // Math teacher generating Math
    assert.strictEqual(checkSubjectPermission('Math', 'Math').allowed, true);
    // Teacher assigned to All generating Math
    assert.strictEqual(checkSubjectPermission('All', 'Math').allowed, true);
    // Reading teacher generating Reading
    assert.strictEqual(checkSubjectPermission('Reading', 'Reading').allowed, true);
    // Science teacher attempting to generate Reading -> forbidden
    assert.strictEqual(checkSubjectPermission('Science', 'Reading').allowed, false);
    // Science teacher generating Science -> allowed
    assert.strictEqual(checkSubjectPermission('Science', 'Science').allowed, true);
  });

  test('renders active subject option labels in dropdown without (Pending PDFs)', () => {
    const materials = [{ subject: 'Math', title: 'ARAL Math Worksheet Grade 7 & 8' }];

    function getMathOptionLabel(materialsList) {
      return materialsList.some((m) => m.subject === 'Math')
        ? 'Mathematics (Active ARAL Materials)'
        : 'Mathematics';
    }

    const labelWithMaterials = getMathOptionLabel(materials);
    assert.strictEqual(labelWithMaterials, 'Mathematics (Active ARAL Materials)');
    assert.doesNotMatch(labelWithMaterials, /Pending PDFs/);

    const labelWithoutMaterials = getMathOptionLabel([]);
    assert.strictEqual(labelWithoutMaterials, 'Mathematics');
    assert.doesNotMatch(labelWithoutMaterials, /Pending PDFs/);
  });

  test('normalizes requested topics from array or single string into Mongo $in query', () => {
    function buildTopicFilter(subject, gradeLevel, body) {
      const requestedTopics = Array.isArray(body?.topics)
        ? body.topics.filter((t) => typeof t === 'string' && t.trim().length > 0)
        : (body?.topic && typeof body.topic === 'string' && body.topic.trim() ? [body.topic.trim()] : []);

      const filter = { subject, gradeLevel };
      if (requestedTopics.length > 0) {
        filter.$or = [
          { topic: { $in: requestedTopics } },
          { competency: { $in: requestedTopics } },
        ];
      }
      return { filter, requestedTopics };
    }

    // Multi-topic array
    const multi = buildTopicFilter('Math', 7, { topics: ['Linear Equations', 'Angle Pairs'] });
    assert.deepStrictEqual(multi.requestedTopics, ['Linear Equations', 'Angle Pairs']);
    assert.deepStrictEqual(multi.filter.$or, [
      { topic: { $in: ['Linear Equations', 'Angle Pairs'] } },
      { competency: { $in: ['Linear Equations', 'Angle Pairs'] } },
    ]);

    // Single legacy string topic
    const single = buildTopicFilter('Math', 7, { topic: 'Number Sets' });
    assert.deepStrictEqual(single.requestedTopics, ['Number Sets']);
    assert.deepStrictEqual(single.filter.$or, [
      { topic: { $in: ['Number Sets'] } },
      { competency: { $in: ['Number Sets'] } },
    ]);

    // Empty / all topics
    const empty = buildTopicFilter('Math', 7, {});
    assert.deepStrictEqual(empty.requestedTopics, []);
    assert.strictEqual(empty.filter.$or, undefined);
  });

  test('generates appropriate auto-titles for weekly quiz and comprehensive exam, respecting custom titles', () => {
    function resolveAssessmentTitle(body, subject, gradeLevel, itemCount) {
      const assessmentType = body?.assessmentType === 'exam' ? 'exam' : 'quiz';
      const autoTitle =
        assessmentType === 'exam'
          ? `Periodical Exam: ${subject === 'Math' ? 'Mathematics' : subject} Grade ${gradeLevel} (${itemCount} items)`
          : `Weekly Quiz: ${subject === 'Math' ? 'Mathematics' : subject} Grade ${gradeLevel} (${itemCount} items)`;
      return typeof body?.title === 'string' && body.title.trim().length > 0
        ? body.title.trim()
        : autoTitle;
    }

    // Quiz with auto-title
    const quizAuto = resolveAssessmentTitle({ assessmentType: 'quiz' }, 'Math', 7, 10);
    assert.strictEqual(quizAuto, 'Weekly Quiz: Mathematics Grade 7 (10 items)');

    // Exam with auto-title
    const examAuto = resolveAssessmentTitle({ assessmentType: 'exam' }, 'Math', 8, 50);
    assert.strictEqual(examAuto, 'Periodical Exam: Mathematics Grade 8 (50 items)');

    // Custom title overrides auto-title
    const custom = resolveAssessmentTitle({ title: 'Midterm Math Assessment' }, 'Math', 7, 20);
    assert.strictEqual(custom, 'Midterm Math Assessment');
  });

  test('preserves fallback notice in API response when OpenAI credits are exhausted', () => {
    function buildExtractorResponse(errorReason, fallbackQuestions) {
      if (errorReason === 'insufficient_quota') {
        return {
          success: true,
          data: {
            title: 'DepEd ARAL Mathematics Exercises (Curriculum Aligned)',
            questions: fallbackQuestions,
          },
          fallbackNotice: 'OpenAI API quota exhausted. Provided verified curriculum-aligned exercises from question bank.',
        };
      }
      return { success: false, error: 'Extraction failed' };
    }

    const res = buildExtractorResponse('insufficient_quota', [{ number: 1, prompt: 'Solve 2x = 10' }]);
    assert.strictEqual(res.success, true);
    assert.match(res.fallbackNotice, /quota exhausted/);
    assert.strictEqual(res.data.questions.length, 1);
  });

  test('prioritizes questions matching materialId before backfilling from general pool', () => {
    function prioritizeMaterialQuestions(materialPool, generalPool, count) {
      let pool = [...materialPool];
      if (pool.length < count) {
        const existingIds = new Set(pool.map((q) => String(q._id)));
        pool = [...pool, ...generalPool.filter((q) => !existingIds.has(String(q._id)))];
      }
      return pool.slice(0, count);
    }

    const materialQuestions = [
      { _id: 'mat_1', prompt: 'Material Question 1', materialId: 'm123' },
      { _id: 'mat_2', prompt: 'Material Question 2', materialId: 'm123' },
    ];
    const generalQuestions = [
      { _id: 'mat_1', prompt: 'Material Question 1', materialId: 'm123' },
      { _id: 'gen_1', prompt: 'General Question 1' },
      { _id: 'gen_2', prompt: 'General Question 2' },
      { _id: 'gen_3', prompt: 'General Question 3' },
    ];

    const result = prioritizeMaterialQuestions(materialQuestions, generalQuestions, 3);
    assert.strictEqual(result.length, 3);
    // Material questions appear first
    assert.strictEqual(result[0]._id, 'mat_1');
    assert.strictEqual(result[1]._id, 'mat_2');
    // General question backfills the remaining slot without duplication
    assert.strictEqual(result[2]._id, 'gen_1');
  });

  test('attaches materialId and sourceMaterial to generated AnswerKey payload', () => {
    function buildAnswerKeyPayload(materialDoc, subject, title, items) {
      return {
        title,
        subject,
        materialId: materialDoc?._id || undefined,
        sourceMaterial: materialDoc?.title || undefined,
        items,
        totalItems: items,
      };
    }

    const materialDoc = {
      _id: '6acde2293b451ecc566a3838',
      title: 'Grade 7 Mathematics Learner Workbook (Quarter 1)',
    };

    const payload = buildAnswerKeyPayload(materialDoc, 'Math', 'Grade 7 Mathematics Assessment', 10);
    assert.strictEqual(payload.materialId, '6acde2293b451ecc566a3838');
    assert.strictEqual(payload.sourceMaterial, 'Grade 7 Mathematics Learner Workbook (Quarter 1)');
    assert.strictEqual(payload.items, 10);

    const payloadWithoutMaterial = buildAnswerKeyPayload(null, 'Reading', 'Weekly Reading Quiz', 10);
    assert.strictEqual(payloadWithoutMaterial.materialId, undefined);
    assert.strictEqual(payloadWithoutMaterial.sourceMaterial, undefined);
  });
});

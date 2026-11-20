const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('CustomExam Schema Enums & Exams API Error Handling Suite', () => {
  const modelPath = path.join(__dirname, '..', 'models', 'CustomExam.js');
  const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'exams', 'route.ts');
  const omrPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');

  const modelSrc = fs.readFileSync(modelPath, 'utf8');
  const routeSrc = fs.readFileSync(routePath, 'utf8');
  const omrPageSrc = fs.readFileSync(omrPagePath, 'utf8');

  test('1. models/CustomExam.js expands assessmentType enum to support all ARAL assessment categories', () => {
    assert.ok(
      modelSrc.includes("'pre-test'") && modelSrc.includes("'post-test'"),
      'CustomExam assessmentType must include pre-test and post-test'
    );
    assert.ok(
      modelSrc.includes("enum: ['quiz', 'exam', 'pre-test', 'post-test']"),
      'CustomExam assessmentType enum must match quiz, exam, pre-test, post-test'
    );
  });

  test('2. models/CustomExam.js expands subject enum to support all DepEd ARAL learning streams', () => {
    const requiredSubjects = [
      'Math',
      'Reading',
      'Science',
      'English',
      'Filipino',
      'Reading - English',
      'Reading - Filipino',
    ];
    for (const sub of requiredSubjects) {
      assert.ok(
        modelSrc.includes(`'${sub}'`),
        `CustomExam subject enum must include ${sub}`
      );
    }
  });

  test('3. /api/teacher/exams POST preserves explicitly provided subject', () => {
    assert.ok(
      routeSrc.includes("const finalSubject = subject || (teacherSubject !== 'All' ? teacherSubject : 'Reading')"),
      'POST handler must prioritize explicit subject over teacherSubject fallback'
    );
  });

  test('4. /api/teacher/exams POST safely maps resolvedType and validates answerKeyId', () => {
    assert.ok(
      routeSrc.includes("['quiz', 'exam', 'pre-test', 'post-test'].includes(assessmentType)"),
      'POST handler must allow pre-test and post-test in resolvedType'
    );
    assert.ok(
      routeSrc.includes('mongoose.Types.ObjectId.isValid(answerKeyId)'),
      'POST handler must validate answerKeyId with mongoose.Types.ObjectId.isValid before lookup'
    );
  });

  test('5. /api/teacher/exams POST returns HTTP 400 on ValidationError or CastError', () => {
    assert.ok(
      routeSrc.includes("e.name === 'ValidationError' || e.name === 'CastError'"),
      'POST catch block must check for ValidationError and CastError'
    );
    assert.ok(
      routeSrc.includes('status: 400'),
      'POST catch block must return HTTP 400 for validation errors'
    );
  });

  test('6. models/CustomExam.js evicts stale model from cache during development hot reload', () => {
    assert.ok(
      modelSrc.includes("process.env.NODE_ENV !== 'production'"),
      'Must check non-production environment before clearing cache'
    );
    assert.ok(
      modelSrc.includes('delete mongoose.models.CustomExam'),
      'Must delete mongoose.models.CustomExam to prevent stale schema caching'
    );
  });

  test('7. omr-assessments/page.tsx and exams route provide question prompt and choices fallbacks', () => {
    assert.ok(
      omrPageSrc.includes('rawPrompt = q.prompt || q.question || q.text || `Item ${idx + 1}`'),
      'omr-assessments handleSaveExam must support prompt, question, text, and item fallback'
    );
    assert.ok(
      omrPageSrc.includes('(q.choices || q.options).slice(0, 4)'),
      'omr-assessments must support choices or options fallback'
    );
    assert.ok(
      routeSrc.includes('rawPrompt = it.prompt || it.question || it.text || `Item ${i + 1}`'),
      'POST /api/teacher/exams must support prompt, question, text fallback'
    );
    assert.ok(
      routeSrc.includes('(it.choices || it.options).slice(0, 4)'),
      'POST /api/teacher/exams must support choices or options fallback'
    );
  });
});

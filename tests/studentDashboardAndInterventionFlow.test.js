import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Student Dashboard, Interventions & Subject Categorization Integrity', () => {
  const root = process.cwd();

  test('1. models/Intervention.js enum replaces Video with Worksheet', () => {
    const filePath = path.join(root, 'models', 'Intervention.js');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes("enum: ['Activity', 'Module', 'Worksheet']"),
      'InterventionSchema type enum must be ["Activity", "Module", "Worksheet"]'
    );
    assert.ok(
      !content.includes("'Video'"),
      'InterventionSchema must not contain "Video" in enum'
    );
  });

  test('2. database/seedUsers.js has zero { type: Video } and { kind: Video } references', () => {
    const filePath = path.join(root, 'database', 'seedUsers.js');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      !content.includes("type: 'Video'"),
      'seedUsers.js must not contain type: "Video"'
    );
    assert.ok(
      !content.includes("kind: 'Video'"),
      'seedUsers.js must not contain kind: "Video"'
    );
    assert.ok(
      content.includes("type: 'Worksheet'"),
      'seedUsers.js should seed authentic Worksheet interventions'
    );
  });

  test('3. src/app/student/page.tsx styles Worksheet chip in emerald and deep-links intervention id', () => {
    const filePath = path.join(root, 'src', 'app', 'student', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('Worksheet: "bg-emerald-50 text-emerald-700"'),
      'Student dashboard must style Worksheet with bg-emerald-50 text-emerald-700'
    );
    assert.ok(
      !content.includes('Video: "bg-violet-50 text-violet-700"'),
      'Student dashboard must not have Video chip styling'
    );
    assert.ok(
      content.includes('/student/interventions?id='),
      'Assigned intervention buttons must link to /student/interventions?id='
    );
  });

  test('4. src/app/student/interventions/page.tsx integrates useSearchParams and auto-selects by id', () => {
    const filePath = path.join(root, 'src', 'app', 'student', 'interventions', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('useSearchParams'),
      'Interventions page must import and call useSearchParams'
    );
    assert.ok(
      content.includes('searchParams.get("id")'),
      'Interventions page must read id query parameter'
    );
    assert.ok(
      content.includes('setSelected(match)'),
      'Interventions page must auto-select matched intervention'
    );
    assert.ok(
      content.includes('Suspense'),
      'Interventions page must be wrapped with React Suspense for Next.js searchParams safety'
    );
  });

  test('5. src/app/student/progress/page.tsx groups COMPREHENSION under Reading and isolates Science', () => {
    const filePath = path.join(root, 'src', 'app', 'student', 'progress', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      !content.includes('const sciRows = latestByTitle(["COMPREHENSION"])'),
      'Progress page must NOT map Science rows to COMPREHENSION'
    );
    assert.ok(
      content.includes('r.subject === "Science"'),
      'Science must only display genuine Science assessments'
    );
    assert.ok(
      content.includes('r.type === "COMPREHENSION"'),
      'Comprehension must be handled under Reading assessments'
    );
  });

  test('6. src/app/api/student/assessments/route.ts groups COMPREHENSION under Reading', () => {
    const filePath = path.join(root, 'src', 'app', 'api', 'student', 'assessments', 'route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes("isFluency || isComp ? 'Reading' : 'Math'"),
      'toRow in student assessments must default COMPREHENSION to Reading'
    );
  });

  test('7. src/app/student/omr-assessments/page.tsx has Reading filter tab and Reading average score card', () => {
    const filePath = path.join(root, 'src', 'app', 'student', 'omr-assessments', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('"Reading"'),
      'OMR page must include Reading in subject tabs'
    );
    assert.ok(
      content.includes('READING AVERAGE SCORE'),
      'OMR page must render READING AVERAGE SCORE card'
    );
    assert.ok(
      content.includes('readingAvg'),
      'OMR page must calculate readingAvg'
    );
  });
});

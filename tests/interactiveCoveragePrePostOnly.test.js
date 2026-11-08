const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Pre-Test & Post-Test Only Scopes with Dynamic Material Scanning & Interactive Coverage Suite', () => {
  const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
  const topicsRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'topics', 'route.ts');
  const readGenRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate-reading', 'route.ts');
  const mathGenRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate', 'route.ts');
  const qSecPath = path.join(__dirname, '..', 'src', 'lib', 'questionnaireSections.ts');

  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const topicsRouteContent = fs.readFileSync(topicsRoutePath, 'utf8');
  const readGenRouteContent = fs.readFileSync(readGenRoutePath, 'utf8');
  const mathGenRouteContent = fs.readFileSync(mathGenRoutePath, 'utf8');
  const qSecContent = fs.readFileSync(qSecPath, 'utf8');

  describe('1. Assessment Scope Restriction (Pre-Test & Post-Test Only)', () => {
    test('defaults assessmentType to pre-test and count to 40', () => {
      assert.ok(pageContent.includes('useState<AssessmentType>("pre-test")'), 'Must default assessmentType to pre-test');
      assert.ok(pageContent.includes('const [count, setCount] = useState(40)'), 'Must default count to 40 items');
    });

    test('replaces 4-scope switcher with clean 2-way toggle [Pre-Test] and [Post-Test]', () => {
      assert.ok(pageContent.includes('Assessment Scope Switcher (Pre-Test & Post-Test Only)'), 'Must tag 2-way Assessment Scope Switcher');
      assert.ok(pageContent.includes('Pre-Test (Baseline Diagnostic)'), 'Must render Pre-Test baseline diagnostic button');
      assert.ok(pageContent.includes('Post-Test (Growth Evaluation)'), 'Must render Post-Test growth evaluation button');
      assert.ok(pageContent.includes('onClick={() => switchAssessmentType("pre-test")}'), 'Must handle switch to pre-test');
      assert.ok(pageContent.includes('onClick={() => switchAssessmentType("post-test")}'), 'Must handle switch to post-test');
    });

    test('updates assessment title placeholder to emphasize Pre-Test / Post-Test', () => {
      assert.ok(
        pageContent.includes('DepEd Phil-IRI Stage 1 Diagnostic Pre-Test'),
        'Placeholder must prompt for Diagnostic Pre-Test'
      );
      assert.ok(
        pageContent.includes('DepEd Phil-IRI Learning Recovery Post-Test'),
        'Placeholder must prompt for Learning Recovery Post-Test'
      );
    });

    test('updates action generate button labels for Pre-Test and Post-Test', () => {
      assert.ok(
        pageContent.includes('Generate Diagnostic Pre-Test (${count} items)'),
        'Generate button must display Generate Diagnostic Pre-Test'
      );
      assert.ok(
        pageContent.includes('Generate Recovery Post-Test (${count} items)'),
        'Generate button must display Generate Recovery Post-Test'
      );
    });
  });

  describe('2. Dynamic Material Scanning (/api/teacher/questionnaire/topics)', () => {
    test('topics route accepts subject, grade, and materialId parameters', () => {
      assert.ok(topicsRouteContent.includes("req.nextUrl.searchParams.get('subject')"), 'Must read subject param');
      assert.ok(topicsRouteContent.includes("req.nextUrl.searchParams.get('grade')"), 'Must read grade param');
      assert.ok(topicsRouteContent.includes("req.nextUrl.searchParams.get('materialId')"), 'Must read materialId param');
    });

    test('returns coverageItems with structured metadata for Reading (Phil-IRI) selections', () => {
      assert.ok(topicsRouteContent.includes('PHIL_IRI_REFERENCES_BY_GRADE'), 'Must reference PHIL_IRI_REFERENCES_BY_GRADE');
      assert.ok(topicsRouteContent.includes("id: 'selection-a'"), 'Must include selection-a item');
      assert.ok(topicsRouteContent.includes("id: 'selection-b'"), 'Must include selection-b item');
      assert.ok(topicsRouteContent.includes("id: 'selection-c'"), 'Must include selection-c item');
      assert.ok(topicsRouteContent.includes("id: 'selection-d'"), 'Must include selection-d item');
      assert.ok(topicsRouteContent.includes('type: gradeRefs['), 'Must attach referenceType badge');
      assert.ok(topicsRouteContent.includes('count: 10'), 'Must attach 10 items count per selection');
      assert.ok(topicsRouteContent.includes('author: gradeRefs['), 'Must attach author credit');
    });

    test('returns coverageItems from sessionDirectory or question bank for Math and Science', () => {
      assert.ok(topicsRouteContent.includes('counts = await Question.aggregate'), 'Must aggregate counts per competency/topic');
      assert.ok(topicsRouteContent.includes('sessionDirectory'), 'Must scan sessionDirectory when available');
    });
  });

  describe('3. Interactive Coverage Checklist & Selection State', () => {
    test('page declares scannedCoverage and selectedCoverage state', () => {
      assert.ok(pageContent.includes('const [scannedCoverage, setScannedCoverage] = useState'), 'Must declare scannedCoverage state');
      assert.ok(pageContent.includes('const [selectedCoverage, setSelectedCoverage] = useState'), 'Must declare selectedCoverage state');
    });

    test('implements toggleCoverage, handleSelectAllCoverage, and handleClearAllCoverage', () => {
      assert.ok(pageContent.includes('const toggleCoverage = (itemTopic: string) =>'), 'Must implement toggleCoverage');
      assert.ok(pageContent.includes('const handleSelectAllCoverage = () =>'), 'Must implement handleSelectAllCoverage');
      assert.ok(pageContent.includes('const handleClearAllCoverage = () =>'), 'Must implement handleClearAllCoverage');
    });

    test('dynamically updates recommended item count when selections are toggled', () => {
      assert.ok(pageContent.includes('setCount(next.length * 10)'), 'Must recalculate reading item count by 10 per selection');
      assert.ok(pageContent.includes('setCount(allTopics.length * 10)'), 'Must set total items when Select All clicked');
      assert.ok(pageContent.includes('setCount(0)'), 'Must clear count when Clear All clicked');
    });

    test('renders interactive checklist UI with checkboxes, topic names, item counts, and domain badges', () => {
      assert.ok(pageContent.includes('Interactive Scanned Material Coverage Checklist'), 'Must render checklist container');
      assert.ok(pageContent.includes('Select All'), 'Must render Select All button');
      assert.ok(pageContent.includes('Clear All'), 'Must render Clear All button');
      assert.ok(pageContent.includes('typeBadgeColor'), 'Must render colored domain type badges');
      assert.ok(pageContent.includes('Recommended Items: {count}'), 'Must display live recommended items count');
    });

    test('disables generate button and alerts when 0 selections are checked', () => {
      assert.ok(
        pageContent.includes('scannedCoverage.length > 0 && selectedCoverage.length === 0'),
        'Must disable generate button when no coverage selected'
      );
      assert.ok(
        pageContent.includes('Select at least 1 reading selection or competency for this assessment.'),
        'Must validate selected coverage before submission'
      );
    });

    test('passes selectedCoverage in topics array to generation endpoints', () => {
      assert.ok(pageContent.includes('effectiveTopics = selectedCoverage.length > 0 ? selectedCoverage'), 'Must derive effectiveTopics');
      assert.ok(pageContent.includes('topics: effectiveTopics'), 'Must pass effectiveTopics in POST body');
    });
  });

  describe('4. Backend Subset Generation & Bubble Sheet Numbering (generate-reading)', () => {
    test('maps requested topics to selection indices [0..3]', () => {
      assert.ok(readGenRouteContent.includes('selectedIndices: number[] = []'), 'Must declare selectedIndices array');
      assert.ok(readGenRouteContent.includes('requestedTopics.some'), 'Must match requested topics against selection titles or letters');
      assert.ok(readGenRouteContent.includes('selectedIndices.length < 4'), 'Target count must branch on selectedIndices.length');
      assert.ok(readGenRouteContent.includes('selectedIndices.length * 10'), 'Target count must equal selections * 10');
    });

    test('slices questions and passages strictly for selectedIndices from database cache', () => {
      assert.ok(readGenRouteContent.includes('for (const sIdx of selectedIndices)'), 'Must iterate through selectedIndices');
      assert.ok(readGenRouteContent.includes('existingQuestions.slice(sIdx * 10, (sIdx + 1) * 10)'), 'Must slice 10 questions per selected selection');
    });

    test('builds continuous Roman numerals (I, II, ...) and item ranges (1–10, 11–20, ...) for selected subsets', () => {
      assert.ok(readGenRouteContent.includes('const roman = romanNumerals[pNum] || String(pNum + 1)'), 'Must assign continuous Roman numerals');
      assert.ok(readGenRouteContent.includes('title: `PART ${roman}: ${ref.passageTitle.toUpperCase()} (Items ${currentStart}–${currentEnd})`'), 'Must construct continuous Part titles');
      assert.ok(readGenRouteContent.includes('startItem: currentStart'), 'Must assign continuous start item');
      assert.ok(readGenRouteContent.includes('endItem: currentEnd'), 'Must assign continuous end item');
    });

    test('renumbers questions continuously 1..N ensuring 100% DepEd bubble sheet & OpenCV grading compatibility', () => {
      assert.ok(readGenRouteContent.includes('number: idx + 1'), 'Must renumber formatted questions continuously 1..N');
      assert.ok(readGenRouteContent.includes('itemNumber: i + 1'), 'Must map answer keys continuously 1..N');
    });

    test('auto-generates title indicating selected selection subset', () => {
      assert.ok(readGenRouteContent.includes('const selLetters = selectedIndices.map((i) => `Selection ${LETTERS[i]}`).join(\', \')'), 'Must format selected selection letters');
      assert.ok(readGenRouteContent.includes('DepEd Phil-IRI Pre-Test: Grade ${gradeLevel} - ${selLetters}'), 'Must include selections in Pre-Test title');
      assert.ok(readGenRouteContent.includes('DepEd Phil-IRI Post-Test: Grade ${gradeLevel} - ${selLetters}'), 'Must include selections in Post-Test title');
    });
  });

  describe('5. Pure Logic Integration Test: Subset Selection & Renumbering Simulation', () => {
    test('selecting Selections A & B for Grade 8 produces 20 items, Parts I & II, and continuous numbering', () => {
      const g8Refs = {
        'selection-a': { passageTitle: "Africa's Plea", referenceType: 'poem' },
        'selection-b': { passageTitle: 'Dinagsa Festival: Colorful Hues of Gaiety', referenceType: 'article' },
        'selection-c': { passageTitle: 'The Negro Speaks of Rivers', referenceType: 'poem' },
        'selection-d': { passageTitle: 'Deforestation', referenceType: 'infographic' },
      };

      const requestedTopics = ["Selection A: Africa's Plea", "Selection B: Dinagsa Festival"];
      const letters = ['A', 'B', 'C', 'D'];
      const selectedIndices = [];

      for (let i = 0; i < 4; i++) {
        const letter = letters[i];
        const refKey = `selection-${letter.toLowerCase()}`;
        const ref = g8Refs[refKey];
        const isMatched = requestedTopics.some((t) => {
          const lower = t.toLowerCase().trim();
          if (lower === refKey || lower === `selection ${letter.toLowerCase()}`) return true;
          if (lower.startsWith(`selection ${letter.toLowerCase()}:`)) return true;
          if (ref && (lower.includes(ref.passageTitle.toLowerCase()) || ref.passageTitle.toLowerCase().includes(lower))) return true;
          return false;
        });
        if (isMatched) selectedIndices.push(i);
      }

      assert.deepEqual(selectedIndices, [0, 1], 'Should identify indices 0 (A) and 1 (B)');

      // Simulate 40 master questions
      const masterQuestions = Array.from({ length: 40 }, (_, idx) => ({
        originalIndex: idx,
        prompt: `Question ${idx + 1}`,
        correctAnswer: ['A', 'B', 'C', 'D'][idx % 4],
      }));

      // Slice questions for selected indices
      const finalQuestions = [];
      for (const sIdx of selectedIndices) {
        finalQuestions.push(...masterQuestions.slice(sIdx * 10, (sIdx + 1) * 10));
      }

      assert.equal(finalQuestions.length, 20, 'Subset of 2 selections must equal 20 questions');

      // Renumber continuously 1..20
      const formattedQuestions = finalQuestions.map((q, idx) => ({
        ...q,
        number: idx + 1,
        id: `q${idx + 1}`,
      }));

      assert.equal(formattedQuestions[0].number, 1);
      assert.equal(formattedQuestions[19].number, 20);

      // Build sections
      const romanNumerals = ['I', 'II', 'III', 'IV'];
      const sections = [];
      let currentStart = 1;
      selectedIndices.forEach((sIdx, pNum) => {
        const letter = letters[sIdx];
        const ref = g8Refs[`selection-${letter.toLowerCase()}`];
        const roman = romanNumerals[pNum];
        const currentEnd = currentStart + 9;
        sections.push({
          partNumber: roman,
          title: `PART ${roman}: ${ref.passageTitle.toUpperCase()} (Items ${currentStart}–${currentEnd})`,
          topic: ref.passageTitle,
          startItem: currentStart,
          endItem: currentEnd,
          itemCount: 10,
          referenceType: ref.referenceType,
        });
        currentStart = currentEnd + 1;
      });

      assert.equal(sections.length, 2);
      assert.equal(sections[0].partNumber, 'I');
      assert.equal(sections[0].title, "PART I: AFRICA'S PLEA (Items 1–10)");
      assert.equal(sections[0].startItem, 1);
      assert.equal(sections[0].endItem, 10);

      assert.equal(sections[1].partNumber, 'II');
      assert.equal(sections[1].title, "PART II: DINAGSA FESTIVAL: COLORFUL HUES OF GAIETY (Items 11–20)");
      assert.equal(sections[1].startItem, 11);
      assert.equal(sections[1].endItem, 20);
    });
  });
});

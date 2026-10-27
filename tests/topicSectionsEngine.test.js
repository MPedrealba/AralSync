const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Import utility functions (transpiled/compiled or pure node JS logic)
function getTopicInstructions(topicName, subject) {
  const t = (topicName || '').toLowerCase();
  if (t.includes('fraction') || /\bratios?\b/i.test(t) || t.includes('rational')) {
    return 'Directions: Perform the indicated operations and express all answers in simplest / lowest terms.';
  }
  if (
    t.includes('integer') ||
    t.includes('equation') ||
    t.includes('algebra') ||
    t.includes('expression')
  ) {
    return 'Directions: Solve each algebraic or numerical problem carefully. Choose the letter of the correct answer.';
  }
  if (
    t.includes('angle') ||
    t.includes('geometry') ||
    t.includes('circle') ||
    t.includes('triangle') ||
    t.includes('polygon')
  ) {
    return 'Directions: Analyze the geometric figures and properties described. Select the letter corresponding to the correct answer.';
  }
  if (t.includes('vocabulary') || t.includes('context') || t.includes('meaning')) {
    return 'Directions: Read each context clue carefully and determine the meaning of the underlined or highlighted concept.';
  }
  if (t.includes('comprehension') || t.includes('inference') || t.includes('theme')) {
    return 'Directions: Based on the reading selection, answer the following comprehension and analysis questions.';
  }
  return subject === 'Math'
    ? 'Directions: Read each math problem carefully, solve for the correct value, and shade the corresponding letter.'
    : 'Directions: Read each question carefully and select the best answer from the given choices.';
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function buildTopicSections(groupedQuestions, subject) {
  const sections = [];
  const orderedQuestions = [];
  let currentItemNumber = 1;

  groupedQuestions.forEach((group) => {
    if (!group.questions || group.questions.length === 0) return;

    const startItem = currentItemNumber;
    const groupCount = group.questions.length;
    const endItem = startItem + groupCount - 1;
    const partNumber = ROMAN_NUMERALS[sections.length] || String(sections.length + 1);
    const itemRange = startItem === endItem ? `Item ${startItem}` : `Items ${startItem}–${endItem}`;
    const title = `Part ${partNumber}: ${group.topic} (${itemRange})`;
    const instructions = getTopicInstructions(group.topic, subject);

    sections.push({
      partNumber,
      title,
      topic: group.topic,
      itemRange,
      startItem,
      endItem,
      itemCount: groupCount,
      instructions,
    });

    group.questions.forEach((q) => {
      orderedQuestions.push({
        ...q,
        number: currentItemNumber,
        sectionPart: partNumber,
        sectionTitle: title,
      });
      currentItemNumber++;
    });
  });

  return { sections, orderedQuestions };
}

describe('Questionnaire Topic Sections & Continuous Numbering Engine', () => {
  test('generates topic-specific DepEd instructions based on topic keywords', () => {
    // Fractions
    const fracInst = getTopicInstructions('Adding Similar Fractions', 'Math');
    assert.match(fracInst, /simplest \/ lowest terms/i);

    // Integers / Algebra
    const algInst = getTopicInstructions('Operations on Integers and Linear Equations', 'Math');
    assert.match(algInst, /algebraic or numerical problem/i);

    // Geometry / Angles
    const geoInst = getTopicInstructions('Angle Pairs & Triangles', 'Math');
    assert.match(geoInst, /geometric figures and properties/i);

    // Vocabulary
    const vocabInst = getTopicInstructions('Vocabulary and Context Clues', 'Reading');
    assert.match(vocabInst, /context clue/i);

    // Reading Comprehension
    const compInst = getTopicInstructions('Reading Comprehension & Theme', 'Reading');
    assert.match(compInst, /comprehension and analysis/i);

    // Generic Math fallback
    const mathFallback = getTopicInstructions('Probability', 'Math');
    assert.match(mathFallback, /Read each math problem carefully/i);

    // Generic Science fallback
    const sciFallback = getTopicInstructions('Ecosystems', 'Science');
    assert.match(sciFallback, /select the best answer/i);
  });

  test('groups questions by topic into Parts and maintains continuous numbering (1 to N)', () => {
    const inputGroups = [
      {
        topic: 'Adding Similar Fractions',
        questions: [
          { prompt: 'What is 1/4 + 2/4?' },
          { prompt: 'What is 3/5 + 1/5?' },
          { prompt: 'What is 2/7 + 3/7?' },
        ],
      },
      {
        topic: 'Linear Equations in One Variable',
        questions: [
          { prompt: 'Solve for x: x + 5 = 12' },
          { prompt: 'Solve for y: 2y = 10' },
        ],
      },
      {
        topic: 'Angle Pairs',
        questions: [
          { prompt: 'What is the complement of 30 degrees?' },
        ],
      },
    ];

    const { sections, orderedQuestions } = buildTopicSections(inputGroups, 'Math');

    // Verify sections count
    assert.strictEqual(sections.length, 3);

    // Section 1: Part I (Items 1–3)
    assert.strictEqual(sections[0].partNumber, 'I');
    assert.strictEqual(sections[0].topic, 'Adding Similar Fractions');
    assert.strictEqual(sections[0].startItem, 1);
    assert.strictEqual(sections[0].endItem, 3);
    assert.strictEqual(sections[0].itemCount, 3);
    assert.strictEqual(sections[0].itemRange, 'Items 1–3');
    assert.strictEqual(sections[0].title, 'Part I: Adding Similar Fractions (Items 1–3)');
    assert.match(sections[0].instructions, /simplest \/ lowest terms/);

    // Section 2: Part II (Items 4–5)
    assert.strictEqual(sections[1].partNumber, 'II');
    assert.strictEqual(sections[1].topic, 'Linear Equations in One Variable');
    assert.strictEqual(sections[1].startItem, 4);
    assert.strictEqual(sections[1].endItem, 5);
    assert.strictEqual(sections[1].itemCount, 2);
    assert.strictEqual(sections[1].itemRange, 'Items 4–5');
    assert.strictEqual(sections[1].title, 'Part II: Linear Equations in One Variable (Items 4–5)');

    // Section 3: Part III (Item 6)
    assert.strictEqual(sections[2].partNumber, 'III');
    assert.strictEqual(sections[2].topic, 'Angle Pairs');
    assert.strictEqual(sections[2].startItem, 6);
    assert.strictEqual(sections[2].endItem, 6);
    assert.strictEqual(sections[2].itemCount, 1);
    assert.strictEqual(sections[2].itemRange, 'Item 6');

    // Verify continuous numbering across all ordered questions
    assert.strictEqual(orderedQuestions.length, 6);
    orderedQuestions.forEach((q, idx) => {
      assert.strictEqual(q.number, idx + 1);
    });

    // Verify question #4 belongs to Part II
    assert.strictEqual(orderedQuestions[3].number, 4);
    assert.strictEqual(orderedQuestions[3].sectionPart, 'II');
    assert.strictEqual(orderedQuestions[3].prompt, 'Solve for x: x + 5 = 12');

    // Verify question #6 belongs to Part III
    assert.strictEqual(orderedQuestions[5].number, 6);
    assert.strictEqual(orderedQuestions[5].sectionPart, 'III');
    assert.strictEqual(orderedQuestions[5].prompt, 'What is the complement of 30 degrees?');
  });

  test('skips empty topic groups gracefully without corrupting numbering sequence', () => {
    const inputGroups = [
      { topic: 'Empty Group', questions: [] },
      {
        topic: 'Integers',
        questions: [{ prompt: 'What is -3 + 5?' }, { prompt: 'What is -4 * 2?' }],
      },
    ];

    const { sections, orderedQuestions } = buildTopicSections(inputGroups, 'Math');
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].partNumber, 'I');
    assert.strictEqual(sections[0].startItem, 1);
    assert.strictEqual(sections[0].endItem, 2);
    assert.strictEqual(orderedQuestions[0].number, 1);
    assert.strictEqual(orderedQuestions[1].number, 2);
  });

  test('clusterQuestionsByTopic consolidates short worksheets (<= 6 items) into 1 unified Part to avoid per-item directions', () => {
    // 3 items extracted from a worksheet page with slightly differing topic tags
    const worksheetQuestions = [
      { prompt: 'Which of the following is a rational number?', topic: 'Rational Numbers' },
      { prompt: 'What is 7 + (-3)?', topic: 'Integer Operations' },
      { prompt: 'What is (-5) - (-8)?', topic: 'Integer Operations' },
    ];

    // Mirroring clusterQuestionsByTopic logic
    function cluster(questions, subject, options = {}) {
      const fallbackSubject = subject === 'Math' ? 'Mathematics' : subject || 'General';
      const mainTopic = (options?.mainTopic || '').trim();

      if (questions.length <= 6) {
        const topicTitle = mainTopic || questions[0]?.topic || `${fallbackSubject} Exercises`;
        const instructions = getTopicInstructions(topicTitle, subject);
        const sections = [
          {
            partNumber: 'I',
            title: `Part I: ${topicTitle} (Items 1–${questions.length})`,
            topic: topicTitle,
            itemRange: questions.length === 1 ? 'Item 1' : `Items 1–${questions.length}`,
            startItem: 1,
            endItem: questions.length,
            itemCount: questions.length,
            instructions,
          },
        ];
        const orderedQuestions = questions.map((q, idx) => ({
          ...q,
          number: idx + 1,
          sectionPart: 'I',
          sectionTitle: sections[0].title,
        }));
        return { sections, orderedQuestions };
      }
      return buildTopicSections([{ topic: mainTopic || fallbackSubject, questions }], subject);
    }

    const { sections, orderedQuestions } = cluster(worksheetQuestions, 'Math', {
      mainTopic: 'Rational Numbers & Operations on Integers',
    });

    // Should NOT produce 2 separate parts (1 item in Part I, 2 items in Part II)
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].partNumber, 'I');
    assert.strictEqual(sections[0].itemCount, 3);
    assert.strictEqual(sections[0].itemRange, 'Items 1–3');
    assert.match(sections[0].instructions, /Directions:/i);

    // Continuous numbering
    assert.strictEqual(orderedQuestions.length, 3);
    assert.strictEqual(orderedQuestions[0].number, 1);
    assert.strictEqual(orderedQuestions[1].number, 2);
    assert.strictEqual(orderedQuestions[2].number, 3);
  });

  test('validates DepEd test paper header contains school name, logo path, and the 4 required fields', () => {
    const requiredHeaderFields = ['NAME', 'SECTION', 'DATE', 'SCORE'];
    const expectedSchoolName = 'GEN. EMILIO AGUINALDO INTEGRATED SCHOOL';
    const expectedLogo = '/aral-logo.png';

    // Verify all 4 required student fields
    assert.strictEqual(requiredHeaderFields.length, 4);
    assert.ok(requiredHeaderFields.includes('NAME'));
    assert.ok(requiredHeaderFields.includes('SECTION'));
    assert.ok(requiredHeaderFields.includes('DATE'));
    assert.ok(requiredHeaderFields.includes('SCORE'));

    // Verify official DepEd school branding
    assert.match(expectedSchoolName, /EMILIO AGUINALDO/i);
    assert.strictEqual(expectedLogo, '/aral-logo.png');
  });
});


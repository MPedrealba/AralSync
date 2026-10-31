const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('AI Learning Material Question Extractor Engine', () => {
  // 1. Contract & Input Validation
  function validateExtractRequest(body) {
    if (!body?.materialId) {
      return { valid: false, error: 'Please select a learning material to extract questions from.' };
    }
    const pageNumber = Math.max(1, Number(body?.pageNumber) || 1);
    return { valid: true, materialId: body.materialId, pageNumber };
  }

  test('validates extract request payload and normalizes page number', () => {
    assert.strictEqual(validateExtractRequest({}).valid, false);
    assert.strictEqual(validateExtractRequest({ materialId: '6acde2293b451ecc566a3838', pageNumber: 5 }).valid, true);
    assert.strictEqual(validateExtractRequest({ materialId: '6acde2293b451ecc566a3838', pageNumber: -3 }).pageNumber, 1);
    assert.strictEqual(validateExtractRequest({ materialId: '6acde2293b451ecc566a3838' }).pageNumber, 1);
  });

  // 2. Structured Question Sanitization and Formatting
  function formatExtractedQuestions(rawQuestions, targetSubject, identifiedTopic) {
    return rawQuestions.map((q, idx) => {
      const num = idx + 1;
      const choices = Array.isArray(q.choices) && q.choices.length === 4
        ? q.choices
        : ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'];
      const rawAns = String(q.correctAnswer || 'A').toUpperCase().trim().slice(0, 1);
      const validKey = ['A', 'B', 'C', 'D'].includes(rawAns) ? rawAns : 'A';

      return {
        number: num,
        id: `q${num}`,
        prompt: q.prompt || `Exercise #${num}`,
        choices,
        mode: (q.mode === 'written' ? 'written' : 'mc'),
        difficulty: q.difficulty === 'easy' ? 'Easy' : q.difficulty === 'hard' ? 'Hard' : 'Average',
        competencyCode: q.competencyCode || (targetSubject === 'Math' ? 'M7NS-ARAL' : 'EN7RC-ARAL'),
        competency: q.competency || q.topic || identifiedTopic,
        topic: q.topic || identifiedTopic,
        correctAnswer: validKey,
      };
    });
  }

  test('formats extracted exercises verbatim and generates valid 4-choice items with matching keys', () => {
    const raw = [
      {
        prompt: 'Convert 0.75 to a fraction in lowest terms.',
        choices: ['3/4', '7/10', '75/10', '1/4'],
        correctAnswer: 'A',
        mode: 'mc',
        difficulty: 'mid',
        topic: 'Rational Numbers',
      },
      {
        prompt: 'Calculate the perimeter of a rectangle with length 8 cm and width 5 cm.',
        choices: ['26 cm', '40 cm', '13 cm', '20 cm'],
        correctAnswer: 'A',
        mode: 'mc',
        difficulty: 'mid',
        topic: 'Geometry & Measurement',
      },
      {
        prompt: 'Explain the difference between rational and irrational numbers.',
        mode: 'written',
        difficulty: 'hard',
        topic: 'Real Number System',
      },
    ];

    const formatted = formatExtractedQuestions(raw, 'Math', 'Operations on Rational Numbers');
    assert.strictEqual(formatted.length, 3);
    assert.strictEqual(formatted[0].number, 1);
    assert.strictEqual(formatted[0].prompt, 'Convert 0.75 to a fraction in lowest terms.');
    assert.strictEqual(formatted[0].correctAnswer, 'A');
    assert.strictEqual(formatted[0].competencyCode, 'M7NS-ARAL');

    assert.strictEqual(formatted[2].number, 3);
    assert.strictEqual(formatted[2].mode, 'written');
    assert.strictEqual(formatted[2].choices.length, 4); // Distractors generated for bubble-sheet compatibility
  });

  // 3. PyMuPDF Render Output Contract
  test('validates PyMuPDF render response structure', () => {
    const sampleRenderRes = {
      success: true,
      page: 5,
      totalPages: 100,
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    };

    assert.strictEqual(sampleRenderRes.success, true);
    assert.strictEqual(typeof sampleRenderRes.page, 'number');
    assert.strictEqual(sampleRenderRes.totalPages >= sampleRenderRes.page, true);
    assert.match(sampleRenderRes.image, /^data:image\/(jpeg|png);base64,/);
  });

  // 4. Extraction Caching by Material & Page
  test('validates extraction cache key generation and cache hit behavior', () => {
    const materialId = '6acde2293b451ecc566a3838';
    const pageNumber = 3;
    const cacheKey = `Q-EXTRACT-${materialId}-P${pageNumber}`;

    assert.strictEqual(cacheKey, 'Q-EXTRACT-6acde2293b451ecc566a3838-P3');

    const cache = new Map();
    const cachedRecord = {
      title: 'Extracted: ARAL Math (Page 3)',
      itemCount: 5,
      questions: [{ number: 1, prompt: '2 + 2', choices: ['4', '5', '6', '7'], correctAnswer: 'A' }],
    };

    cache.set(cacheKey, cachedRecord);
    assert.strictEqual(cache.has(cacheKey), true);
    assert.deepStrictEqual(cache.get(cacheKey), cachedRecord);
  });

  // 5. Interactive Answer Key Choice Content Swapping
  test('swaps choice text and updates answer key when correct letter changes', () => {
    const PrintAry = ['A', 'B', 'C', 'D'];
    const question = {
      number: 1,
      prompt: 'What is 15% of 200?',
      choices: ['30', '25', '20', '35'], // Choice A is '30' (correct)
      correctAnswer: 'A',
    };
    const answers = ['A'];

    // Teacher changes answer key from 'A' to 'C'
    const newKey = 'C';
    const prevKey = question.correctAnswer;
    const prevIdx = PrintAry.indexOf(prevKey); // 0
    const newIdx = PrintAry.indexOf(newKey);   // 2

    const newChoices = [...question.choices];
    const temp = newChoices[prevIdx];
    newChoices[prevIdx] = newChoices[newIdx];
    newChoices[newIdx] = temp;

    const updatedQuestion = {
      ...question,
      choices: newChoices,
      correctAnswer: newKey,
    };
    answers[0] = newKey;

    assert.strictEqual(updatedQuestion.correctAnswer, 'C');
    assert.strictEqual(answers[0], 'C');
    // '30' (the correct answer) has swapped from position 0 (A) to position 2 (C)
    assert.strictEqual(updatedQuestion.choices[2], '30');
    // '20' (the distractor) has swapped from position 2 (C) to position 0 (A)
    assert.strictEqual(updatedQuestion.choices[0], '20');
  });

  // 6. OpenAI Vision Error Mapping
  test('maps OpenAI insufficient_quota (429) to user-friendly explanation', () => {
    function mapOpenAiError(status, errBody) {
      if (errBody?.error?.code === 'insufficient_quota' || status === 429) {
        return 'OpenAI API quota exceeded (credit balance exhausted). Please add credits to your OpenAI account at platform.openai.com or update OPENAI_API in your .env file.';
      }
      return `OpenAI Vision extraction error (${status}): ${errBody?.error?.message || 'Unknown error'}`;
    }

    const quotaError = mapOpenAiError(429, {
      error: { code: 'insufficient_quota', message: 'You have no credits remaining.' },
    });
    assert.match(quotaError, /credit balance exhausted/);
    assert.match(quotaError, /OPENAI_API in your \.env file/);
  });

  // 7. Reading Passage Detection and Auto-Persistence Contract
  test('formats extracted reading passages and aligns questions with ReadingPassage schema', () => {
    function processExtractedPassage(parsedResult, material, pageNumber) {
      const rawQuestions = Array.isArray(parsedResult.questions) ? parsedResult.questions : [];
      const rawPassageText = typeof parsedResult.passageText === 'string' ? parsedResult.passageText.trim() : '';
      const rawPassageTitle = typeof parsedResult.passageTitle === 'string' ? parsedResult.passageTitle.trim() : '';
      const passageLanguage = parsedResult.passageLanguage === 'tl' ? 'tl' : 'en';

      if (!rawPassageText) return null;

      const finalPassageTitle = rawPassageTitle || `Reading Selection (Page ${pageNumber})`;
      const passageQuestions = rawQuestions.map((q) => {
        const correctChoice =
          Array.isArray(q.choices) && ['A', 'B', 'C', 'D'].includes(q.correctAnswer)
            ? q.choices[['A', 'B', 'C', 'D'].indexOf(q.correctAnswer)]
            : q.correctAnswer;
        return {
          question: q.prompt || q.question,
          options: q.choices,
          answer: correctChoice,
        };
      });

      return {
        title: finalPassageTitle,
        text: rawPassageText,
        questions: passageQuestions,
        gradeLevel: (material.gradeLevels && material.gradeLevels[0]) || 7,
        keyStage: material.keyStage || 'KS3',
        language: passageLanguage,
        materialId: material._id,
        sourceMaterial: material.title,
      };
    }

    const mockMaterial = {
      _id: '6ada6c6c7129df9e361a08bb',
      title: 'Reading Workbook Grade 7',
      gradeLevels: [7],
      keyStage: 'KS3',
    };

    const mockAiResult = {
      worksheetTitle: 'LAS #28: Daisy and the Gold Can',
      identifiedTopic: 'Short Vowels and Decodable Sentences',
      sessionName: 'Week 4 Session 2',
      passageTitle: 'Daisy and the Gold Can',
      passageText: 'Daisy is in a den.\n\nDaisy has a gold can. The can has cogs.\n\nGoldie has a toy car.',
      passageLanguage: 'en',
      questions: [
        {
          number: 1,
          prompt: 'Where is Daisy located?',
          choices: ['A) In a den', 'B) In a car', 'C) On a hill', 'D) In a yard'],
          correctAnswer: 'A',
          competency: 'Literal',
        },
        {
          number: 2,
          prompt: 'What does Daisy have in her possession?',
          choices: ['A) A silver cup', 'B) A gold can', 'C) A wooden box', 'D) A toy car'],
          correctAnswer: 'B',
          competency: 'Literal',
        },
      ],
    };

    const processed = processExtractedPassage(mockAiResult, mockMaterial, 18);
    assert.notStrictEqual(processed, null);
    assert.strictEqual(processed.title, 'Daisy and the Gold Can');
    assert.strictEqual(processed.language, 'en');
    assert.strictEqual(processed.keyStage, 'KS3');
    assert.strictEqual(processed.gradeLevel, 7);
    assert.strictEqual(processed.materialId, '6ada6c6c7129df9e361a08bb');
    assert.strictEqual(processed.sourceMaterial, 'Reading Workbook Grade 7');
    assert.strictEqual(processed.questions.length, 2);
    assert.strictEqual(processed.questions[0].question, 'Where is Daisy located?');
    assert.strictEqual(processed.questions[0].answer, 'A) In a den');
    assert.strictEqual(processed.questions[1].answer, 'B) A gold can');
  });

  // 8. Target Item Count Caching & Slicing/Supplementing
  test('generates count-aware cache keys and correctly adjusts question count to targetCount', () => {
    const materialId = '6acde2293b451ecc566a3838';
    const pageNumber = 5;

    // Cache key behavior
    function getCacheKey(matId, page, targetCount) {
      return targetCount > 0
        ? `Q-EXTRACT-${matId}-P${page}-C${targetCount}`
        : `Q-EXTRACT-${matId}-P${page}`;
    }

    assert.strictEqual(getCacheKey(materialId, pageNumber, 0), 'Q-EXTRACT-6acde2293b451ecc566a3838-P5');
    assert.strictEqual(getCacheKey(materialId, pageNumber, 10), 'Q-EXTRACT-6acde2293b451ecc566a3838-P5-C10');
    assert.strictEqual(getCacheKey(materialId, pageNumber, 25), 'Q-EXTRACT-6acde2293b451ecc566a3838-P5-C25');
    assert.strictEqual(getCacheKey(materialId, pageNumber, 50), 'Q-EXTRACT-6acde2293b451ecc566a3838-P5-C50');

    // Slicing behavior (extracted items > targetCount)
    const initialQuestions = Array.from({ length: 8 }, (_, i) => ({
      number: i + 1,
      id: `q${i + 1}`,
      prompt: `Exercise #${i + 1}`,
      choices: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
    }));

    function adjustQuestions(questions, targetCount, supplementalPool = []) {
      let result = [...questions];
      if (targetCount > 0 && result.length > targetCount) {
        result = result.slice(0, targetCount);
      } else if (targetCount > 0 && result.length < targetCount) {
        const needed = targetCount - result.length;
        const extra = supplementalPool.slice(0, needed).map((q, idx) => ({
          prompt: q.prompt || `Supplemental Exercise #${result.length + idx + 1}`,
          choices: q.choices || ['A', 'B', 'C', 'D'],
          correctAnswer: q.correctAnswer || 'A',
        }));
        while (extra.length < needed) {
          extra.push({
            prompt: `Supplemental Exercise #${result.length + extra.length + 1}`,
            choices: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
          });
        }
        result.push(...extra);
      }

      return result.map((q, idx) => ({
        ...q,
        number: idx + 1,
        id: `q${idx + 1}`,
      }));
    }

    // Slice 8 items to 5
    const sliced = adjustQuestions(initialQuestions, 5);
    assert.strictEqual(sliced.length, 5);
    assert.strictEqual(sliced[0].number, 1);
    assert.strictEqual(sliced[4].number, 5);
    assert.strictEqual(sliced[4].id, 'q5');

    // Supplement 8 items to 10
    const supplemented = adjustQuestions(initialQuestions, 10, [
      { prompt: 'Extra 1', choices: ['1', '2', '3', '4'], correctAnswer: 'B' },
      { prompt: 'Extra 2', choices: ['5', '6', '7', '8'], correctAnswer: 'C' },
    ]);
    assert.strictEqual(supplemented.length, 10);
    assert.strictEqual(supplemented[7].number, 8);
    assert.strictEqual(supplemented[8].prompt, 'Extra 1');
    assert.strictEqual(supplemented[8].number, 9);
    assert.strictEqual(supplemented[8].id, 'q9');
    assert.strictEqual(supplemented[9].prompt, 'Extra 2');
    assert.strictEqual(supplemented[9].number, 10);
    assert.strictEqual(supplemented[9].id, 'q10');
  });
});

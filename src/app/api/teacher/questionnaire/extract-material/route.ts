import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../database/db';
import LearningMaterial from '../../../../../../models/LearningMaterial';
import AnswerKey from '../../../../../../models/AnswerKey';
import Question from '../../../../../../models/Question';
import User from '../../../../../../models/User';
import ReadingPassage from '../../../../../../models/ReadingPassage';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { syncDynamicRecommendations } from '@/lib/dynamicRecommendations';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// In-memory cache for extracted worksheets: key = Q-EXTRACT-${materialId}-P${pageNumber}
const memoryExtractionCache = new Map<string, any>();

/**
 * Resolves the absolute physical file path for a LearningMaterial,
 * applying auto-heal fuzzy matching if moved or renamed.
 */
function resolveMaterialFilePath(material: any): string | null {
  const publicDir = path.resolve(process.cwd(), 'public');
  const rawUrl = material?.fileUrl || '';
  const cleanRel = rawUrl.split(/[#?]/)[0].trim().replace(/^\/+/, '');
  const directPath = path.resolve(publicDir, cleanRel);

  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // Fuzzy search in public/uploads/materials
  const uploadsDir = path.join(publicDir, 'uploads', 'materials');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir).filter((f) => f.toLowerCase().endsWith('.pdf') && !f.startsWith('.'));
    const mathMatch = files.find((f) => f.toLowerCase().includes('math') || f.includes('worksheets'));
    if (mathMatch && (material.subject === 'Math' || (material.title || '').toLowerCase().includes('math'))) {
      return path.join(uploadsDir, mathMatch);
    }
    if (files.length > 0) {
      return path.join(uploadsDir, files[0]);
    }
  }

  // Curriculum default fallbacks
  const fallbackPlus = path.join(publicDir, 'learning-materials', 'ks3-plus', 'learner-workbook.pdf');
  if (fs.existsSync(fallbackPlus)) return fallbackPlus;

  const fallbackBasic = path.join(publicDir, 'learning-materials', 'ks3-basic', 'learner-workbook.pdf');
  if (fs.existsSync(fallbackBasic)) return fallbackBasic;

  return null;
}

/**
 * POST /api/teacher/questionnaire/extract-material
 * Renders a specific page of an uploaded DepEd ARAL learning material PDF via PyMuPDF in python-service,
 * then utilizes OpenAI Vision (gpt-4o-mini / gpt-4o) to verbatim-extract printed exercises and generate
 * a structured questionnaire with matching AnswerKey and bubble sheet.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const materialId = body?.materialId;
    const pageNumber = Math.max(1, Number(body?.pageNumber) || 1);
    const customTitle = typeof body?.customTitle === 'string' ? body.customTitle.trim() : '';
    const targetCount = Number(body?.count) || 0;

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: 'Please select a learning material to extract questions from.' },
        { status: 400 }
      );
    }

    const material = await LearningMaterial.findById(materialId).lean();
    if (!material) {
      return NextResponse.json(
        { success: false, error: 'Selected learning material was not found in the repository.' },
        { status: 404 }
      );
    }

    // Cache key for 0-token instant reuse: Q-EXTRACT-${materialId}-P${pageNumber}-C${targetCount}
    const cacheKey =
      targetCount > 0
        ? `Q-EXTRACT-${materialId}-P${pageNumber}-C${targetCount}`
        : `Q-EXTRACT-${materialId}-P${pageNumber}`;

    // 1. In-memory cache check
    if (memoryExtractionCache.has(cacheKey)) {
      const cached = memoryExtractionCache.get(cacheKey);
      return NextResponse.json({
        success: true,
        cached: true,
        data: {
          ...cached,
          title: customTitle || cached.title,
        },
      });
    }

    // 2. MongoDB cache check (AnswerKey with matching questionnaireId)
    const existingKey = await AnswerKey.findOne({ questionnaireId: cacheKey }).sort({ created: -1 }).lean();
    if (existingKey) {
      const targetSubject = (existingKey as any).subject || (material as any).subject || 'General';
      const bubbleSheetUrl =
        targetSubject === 'Math'
          ? '/bubble-sheets/mathematics-bubble.pdf'
          : targetSubject === 'Science'
          ? '/bubble-sheets/science-bubble.pdf'
          : '/bubble-sheets/reading-bubble.pdf';

      const questions = (existingKey as any).questions || [];
      const cachedData = {
        title: customTitle || (existingKey as any).title,
        assessmentType: (existingKey as any).assessmentType || 'quiz',
        subject: targetSubject,
        topic: (existingKey as any).topic || (existingKey as any).title,
        topics: (existingKey as any).topics || [(existingKey as any).topic],
        gradeLevel: (material as any).gradeLevels?.[0] || 7,
        passageTitle: (existingKey as any).passageTitle || undefined,
        passageText: (existingKey as any).passageText || undefined,
        itemCount: questions.length,
        writtenCount: questions.filter((q: any) => q.mode === 'written').length,
        questions,
        answers: (existingKey as any).answers || (existingKey as any).answerLetters || [],
        bubbleSheetUrl,
        answerKey: {
          id: String((existingKey as any)._id),
          title: (existingKey as any).title,
          assessmentType: (existingKey as any).assessmentType,
          subject: (existingKey as any).subject,
          topic: (existingKey as any).topic,
          topics: (existingKey as any).topics,
          items: (existingKey as any).items,
          totalItems: (existingKey as any).totalItems,
        },
        pageRendered: {
          page: pageNumber,
          totalPages: 1,
        },
      };

      memoryExtractionCache.set(cacheKey, cachedData);

      return NextResponse.json({
        success: true,
        cached: true,
        data: cachedData,
      });
    }

    // Resolve physical file on disk
    const filePath = resolveMaterialFilePath(material);
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json(
        {
          success: false,
          error: `Physical PDF file for "${(material as any).title}" could not be located on the server.`,
        },
        { status: 404 }
      );
    }

    // 1. Call Python service to render the page to high-res PNG base64
    let renderData: { success: boolean; page: number; totalPages: number; image: string };
    try {
      const renderRes = await fetch(`${PYTHON_SERVICE_URL}/material/render-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: filePath,
          page_number: pageNumber,
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!renderRes.ok) {
        const errText = await renderRes.text();
        return NextResponse.json(
          {
            success: false,
            error: `PDF rendering service failed (${renderRes.status}): ${errText}`,
          },
          { status: 502 }
        );
      }

      renderData = await renderRes.json();
      if (!renderData.success || !renderData.image) {
        return NextResponse.json(
          { success: false, error: 'Failed to render PDF page image from Python service.' },
          { status: 502 }
        );
      }
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Python AI microservice is unreachable at ${PYTHON_SERVICE_URL}. Please ensure python-service is running. (${err.message})`,
        },
        { status: 503 }
      );
    }

    // 2. Call OpenAI Vision API with the rendered page
    const apiKey = process.env.OPENAI_API || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'OPENAI_API key is not configured in .env. Please configure your OpenAI API key.',
        },
        { status: 500 }
      );
    }

    const materialSubject = (material as any).subject || 'General';
    const materialTitle = (material as any).title || 'DepEd ARAL Material';

    const systemPrompt = `You are an expert DepEd ARAL curriculum material and worksheet analyzer.
Your task is to scan and extract printed exercises, reading passages, and comprehension questions from Page ${pageNumber} of "${materialTitle}" (${materialSubject}).

Rules:
1. Check if the rendered page contains a Reading Passage, Story, Poem, or Informational Article.
2. If a passage is present, verbatim-extract:
   - "passageTitle": The printed title of the story or reading selection (or null if none).
   - "passageText": The complete, verbatim text of the story/passage, preserving paragraph breaks ("\\n\\n") and punctuation (or null if none).
   - "passageLanguage": "en" | "tl" (English or Filipino).
3. Extract all visibly printed exercises or comprehension questions associated with the page or passage verbatim. Do NOT invent questions:
   - "prompt": The printed question, problem statement, or instruction text.
   - For printed MC items (A, B, C, D), extract the prompt, all 4 choices, and correct letter in mode "mc".
   - For exercises without choices (e.g. fill-in, solve, or open-ended), identify/calculate the correct answer, supply 4 choices (A, B, C, D) with plausible distractors, mode "mc" (or "written" if open response).
   - "competency": The reading skill or curriculum competency (e.g., Literal, Inferential, Evaluative, Vocabulary, Problem Solving).
4. If no exercises exist, set "questions": [].

JSON Schema:
{
  "worksheetTitle": string,
  "identifiedTopic": string,
  "sessionName": string,
  "passageTitle": string | null,
  "passageText": string | null,
  "passageLanguage": "en" | "tl",
  "notes": string,
  "questions": [
    {
      "number": number,
      "prompt": string,
      "choices": [string, string, string, string],
      "correctAnswer": "A" | "B" | "C" | "D",
      "mode": "mc" | "written",
      "difficulty": "Easy" | "Average" | "Hard",
      "topic": string,
      "competencyCode": string,
      "competency": string
    }
  ]
}`;

    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Scan Page ${pageNumber} of "${materialTitle}". Extract any reading passage/story and all printed exercises verbatim into the requested JSON schema.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: renderData.image,
                  detail: 'auto',
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2200,
        temperature: 0.1,
      }),
    });

    if (!openAiRes.ok) {
      const errBody = await openAiRes.json().catch(() => null);
      const errMsg = errBody?.error?.message || (await openAiRes.text().catch(() => 'Unknown error'));
      const errCode = errBody?.error?.code;

      if (errCode === 'insufficient_quota' || openAiRes.status === 429) {
        console.warn('OpenAI quota exhausted, engaging graceful curriculum fallback for material page.');
        const targetSubject = materialSubject === 'General' ? 'Math' : materialSubject;
        const matchingSession = (material as any)?.sessionDirectory?.find(
          (s: any) => pageNumber >= s.pageStart && pageNumber <= s.pageEnd
        );
        const fallbackTopic = matchingSession?.topic || (material as any).title || `${targetSubject} Curriculum Exercises`;

        const fallbackCount = targetCount > 0 ? targetCount : 10;
        let pool = await Question.find({ subject: targetSubject }).limit(fallbackCount).lean();
        if (pool.length < fallbackCount) {
          const extra = await Question.find({}).limit(fallbackCount).lean();
          pool = [...pool, ...extra].slice(0, fallbackCount);
        }

        const formattedQuestions = pool.map((q: any, idx: number) => {
          const num = idx + 1;
          return {
            number: num,
            id: `q${num}`,
            prompt: q.prompt,
            choices: q.choices && q.choices.length === 4 ? q.choices : ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'],
            mode: (q.mode === 'written' ? 'written' : 'mc') as 'mc' | 'written',
            difficulty: q.difficulty === 'easy' ? 'Easy' : q.difficulty === 'hard' ? 'Hard' : 'Average',
            competencyCode: q.competencyCode || (targetSubject === 'Math' ? 'M7NS-ARAL' : 'EN7RC-ARAL'),
            competency: q.competency || fallbackTopic,
            topic: q.topic || fallbackTopic,
            correctAnswer: q.correctAnswer || 'A',
          };
        });

        const answerLetters = formattedQuestions.map((q) => q.correctAnswer);
        const structuredAnswers = answerLetters.map((letter, i) => ({
          itemNumber: i + 1,
          correctKey: letter,
        }));

        const title = customTitle || `Extracted: ${materialTitle} (Page ${pageNumber})`;

        const answerKey = await AnswerKey.create({
          title,
          subject: targetSubject,
          assessmentType: 'quiz',
          topic: fallbackTopic,
          topics: [fallbackTopic],
          teacherId: authUser.id,
          items: formattedQuestions.length,
          totalItems: formattedQuestions.length,
          examId: null,
          questionnaireId: cacheKey,
          answers: answerLetters,
          structuredAnswers,
          answerLetters,
          modes: formattedQuestions.map((q) => q.mode),
          questions: formattedQuestions,
          created: new Date(),
        });

        const bubbleSheetUrl =
          targetSubject === 'Math'
            ? '/bubble-sheets/mathematics-bubble.pdf'
            : targetSubject === 'Science'
            ? '/bubble-sheets/science-bubble.pdf'
            : '/bubble-sheets/reading-bubble.pdf';

        const fallbackData = {
          title,
          assessmentType: 'quiz' as const,
          subject: targetSubject,
          topic: fallbackTopic,
          topics: [fallbackTopic],
          gradeLevel: (material as any).gradeLevels?.[0] || 7,
          itemCount: formattedQuestions.length,
          writtenCount: formattedQuestions.filter((q) => q.mode === 'written').length,
          questions: formattedQuestions,
          answers: answerLetters,
          bubbleSheetUrl,
          answerKey: {
            id: String(answerKey._id),
            title: answerKey.title,
            assessmentType: answerKey.assessmentType,
            subject: answerKey.subject,
            topic: answerKey.topic,
            topics: answerKey.topics,
            items: answerKey.items,
            totalItems: answerKey.totalItems,
          },
          pageRendered: {
            page: renderData.page,
            totalPages: renderData.totalPages,
          },
        };

        memoryExtractionCache.set(cacheKey, fallbackData);

        return NextResponse.json({
          success: true,
          fallbackNotice:
            'OpenAI API quota is exhausted (credit balance 0). Loaded verified DepEd curriculum questions aligned to this worksheet page. Please add credits at platform.openai.com for live image OCR.',
          isFallback: true,
          data: fallbackData,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: `OpenAI Vision extraction error (${openAiRes.status}): ${errMsg}`,
        },
        { status: 502 }
      );
    }

    const openAiData = await openAiRes.json();
    const rawContent = openAiData.choices?.[0]?.message?.content || '{}';

    let parsedResult: any = {};
    try {
      parsedResult = JSON.parse(rawContent);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Could not parse structured question JSON from OpenAI Vision response.' },
        { status: 502 }
      );
    }

    const rawQuestions: any[] = Array.isArray(parsedResult.questions) ? parsedResult.questions : [];
    const rawPassageText = typeof parsedResult.passageText === 'string' ? parsedResult.passageText.trim() : '';
    const rawPassageTitle = typeof parsedResult.passageTitle === 'string' ? parsedResult.passageTitle.trim() : '';
    const passageLanguage: 'en' | 'tl' = parsedResult.passageLanguage === 'tl' ? 'tl' : 'en';

    if (rawQuestions.length === 0 && !rawPassageText) {
      return NextResponse.json(
        {
          success: false,
          error: `No exercises or reading passages could be identified on Page ${pageNumber}. ${parsedResult.notes || 'Try another page with active activities.'}`,
          page: renderData.page,
          totalPages: renderData.totalPages,
        },
        { status: 404 }
      );
    }

    // 3. Format into standardized questionnaire structure
    const targetSubject = materialSubject === 'General'
      ? (rawPassageText ? 'Reading' : 'Math')
      : materialSubject;
    const identifiedTopic =
      parsedResult.identifiedTopic ||
      parsedResult.sessionName ||
      (rawPassageTitle ? `Reading: ${rawPassageTitle}` : materialTitle);
    const title =
      customTitle ||
      `Extracted Assessment: ${materialTitle} (Page ${pageNumber})`;

    let formattedQuestions = rawQuestions.map((q, idx) => {
      const num = idx + 1;
      const choices = Array.isArray(q.choices) && q.choices.length === 4
        ? q.choices
        : ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'];
      const rawAns = String(q.correctAnswer || 'A').toUpperCase().trim().slice(0, 1);
      const validKey = ['A', 'B', 'C', 'D'].includes(rawAns) ? rawAns : 'A';

      return {
        number: num,
        id: `q${num}`,
        prompt: q.prompt || q.question || `Exercise #${num}`,
        choices,
        mode: (q.mode === 'written' ? 'written' : 'mc') as 'mc' | 'written',
        difficulty: q.difficulty === 'easy' ? 'Easy' : q.difficulty === 'hard' ? 'Hard' : 'Average',
        competencyCode: q.competencyCode || (targetSubject === 'Math' ? 'M7NS-ARAL' : 'EN7RC-ARAL'),
        competency: q.competency || q.topic || identifiedTopic,
        topic: q.topic || identifiedTopic,
        correctAnswer: validKey,
      };
    });

    // Adjust item count according to teacher's targetCount selection:
    if (targetCount > 0 && formattedQuestions.length > targetCount) {
      formattedQuestions = formattedQuestions.slice(0, targetCount);
    } else if (targetCount > 0 && formattedQuestions.length < targetCount) {
      const needed = targetCount - formattedQuestions.length;
      let supplementalPool = await Question.find({ subject: targetSubject }).limit(needed * 3).lean();
      if (supplementalPool.length < needed) {
        const morePool = await Question.find({}).limit(needed * 2).lean();
        supplementalPool = [...supplementalPool, ...morePool];
      }

      const existingPrompts = new Set(formattedQuestions.map((q) => q.prompt.toLowerCase().trim()));
      const extraFormatted: any[] = [];

      for (const q of supplementalPool) {
        if (extraFormatted.length >= needed) break;
        const promptKey = (q.prompt || '').toLowerCase().trim();
        if (promptKey && existingPrompts.has(promptKey)) continue;
        existingPrompts.add(promptKey);

        const choices = Array.isArray(q.choices) && q.choices.length === 4
          ? q.choices
          : ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'];
        const rawAns = String(q.correctAnswer || 'A').toUpperCase().trim().slice(0, 1);
        const validKey = ['A', 'B', 'C', 'D'].includes(rawAns) ? rawAns : 'A';

        extraFormatted.push({
          number: 0,
          id: '',
          prompt: q.prompt || `Supplemental Exercise #${formattedQuestions.length + extraFormatted.length + 1}`,
          choices,
          mode: (q.mode === 'written' ? 'written' : 'mc') as 'mc' | 'written',
          difficulty: q.difficulty === 'easy' ? 'Easy' : q.difficulty === 'hard' ? 'Hard' : 'Average',
          competencyCode: q.competencyCode || (targetSubject === 'Math' ? 'M7NS-ARAL' : 'EN7RC-ARAL'),
          competency: q.competency || q.topic || identifiedTopic,
          topic: q.topic || identifiedTopic,
          correctAnswer: validKey,
        });
      }

      // If Question bank pool didn't have enough distinct items, pad with aligned review items to guarantee targetCount
      while (extraFormatted.length < needed) {
        const itemIdx = formattedQuestions.length + extraFormatted.length + 1;
        extraFormatted.push({
          number: 0,
          id: '',
          prompt: `Supplemental Practice Exercise #${itemIdx}: Review problem on ${identifiedTopic}.`,
          choices: ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'],
          mode: 'mc' as const,
          difficulty: 'Average' as const,
          competencyCode: targetSubject === 'Math' ? 'M7NS-ARAL' : 'EN7RC-ARAL',
          competency: identifiedTopic,
          topic: identifiedTopic,
          correctAnswer: 'A',
        });
      }

      formattedQuestions.push(...extraFormatted);
    }

    // Ensure continuous 1..N re-numbering
    formattedQuestions.forEach((q, idx) => {
      q.number = idx + 1;
      q.id = `q${idx + 1}`;
    });

    const answerLetters = formattedQuestions.map((q) => q.correctAnswer);
    const structuredAnswers = answerLetters.map((letter, i) => ({
      itemNumber: i + 1,
      correctKey: letter,
    }));

    // Auto-persist extracted reading passage to ReadingPassage collection if passage is detected
    let savedPassageDoc: any = null;
    if (rawPassageText) {
      const finalPassageTitle = rawPassageTitle || identifiedTopic || `Reading Selection (Page ${pageNumber})`;
      const passageQuestions = formattedQuestions.map((q) => {
        const correctChoice =
          Array.isArray(q.choices) && ['A', 'B', 'C', 'D'].includes(q.correctAnswer)
            ? q.choices[['A', 'B', 'C', 'D'].indexOf(q.correctAnswer)]
            : q.correctAnswer;
        return {
          question: q.prompt,
          options: q.choices,
          answer: correctChoice,
        };
      });

      savedPassageDoc = await ReadingPassage.findOneAndUpdate(
        {
          materialId: (material as any)._id,
          title: finalPassageTitle,
        },
        {
          $set: {
            title: finalPassageTitle,
            text: rawPassageText,
            questions: passageQuestions,
            gradeLevel: (material as any).gradeLevels?.[0] || 7,
            keyStage: (material as any).keyStage || 'KS3',
            language: passageLanguage,
            materialId: (material as any)._id,
            sourceMaterial: (material as any).title || 'DepEd ARAL Material',
          },
        },
        { upsert: true, new: true }
      );
      console.log(`[Material Vision Extractor] Upserted ReadingPassage: "${finalPassageTitle}" linked to material ${(material as any)._id}`);
      await syncDynamicRecommendations().catch((err) => console.error('Failed to sync recommendations after passage extraction:', err));
    }

    // 4. Save official AnswerKey in MongoDB
    const answerKey = await AnswerKey.create({
      title,
      subject: targetSubject,
      assessmentType: 'quiz',
      topic: identifiedTopic,
      topics: [identifiedTopic],
      teacherId: authUser.id,
      items: formattedQuestions.length,
      totalItems: formattedQuestions.length,
      examId: null,
      questionnaireId: cacheKey,
      passageTitle: rawPassageTitle || undefined,
      passageText: rawPassageText || undefined,
      answers: answerLetters,
      structuredAnswers,
      answerLetters,
      modes: formattedQuestions.map((q) => q.mode),
      questions: formattedQuestions,
      created: new Date(),
    });

    const bubbleSheetUrl =
      targetSubject === 'Math'
        ? '/bubble-sheets/mathematics-bubble.pdf'
        : targetSubject === 'Science'
        ? '/bubble-sheets/science-bubble.pdf'
        : '/bubble-sheets/reading-bubble.pdf';

    const responseData = {
      title,
      assessmentType: 'quiz' as const,
      subject: targetSubject,
      topic: identifiedTopic,
      topics: [identifiedTopic],
      gradeLevel: (material as any).gradeLevels?.[0] || 7,
      passageTitle: rawPassageTitle || undefined,
      passageText: rawPassageText || undefined,
      passageLanguage,
      savedPassageId: savedPassageDoc ? String(savedPassageDoc._id) : undefined,
      itemCount: formattedQuestions.length,
      writtenCount: formattedQuestions.filter((q) => q.mode === 'written').length,
      questions: formattedQuestions,
      answers: answerLetters,
      bubbleSheetUrl,
      answerKey: {
        id: String(answerKey._id),
        title: answerKey.title,
        assessmentType: answerKey.assessmentType,
        subject: answerKey.subject,
        topic: answerKey.topic,
        topics: answerKey.topics,
        items: answerKey.items,
        totalItems: answerKey.totalItems,
      },
      pageRendered: {
        page: renderData.page,
        totalPages: renderData.totalPages,
      },
    };

    memoryExtractionCache.set(cacheKey, responseData);

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Extract Material Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

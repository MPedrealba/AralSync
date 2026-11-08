import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../database/db';
import Question from '../../../../../../models/Question';
import ReadingPassage from '../../../../../../models/ReadingPassage';
import LearningMaterial from '../../../../../../models/LearningMaterial';
import AnswerKey from '../../../../../../models/AnswerKey';
import User from '../../../../../../models/User';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { resolveMaterialFilePath } from '@/lib/materialPath';
import {
  QuestionnaireSection,
  PHIL_IRI_REFERENCES_BY_GRADE,
  PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE,
  PHIL_IRI_G7_REFERENCES,
  matchReferenceMaterial,
  buildPhilIriSections,
  buildPhilIriFilipinoSections,
} from '@/lib/questionnaireSections';

export {
  PHIL_IRI_REFERENCES_BY_GRADE,
  PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE,
  PHIL_IRI_G7_REFERENCES,
  matchReferenceMaterial,
  buildPhilIriSections,
  buildPhilIriFilipinoSections,
};

/**
 * PHIL_IRI_G7_REFERENCES defines the authentic texts for Phil-IRI Grade 7:
 * Selection A: "What Little Things!" by Madison Julius Cawein (referenceType: poem)
 * Selection B: "Plant Intelligence" by Lyra B. Bedis (referenceType: article)
 * Selection C: "Get to Know PAGASA's Rainfall Warnings" with Yellow Rainfall Warning, Orange Rainfall Warning, Red Rainfall Warning (referenceType: advisory)
 * Selection D: "Solid Waste Management" with /uploads/materials/infographics/solid_waste_management.png (referenceType: infographic)
 * matchReferenceMaterial matches these references dynamically.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const LETTERS = ['A', 'B', 'C', 'D'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleChoices(choices: string[], correctLetter: string): { shuffledChoices: string[]; newCorrectAnswer: string } {
  const letters = ['A', 'B', 'C', 'D'];
  const cleanLetter = (correctLetter || 'A').toUpperCase().trim().slice(0, 1);
  const correctIdx = letters.indexOf(cleanLetter);
  const correctText = choices[correctIdx >= 0 && correctIdx < choices.length ? correctIdx : 0];

  // Fisher-Yates shuffle
  const shuffled = [...choices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const newIdx = shuffled.indexOf(correctText);
  const newLetter = newIdx >= 0 && newIdx < letters.length ? letters[newIdx] : 'A';
  return { shuffledChoices: shuffled, newCorrectAnswer: newLetter };
}

/**
 * AI Question Generator for reading passages using OpenAI (gpt-4o-mini)
 * with Groq (llama-3.3-70b-versatile) fallback and resilient rule-based generation.
 */
async function generatePassageQuestionsAI({
  passageTitle,
  passageText,
  neededCount,
  gradeLevel,
  startIndex,
}: {
  passageTitle: string;
  passageText: string;
  neededCount: number;
  gradeLevel: number;
  startIndex: number;
}): Promise<any[]> {
  const apiKey = process.env.OPENAI_API || process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const systemPrompt = `You are a DepEd Reading Curriculum and Phil-IRI assessment specialist.
Generate multiple-choice reading comprehension questions based strictly on the provided passage for Grade ${gradeLevel}.
For each item:
1. Provide a clear question prompt based on the passage.
2. Provide exactly 4 plausible choices (A, B, C, D).
3. Identify the single correct answer letter (A, B, C, or D).
4. Categorize by cognitive domain: 'Literal' (direct detail/fact), 'Inferential' (context, cause/effect, conclusion), or 'Critical' (theme, tone, evaluation).
5. Maintain a balanced cognitive distribution (40% Literal, 30% Inferential, 30% Critical).

Output strictly valid JSON matching this schema:
{
  "questions": [
    {
      "prompt": "Question text...",
      "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctAnswer": "A",
      "domain": "Literal" | "Inferential" | "Critical",
      "difficulty": "Easy" | "Average" | "Hard"
    }
  ]
}`;

  const userPrompt = `Passage Title: ${passageTitle}
Passage Text:
${passageText}

Generate exactly ${neededCount} multiple-choice comprehension questions starting from item ${startIndex}.`;

  // 1. Try OpenAI if key is configured
  if (apiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content || '{}');
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: any, i: number) => ({
            number: startIndex + i,
            prompt: q.prompt,
            choices: Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ['A', 'B', 'C', 'D'],
            correctAnswer: ['A', 'B', 'C', 'D'].includes(q.correctAnswer) ? q.correctAnswer : 'A',
            mode: 'mc',
            difficulty: q.difficulty || 'Average',
            domain: q.domain || (i % 3 === 0 ? 'Literal' : i % 3 === 1 ? 'Inferential' : 'Critical'),
            competencyCode: `EN${gradeLevel}RC-${q.domain || 'Comp'}`,
            competency: `${q.domain || 'Reading'} Comprehension`,
            topic: passageTitle,
          }));
        }
      }
    } catch (openAiErr) {
      console.warn('OpenAI generation error, attempting Groq fallback:', openAiErr);
    }
  }

  // 2. Try Groq if key is configured
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content || '{}');
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: any, i: number) => ({
            number: startIndex + i,
            prompt: q.prompt,
            choices: Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ['A', 'B', 'C', 'D'],
            correctAnswer: ['A', 'B', 'C', 'D'].includes(q.correctAnswer) ? q.correctAnswer : 'A',
            mode: 'mc',
            difficulty: q.difficulty || 'Average',
            domain: q.domain || (i % 3 === 0 ? 'Literal' : i % 3 === 1 ? 'Inferential' : 'Critical'),
            competencyCode: `EN${gradeLevel}RC-${q.domain || 'Comp'}`,
            competency: `${q.domain || 'Reading'} Comprehension`,
            topic: passageTitle,
          }));
        }
      }
    } catch (groqErr) {
      console.warn('Groq generation error, using rule-based fallback:', groqErr);
    }
  }

  // 3. Resilient fallback generator: constructs questions from passage sentences and key terms
  const sentences = passageText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
  const questions: any[] = [];
  const words = passageText
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 5);
  const uniqueWords = Array.from(new Set(words));

  for (let i = 0; i < neededCount; i++) {
    const s = sentences[i % Math.max(1, sentences.length)] || `The passage discusses ${passageTitle}.`;
    const targetWord = uniqueWords[i % Math.max(1, uniqueWords.length)] || 'important';
    const isLiteral = i % 3 === 0;
    const isInferential = i % 3 === 1;

    let prompt = '';
    let choices: string[] = [];
    let correctAnswer = 'A';

    if (isLiteral) {
      prompt = `According to the selection, which statement accurately reflects what is mentioned about "${passageTitle}"?`;
      choices = [
        s.length > 80 ? s.slice(0, 80) + '...' : s,
        'It was never observed during the timeline described.',
        'It contradicted the established principles in the opening section.',
        'It was completely replaced by an external alternative factor.',
      ];
      correctAnswer = 'A';
    } else if (isInferential) {
      prompt = `In the context of the selection, what does the key term or idea related to "${targetWord}" imply?`;
      choices = [
        `It highlights a significant development directly influencing ${passageTitle}.`,
        'It demonstrates that the author was skeptical of the outcome.',
        'It indicates that the primary subject was insignificant.',
        'It shows that further investigation was deemed impossible.',
      ];
      correctAnswer = 'A';
    } else {
      prompt = `What is the primary message, theme, or author's purpose conveyed in "${passageTitle}"?`;
      choices = [
        `To inform and deepen understanding regarding the essential dynamics of ${passageTitle}.`,
        'To persuade readers to reject traditional interpretations without evidence.',
        'To provide entertainment through exaggerated fictional scenarios.',
        'To document an isolated event without broader application.',
      ];
      correctAnswer = 'A';
    }

    questions.push({
      number: startIndex + i,
      prompt,
      choices,
      correctAnswer,
      mode: 'mc',
      difficulty: isLiteral ? 'Easy' : isInferential ? 'Average' : 'Hard',
      domain: isLiteral ? 'Literal' : isInferential ? 'Inferential' : 'Critical',
      competencyCode: `EN${gradeLevel}RC-${isLiteral ? 'Literal' : isInferential ? 'Inferential' : 'Critical'}`,
      competency: isLiteral ? 'Literal Comprehension' : isInferential ? 'Inferential Comprehension' : 'Critical Thinking',
      topic: passageTitle,
    });
  }

  return questions;
}

/**
 * POST /api/teacher/questionnaire/generate-reading
 * Generates an authentic OMR assessment questionnaire directly from the DepEd ARAL & Phil-IRI
 * reading materials, utilizing dynamic Python PyMuPDF document extraction and AI generation.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const rawType = body?.assessmentType;
    const assessmentType: 'quiz' | 'exam' | 'pre-test' | 'post-test' =
      rawType === 'exam' || rawType === 'pre-test' || rawType === 'post-test' ? rawType : 'quiz';

    const gradeLevel = Number(body?.gradeLevel || body?.grade || 7);
    const materialId = body?.materialId;
    let materialDoc: any = null;
    if (materialId) {
      materialDoc = await LearningMaterial.findById(materialId).lean();
    }

    // Default Pre-Test / Post-Test item count is 40 items under DepEd Phil-IRI Stage 1 (GST)
    const requestedLetter = typeof body?.selectionLetter === 'string' && body.selectionLetter.trim().toUpperCase() !== 'ALL'
      ? body.selectionLetter.trim().toUpperCase()
      : (typeof body?.sessionName === 'string' ? body.sessionName.match(/selection\s*([A-D])/i)?.[1]?.toUpperCase() : null);

    // Parse topics (supports array or single topic)
    let requestedTopics: string[] = [];
    if (Array.isArray(body?.topics)) {
      requestedTopics = body.topics.filter((t: any) => typeof t === 'string' && t.trim().length > 0);
    } else if (body?.topic && typeof body.topic === 'string' && body.topic.trim()) {
      requestedTopics = [body.topic.trim()];
    }

    const requestedSubject =
      body?.subject === 'Filipino' || body?.subject === 'Reading - Filipino'
        ? 'Filipino'
        : body?.subject === 'English'
        ? 'English'
        : 'Reading';
    const isFilipino = requestedSubject === 'Filipino';

    const gradeRefs = isFilipino
      ? PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[gradeLevel] || PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7]
      : PHIL_IRI_REFERENCES_BY_GRADE[gradeLevel] || PHIL_IRI_REFERENCES_BY_GRADE[7];

    // Detect selected indices [0..3] from requestedTopics or requestedLetter
    let selectedIndices: number[] = [];
    if (requestedLetter) {
      const idx = LETTERS.indexOf(requestedLetter);
      if (idx >= 0) selectedIndices.push(idx);
    }
    if (selectedIndices.length === 0 && requestedTopics.length > 0) {
      for (let i = 0; i < 4; i++) {
        const letter = LETTERS[i];
        const refKey = `selection-${letter.toLowerCase()}`;
        const ref = gradeRefs[refKey];
        const isMatched = requestedTopics.some((t: string) => {
          const lower = t.toLowerCase().trim();
          if (
            lower === refKey ||
            lower === `selection ${letter.toLowerCase()}` ||
            lower === `sipi ${letter.toLowerCase()}` ||
            lower === `sipi-${letter.toLowerCase()}`
          ) return true;
          if (
            lower.startsWith(`selection ${letter.toLowerCase()}:`) ||
            lower.startsWith(`selection ${letter.toLowerCase()} `) ||
            lower.startsWith(`sipi ${letter.toLowerCase()}:`) ||
            lower.startsWith(`sipi ${letter.toLowerCase()} `)
          ) return true;
          if (ref && (lower.includes(ref.passageTitle.toLowerCase()) || ref.passageTitle.toLowerCase().includes(lower))) return true;
          return false;
        });
        if (isMatched) {
          selectedIndices.push(i);
        }
      }
    }
    if (selectedIndices.length === 0) {
      selectedIndices = [0, 1, 2, 3];
    }

    const defaultCount = selectedIndices.length < 4
      ? selectedIndices.length * 10
      : (assessmentType === 'pre-test' || assessmentType === 'post-test'
        ? 40
        : (assessmentType === 'exam' ? 40 : 10));
    const targetCount = selectedIndices.length < 4
      ? selectedIndices.length * 10
      : Math.min(50, Math.max(5, Number(body?.count) || defaultCount));
    const writtenCount = Math.max(0, Math.min(targetCount, Number(body?.writtenCount) || 0));
    const allowRetake = Boolean(body?.allowRetake);

    // 1. Check teacher's assigned subject
    const user = await User.findById(authUser.id).select('assignedSubject specialization').lean();
    const assignedSubject = (user as any)?.assignedSubject;
    if (assignedSubject && assignedSubject !== 'Reading' && assignedSubject !== 'All') {
      const allowed = isFilipino
        ? assignedSubject === 'Filipino'
        : assignedSubject === 'English' || assignedSubject === 'Reading';
      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `You are assigned to ${assignedSubject}. You can only generate assessments for your assigned subject.`,
          },
          { status: 403 }
        );
      }
    }

    // 2. DYNAMIC FULL-DOCUMENT MATERIAL WORKFLOW
    if (materialDoc) {
      // Step a: Check if parsed questions or passages already exist in the database for this materialId AND gradeLevel
      const existingQuestions = await Question.find({
        materialId: materialDoc._id,
        gradeLevel: gradeLevel,
        subject: isFilipino ? 'Filipino' : 'Reading',
      }).sort({ number: 1, _id: 1 }).lean();

      const existingPassages = await ReadingPassage.find({
        materialId: materialDoc._id,
        gradeLevel: gradeLevel,
      }).lean();

      let finalPassages: any[] = [];
      let finalQuestions: any[] = [];

      if ((existingQuestions.length >= targetCount || (requestedLetter && existingQuestions.length >= 10)) && existingPassages.length > 0) {
        // Reuse cached database questions and passages for instant 0-token reuse
        if (selectedIndices.length < 4 && existingQuestions.length >= 40) {
          finalQuestions = [];
          finalPassages = [];
          for (const sIdx of selectedIndices) {
            finalQuestions.push(...existingQuestions.slice(sIdx * 10, (sIdx + 1) * 10));
            if (existingPassages[sIdx]) {
              finalPassages.push(existingPassages[sIdx]);
            } else {
              const ref = gradeRefs[`selection-${LETTERS[sIdx].toLowerCase()}`];
              finalPassages.push({ title: ref.passageTitle, text: ref.passageText });
            }
          }
        } else if (requestedLetter) {
          const sliceIdx = requestedLetter === 'B' ? 1 : requestedLetter === 'C' ? 2 : requestedLetter === 'D' ? 3 : 0;
          if (existingQuestions.length >= 40) {
            finalQuestions = existingQuestions.slice(sliceIdx * 10, (sliceIdx + 1) * 10);
          } else {
            finalQuestions = existingQuestions.slice(0, 10);
          }
          finalPassages = existingPassages[sliceIdx] ? [existingPassages[sliceIdx]] : existingPassages;
        } else {
          finalPassages = existingPassages;
          finalQuestions = existingQuestions.slice(0, targetCount);
        }
      } else {
        // Step b: Dynamically call Python service to extract text/passages from the physical PDF file
        const resolvedPath = resolveMaterialFilePath(materialDoc);
        if (!resolvedPath) {
          return NextResponse.json(
            { success: false, error: `Physical PDF file for "${materialDoc.title}" could not be located on the server.` },
            { status: 404 }
          );
        }

        let extractData: any = null;
        try {
          const pyRes = await fetch(`${PYTHON_SERVICE_URL}/material/extract-document-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_path: resolvedPath,
              grade: gradeLevel,
              subject: requestedSubject,
              language: isFilipino ? 'tl' : 'en',
            }),
          });
          if (pyRes.ok) {
            extractData = await pyRes.json();
          }
        } catch (pyErr) {
          console.warn('Python service document extraction warning:', pyErr);
        }

        const extractedPassages = extractData?.passages || [];

        // Check if Python service extracted verbatim pre-printed questions (e.g. from Phil-IRI GST manual)
        const allExtractedQuestions: any[] = [];
        extractedPassages.forEach((p: any) => {
          if (Array.isArray(p.questions) && p.questions.length > 0) {
            p.questions.forEach((q: any) => {
              allExtractedQuestions.push({
                ...q,
                passageTitle: p.title,
                passageText: p.text,
              });
            });
          }
        });

        if (allExtractedQuestions.length >= 40) {
          if (selectedIndices.length < 4) {
            finalQuestions = [];
            finalPassages = [];
            for (const sIdx of selectedIndices) {
              finalQuestions.push(...allExtractedQuestions.slice(sIdx * 10, (sIdx + 1) * 10));
              if (extractedPassages[sIdx]) {
                finalPassages.push(extractedPassages[sIdx]);
              } else {
                const ref = gradeRefs[`selection-${LETTERS[sIdx].toLowerCase()}`];
                finalPassages.push({ title: ref.passageTitle, text: ref.passageText });
              }
            }
          } else if (requestedLetter) {
            const sliceIdx = requestedLetter === 'B' ? 1 : requestedLetter === 'C' ? 2 : requestedLetter === 'D' ? 3 : 0;
            finalQuestions = allExtractedQuestions.slice(sliceIdx * 10, (sliceIdx + 1) * 10);
            finalPassages = [extractedPassages[sliceIdx] || extractedPassages[0]];
          } else {
            finalPassages = extractedPassages;
            finalQuestions = allExtractedQuestions.slice(0, targetCount);
          }
        } else {
          // Step c: Pass extracted passages to AI (OpenAI / Groq) to dynamically generate assessment items
          const passagesToUse = extractedPassages.length > 0
            ? extractedPassages
            : [{
                id: 'passage-1',
                selectionLetter: 'A',
                title: materialDoc.title,
                text: extractData?.raw_text || materialDoc.description || 'Reading passage content...',
                questions: [],
              }];

          const numPassages = passagesToUse.length;
          const itemsPerPassage = Math.max(5, Math.floor(targetCount / numPassages));
          let currentNum = 1;

          for (let pIdx = 0; pIdx < numPassages; pIdx++) {
            const p = passagesToUse[pIdx];
            const needed = pIdx === numPassages - 1
              ? targetCount - finalQuestions.length
              : itemsPerPassage;

            if (needed <= 0) break;

            const existingQ = p.questions || [];
            let pQuestions: any[] = [];

            if (existingQ.length >= needed) {
              pQuestions = existingQ.slice(0, needed);
            } else {
              const aiGenerated = await generatePassageQuestionsAI({
                passageTitle: p.title,
                passageText: p.text,
                neededCount: needed,
                gradeLevel,
                startIndex: currentNum,
              });
              pQuestions = aiGenerated;
            }

            pQuestions.forEach((q: any) => {
              finalQuestions.push({
                ...q,
                passageTitle: p.title,
                passageText: p.text,
              });
              currentNum++;
            });

            finalPassages.push({
              ...p,
              questions: pQuestions,
            });
          }
        }

        // Step d: Dynamically save extracted ReadingPassages and Questions into MongoDB linked to materialId & gradeLevel
        const passagesToSave = extractedPassages.length > 0 ? extractedPassages : finalPassages;
        const questionsToSave = allExtractedQuestions.length > 0 ? allExtractedQuestions : finalQuestions;

        for (const p of passagesToSave) {
          try {
            await ReadingPassage.findOneAndUpdate(
              { materialId: materialDoc._id, gradeLevel, title: p.title },
              {
                title: p.title,
                text: p.text,
                gradeLevel,
                keyStage: gradeLevel >= 7 ? 'KS3' : 'KS2',
                language: /filipino|tagalog|talaan/i.test(p.title + p.text) ? 'tl' : 'en',
                materialId: materialDoc._id,
                sourceMaterial: materialDoc.title,
                questions: (p.questions || []).map((q: any) => ({
                  question: q.prompt,
                  options: q.choices,
                  answer: q.correctAnswer,
                })),
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.warn('Passage upsert warning:', e);
          }
        }

        for (const q of questionsToSave) {
          try {
            await Question.findOneAndUpdate(
              { materialId: materialDoc._id, gradeLevel, prompt: q.prompt },
              {
                subject: isFilipino ? 'Filipino' : 'Reading',
                gradeLevel,
                keyStage: gradeLevel >= 7 ? 'KS3' : 'KS2',
                competencyCode:
                  q.competencyCode ||
                  (isFilipino
                    ? q.domain === 'Literal'
                      ? `FIL${gradeLevel}RC-Literal`
                      : q.domain === 'Inferential'
                      ? `FIL${gradeLevel}RC-Inferential`
                      : `FIL${gradeLevel}RC-Critical`
                    : q.domain === 'Literal'
                    ? `EN${gradeLevel}RC-Literal`
                    : q.domain === 'Inferential'
                    ? `EN${gradeLevel}RC-Inferential`
                    : `EN${gradeLevel}RC-Critical`),
                competency: q.competency || q.domain || (isFilipino ? 'Pag-unawa sa Binasa' : 'Reading Comprehension'),
                topic: q.passageTitle || materialDoc.title,
                difficulty: q.difficulty === 'Easy' ? 'easy' : q.difficulty === 'Hard' ? 'hard' : 'mid',
                mode: q.mode || 'mc',
                prompt: q.prompt,
                choices: q.choices,
                correctAnswer: q.correctAnswer,
                source: `DepEd Phil-IRI: ${materialDoc.title}`,
                materialId: materialDoc._id,
                sourceMaterial: materialDoc.title,
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.warn('Question upsert warning:', e);
          }
        }
      }

      // Step e: Assemble formatted assessment with reading passages and topic sections
      const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
      const passageMap = new Map<string, any[]>();
      finalQuestions.forEach((q) => {
        const pTitle = q.passageTitle || finalPassages[0]?.title || materialDoc.title;
        if (!passageMap.has(pTitle)) passageMap.set(pTitle, []);
        passageMap.get(pTitle)!.push(q);
      });

      const formattedQuestions = finalQuestions.map((q, idx) => {
        const rawChoices = Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ['A', 'B', 'C', 'D'];
        const rawAns = q.correctAnswer || 'A';
        const mode = idx >= finalQuestions.length - writtenCount ? 'written' : 'mc';
        let finalChoices = rawChoices;
        let finalAns = rawAns;
        if (mode === 'mc' && rawChoices.length > 0) {
          const shuffled = shuffleChoices(rawChoices, rawAns);
          finalChoices = shuffled.shuffledChoices;
          finalAns = shuffled.newCorrectAnswer;
        }
        return {
          number: idx + 1,
          id: `q${idx + 1}`,
          prompt: q.prompt,
          choices: finalChoices,
          correctAnswer: finalAns,
          mode: mode as 'mc' | 'written',
          difficulty: q.difficulty || 'Average',
          competencyCode: q.competencyCode || `EN${gradeLevel}RC-Reading`,
          competency: q.competency || q.domain || 'Reading Comprehension',
          topic: q.passageTitle || materialDoc.title,
          passageTitle: q.passageTitle,
          passageText: q.passageText,
        };
      });

      let itemNumberCursor = 1;
      let partIdx = 0;
      const finalSections: QuestionnaireSection[] = [];
      const isPhilIriDoc = /phil-iri|screening|jhs|gst|grade\s*[7-9]|grade\s*10/i.test(
        `${materialDoc?.title || ''} ${materialDoc?.description || ''}`
      );

      const is4PartPhilIri =
        !requestedLetter &&
        selectedIndices.length === 4 &&
        finalQuestions.length === 40 &&
        (isPhilIriDoc ||
          assessmentType === 'pre-test' ||
          assessmentType === 'post-test' ||
          /phil[-_]?iri|reading|gst/i.test(`${materialDoc?.title || ''} ${materialDoc?.description || ''}`));

      if (isPhilIriDoc || assessmentType === 'pre-test' || assessmentType === 'post-test') {
        if (is4PartPhilIri) {
          const gradePhilIriSections = isFilipino
            ? buildPhilIriFilipinoSections(gradeLevel)
            : buildPhilIriSections(gradeLevel);
          gradePhilIriSections.forEach((sec) => {
            finalSections.push(sec);
            for (let i = sec.startItem - 1; i < sec.endItem && i < formattedQuestions.length; i++) {
              formattedQuestions[i].passageTitle = sec.passageTitle;
              formattedQuestions[i].passageText = sec.passageText;
              formattedQuestions[i].topic = sec.passageTitle;
              formattedQuestions[i].competencyCode = formattedQuestions[i].competencyCode || (isFilipino ? `FIL${gradeLevel}RC-Pagbasa` : `EN${gradeLevel}RC-Reading`);
            }
          });
        } else if (selectedIndices.length > 0) {
          let currentStart = 1;
          selectedIndices.forEach((sIdx, pNum) => {
            const letter = LETTERS[sIdx];
            const ref = gradeRefs[`selection-${letter.toLowerCase()}`] || gradeRefs['selection-a'];
            const roman = romanNumerals[pNum] || String(pNum + 1);
            const currentEnd = currentStart + 9;
            finalSections.push({
              partNumber: roman,
              // title: `PART ${roman}: ${ref.passageTitle.toUpperCase()} (Items ${currentStart}–${currentEnd})`
              title: isFilipino
                ? `BAHAGI ${roman}: ${ref.passageTitle.toUpperCase()} (Mga Bilang ${currentStart}–${currentEnd})`
                : `PART ${roman}: ${ref.passageTitle.toUpperCase()} (Items ${currentStart}–${currentEnd})`,
              topic: ref.passageTitle,
              itemRange: isFilipino ? `Mga Bilang ${currentStart}–${currentEnd}` : `Items ${currentStart}–${currentEnd}`,
              startItem: currentStart,
              endItem: currentEnd,
              itemCount: 10,
              instructions: isFilipino
                ? `Panuto: Basahing mabuti ang seleksiyong "${ref.passageTitle}". Piliin ang titik ng tamang sagot at itiman ang kaukulang bilog sa iyong sagutang papel.`
                : `Directions: Read the selection "${ref.passageTitle}" carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.`,
              passageTitle: ref.passageTitle,
              passageText: ref.passageText,
              passageImage: ref.passageImage,
              referenceType: ref.referenceType,
            });

            for (let i = currentStart - 1; i < currentEnd && i < formattedQuestions.length; i++) {
              formattedQuestions[i].passageTitle = ref.passageTitle;
              formattedQuestions[i].passageText = ref.passageText;
              formattedQuestions[i].topic = ref.passageTitle;
              formattedQuestions[i].competencyCode = formattedQuestions[i].competencyCode || (isFilipino ? `FIL${gradeLevel}RC-Pagbasa` : `EN${gradeLevel}RC-Reading`);
            }
            currentStart = currentEnd + 1;
          });
        }
      } else if (requestedLetter) {
        const key = `selection-${requestedLetter.toLowerCase()}`;
        const ref = gradeRefs[key] || gradeRefs['selection-a'];
        finalSections.push({
          partNumber: 'I',
          title: `PART I: ${ref.passageTitle.toUpperCase()} (Items 1–${formattedQuestions.length})`,
          topic: ref.passageTitle,
          itemRange: `Items 1–${formattedQuestions.length}`,
          startItem: 1,
          endItem: formattedQuestions.length,
          itemCount: formattedQuestions.length,
          instructions: `Directions: Read the selection "${ref.passageTitle}" carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.`,
          passageTitle: ref.passageTitle,
          passageText: ref.passageText,
          passageImage: ref.passageImage,
          referenceType: ref.referenceType,
        });

        formattedQuestions.forEach((q) => {
          q.passageTitle = ref.passageTitle;
          q.passageText = ref.passageText;
          q.topic = ref.passageTitle;
          q.competencyCode = q.competencyCode || `EN${gradeLevel}RC-Reading`;
        });
      } else {
        Array.from(passageMap.entries()).forEach(([pTitle, pQuestions]) => {
          const startItem = itemNumberCursor;
          const endItem = startItem + pQuestions.length - 1;
          const partNumber = romanNumerals[partIdx] || String(partIdx + 1);
          const matchingPassage = finalPassages.find((p) => p.title === pTitle) || { text: pQuestions[0]?.passageText || '' };
          const refMeta = matchReferenceMaterial(
            pTitle,
            matchingPassage.text || pQuestions[0]?.passageText || '',
            { partIdx, isPhilIri: isPhilIriDoc, gradeLevel }
          );

          finalSections.push({
            partNumber,
            title: `PART ${partNumber}: ${(refMeta.passageTitle || pTitle).toUpperCase()} (Items ${startItem}–${endItem})`,
            topic: refMeta.passageTitle || pTitle,
            itemRange: startItem === endItem ? `Item ${startItem}` : `Items ${startItem}–${endItem}`,
            startItem,
            endItem,
            itemCount: pQuestions.length,
            instructions: `Directions: Read the selection "${refMeta.passageTitle || pTitle}" carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.`,
            passageTitle: refMeta.passageTitle || pTitle,
            passageText: refMeta.passageText || matchingPassage.text || '',
            passageImage: refMeta.passageImage || (matchingPassage as any)?.image || undefined,
            referenceType: refMeta.referenceType,
          });
          itemNumberCursor = endItem + 1;
          partIdx++;
        });
      }

      const answerLetters = formattedQuestions.map((q) => q.correctAnswer);
      const structuredAnswers = answerLetters.map((letter, i) => ({
        itemNumber: i + 1,
        correctKey: letter,
      }));

      const primaryPassage = finalPassages[0] || {};
      const passageTitle = finalPassages.length === 1
        ? primaryPassage.title || materialDoc.title
        : `${materialDoc.title} (${finalPassages.length} Reading Selections)`;
      const passageText = finalPassages.length === 1
        ? primaryPassage.text || ''
        : ''; // When multiple selections are present, each section displays its own passageText
      const topPassageImage = finalSections.find((s) => s.passageImage)?.passageImage || '';

      const selLetters = selectedIndices.map((i) => `Selection ${LETTERS[i]}`).join(', ');
      const localizedSelLetters = isFilipino ? selectedIndices.map((i) => `Sipi ${LETTERS[i]}`).join(', ') : selLetters;
      const autoTitle = selectedIndices.length === 1
        ? (isFilipino
          ? `DepEd Phil-IRI Pagtatasa sa Filipino: Baitang ${gradeLevel} - Sipi ${LETTERS[selectedIndices[0]]} (${formattedQuestions.length} Aytem)`
          : `DepEd Phil-IRI Reading Assessment: Grade ${gradeLevel} - Selection ${LETTERS[selectedIndices[0]]} (${formattedQuestions.length} Items)`)
        : selectedIndices.length < 4
        ? assessmentType === 'post-test'
          ? (isFilipino
            ? `DepEd Phil-IRI Panapos na Pagtatasa: Baitang ${gradeLevel} - ${localizedSelLetters} (${formattedQuestions.length} Aytem)`
            : `DepEd Phil-IRI Post-Test: Grade ${gradeLevel} - ${selLetters} (${formattedQuestions.length} Items)`)
          : (isFilipino
            ? `DepEd Phil-IRI Panimulang Pagtatasa: Baitang ${gradeLevel} - ${localizedSelLetters} (${formattedQuestions.length} Aytem)`
            : `DepEd Phil-IRI Pre-Test: Grade ${gradeLevel} - ${selLetters} (${formattedQuestions.length} Items)`)
        : requestedLetter
        ? (isFilipino
          ? `DepEd Phil-IRI Pagtatasa sa Filipino: Baitang ${gradeLevel} - Sipi ${requestedLetter} (${formattedQuestions.length} Aytem)`
          : `DepEd Phil-IRI Reading Assessment: Grade ${gradeLevel} - Selection ${requestedLetter} (${formattedQuestions.length} Items)`)
        : assessmentType === 'pre-test'
        ? (isFilipino
          ? `DepEd Phil-IRI Stage 1 Panimulang Pagtatasa sa Filipino: Baitang ${gradeLevel} (${formattedQuestions.length} Aytem)`
          : `DepEd Phil-IRI Stage 1 Group Screening Pre-Test: Grade ${gradeLevel} (${formattedQuestions.length} Items)`)
        : assessmentType === 'post-test'
        ? (isFilipino
          ? `DepEd Phil-IRI Panapos na Pagtatasa sa Filipino: Baitang ${gradeLevel} (${formattedQuestions.length} Aytem)`
          : `DepEd Phil-IRI Post-Test Reading Assessment: Grade ${gradeLevel} (${formattedQuestions.length} Items)`)
        : assessmentType === 'exam'
        ? (isFilipino
          ? `Pangkalahatang Pagsusulit sa Filipino: Baitang ${gradeLevel} (${formattedQuestions.length} Aytem)`
          : `Comprehensive Reading Exam: Grade ${gradeLevel} (${formattedQuestions.length} Items)`)
        : (isFilipino
          ? `Pagsusulit sa Filipino: ${passageTitle} (${formattedQuestions.length} Aytem)`
          : `Weekly Reading Assessment: ${passageTitle} (${formattedQuestions.length} Items)`);

      const title = typeof body?.title === 'string' && body.title.trim().length > 0
        ? body.title.trim()
        : autoTitle;

      const cleanType = assessmentType.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const answerKey = await AnswerKey.create({
        title,
        subject: isFilipino ? 'Filipino' : 'Reading',
        assessmentType,
        assessmentCategory: assessmentType,
        topic: passageTitle,
        topics: finalPassages.map((p) => p.title),
        teacherId: authUser.id,
        materialId: materialDoc._id,
        sourceMaterial: materialDoc.title,
        items: formattedQuestions.length,
        totalItems: formattedQuestions.length,
        examId: null,
        questionnaireId: `Q-READ-${cleanType}-${Date.now()}`,
        answers: answerLetters,
        structuredAnswers,
        answerLetters,
        modes: formattedQuestions.map((q) => q.mode),
        questions: formattedQuestions,
        sections: finalSections,
        passageTitle,
        passageText,
        passageImage: topPassageImage,
        targetGrade: gradeLevel,
        created: new Date(),
      });

      return NextResponse.json({
        success: true,
        data: {
          title,
          assessmentType,
          assessmentCategory: assessmentType,
          subject: isFilipino ? 'Filipino' : 'Reading',
          topic: passageTitle,
          topics: finalPassages.map((p) => p.title),
          materialId: String(materialDoc._id),
          sourceMaterial: materialDoc.title,
          gradeLevel,
          itemCount: formattedQuestions.length,
          writtenCount,
          questions: formattedQuestions,
          answers: answerLetters,
          bubbleSheetUrl: '/bubble-sheets/reading-bubble.pdf',
          passageTitle,
          passageText,
          passageImage: topPassageImage,
          passages: finalPassages,
          sections: finalSections,
          answerKey: {
            id: String(answerKey._id),
            title: answerKey.title,
            assessmentType: answerKey.assessmentType,
            assessmentCategory: answerKey.assessmentCategory || answerKey.assessmentType,
            subject: answerKey.subject,
            topic: answerKey.topic,
            topics: answerKey.topics,
            materialId: String(materialDoc._id),
            sourceMaterial: materialDoc.title,
            items: answerKey.items,
            totalItems: answerKey.totalItems,
            sections: finalSections,
            passageImage: topPassageImage,
          },
        },
      });
    }

    // 3. CURRICULUM BANK FALLBACK WORKFLOW (when no materialId is provided)
    let finalTopic = '';
    let finalTopicsList: string[] = [];
    let selectedQuestions: any[] = [];
    let passageTitle = '';
    let passageText = '';

    const passageId = body?.passageId;

    if (assessmentType === 'quiz') {
      if (requestedTopics.length === 0 && !passageId) {
        return NextResponse.json(
          { success: false, error: 'Please select 1 or 2 topics for this weekly quiz.' },
          { status: 400 }
        );
      }
      if (requestedTopics.length > 2) {
        return NextResponse.json(
          { success: false, error: 'A weekly quiz can only cover 1 or 2 topics. For all topics, choose "Comprehensive Exam".' },
          { status: 400 }
        );
      }

      if (requestedTopics.length > 0) {
        finalTopicsList = requestedTopics;
        finalTopic = requestedTopics.join(' & ');

        if (!allowRetake) {
          for (const t of requestedTopics) {
            const priorKey = await AnswerKey.findOne({
              teacherId: authUser.id,
              $or: [{ topic: t }, { topics: t }],
              assessmentType: 'quiz',
            }).select('title created').lean();

            if (priorKey) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Topic "${t}" was already assessed in a quiz. Check "Allow Retake" to create another quiz for this topic.`,
                  alreadyAssessed: true,
                },
                { status: 400 }
              );
            }
          }
        }

        const generalQuestions = await Question.find({
          subject: isFilipino ? 'Filipino' : 'Reading',
          topic: { $in: requestedTopics },
        }).lean();

        if (generalQuestions.length === 0) {
          return NextResponse.json({ success: false, error: `No questions found for topic(s) "${finalTopic}".` }, { status: 404 });
        }

        selectedQuestions = shuffle(generalQuestions).slice(0, targetCount);
        if (selectedQuestions.length < targetCount) {
          const needed = targetCount - selectedQuestions.length;
          selectedQuestions = [...selectedQuestions, ...shuffle(generalQuestions).slice(0, needed)];
        }
      } else if (passageId) {
        const passage = await ReadingPassage.findById(passageId).lean();
        if (!passage) {
          return NextResponse.json({ success: false, error: 'Reading passage not found.' }, { status: 404 });
        }
        finalTopic = (passage as any).title || (isFilipino ? 'Pag-unawa sa Binasa' : 'Reading Comprehension');
        finalTopicsList = [finalTopic];
        passageTitle = (passage as any).title || '';
        passageText = (passage as any).text || (passage as any).content || '';
        const embedded = Array.isArray(passage.questions) ? passage.questions : [];
        const passageQuestions = embedded.map((q: any) => {
          const choices = Array.isArray(q.options) && q.options.length ? q.options : [];
          const ansIdx = choices.indexOf(q.answer);
          const letter = ansIdx >= 0 ? LETTERS[ansIdx] : (['A', 'B', 'C', 'D'].includes(q.answer) ? q.answer : 'A');
          return {
            prompt: q.question || q.prompt,
            choices,
            correctAnswer: letter,
            difficulty: 'mid',
            competencyCode: isFilipino ? 'FIL-RC' : 'EN-RC',
            competency: isFilipino ? 'Pag-unawa sa Binasa' : 'Reading Comprehension',
            topic: passage.title || '',
          };
        });
        selectedQuestions = passageQuestions.slice(0, targetCount);
      }
    } else {
      // Exam / Pre-Test / Post-Test whole bank fallback
      let allDistinct = await Question.distinct('topic', { subject: isFilipino ? 'Filipino' : 'Reading' });
      if (allDistinct.length === 0 && isFilipino) {
        allDistinct = await Question.distinct('topic', { subject: 'Reading' });
      }
      const allTopics = allDistinct
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .sort((a, b) => a.localeCompare(b));

      finalTopic = isFilipino ? 'Kurikulum sa Pag-unawa sa Binasa' : 'Reading Comprehension Curriculum';
      finalTopicsList = allTopics.length > 0 ? allTopics : [isFilipino ? 'Pag-unawa sa Binasa' : 'Reading Comprehension'];

      let allQuestions = await Question.find({ subject: isFilipino ? 'Filipino' : 'Reading' }).lean();
      if (allQuestions.length === 0 && isFilipino) {
        allQuestions = await Question.find({ subject: 'Reading' }).lean();
      }
      if (allQuestions.length === 0) {
        return NextResponse.json({ success: false, error: 'No reading questions found in curriculum bank.' }, { status: 404 });
      }

      selectedQuestions = shuffle(allQuestions).slice(0, targetCount);
    }

    const itemCount = selectedQuestions.length;
    const questions = selectedQuestions.map((q, i) => {
      const mode = (i >= itemCount - writtenCount ? 'written' : 'mc') as 'mc' | 'written';
      const rawChoices = Array.isArray(q.choices) ? q.choices : [];
      const rawAns = q.correctAnswer || 'A';
      let finalChoices = rawChoices;
      let finalAns = rawAns;
      if (mode === 'mc' && rawChoices.length > 0) {
        const { shuffledChoices, newCorrectAnswer } = shuffleChoices(rawChoices, rawAns);
        finalChoices = shuffledChoices;
        finalAns = newCorrectAnswer;
      }
      return {
        number: i + 1,
        id: `q${i + 1}`,
        prompt: q.prompt,
        choices: finalChoices,
        correctAnswer: finalAns,
        mode,
        difficulty: q.difficulty === 'easy' ? 'Easy' : q.difficulty === 'hard' ? 'Hard' : 'Average',
        competencyCode: q.competencyCode || 'EN7RC-ARAL',
        competency: q.competency || q.topic || finalTopic,
        topic: q.topic || finalTopic,
      };
    });

    const answerLetters = questions.map((q) => q.correctAnswer);
    const structuredAnswers = answerLetters.map((letter, i) => ({
      itemNumber: i + 1,
      correctKey: letter,
    }));

    const autoTitle = assessmentType === 'pre-test'
      ? `ARAL Baseline Diagnostic Pre-Test: Reading (${itemCount} items)`
      : assessmentType === 'post-test'
      ? `ARAL Endline Evaluation Post-Test: Reading (${itemCount} items)`
      : assessmentType === 'exam'
      ? `Comprehensive Exam: Reading (${itemCount} items)`
      : `Weekly Quiz: ${finalTopic} (${itemCount} items)`;

    const title = typeof body?.title === 'string' && body.title.trim().length > 0
      ? body.title.trim()
      : autoTitle;

    const cleanType = assessmentType.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let fallbackSections: QuestionnaireSection[] = [];
    if (
      (itemCount === 40 || selectedIndices.length > 0) &&
      (assessmentType === 'pre-test' ||
        assessmentType === 'post-test' ||
        /phil[-_]?iri|screening|reading|gst/i.test(title))
    ) {
      const gRefs = PHIL_IRI_REFERENCES_BY_GRADE[gradeLevel] || PHIL_IRI_REFERENCES_BY_GRADE[7];
      const partsMeta = [
        { ref: gRefs['selection-a'] || PHIL_IRI_G7_REFERENCES['selection-a'], start: 1, end: 10, part: 'I' },
        { ref: gRefs['selection-b'] || PHIL_IRI_G7_REFERENCES['selection-b'], start: 11, end: 20, part: 'II' },
        { ref: gRefs['selection-c'] || PHIL_IRI_G7_REFERENCES['selection-c'], start: 21, end: 30, part: 'III' },
        { ref: gRefs['selection-d'] || PHIL_IRI_G7_REFERENCES['selection-d'], start: 31, end: 40, part: 'IV' },
      ];
      if (selectedIndices.length < 4 && selectedIndices.length > 0) {
        let curStart = 1;
        fallbackSections = selectedIndices.map((sIdx, pNum) => {
          const letter = LETTERS[sIdx];
          const ref = gRefs[`selection-${letter.toLowerCase()}`] || partsMeta[sIdx]?.ref || partsMeta[0].ref;
          const roman = ['I', 'II', 'III', 'IV'][pNum] || String(pNum + 1);
          const curEnd = curStart + 9;
          const sec = {
            partNumber: roman,
            title: isFilipino
              ? `BAHAGI ${roman}: ${ref.passageTitle.toUpperCase()} (Mga Bilang ${curStart}–${curEnd})`
              : `PART ${roman}: ${ref.passageTitle.toUpperCase()} (Items ${curStart}–${curEnd})`,
            topic: ref.passageTitle,
            itemRange: isFilipino ? `Mga Bilang ${curStart}–${curEnd}` : `Items ${curStart}–${curEnd}`,
            startItem: curStart,
            endItem: curEnd,
            itemCount: 10,
            instructions: isFilipino
              ? `Panuto: Basahing mabuti ang seleksiyong "${ref.passageTitle}". Piliin ang titik ng tamang sagot at itiman ang kaukulang bilog sa iyong sagutang papel.`
              : `Directions: Read the selection "${ref.passageTitle}" carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.`,
            passageTitle: ref.passageTitle,
            passageText: ref.passageText,
            passageImage: ref.passageImage,
            referenceType: ref.referenceType,
          };
          curStart = curEnd + 1;
          return sec;
        });
      } else {
        fallbackSections = partsMeta.map(({ ref, start, end, part }) => ({
          partNumber: part,
          title: isFilipino
            ? `BAHAGI ${part}: ${ref.passageTitle.toUpperCase()} (Mga Bilang ${start}–${end})`
            : `PART ${part}: ${ref.passageTitle.toUpperCase()} (Items ${start}–${end})`,
          topic: ref.passageTitle,
          itemRange: isFilipino ? `Mga Bilang ${start}–${end}` : `Items ${start}–${end}`,
          startItem: start,
          endItem: end,
          itemCount: 10,
          instructions: isFilipino
            ? `Panuto: Basahing mabuti ang seleksiyong "${ref.passageTitle}". Piliin ang titik ng tamang sagot at itiman ang kaukulang bilog sa iyong sagutang papel.`
            : `Directions: Read the selection "${ref.passageTitle}" carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.`,
          passageTitle: ref.passageTitle,
          passageText: ref.passageText,
          passageImage: ref.passageImage,
          referenceType: ref.referenceType,
        }));
      }
    } else {
      fallbackSections = [
        {
          partNumber: 'I',
          title: isFilipino
            ? `BAHAGI I: ${finalTopic.toUpperCase()} (Mga Bilang 1–${itemCount})`
            : `PART I: ${finalTopic.toUpperCase()} (Items 1–${itemCount})`,
          topic: finalTopic,
          itemRange: itemCount === 1 ? (isFilipino ? 'Bilang 1' : 'Item 1') : (isFilipino ? `Mga Bilang 1–${itemCount}` : `Items 1–${itemCount}`),
          startItem: 1,
          endItem: itemCount,
          itemCount,
          instructions: passageText
            ? (isFilipino
              ? `Panuto: Basahing mabuti ang "${passageTitle || finalTopic}". Piliin ang titik ng tamang sagot at itiman ang kaukulang bilog sa iyong sagutang papel.`
              : `Directions: Read "${passageTitle || finalTopic}" carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.`)
            : (isFilipino
              ? 'Panuto: Basahing mabuti ang bawat tanong. Piliin ang titik ng tamang sagot at itiman ang kaukulang bilog sa iyong sagutang papel.'
              : 'Directions: Read each question carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.'),
          passageTitle: passageTitle || finalTopic,
          passageText: passageText || '',
          referenceType: passageText ? 'article' : undefined,
        },
      ];
    }

    const answerKey = await AnswerKey.create({
      title,
      subject: isFilipino ? 'Filipino' : 'Reading',
      assessmentType,
      assessmentCategory: assessmentType,
      topic: finalTopic,
      topics: finalTopicsList,
      teacherId: authUser.id,
      items: itemCount,
      totalItems: itemCount,
      examId: null,
      questionnaireId: `Q-${cleanType}-${Date.now()}`,
      answers: answerLetters,
      structuredAnswers,
      answerLetters,
      modes: questions.map((q) => q.mode),
      questions,
      sections: fallbackSections,
      passageTitle,
      passageText,
      created: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        title,
        assessmentType,
        assessmentCategory: assessmentType,
        subject: isFilipino ? 'Filipino' : 'Reading',
        topic: finalTopic,
        topics: finalTopicsList,
        gradeLevel,
        itemCount,
        writtenCount,
        questions,
        answers: answerLetters,
        bubbleSheetUrl: '/bubble-sheets/reading-bubble.pdf',
        passageTitle,
        passageText,
        sections: fallbackSections,
        answerKey: {
          id: String(answerKey._id),
          title: answerKey.title,
          assessmentType: answerKey.assessmentType,
          assessmentCategory: answerKey.assessmentCategory || answerKey.assessmentType,
          subject: answerKey.subject,
          topic: answerKey.topic,
          topics: answerKey.topics,
          items: answerKey.items,
          totalItems: answerKey.totalItems,
          sections: fallbackSections,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Generate Reading Questionnaire Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

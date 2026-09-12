import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../database/db';
import ReadingPassage from '../../../../../../models/ReadingPassage';
import AnswerKey from '../../../../../../models/AnswerKey';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'it', 'at', 'by', 'for', 'with', 'as', 'that',
  'this', 'these', 'those', 'they', 'them', 'we', 'you', 'he', 'she', 'his',
  'her', 'their', 'there', 'have', 'has', 'had', 'from', 'about', 'into', 'over',
  'can', 'will', 'would', 'do', 'does', 'did', 'but', 'so', 'not', 'also', 'such',
  'its', 'than', 'then', 'when', 'where', 'what', 'which', 'who', 'some', 'each',
  'every', 'while', 'because', 'out', 'up', 'down', 'off', 'how', 'why', 'very',
]);

/** Deterministic question generator that writes MCQs grounded in the passage text. */
function generateFromText(text: string, count: number): {
  prompt: string;
  choices: string[];
  answerLetter: string;
}[] {
  // Split into sentences, keep usable-length ones.
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      const n = words(s).length;
      return n >= 4 && n <= 20;
    });

  // Build a vocabulary of meaningful (non-stopword) tokens, keeping original casing.
  const seen = new Set<string>();
  const vocab: string[] = [];
  for (const tok of text.replace(/[^a-zA-Z0-9'\s]/g, ' ').split(/\s+/)) {
    const lw = tok.toLowerCase();
    if (STOPWORDS.has(lw) || lw.length < 4 || seen.has(lw)) continue;
    seen.add(lw);
    vocab.push(tok);
  }
  if (vocab.length < 4) return [];

  const generated: { prompt: string; choices: string[]; answerLetter: string }[] = [];

  for (const s of sentences) {
    if (generated.length >= count) break;
    const sWords = s.split(/\s+/).filter(Boolean);
    // Pick a content word to blank (prefer a mid-sentence meaningful word).
    let idx = -1;
    for (let i = 1; i < sWords.length - 1; i++) {
      const lw = sWords[i].toLowerCase().replace(/[^a-z0-9']/g, '');
      if (lw.length >= 4 && !STOPWORDS.has(lw)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) continue;

    const target = sWords[idx];
    const targetLw = target.toLowerCase().replace(/[^a-z0-9']/g, '');
    const distractors = shuffle(vocab.filter((v) => v.toLowerCase() !== targetLw)).slice(0, 3);
    if (distractors.length < 3) continue;

    const shown = sWords.map((w, i) => (i === idx ? '________' : w)).join(' ');
    const choices = shuffle([target, ...distractors]);
    const answerIndex = choices.findIndex((c) => c.toLowerCase() === targetLw);
    generated.push({
      prompt: `According to the passage, “${shown}”.`,
      choices,
      answerLetter: LETTERS[answerIndex],
    });
  }

  return generated;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * POST /api/teacher/questionnaire/generate-reading
 * Builds a Reading-Comprehension questionnaire from a selected passage/module
 * (body: { passageId, count? }), so teachers can administer the comprehension
 * check as an OMR exam (print questionnaire + bubble sheet, then scan).
 *
 * Question source:
 *   1. The passage's embedded comprehension questions when present.
 *   2. Otherwise, cloze-style MCQs generated deterministically from the text.
 * An AnswerKey (subject "Reading") is saved in both cases.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const passageId = body?.passageId;
    const count = Math.min(30, Math.max(1, Number(body?.count) || 5));

    if (!passageId) {
      return NextResponse.json(
        { success: false, error: 'passageId is required.' },
        { status: 400 }
      );
    }

    const passage = await ReadingPassage.findById(passageId).lean();
    if (!passage) {
      return NextResponse.json(
        { success: false, error: 'Reading passage not found.' },
        { status: 404 }
      );
    }

    const text = passage.text || '';
    const embedded = Array.isArray(passage.questions) ? passage.questions : [];
    const want = Math.min(count, Math.max(10, embedded.length || 10));

    /* Assemble questions (number-parallel arrays) */
    const questions: {
      number: number;
      id: string;
      prompt: string;
      choices: string[];
      mode: 'mc' | 'written';
      difficulty: string;
      competencyCode: string;
      competency: string;
      topic: string;
    }[] = [];
    const answerLetters: string[] = [];

    if (embedded.length > 0) {
      embedded.slice(0, want).forEach((q: any, i: number) => {
        const choices = Array.isArray(q.options) && q.options.length ? q.options : [];
        const ansIdx = choices.indexOf(q.answer);
        const letter = ansIdx >= 0 ? LETTERS[ansIdx] : 'A';
        questions.push({
          number: i + 1,
          id: `p${i}`,
          prompt: q.question || '',
          choices,
          mode: 'mc',
          difficulty: 'Average',
          competencyCode: 'Reading Comprehension',
          competency: 'Comprehension',
          topic: passage.title || '',
        });
        answerLetters.push(letter);
      });
    } else if (text) {
      const generated = generateFromText(text, want);
      generated.forEach((g, i) => {
        questions.push({
          number: i + 1,
          id: `g${i}`,
          prompt: g.prompt,
          choices: g.choices,
          mode: 'mc',
          difficulty: 'Average',
          competencyCode: 'Reading Comprehension',
          competency: 'Comprehension',
          topic: passage.title || '',
        });
        answerLetters.push(g.answerLetter);
      });
    }

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'This passage has no comprehension questions and is too short to generate them. Provide a longer module.',
        },
        { status: 422 }
      );
    }

    const itemCount = questions.length;
    const title = `${passage.title} — Reading Comprehension Exam (${itemCount} items)`;

    const answerKey = await AnswerKey.create({
      title,
      subject: 'Reading',
      items: itemCount,
      answers: answerLetters,
      created: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        title,
        subject: 'Reading',
        gradeLevel: passage.gradeLevel || 7,
        itemCount,
        passageTitle: passage.title,
        writtenCount: 0,
        questions,
        answers: answerLetters,
        answerKey: {
          id: String(answerKey._id),
          title: answerKey.title,
          subject: answerKey.subject,
          items: answerKey.items,
        },
      },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e);
    console.error('Generate Reading Questionnaire Error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
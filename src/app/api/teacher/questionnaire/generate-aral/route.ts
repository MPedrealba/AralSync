import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../database/db';
import ReadingPassage from '../../../../../../models/ReadingPassage';
import AnswerKey from '../../../../../../models/AnswerKey';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';

const LETTERS = ['A', 'B', 'C', 'D'];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'it', 'at', 'by', 'for', 'with', 'as', 'that',
  'this', 'these', 'those', 'they', 'them', 'we', 'you', 'he', 'she', 'his',
  'her', 'their', 'there', 'have', 'has', 'had', 'from', 'about', 'into', 'over',
  'can', 'will', 'would', 'do', 'does', 'did', 'but', 'so', 'not', 'also', 'such',
  'its', 'than', 'then', 'when', 'where', 'what', 'which', 'who', 'some', 'each',
  'every', 'while', 'because', 'out', 'up', 'down', 'off', 'how', 'why', 'very',
]);

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-zA-Z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateFromText(text: string, count: number): {
  prompt: string;
  choices: string[];
  answerLetter: string;
}[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      const n = words(s).length;
      return n >= 5 && n <= 24;
    });

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
      prompt: `Based on the ARAL passage, complete the statement: “${shown}”.`,
      choices,
      answerLetter: LETTERS[answerIndex] || 'A',
    });
  }

  return generated;
}

/**
 * POST /api/teacher/questionnaire/generate-aral
 * Builds a standardized OMR assessment questionnaire directly grounded in the
 * official DepEd ARAL Program learning materials and reading selections.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const passageId = body?.passageId;
    const requestedCount = Math.min(30, Math.max(5, Number(body?.count) || 10));
    const writtenCount = Math.max(0, Math.min(requestedCount, Number(body?.writtenCount) || 0));

    let passage: any = null;
    if (passageId) {
      passage = await ReadingPassage.findById(passageId).lean();
    }
    if (!passage) {
      // Find the first available ARAL passage
      passage = await ReadingPassage.findOne({ title: /^ARAL/ }).lean();
    }

    if (!passage) {
      return NextResponse.json(
        { success: false, error: 'No ARAL reading passage found. Please seed ARAL materials first.' },
        { status: 404 }
      );
    }

    const text = passage.text || '';
    const embedded = Array.isArray(passage.questions) ? passage.questions : [];

    const rawItems: {
      prompt: string;
      choices: string[];
      answerLetter: string;
      topic: string;
      competency: string;
    }[] = [];

    // 1. Add authentic embedded comprehension questions from the ARAL material
    embedded.forEach((q: any) => {
      const choices = Array.isArray(q.options) && q.options.length === 4 ? q.options : (q.options || []);
      const ansIdx = choices.indexOf(q.answer);
      const letter = ansIdx >= 0 ? LETTERS[ansIdx] : 'A';
      rawItems.push({
        prompt: q.question,
        choices,
        answerLetter: letter,
        topic: passage.title,
        competency: 'ARAL Reading Comprehension',
      });
    });

    // 2. If more items are needed, generate cloze/context items from the passage text
    if (rawItems.length < requestedCount && text) {
      const needed = requestedCount - rawItems.length;
      const extra = generateFromText(text, needed);
      extra.forEach((g) => {
        rawItems.push({
          prompt: g.prompt,
          choices: g.choices,
          answerLetter: g.answerLetter,
          topic: passage.title,
          competency: 'ARAL Vocabulary & Context Analysis',
        });
      });
    }

    const picked = rawItems.slice(0, requestedCount);
    if (picked.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate questions from the selected ARAL material.' },
        { status: 422 }
      );
    }

    const itemCount = picked.length;
    // Last writtenCount items become written if teacher requested hybrid grading
    const modes: ('mc' | 'written')[] = picked.map((_, i) =>
      i >= itemCount - writtenCount ? 'written' : 'mc'
    );

    const questions = picked.map((item, i) => ({
      number: i + 1,
      id: `aral-${i + 1}`,
      prompt: item.prompt,
      choices: modes[i] === 'written' ? [] : item.choices,
      mode: modes[i],
      difficulty: i < itemCount * 0.4 ? 'Easy' : i < itemCount * 0.8 ? 'Average' : 'Hard',
      competencyCode: 'ARAL-RECOVERY',
      competency: item.competency,
      topic: item.topic,
    }));

    const answerLetters = picked.map((item) => item.answerLetter);

    const writtenItems = questions
      .filter((q) => q.mode === 'written')
      .map((q) => ({
        index: q.number - 1,
        prompt: q.prompt,
        max: 2,
      }));

    const title = `${passage.title} — OMR Recovery Assessment (${itemCount} items)`;

    const answerKey = await AnswerKey.create({
      title,
      subject: 'Reading',
      items: itemCount,
      answers: answerLetters,
      modes,
      writtenItems,
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
        passageText: passage.text,
        writtenCount,
        questions,
        answers: answerLetters,
        modes,
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
    console.error('Generate ARAL Questionnaire Error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

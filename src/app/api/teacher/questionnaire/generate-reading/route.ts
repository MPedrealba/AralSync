import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../database/db';
import Question from '../../../../../../models/Question';
import ReadingPassage from '../../../../../../models/ReadingPassage';
import AnswerKey from '../../../../../../models/AnswerKey';
import User from '../../../../../../models/User';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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
 * Generates an authentic OMR assessment questionnaire directly from the DepEd ARAL
 * learning material Question Bank, organized strictly by topic/competency.
 * 
 * NO OpenAI is used; all items are grounded in the official workbooks.
 * Checks per-teacher topic reuse and honors the "allowRetake" flag.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const assessmentType: 'quiz' | 'exam' = body?.assessmentType === 'exam' ? 'exam' : 'quiz';

    // Parse topics (supports array of 1-2 topics or single topic)
    let requestedTopics: string[] = [];
    if (Array.isArray(body?.topics)) {
      requestedTopics = body.topics.filter((t: any) => typeof t === 'string' && t.trim().length > 0);
    } else if (body?.topic && typeof body.topic === 'string' && body.topic.trim()) {
      requestedTopics = [body.topic.trim()];
    }

    const passageId = body?.passageId;
    const targetCount = Math.min(50, Math.max(5, Number(body?.count) || (assessmentType === 'exam' ? 50 : 10)));
    const writtenCount = Math.max(0, Math.min(targetCount, Number(body?.writtenCount) || 0));
    const allowRetake = Boolean(body?.allowRetake);

    // 1. Check teacher's assigned subject
    const user = await User.findById(authUser.userId).select('assignedSubject specialization').lean();
    const assignedSubject = (user as any)?.assignedSubject;
    if (assignedSubject && assignedSubject !== 'Reading' && assignedSubject !== 'All') {
      return NextResponse.json(
        {
          success: false,
          error: `You are assigned to ${assignedSubject}. You can only generate assessments for your assigned subject.`,
        },
        { status: 403 }
      );
    }

    let finalTopic = '';
    let finalTopicsList: string[] = [];
    let selectedQuestions: any[] = [];
    let passageTitle = '';
    let passageText = '';

    // 2. Generate according to assessment type
    if (assessmentType === 'quiz') {
      // ──── QUIZ MODE: Formative weekly assessment (1 or 2 topics only) ────
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

        // Check if teacher already assessed these topics
        if (!allowRetake) {
          for (const t of requestedTopics) {
            const priorKey = await AnswerKey.findOne({
              teacherId: authUser.userId,
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

        if (requestedTopics.length === 1) {
          const t = requestedTopics[0];
          const topicQuestions = await Question.find({ subject: 'Reading', topic: t }).lean();
          if (topicQuestions.length === 0) {
            return NextResponse.json({ success: false, error: `No questions found in learning materials for topic "${t}".` }, { status: 404 });
          }
          if (topicQuestions.length >= targetCount) {
            selectedQuestions = shuffle(topicQuestions).slice(0, targetCount);
          } else {
            const needed = targetCount - topicQuestions.length;
            const otherQuestions = await Question.find({ subject: 'Reading', topic: { $ne: t } }).lean();
            selectedQuestions = [...topicQuestions, ...shuffle(otherQuestions).slice(0, needed)];
          }
        } else {
          // Exactly 2 topics: split items evenly between them
          const half = Math.floor(targetCount / 2);
          const remainder = targetCount - half;

          const q1 = await Question.find({ subject: 'Reading', topic: requestedTopics[0] }).lean();
          const q2 = await Question.find({ subject: 'Reading', topic: requestedTopics[1] }).lean();

          if (q1.length === 0 && q2.length === 0) {
            return NextResponse.json({ success: false, error: 'No questions found for the selected topics.' }, { status: 404 });
          }

          let set1 = shuffle(q1).slice(0, half);
          let set2 = shuffle(q2).slice(0, remainder);

          if (set1.length < half) {
            const extra = shuffle(q2.filter((q) => !set2.some((s) => String(s._id) === String(q._id)))).slice(0, half - set1.length);
            set2 = [...set2, ...extra];
          } else if (set2.length < remainder) {
            const extra = shuffle(q1.filter((q) => !set1.some((s) => String(s._id) === String(q._id)))).slice(0, remainder - set2.length);
            set1 = [...set1, ...extra];
          }

          selectedQuestions = shuffle([...set1, ...set2]);
        }
      } else if (passageId) {
        // Fallback: Passage-based quiz
        const passage = await ReadingPassage.findById(passageId).lean();
        if (!passage) {
          return NextResponse.json({ success: false, error: 'Reading passage not found.' }, { status: 404 });
        }
        finalTopic = (passage as any).title || 'Reading Comprehension';
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
            competencyCode: 'EN-RC',
            competency: 'Reading Comprehension',
            topic: passage.title || '',
          };
        });
        if (passageQuestions.length >= targetCount) {
          selectedQuestions = passageQuestions.slice(0, targetCount);
        } else {
          const needed = targetCount - passageQuestions.length;
          const supplemental = await Question.find({ subject: 'Reading' }).limit(needed).lean();
          selectedQuestions = [...passageQuestions, ...supplemental];
        }
      }
    } else {
      // ──── COMPREHENSIVE EXAM MODE: Covers the WHOLE set of topics ────
      const allDistinct = await Question.distinct('topic', { subject: 'Reading' });
      const allTopics = allDistinct
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .sort((a, b) => a.localeCompare(b));

      if (allTopics.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No curriculum topics found in learning materials for exam generation.' },
          { status: 404 }
        );
      }

      finalTopic = 'Whole Curriculum';
      finalTopicsList = allTopics;

      // Balanced distribution: evenly allocate questions across every single topic
      const numTopics = allTopics.length;
      const basePerTopic = Math.floor(targetCount / numTopics);
      const remainder = targetCount % numTopics;

      const questionsByTopic: Record<string, any[]> = {};
      for (const t of allTopics) {
        questionsByTopic[t] = await Question.find({ subject: 'Reading', topic: t }).lean();
      }

      let examPool: any[] = [];
      allTopics.forEach((t, idx) => {
        const quota = basePerTopic + (idx < remainder ? 1 : 0);
        const avail = shuffle(questionsByTopic[t] || []);
        examPool.push(...avail.slice(0, quota));
      });

      // If any topic had fewer questions than its quota, fill remainder from surplus pool
      if (examPool.length < targetCount) {
        const usedIds = new Set(examPool.map((q) => String(q._id)));
        const surplus: any[] = [];
        for (const t of allTopics) {
          const unused = (questionsByTopic[t] || []).filter((q: any) => !usedIds.has(String(q._id)));
          surplus.push(...unused);
        }
        examPool.push(...shuffle(surplus).slice(0, targetCount - examPool.length));
      }

      selectedQuestions = shuffle(examPool);
    }

    if (selectedQuestions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not assemble questions for the requested assessment.' },
        { status: 422 }
      );
    }

    const itemCount = selectedQuestions.length;
    const questions = selectedQuestions.map((q, i) => ({
      number: i + 1,
      id: `q${i + 1}`,
      prompt: q.prompt,
      choices: q.choices || [],
      mode: (i >= itemCount - writtenCount ? 'written' : 'mc') as 'mc' | 'written',
      difficulty: q.difficulty === 'easy' ? 'Easy' : q.difficulty === 'hard' ? 'Hard' : 'Average',
      competencyCode: q.competencyCode || 'EN7RC-ARAL',
      competency: q.competency || q.topic || finalTopic,
      topic: q.topic || finalTopic,
    }));

    const answerLetters = selectedQuestions.map((q) => q.correctAnswer || 'A');
    const structuredAnswers = answerLetters.map((letter, i) => ({
      itemNumber: i + 1,
      correctKey: letter,
    }));

    const autoTitle =
      assessmentType === 'exam'
        ? `Comprehensive Exam: Reading (${itemCount} items • Whole Curriculum)`
        : (finalTopicsList.length > 1
            ? `Weekly Quiz: ${finalTopicsList.join(' & ')} (${itemCount} items)`
            : `Weekly Quiz: ${finalTopic} (${itemCount} items)`);
    const title =
      typeof body?.title === 'string' && body.title.trim().length > 0
        ? body.title.trim()
        : autoTitle;

    // Save official AnswerKey linked to this teacher and assessment category
    const answerKey = await AnswerKey.create({
      title,
      subject: 'Reading',
      assessmentType,
      topic: finalTopic,
      topics: finalTopicsList,
      teacherId: authUser.userId,
      items: itemCount,
      totalItems: itemCount,
      examId: null,
      questionnaireId: `Q-${assessmentType.toUpperCase()}-${Date.now()}`,
      answers: answerLetters,
      structuredAnswers,
      answerLetters,
      modes: questions.map((q) => q.mode),
      questions,
      passageTitle,
      passageText,
      created: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        title,
        assessmentType,
        subject: 'Reading',
        topic: finalTopic,
        topics: finalTopicsList,
        gradeLevel: 7,
        itemCount,
        writtenCount,
        questions,
        answers: answerLetters,
        bubbleSheetUrl: '/bubble-sheets/reading-bubble.pdf',
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
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Generate Reading Questionnaire Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
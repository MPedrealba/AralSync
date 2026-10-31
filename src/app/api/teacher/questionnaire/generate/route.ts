import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../../../database/db";
import Question from "../../../../../../models/Question";
import LearningMaterial from "../../../../../../models/LearningMaterial";
import AnswerKey from "../../../../../../models/AnswerKey";
import { requireAuth, authErrorResponse } from "@/lib/auth";
import { buildTopicSections, getTopicInstructions, ROMAN_NUMERALS } from "@/lib/questionnaireSections";

const SUBJECTS = ["Math", "Science"];

const difficultyLabel = (d: string) =>
  d === "easy" ? "Easy" : d === "hard" ? "Hard" : "Average";

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
 * POST /api/teacher/questionnaire/generate
 * Auto-builds an OMR questionnaire from the DepEd-aligned Question Bank and
 * saves the matching Answer Key.
 *
 * Body: { subject, grade, count?, topic?, writtenCount? }
 *   count         — total items requested (default 50, max 50)
 *   writtenCount  — how many of those items to mark as "written" (teacher-graded)
 *                   must be ≤ count; remaining items are MC (auto-graded)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const body = await req.json();
    const subject = body?.subject;
    const gradeLevel = Number(body?.grade);
    const count = Math.min(50, Math.max(1, Number(body?.count) || 50));
    const writtenCount = Math.max(0, Math.min(count, Number(body?.writtenCount) || 0));
    const requestedTopics: string[] = Array.isArray(body?.topics)
      ? body.topics.filter((t: any) => typeof t === "string" && t.trim().length > 0)
      : (body?.topic && typeof body.topic === "string" && body.topic.trim() ? [body.topic.trim()] : []);
    const materialId = body?.materialId;
    let materialDoc: any = null;
    if (materialId) {
      materialDoc = await LearningMaterial.findById(materialId).lean();
    }

    if (!SUBJECTS.includes(subject) || !gradeLevel) {
      return NextResponse.json(
        { success: false, error: "Subject and grade level are required." },
        { status: 400 }
      );
    }

    const filter: Record<string, unknown> = { subject, gradeLevel };
    if (requestedTopics.length > 0) {
      filter.$or = [
        { topic: { $in: requestedTopics } },
        { competency: { $in: requestedTopics } },
      ];
    }

    let pool: any[] = [];
    if (materialId) {
      const materialFilter: Record<string, unknown> = {
        subject,
        gradeLevel,
        $or: [
          { materialId },
          ...(materialDoc?.title ? [{ sourceMaterial: materialDoc.title }] : []),
          ...(materialDoc?.title ? [{ source: new RegExp(materialDoc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] : []),
        ],
      };
      if (requestedTopics.length > 0) {
        materialFilter.$and = [
          {
            $or: [
              { topic: { $in: requestedTopics } },
              { competency: { $in: requestedTopics } },
            ],
          },
        ];
      }
      pool = await Question.find(materialFilter).lean();
    }

    if (pool.length < count) {
      const generalPool = await Question.find(filter).lean();
      const existingIds = new Set(pool.map((q) => String(q._id)));
      pool = [...pool, ...generalPool.filter((q) => !existingIds.has(String(q._id)))];
    }
    if (pool.length === 0) {
      const topicDesc = requestedTopics.length > 0
        ? ` matching selected topic(s) (${requestedTopics.slice(0, 3).join(", ")}${requestedTopics.length > 3 ? "..." : ""})`
        : "";
      return NextResponse.json(
        { success: false, error: `No questions in the bank for ${subject} Grade ${gradeLevel}${topicDesc}. Try another grade or select more topics.` },
        { status: 404 }
      );
    }

    if (pool.length < count) {
      return NextResponse.json(
        { success: false, error: `Only ${pool.length} questions available for ${subject} Grade ${gradeLevel}. Requested ${count}. Reduce the count or broaden your topic filter.` },
        { status: 400 }
      );
    }

    // ── Topic-Grouped Sampling & Continuous Numbering ──
    const getQuestionTopic = (q: any): string => {
      if (typeof q.topic === "string" && q.topic.trim().length > 0) {
        return q.topic.trim();
      }
      if (typeof q.competency === "string" && q.competency.trim().length > 0) {
        return q.competency.trim();
      }
      return "General Curriculum";
    };

    // Partition pool into buckets by topic
    const poolByTopic = new Map<string, any[]>();
    for (const q of pool) {
      const t = getQuestionTopic(q);
      if (!poolByTopic.has(t)) {
        poolByTopic.set(t, []);
      }
      poolByTopic.get(t)!.push(q);
    }

    // Determine ordered topic sequence:
    // If specific topics were requested, preserve that order; otherwise alphabetical
    let orderedTopics: string[];
    if (requestedTopics.length > 0) {
      const requestedSet = new Set<string>();
      orderedTopics = [];
      for (const t of requestedTopics) {
        if (poolByTopic.has(t) && !requestedSet.has(t)) {
          orderedTopics.push(t);
          requestedSet.add(t);
        }
      }
      for (const t of poolByTopic.keys()) {
        if (!requestedSet.has(t)) {
          orderedTopics.push(t);
          requestedSet.add(t);
        }
      }
    } else {
      orderedTopics = Array.from(poolByTopic.keys()).sort((a, b) => a.localeCompare(b));
    }

    // Allocate question counts across topics evenly using round-robin
    const availableCounts = new Map<string, number>();
    const topicAllocations = new Map<string, number>();
    for (const t of orderedTopics) {
      availableCounts.set(t, poolByTopic.get(t)?.length || 0);
      topicAllocations.set(t, 0);
    }

    let allocated = 0;
    let progress = true;
    while (allocated < count && progress) {
      progress = false;
      for (const t of orderedTopics) {
        if (allocated >= count) break;
        const current = topicAllocations.get(t) || 0;
        const maxAvail = availableCounts.get(t) || 0;
        if (current < maxAvail) {
          topicAllocations.set(t, current + 1);
          allocated++;
          progress = true;
        }
      }
    }

    // Pick questions topic by topic with difficulty balance
    const groupedQuestions: { topic: string; questions: any[] }[] = [];

    for (const t of orderedTopics) {
      const needed = topicAllocations.get(t) || 0;
      if (needed <= 0) continue;

      const topicPool = poolByTopic.get(t) || [];
      const buckets: Record<string, any[]> = { easy: [], mid: [], hard: [] };
      for (const q of topicPool) {
        const d = (q as any).difficulty || "mid";
        buckets[d]?.push(q) ?? buckets.mid.push(q);
      }

      const pickedForTopic: any[] = [];
      const bucketKeys = ["easy", "mid", "hard"] as const;
      let round = 0;

      while (pickedForTopic.length < needed) {
        const b = bucketKeys[round % 3];
        const remaining = buckets[b].filter((q) => !pickedForTopic.includes(q));
        if (remaining.length > 0) {
          const shuffled = remaining.sort(() => Math.random() - 0.5);
          pickedForTopic.push(shuffled[0]);
        }
        round++;
        if (round > topicPool.length * 3 + 3) {
          for (const q of topicPool) {
            if (pickedForTopic.length >= needed) break;
            if (!pickedForTopic.includes(q)) pickedForTopic.push(q);
          }
          break;
        }
      }

      // Sort within topic: easy → mid → hard for natural pedagogical progression
      pickedForTopic.sort((a, b) => {
        const da = a.difficulty || "mid";
        const db = b.difficulty || "mid";
        const order = { easy: 0, mid: 1, hard: 2 } as Record<string, number>;
        return (order[da] ?? 1) - (order[db] ?? 1);
      });

      groupedQuestions.push({
        topic: t,
        questions: pickedForTopic,
      });
    }

    // Build official DepEd topic sections and continuous question numbering (1 to N)
    const { sections, orderedQuestions } = buildTopicSections(groupedQuestions, subject);

    // Assign modes: last `writtenCount` items become "written" so MC items come first
    const displayModes: string[] = orderedQuestions.map((_, i) =>
      i >= orderedQuestions.length - writtenCount ? "written" : "mc"
    );

    const questions = orderedQuestions.map((q, i) => {
      const mode = displayModes[i] as 'mc' | 'written';
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
        id: String(q._id),
        prompt: q.prompt,
        choices: finalChoices,
        correctAnswer: finalAns,
        mode,
        difficulty: difficultyLabel(q.difficulty || "mid"),
        competencyCode: q.competencyCode || "",
        competency: q.competency || "",
        topic: q.topic || "",
        sectionPart: q.sectionPart,
        sectionTitle: q.sectionTitle,
      };
    });

    const answerLetters = questions.map((q) => q.correctAnswer);

    // Written item metadata for teacher grading after scan
    const writtenItems = orderedQuestions
      .map((q, i) => ({ q, index: i }))
      .filter((_, i) => displayModes[i] === "written")
      .map(({ q, index }) => ({
        index,
        prompt: q.prompt,
        max: 1,
      }));

    const itemCount = questions.length;
    const rawType = body?.assessmentType;
    const assessmentType =
      rawType === "exam" || rawType === "pre-test" || rawType === "post-test" ? rawType : "quiz";
    const topicSummary = requestedTopics.length > 0 ? requestedTopics.join(" & ") : "All Topics";
    const subjectDisplay = subject === "Math" ? "Mathematics" : subject;
    const autoTitle =
      assessmentType === "pre-test"
        ? `ARAL Baseline Diagnostic Pre-Test: ${subjectDisplay} Grade ${gradeLevel} (${itemCount} items)`
        : assessmentType === "post-test"
        ? `ARAL Endline Evaluation Post-Test: ${subjectDisplay} Grade ${gradeLevel} (${itemCount} items)`
        : assessmentType === "exam"
        ? `Periodical Exam: ${subjectDisplay} Grade ${gradeLevel} (${itemCount} items)`
        : `Weekly Quiz: ${subjectDisplay} Grade ${gradeLevel} (${itemCount} items)`;
    const title =
      typeof body?.title === "string" && body.title.trim().length > 0
        ? body.title.trim()
        : autoTitle;

    const answerKey = await AnswerKey.create({
      title,
      subject,
      assessmentType,
      assessmentCategory: assessmentType,
      topic: topicSummary,
      topics: requestedTopics,
      materialId: materialDoc?._id || undefined,
      sourceMaterial: materialDoc?.title || undefined,
      items: itemCount,
      totalItems: itemCount,
      answers: answerLetters,
      modes: displayModes,
      writtenItems,
      questions,
      sections,
      created: new Date(),
    });

    const bubbleSheetUrl =
      subject === "Math"
        ? "/bubble-sheets/mathematics-bubble.pdf"
        : subject === "Science"
        ? "/bubble-sheets/science-bubble.pdf"
        : "/bubble-sheets/reading-bubble.pdf";

    return NextResponse.json({
      success: true,
      data: {
        title,
        assessmentType,
        assessmentCategory: assessmentType,
        subject,
        topic: topicSummary,
        topics: requestedTopics,
        materialId: materialDoc?._id ? String(materialDoc._id) : undefined,
        sourceMaterial: materialDoc?.title || undefined,
        gradeLevel,
        itemCount,
        questions,
        sections,
        answers: answerLetters,
        modes: displayModes,
        writtenCount,
        bubbleSheetUrl,
        answerKey: {
          id: String(answerKey._id),
          title: answerKey.title,
          assessmentType: answerKey.assessmentType,
          assessmentCategory: answerKey.assessmentCategory || answerKey.assessmentType,
          subject: answerKey.subject,
          topic: answerKey.topic,
          topics: answerKey.topics,
          materialId: materialDoc?._id ? String(materialDoc._id) : undefined,
          sourceMaterial: materialDoc?.title || undefined,
          items: answerKey.items,
          totalItems: answerKey.totalItems,
          sections,
        },
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

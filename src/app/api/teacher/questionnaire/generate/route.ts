import { NextResponse } from "next/server";
import connectDB from "../../../../../../database/db";
import Question from "../../../../../../models/Question";
import AnswerKey from "../../../../../../models/AnswerKey";
import { requireAuth, authErrorResponse } from "@/lib/auth";

const SUBJECTS = ["Math", "Science"];

const difficultyLabel = (d: string) =>
  d === "easy" ? "Easy" : d === "hard" ? "Hard" : "Average";

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
export async function POST(req: Request) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const body = await req.json();
    const subject = body?.subject;
    const gradeLevel = Number(body?.grade);
    const count = Math.min(50, Math.max(1, Number(body?.count) || 50));
    const writtenCount = Math.max(0, Math.min(count, Number(body?.writtenCount) || 0));
    const topic = (body?.topic || "").trim();

    if (!SUBJECTS.includes(subject) || !gradeLevel) {
      return NextResponse.json(
        { success: false, error: "Subject and grade level are required." },
        { status: 400 }
      );
    }

    const filter: Record<string, unknown> = { subject, gradeLevel };
    if (topic) {
      filter.$or = [
        { topic: new RegExp(topic, "i") },
        { competency: new RegExp(topic, "i") },
      ];
    }

    const pool = await Question.find(filter).lean();
    if (pool.length === 0) {
      return NextResponse.json(
        { success: false, error: `No questions in the bank for ${subject} Grade ${gradeLevel}${topic ? ` matching "${topic}"` : ""}. Try another grade or topic.` },
        { status: 404 }
      );
    }

    if (pool.length < count) {
      return NextResponse.json(
        { success: false, error: `Only ${pool.length} questions available for ${subject} Grade ${gradeLevel}. Requested ${count}. Reduce the count or broaden your topic filter.` },
        { status: 400 }
      );
    }

    // ── Difficulty-balanced sampling ──
    // Split pool into buckets by difficulty, then round-robin pick so the
    // resulting questionnaire has a balanced mix of easy / mid / hard items.
    const buckets: Record<string, any[]> = { easy: [], mid: [], hard: [] };
    for (const q of pool) {
      const d = (q as any).difficulty || "mid";
      buckets[d]?.push(q) ?? buckets.mid.push(q);
    }

    const pick: any[] = [];
    const bucketKeys = ["easy", "mid", "hard"] as const;
    let round = 0;
    while (pick.length < count) {
      const b = bucketKeys[round % 3];
      // find next unused item in this bucket
      const remaining = buckets[b].filter((q) => !pick.includes(q));
      if (remaining.length > 0) {
        // shuffle within bucket slice for variety
        const shuffled = remaining.sort(() => Math.random() - 0.5);
        pick.push(shuffled[0]);
      }
      round++;
      // safety: if we've gone 3 full rounds without filling, just grab what's left
      if (round > buckets.easy.length + buckets.mid.length + buckets.hard.length + 3) break;
    }

    // Assign modes: last `writtenCount` items become "written" so MC items come first
    // (easier for students to bubble the MC block, then answer written at the end).
    const modes: string[] = pick.map((_, i) =>
      i >= pick.length - writtenCount ? "written" : "mc"
    );

    // Sort by difficulty for display (easy → mid → hard), preserving mode grouping
    const displayOrder = [...pick.keys()].sort((a, b) => {
      const da = pick[a].difficulty || "mid";
      const db = pick[b].difficulty || "mid";
      const order = { easy: 0, mid: 1, hard: 2 } as Record<string, number>;
      return (order[da] ?? 1) - (order[db] ?? 1);
    });

    // Mode in the SAME display order as answers/writtenItems, so the AnswerKey's
    // modes[i] corresponds to the same item as answers[i]. (modes is in pick order;
    // displayOrder can permute it, so we must re-map before storing.)
    const displayModes = displayOrder.map((idx) => modes[idx]);

    const questions = displayOrder.map((idx, i) => {
      const q: any = pick[idx];
      return {
        number: i + 1,
        id: String(q._id),
        prompt: q.prompt,
        choices: q.choices || [],
        mode: displayModes[i],
        difficulty: difficultyLabel(q.difficulty || "mid"),
        competencyCode: q.competencyCode || "",
        competency: q.competency || "",
        topic: q.topic || "",
      };
    });

    // Answers in display order
    const answerLetters = displayOrder.map((idx) => pick[idx].correctAnswer);

    // Written item metadata (for teacher grading after scan), indexed by DISPLAY order
    const writtenItems = displayOrder
      .map((idx, i) => ({ idx, originalIndex: i }))
      .filter(({ idx }) => modes[idx] === "written")
      .map(({ idx, originalIndex }) => ({
        index: originalIndex, // 0-based position in the final questionnaire
        prompt: (pick[idx] as any).prompt,
        max: 1, // each written item worth 1 point by default
      }));

    const itemCount = questions.length;
    const title = `${subject} Grade ${gradeLevel} Auto-Questionnaire (${itemCount} items)`;

    const answerKey = await AnswerKey.create({
      title,
      subject,
      items: itemCount,
      answers: answerLetters,
      modes: displayModes,
      writtenItems,
      created: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        title,
        subject,
        gradeLevel,
        itemCount,
        questions,
        answers: answerLetters,
        modes: displayModes,
        writtenCount,
        answerKey: {
          id: String(answerKey._id),
          title: answerKey.title,
          subject: answerKey.subject,
          items: answerKey.items,
        },
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

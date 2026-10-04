import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../../../database/db";
import Question from "../../../../../../models/Question";
import AnswerKey from "../../../../../../models/AnswerKey";
import { requireAuth, authErrorResponse, AuthError } from "@/lib/auth";

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
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
 * POST /api/teacher/questionnaire/swap-question
 * Swaps a single item in a generated questionnaire with an authentic alternative
 * from the same topic/subject, while automatically keeping the MongoDB AnswerKey in sync.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const body = await req.json();
    const subject = body?.subject || "Reading";
    const topic = body?.topic ? String(body.topic).trim() : "";
    const mode = body?.mode === "written" ? "written" : "mc";
    const itemNumber = Math.max(1, Number(body?.itemNumber) || 1);
    const excludePrompts: string[] = Array.isArray(body?.excludePrompts)
      ? body.excludePrompts.map((p: any) => String(p).trim()).filter(Boolean)
      : [];
    const answerKeyId = body?.answerKeyId ? String(body.answerKeyId) : null;

    let candidates: any[] = [];

    // 1. Try exact topic match excluding already used prompts
    if (topic) {
      candidates = await Question.find({
        subject,
        topic: { $regex: new RegExp(`^${escapeRegex(topic)}$`, "i") },
        prompt: { $nin: excludePrompts },
      }).lean();

      // 2. Try partial topic match if exact match has no alternatives
      if (candidates.length === 0) {
        candidates = await Question.find({
          subject,
          topic: { $regex: new RegExp(escapeRegex(topic), "i") },
          prompt: { $nin: excludePrompts },
        }).lean();
      }
    }

    // 3. Fallback: Any question in the subject not in excludePrompts
    if (candidates.length === 0) {
      candidates = await Question.find({
        subject,
        prompt: { $nin: excludePrompts },
      }).lean();
    }

    // 4. Ultimate fallback: Any question in the subject
    if (candidates.length === 0) {
      candidates = await Question.find({ subject }).lean();
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No alternate questions found in the question bank." },
        { status: 404 }
      );
    }

    const chosen = shuffle(candidates)[0];
    const letter = chosen.correctAnswer || "A";

    const formattedQuestion = {
      number: itemNumber,
      id: `q${itemNumber}`,
      prompt: chosen.prompt,
      choices:
        Array.isArray(chosen.choices) && chosen.choices.length > 0
          ? chosen.choices
          : ["Option A", "Option B", "Option C", "Option D"],
      mode: (chosen.mode || mode || "mc") as "mc" | "written",
      difficulty:
        chosen.difficulty === "easy"
          ? "Easy"
          : chosen.difficulty === "hard"
          ? "Hard"
          : "Average",
      competencyCode: chosen.competencyCode || "EN7RC-ARAL",
      competency: chosen.competency || chosen.topic || topic || "Reading Competency",
      topic: chosen.topic || topic || "General",
      correctAnswer: letter,
    };

    // 5. If an AnswerKey is linked, update it in MongoDB so OMR grading matches immediately
    if (answerKeyId) {
      try {
        const key = await AnswerKey.findById(answerKeyId);
        if (key) {
          const idx = itemNumber - 1;

          // Update answerLetters array
          if (Array.isArray(key.answerLetters)) {
            while (key.answerLetters.length <= idx) {
              key.answerLetters.push("A");
            }
            key.answerLetters[idx] = letter;
            key.markModified("answerLetters");
          }

          // Update structured answers array
          if (Array.isArray(key.answers)) {
            while (key.answers.length <= idx) {
              key.answers.push({ itemNumber: key.answers.length + 1, correctKey: "A" });
            }
            if (typeof key.answers[idx] === "object" && key.answers[idx] !== null) {
              key.answers[idx].correctKey = letter;
            } else {
              key.answers[idx] = letter;
            }
            key.markModified("answers");
          }

          // Update questions array if stored
          if (Array.isArray(key.questions)) {
            while (key.questions.length <= idx) {
              key.questions.push(null);
            }
            key.questions[idx] = formattedQuestion;
            key.markModified("questions");
          }

          await key.save();
        }
      } catch (keyErr) {
        console.warn("Could not update linked AnswerKey on question swap:", keyErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        question: formattedQuestion,
        correctAnswer: letter,
        answerKeyId,
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Swap Question Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

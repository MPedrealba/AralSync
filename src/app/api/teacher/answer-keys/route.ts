import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../../database/db";
import AnswerKey from "../../../../../models/AnswerKey";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const keys = await AnswerKey.find().sort({ created: -1 }).lean();
    const formatted = keys.map((k: any) => {
      // Normalize answers: extract correctKey if stored as an object { itemNumber, correctKey }
      const rawAnswers = Array.isArray(k.answers) ? k.answers : (k.answerLetters || []);
      const normalizedAnswers = rawAnswers.map((a: any) => {
        if (!a) return "";
        if (typeof a === "string") return a;
        if (typeof a === "object" && a.correctKey) return String(a.correctKey);
        if (typeof a === "object" && a.letter) return String(a.letter);
        return String(a);
      });

      return {
        id: String(k._id),
        title: k.title,
        assessmentType: k.assessmentType || (k.title?.toLowerCase().includes("exam") ? "exam" : "quiz"),
        topic: k.topic || "",
        topics: Array.isArray(k.topics) && k.topics.length > 0 ? k.topics : (k.topic ? [k.topic] : []),
        subject: k.subject || "—",
        items: k.items ?? normalizedAnswers.length ?? 0,
        answers: normalizedAnswers,
        modes: k.modes ?? [],
        writtenItems: k.writtenItems ?? [],
        questions: k.questions ?? [],
        passageTitle: k.passageTitle || "",
        passageText: k.passageText || "",
        created: k.created,
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const body = await req.json();
    const { title, subject, items, answers, assessmentType, topic, topics } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required." },
        { status: 400 }
      );
    }

    const resolvedType = assessmentType || (title.toLowerCase().includes("exam") ? "exam" : "quiz");
    const resolvedTopics = Array.isArray(topics) ? topics : (topic ? [topic] : []);

    const rawAnswers = Array.isArray(answers) ? answers : [];
    const normalizedAnswers = rawAnswers.map((a: any) => {
      if (!a) return "";
      if (typeof a === "string") return a;
      if (typeof a === "object" && a.correctKey) return String(a.correctKey);
      if (typeof a === "object" && a.letter) return String(a.letter);
      return String(a);
    });

    const key = await AnswerKey.create({
      title,
      subject: subject || undefined,
      assessmentType: resolvedType,
      topic: topic || (resolvedTopics.length === 1 ? resolvedTopics[0] : ""),
      topics: resolvedTopics,
      items: items ?? normalizedAnswers.length ?? 0,
      answers: normalizedAnswers,
      answerLetters: normalizedAnswers,
      created: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(key._id),
        title: key.title,
        assessmentType: key.assessmentType,
        topic: key.topic,
        topics: key.topics,
        subject: key.subject,
        items: key.items,
        answers: key.answers,
        created: key.created,
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

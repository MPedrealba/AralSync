import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../../database/db";
import AnswerKey from "../../../../../models/AnswerKey";
import { requireAuth, authErrorResponse } from "@/lib/auth";
import { getTeacherSubject } from "@/lib/teacherScope";

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ["teacher"]);
    await connectDB();

    const teacherSubject = await getTeacherSubject(authUser);
    const { searchParams } = new URL(req.url);
    const reqSubject = searchParams.get("subject");

    const filter: Record<string, any> = {};
    if (teacherSubject !== "All") {
      filter.subject = teacherSubject;
    } else if (reqSubject && ["Reading", "Math", "Science"].includes(reqSubject)) {
      filter.subject = reqSubject;
    }

    const keys = await AnswerKey.find(filter).sort({ created: -1 }).lean();
    const formatted = keys.map((k: any) => {
      // Normalize answers: extract correctKey if stored as an object { itemNumber, correctKey }
      const rawAnswers = Array.isArray(k.answers) ? k.answers : (k.answerLetters || []);
      const normalizedAnswers = rawAnswers.map((a: any) => {
        if (!a) return "";
        if (typeof a === "string") return a;
        if (typeof a === "object" && a.correctKey) return String(a.correctKey);
        if (typeof a === "object" && a.letter) return String(a.letter);
        if (typeof a === "object" && a.answer) return String(a.answer);
        return String(a);
      });

      const finalAnswers: string[] =
        normalizedAnswers.length > 0 && normalizedAnswers.some(Boolean)
          ? normalizedAnswers
          : (k.questions || []).map((q: any) => q.correctAnswer || q.answer || "A");

      const finalModes: string[] =
        Array.isArray(k.modes) && k.modes.length === finalAnswers.length
          ? k.modes
          : finalAnswers.map(() => "mc");

      const finalItems: number = finalAnswers.length || k.items || 0;

      return {
        id: String(k._id),
        title: k.title,
        assessmentType: k.assessmentType || (k.title?.toLowerCase().includes("exam") ? "exam" : "quiz"),
        topic: k.topic || "",
        topics: Array.isArray(k.topics) && k.topics.length > 0 ? k.topics : (k.topic ? [k.topic] : []),
        subject: k.subject || "—",
        items: finalItems,
        answers: finalAnswers,
        modes: finalModes,
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
    const authUser = await requireAuth(req, ["teacher"]);
    await connectDB();

    const teacherSubject = await getTeacherSubject(authUser);
    const body = await req.json();
    const { title, subject, items, answers, assessmentType, topic, topics } = body;

    const finalSubject = teacherSubject !== "All" ? teacherSubject : (subject || "Reading");

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
      subject: finalSubject || undefined,
      teacherId: authUser.id,
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

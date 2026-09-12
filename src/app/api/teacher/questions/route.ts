import { NextResponse } from "next/server";
import connectDB from "../../../../../database/db";
import Question from "../../../../../models/Question";
import { requireAuth, authErrorResponse } from "@/lib/auth";

/**
 * GET /api/teacher/questions
 * List the Question Bank (DepEd-aligned OMR questions). Supports optional
 * ?subject=, ?grade=, ?topic= filters so the generator tab can preview
 * available questions.
 */
export async function GET(req: Request) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const grade = searchParams.get("grade");
    const topic = searchParams.get("topic");

    const filter: Record<string, unknown> = {};
    if (subject) filter.subject = subject;
    if (grade) filter.gradeLevel = Number(grade);
    if (topic) {
      filter.$or = [
        { topic: new RegExp(topic, "i") },
        { competency: new RegExp(topic, "i") },
      ];
    }

    const questions = await Question.find(filter).sort({ gradeLevel: 1 }).lean();

    const rows = questions.map((q: any) => ({
      id: String(q._id),
      subject: q.subject,
      gradeLevel: q.gradeLevel,
      competencyCode: q.competencyCode || "",
      competency: q.competency || "",
      topic: q.topic || "",
      difficulty: q.difficulty || "mid",
      prompt: q.prompt,
      choices: q.choices || [],
      correctAnswer: q.correctAnswer,
      source: q.source || "DepEd Learning Resource",
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

/**
 * POST /api/teacher/questions
 * Add a single question to the bank.
 */
export async function POST(req: Request) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const body = await req.json();
    const {
      subject,
      gradeLevel,
      competencyCode,
      competency,
      topic,
      difficulty,
      prompt,
      choices,
      correctAnswer,
      source,
    } = body;

    if (!subject || !prompt || !choices || choices.length !== 4 || !correctAnswer) {
      return NextResponse.json(
        { success: false, error: "Subject, prompt, 4 choices, and correct answer are required." },
        { status: 400 }
      );
    }

    const question = await Question.create({
      subject,
      gradeLevel: gradeLevel || 7,
      competencyCode: competencyCode || "",
      competency: competency || "",
      topic: topic || "",
      difficulty: difficulty || "mid",
      prompt,
      choices,
      correctAnswer,
      source: source || "DepEd Learning Resource",
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(question._id),
        subject: question.subject,
        gradeLevel: question.gradeLevel,
        competencyCode: question.competencyCode,
        competency: question.competency,
        topic: question.topic,
        prompt: question.prompt,
        choices: question.choices,
        correctAnswer: question.correctAnswer,
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
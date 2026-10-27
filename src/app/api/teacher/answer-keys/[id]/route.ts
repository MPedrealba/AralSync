import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../../../database/db";
import AnswerKey from "../../../../../../models/AnswerKey";
import Assessment from "../../../../../../models/Assessment";
import CustomExam from "../../../../../../models/CustomExam";
import { requireAuth, authErrorResponse } from "@/lib/auth";

/**
 * DELETE /api/teacher/answer-keys/:id?force=true
 * Remove an answer key.
 *
 * Default (protective): blocked when any saved Assessment links back to this
 * key, so past scores keep their source.
 * ?force=true: deletes anyway and detaches (nulls) the answerKeyRef on every
 * Assessment / CustomExam that referenced it. Old scores are untouched — only
 * their "which key scored me" pointer is cleared. The response reports how
 * many records were detached.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Answer key id is required." },
        { status: 400 }
      );
    }

    const force = new URL(req.url).searchParams.get("force") === "true";

    // Protective check: refuse to delete a key that past assessments still
    // reference, unless the caller explicitly forces.
    const referencing = await Assessment.countDocuments({ answerKeyRef: id });
    if (referencing > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete this answer key — it was used to score ${referencing} assessment${
            referencing === 1 ? "" : "s"
          }.`,
          blocked: true,
          referencing,
        },
        { status: 409 }
      );
    }

    const exists = await AnswerKey.findById(id);
    if (!exists) {
      return NextResponse.json(
        { success: false, error: "Answer key not found." },
        { status: 404 }
      );
    }

    // Force path: detach records that point at this key before removing it.
    let detached = 0;
    if (force) {
      const [assDetached, examDetached] = await Promise.all([
        Assessment.updateMany(
          { answerKeyRef: id },
          { $set: { answerKeyRef: null } }
        ),
        CustomExam.updateMany(
          { answerKeyRef: id },
          { $set: { answerKeyRef: null } }
        ),
      ]);
      detached = assDetached.modifiedCount + examDetached.modifiedCount;
    }

    await AnswerKey.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      data: { id, force, detached },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

/**
 * PATCH /api/teacher/answer-keys/:id
 * Updates answers, question choices, or title on an existing AnswerKey.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Answer key id is required." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, any> = {};

    if (Array.isArray(body.answers)) {
      updateData.answers = body.answers;
      updateData.answerLetters = body.answers;
    }
    if (Array.isArray(body.questions)) {
      updateData.questions = body.questions;
    }
    if (typeof body.title === "string" && body.title.trim()) {
      updateData.title = body.title.trim();
    }
    if (typeof body.isOnline === "boolean") {
      updateData.isOnline = body.isOnline;
    }
    if (typeof body.timeLimitMinutes === "number") {
      updateData.timeLimitMinutes = Math.max(0, body.timeLimitMinutes);
    }
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.targetGrade !== undefined) {
      updateData.targetGrade = body.targetGrade ? Number(body.targetGrade) : null;
    }
    if (typeof body.targetSection === "string") {
      updateData.targetSection = body.targetSection.trim();
    }

    const updated = await AnswerKey.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Answer key not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

/**
 * GET /api/teacher/answer-keys/:id
 * Fetches a single answer key with questions and online delivery settings.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Answer key id is required." },
        { status: 400 }
      );
    }

    const key = await AnswerKey.findById(id).lean();
    if (!key) {
      return NextResponse.json(
        { success: false, error: "Answer key not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: key,
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
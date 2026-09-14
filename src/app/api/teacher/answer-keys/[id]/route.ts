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
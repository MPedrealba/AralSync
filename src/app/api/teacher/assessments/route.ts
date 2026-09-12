import { NextResponse, NextRequest } from "next/server";
import connectDB from "../../../../../database/db";
import Assessment from "../../../../../models/Assessment";
import LearnerRecord from "../../../../../models/LearnerRecord";
import User from "../../../../../models/User";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // OMR | READING_FLUENCY | COMPREHENSION

    const filter: Record<string, string> = {};
    if (type && ["OMR", "READING_FLUENCY", "COMPREHENSION"].includes(type)) {
      filter.type = type;
    }

    // Fetch assessments + join student info + learner record
    const assessments = await Assessment.find(filter)
      .sort({ date: -1 })
      .lean();

    // Gather student IDs and record IDs to batch-fetch
    const studentIds = [...new Set(assessments.map((a) => String(a.studentId)))];
    const users = await User.find({ _id: { $in: studentIds } })
      .select("name")
      .lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u.name]));

    const records = await LearnerRecord.find({
      studentId: { $in: studentIds },
    })
      .select("studentId gradeLevel section")
      .lean();
    const recordMap = new Map(
      records.map((r: any) => [String(r.studentId), r])
    );

    const formatted = assessments.map((a: any) => {
      const name = userMap.get(String(a.studentId)) || "Unknown";
      const rec = recordMap.get(String(a.studentId));
      const gradeLevel = rec?.gradeLevel ?? "—";
      const section = rec?.section ?? "—";
      return {
        id: String(a._id),
        title: a.title || a.type || "Untitled",
        type: a.type,
        subject: a.subject || "—",
        studentName: name,
        studentId: String(a.studentId),
        gradeSection: `Grade ${gradeLevel} - ${section}`,
        score: a.score,
        totalItems: a.totalItems ?? 50,
        mcTotal: a.mcTotal ?? 0,
        scoredItems: a.scoredItems ?? null,
        writtenMax: a.writtenMax ?? 0,
        writtenScore: a.writtenScore ?? 0,
        gradingStatus: a.gradingStatus ?? 'complete',
        writtenItems: a.writtenItems ?? [],
        masteryLevel: a.masteryLevel || "—",
        wpm: a.wpm ?? null,
        accuracy: a.accuracy ?? null,
        pauses: a.pauses ?? null,
        wer: a.wer ?? null,
        durationSec: a.durationSec ?? null,
        passageTitle: a.passageTitle || null,
        subskills: a.subskills ?? [],
        status: a.status || 'pending',
        notes: a.notes || null,
        date: a.date,
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

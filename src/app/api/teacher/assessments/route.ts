import { NextResponse, NextRequest } from "next/server";
import connectDB from "../../../../../database/db";
import Assessment from "../../../../../models/Assessment";
import LearnerRecord from "../../../../../models/LearnerRecord";
import User from "../../../../../models/User";
import { requireAuth, authErrorResponse } from "@/lib/auth";
import { getTeacherSubject } from "@/lib/teacherScope";
import { logAudit } from "@/lib/audit";
import { syncLearnerPhilIriMetrics } from "@/lib/philIriSync";

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ["teacher"]);
    await connectDB();

    const teacherSubject = await getTeacherSubject(authUser);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // OMR | READING_FLUENCY | COMPREHENSION
    const reqSubject = searchParams.get("subject");

    const filter: Record<string, any> = {};
    if (type && ["OMR", "READING_FLUENCY", "COMPREHENSION"].includes(type)) {
      filter.type = type;
    }

    if (teacherSubject !== "All") {
      filter.subject = teacherSubject;
    } else if (reqSubject && ["Reading", "Math", "Science"].includes(reqSubject)) {
      filter.subject = reqSubject;
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
        assessmentCategory: a.assessmentCategory || (a.title?.toLowerCase().includes("exam") ? "exam" : "quiz"),
        topics: Array.isArray(a.topics) ? a.topics : [],
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
        // Phil-IRI measured output.
        miscueBreakdown: a.miscueBreakdown ?? null,
        miscueTotal: a.miscueTotal ?? null,
        stutterCount: a.stutterCount ?? null,
        hesitations: a.hesitations ?? null,
        longestPause: a.longestPause ?? null,
        speechDurationSec: a.speechDurationSec ?? null,
        pauseTotalSec: a.pauseTotalSec ?? null,
        pauseAvgSec: a.pauseAvgSec ?? null,
        silentSec: a.silenceSec ?? null,
        miscueItems: a.miscueItems ?? [],
        wordsAttempted: a.wordsAttempted ?? null,
        subskills: a.subskills ?? [],
        status: a.status || 'pending',
        notes: a.notes || null,
        omrSheetUrl: a.omrSheetUrl || null,
        omrOriginalFilename: a.omrOriginalFilename || null,
        detectedAnswers: a.detectedAnswers || [],
        date: a.date,
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

/**
 * POST /api/teacher/assessments
 * Supports creating assessments replayed from the PWA offline queue
 * or teacher manual entry.
 */
export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ["teacher"]);
    const body = await req.json();

    const {
      studentId,
      type = "READING_FLUENCY",
      title,
      passageTitle,
      score,
      accuracy,
      wpm,
      pauses,
      wer,
      durationSec,
      miscueBreakdown,
      miscueItems,
      miscueTotal,
      wordsAttempted,
      masteryLevel,
      status = "approved",
      notes,
      date,
      assessmentCategory,
      topics,
      subject,
      scoredItems,
      totalItems,
      detectedAnswers,
    } = body || {};

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "studentId is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const finalScore =
      typeof score === "number"
        ? score
        : typeof accuracy === "number"
        ? accuracy
        : 0;
    const finalTitle = title || passageTitle || "Assessment";
    const finalSubject =
      subject ||
      (type === "READING_FLUENCY"
        ? "Reading"
        : type === "COMPREHENSION"
        ? "Reading"
        : "General");

    const assessment = await Assessment.create({
      studentId,
      type,
      subject: finalSubject,
      title: finalTitle,
      passageTitle: passageTitle || finalTitle,
      score: finalScore,
      accuracy: typeof accuracy === "number" ? accuracy : finalScore,
      wpm: typeof wpm === "number" ? wpm : undefined,
      pauses: typeof pauses === "number" ? pauses : undefined,
      wer: typeof wer === "number" ? wer : undefined,
      durationSec: typeof durationSec === "number" ? durationSec : undefined,
      miscueBreakdown: miscueBreakdown || undefined,
      miscueItems: Array.isArray(miscueItems) ? miscueItems : [],
      miscueTotal: typeof miscueTotal === "number" ? miscueTotal : undefined,
      wordsAttempted:
        typeof wordsAttempted === "number" ? wordsAttempted : undefined,
      masteryLevel: masteryLevel || "—",
      status: status || "approved",
      notes: notes || "Submitted via AralSync Offline Queue synchronization",
      date: date ? new Date(date) : new Date(),
      assessmentCategory,
      topics: Array.isArray(topics) ? topics : [],
      scoredItems: Array.isArray(scoredItems) ? scoredItems : undefined,
      totalItems: typeof totalItems === "number" ? totalItems : undefined,
      detectedAnswers: Array.isArray(detectedAnswers) ? detectedAnswers : undefined,
    });

    if (["READING_FLUENCY", "COMPREHENSION"].includes(type) && status === "approved") {
      try {
        await syncLearnerPhilIriMetrics(studentId);
      } catch (err) {
        console.warn("syncLearnerPhilIriMetrics failed during offline sync:", err);
      }
    }

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: "teacher",
      action: "offline_sync_assessment",
      targetType: "Assessment",
      targetId: String(assessment._id),
      meta: { studentId, type, title: finalTitle },
    });

    return NextResponse.json({ success: true, data: assessment });

  } catch (e: any) {
    return authErrorResponse(e);
  }
}


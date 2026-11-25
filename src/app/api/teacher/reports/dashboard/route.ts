import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse, AuthError } from "@/lib/auth";
import { ok } from "@/lib/api";
import connectDB from "../../../../../../database/db";
import LearnerRecord from "../../../../../../models/LearnerRecord";
import { buildNationalDashboard } from "@/lib/nationalDashboard";
import { getTeacherSubject, getTeacherLearnerFilter } from "@/lib/teacherScope";
import { isSyPeriod } from "@/lib/syPeriod";
import type { SyPeriodKey } from "@/lib/syPeriod";

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ["teacher"]);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get("period") ?? "ALL").toUpperCase();
    const period: SyPeriodKey = isSyPeriod(raw) ? raw : "ALL";
    const g = searchParams.get("grade");
    const grade = g && !Number.isNaN(Number(g)) ? Number(g) : null;

    const teacherSubject = await getTeacherSubject(authUser);
    const assignedStudentIds = await LearnerRecord.find(
      getTeacherLearnerFilter(authUser.id, teacherSubject)
    ).distinct("studentId");

    return ok(
      await buildNationalDashboard({
        period,
        grade,
        assignedStudentIds,
        teacherSubject,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Teacher national-dashboard API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

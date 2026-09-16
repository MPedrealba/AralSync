import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse, AuthError } from "@/lib/auth";
import { ok } from "@/lib/api";
import connectDB from "../../../../../../database/db";
import { buildNationalDashboard } from "@/lib/nationalDashboard";
import { isSyPeriod } from "@/lib/syPeriod";
import type { SyPeriodKey } from "@/lib/syPeriod";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get("period") ?? "ALL").toUpperCase();
    const period: SyPeriodKey = isSyPeriod(raw) ? raw : "ALL";
    const g = searchParams.get("grade");
    const grade = g && !Number.isNaN(Number(g)) ? Number(g) : null;

    return ok(await buildNationalDashboard({ period, grade }));
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Teacher national-dashboard API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
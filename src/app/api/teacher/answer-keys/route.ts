import { NextResponse } from "next/server";
import connectDB from "../../../../../database/db";
import AnswerKey from "../../../../../models/AnswerKey";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const keys = await AnswerKey.find().sort({ created: -1 }).lean();
    const formatted = keys.map((k: any) => ({
      id: String(k._id),
      title: k.title,
      subject: k.subject || "—",
      items: k.items ?? k.answers?.length ?? 0,
      modes: k.modes ?? [],
      writtenItems: k.writtenItems ?? [],
      created: k.created,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth(req, ["teacher"]);
    await connectDB();

    const body = await req.json();
    const { title, subject, items, answers } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required." },
        { status: 400 }
      );
    }

    const key = await AnswerKey.create({
      title,
      subject: subject || undefined,
      items: items ?? answers?.length ?? 0,
      answers: answers ?? [],
      created: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(key._id),
        title: key.title,
        subject: key.subject,
        items: key.items,
        created: key.created,
      },
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

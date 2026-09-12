import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Intervention from '../../../../../models/Intervention';

export async function GET(req: NextRequest) {
  try {
    const { id: userId } = await requireAuth(req, ['student']);

    await connectDB();

    const interventions = await Intervention.find({ studentId: userId })
      .sort({ assignedDate: -1 })
      .lean();

    const data = interventions.map((i: any) => ({
      id: String(i._id),
      title: i.title || 'Untitled',
      category: i.category || i.type || 'Activity',
      type: i.type || 'Activity',
      status: i.status || 'Not Started',
      assignedDate: i.assignedDate,
    }));

    const completed = data.filter((d) => d.status === 'Completed').length;

    return ok({
      count: data.length,
      completed,
      interventions: data,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Student interventions API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
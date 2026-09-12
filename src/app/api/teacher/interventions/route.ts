import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Intervention from '../../../../../models/Intervention';
import LearnerRecord from '../../../../../models/LearnerRecord';

/** Map a category/title onto a card icon key. */
const iconFor = (intervention: any): string => {
  const category = (intervention?.category || '').toLowerCase();
  const title = (intervention?.title || '').toLowerCase();
  if (category.includes('numeracy') || category.includes('math')) return 'numeracy';
  if (category.includes('science')) return 'science';
  return 'reading';
};

/** GET /api/teacher/interventions — list with learner name + cohort. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    const { searchParams } = new URL(req.url);
    const filter: Record<string, unknown> = {};
    const status = searchParams.get('status');
    if (status) filter.status = status;

    const interventions = await Intervention.find(filter)
      .sort({ assignedDate: -1 })
      .populate('studentId', 'name');

    const studentIds = interventions
      .map((i: any) => i.studentId?._id)
      .filter(Boolean);
    const records = await LearnerRecord.find({ studentId: { $in: studentIds } });
    const recordByStudent = new Map(
      records.map((r: any) => [r.studentId.toString(), r])
    );

    const data = interventions.map((i: any) => {
      const rec = recordByStudent.get(i.studentId?._id?.toString());
      const d = new Date(i.assignedDate);
      const created = d.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      });
      return {
        id: i._id.toString(),
        title: i.title || 'Intervention',
        learner: i.studentId?.name || 'Unknown',
        gradeSection: rec
          ? `Grade ${rec.gradeLevel} - ${rec.section}`
          : '',
        category: i.category || '',
        type: i.type || '',
        typeIcon: iconFor(i),
        description: `${i.category || 'Learning'} material assigned to support ${i.studentId?.name || 'the learner'}.`,
        created,
        status: i.status || 'Not Started',
        reviewed: i.reviewed ?? false,
      };
    });

    return ok(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Interventions List API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** POST /api/teacher/interventions — create an intervention entry. */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    const body = await req.json();
    const { studentId, title, category, type } = body || {};

    if (!studentId || !title) {
      return fail('studentId and title are required', 400);
    }

    await connectDB();

    const intervention = await Intervention.create({
      studentId,
      title,
      category: category || title,
      type: type || 'Activity',
      status: 'Not Started',
      assignedDate: new Date(),
    });

    return ok({
      id: intervention._id.toString(),
      title: intervention.title,
      category: intervention.category,
      type: intervention.type,
      status: intervention.status,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Create Intervention API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
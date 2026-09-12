import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import Assessment from '../../../../../../models/Assessment';
import Intervention from '../../../../../../models/Intervention';
import User from '../../../../../../models/User';
import { Types } from 'mongoose';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/teacher/learners/[id]
 * Full profile for one learner: record, mastery, assessments grouped by type,
 * and interventions. Accepts either the LearnerRecord _id, the Mongo ObjectId
 * of the student's User doc, or the LRN string.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req, ['teacher']);

    await connectDB();

    const { id } = await params;

    let record: any = null;

    if (Types.ObjectId.isValid(id)) {
      record =
        (await LearnerRecord.findById(id)) ||
        (await LearnerRecord.findOne({ studentId: id }));
    } else {
      record = await LearnerRecord.findOne({ lrn: id });
    }

    if (!record) {
      return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
    }

    const studentId = record.studentId;

    const [user, assessments, interventions] = await Promise.all([
      (record as any).populate('studentId', 'name username'),
      Assessment.find({ studentId }).sort({ date: -1 }),
      Intervention.find({ studentId }).sort({ assignedDate: -1 }),
    ]);

    const omrAssessments = assessments
      .filter((a: any) => a.type === 'OMR')
      .map((a: any) => ({
        id: a._id.toString(),
        date: a.date,
        title: a.title || 'OMR Scan',
        subject: a.subject || 'Math',
        score: a.score,
        mastery: a.masteryLevel,
      }));

    const readingAssessments = assessments
      .filter((a: any) => a.type === 'READING_FLUENCY')
      .map((a: any) => ({
        id: a._id.toString(),
        date: a.date,
        accuracy: a.accuracy != null ? `${a.accuracy}%` : '—',
        fluency: a.wpm ?? a.score,
        wordsErr: a.accuracy != null ? `${(100 - a.accuracy).toFixed(1)}%` : '—',
        pauses: a.pauses ?? 0,
        title: a.title || 'Oral Reading Fluency',
      }));

    const comprehensionAssessments = assessments
      .filter((a: any) => a.type === 'COMPREHENSION')
      .map((a: any) => ({
        id: a._id.toString(),
        date: a.date,
        passage: a.passageTitle || a.title || 'Passage',
        subject: a.subject,
        score: a.score,
        mastery: a.masteryLevel,
        subskills: a.subskills || [],
      }));

    const data = {
      id: record._id.toString(),
      learner: {
        name: (user as any).studentId?.name || 'Unknown',
        lrn: record.lrn,
        gradeLevel: record.gradeLevel,
        section: record.section,
        guardian: record.guardian || '',
        contact: record.contact || '',
        address: record.address || '',
      },
      performanceLevel: record.masteryStatus || '—',
      riskClassification: record.riskLevel || '—',
      omrAssessments,
      readingAssessments,
      comprehensionAssessments,
      interventions: interventions.map((i: any) => ({
        id: i._id.toString(),
        title: i.title,
        category: i.category,
        type: i.type,
        status: i.status,
        assignedDate: i.assignedDate,
      })),
    };

    return ok(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Learner Detail API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/teacher/learners/[id]
 * Update a learner's profile fields (FR2 "manage"). Syncs the display name on
 * the linked User and validates the risk/mastery enums before saving. This is
 * how a teacher corrects an imported/duplicate record manually.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth(req, ['teacher']);
    await connectDB();

    const { id } = await params;
    const body = await req.json();

    let record: any = null;
    if (Types.ObjectId.isValid(id)) {
      record =
        (await LearnerRecord.findById(id)) ||
        (await LearnerRecord.findOne({ studentId: id }));
    } else {
      record = await LearnerRecord.findOne({ lrn: id });
    }
    if (!record) {
      return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
    }

    const RISK = ['Low Risk', 'Moderate Risk', 'High Risk'];
    const MASTERY = ['Beginning', 'Developing', 'Approaching', 'Proficient'];

    if (body.riskLevel !== undefined && !RISK.includes(body.riskLevel)) {
      return NextResponse.json({ error: 'Invalid risk level' }, { status: 400 });
    }
    if (body.masteryStatus !== undefined && !MASTERY.includes(body.masteryStatus)) {
      return NextResponse.json({ error: 'Invalid mastery status' }, { status: 400 });
    }
    if (body.gradeLevel !== undefined && body.gradeLevel !== null && body.gradeLevel !== '') {
      const g = Number(body.gradeLevel);
      if (Number.isNaN(g)) {
        return NextResponse.json({ error: 'Invalid grade level' }, { status: 400 });
      }
      body.gradeLevel = g;
    }

    const recordFields = [
      'gradeLevel',
      'section',
      'guardian',
      'contact',
      'address',
      'riskLevel',
      'masteryStatus',
    ];
    for (const f of recordFields) {
      if (body[f] !== undefined) record[f] = body[f] === '' ? undefined : body[f];
    }
    await record.save();

    if (body.name && record.studentId) {
      await User.findByIdAndUpdate(record.studentId, { name: body.name });
    }

    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      role: 'teacher',
      action: 'learner_update',
      targetType: 'LearnerRecord',
      targetId: String(record._id),
      meta: { fields: Object.keys(body) },
    });

    return ok({ id: String(record._id) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Learner Update API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
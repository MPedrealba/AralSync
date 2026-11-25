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
import { evaluateGstScore } from '@/lib/reading';
import {
  getTeacherSubject,
  getSubjectFilter,
  getInterventionSubjectFilter,
  type TeacherSubject,
} from '@/lib/teacherScope';

const READING_SUBJS = new Set(['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino']);

function isTeacherAssignedToRecord(
  record: any,
  actor: { id: string; role?: string },
  teacherSubject: TeacherSubject
): boolean {
  if (actor.role === 'admin' || actor.role === 'coordinator') return true;
  if (record.assignedTeacherId?.toString() === actor.id) return true;

  const assigned = record.assignedTeachers || {};
  const hasAnySubjectTeacher = Boolean(
    assigned.reading || assigned.english || assigned.filipino || assigned.math || assigned.science
  );
  if (!record.assignedTeacherId && !hasAnySubjectTeacher) return true;

  if (teacherSubject === 'All') {
    return (
      assigned.reading?.toString() === actor.id ||
      assigned.english?.toString() === actor.id ||
      assigned.filipino?.toString() === actor.id ||
      assigned.math?.toString() === actor.id ||
      assigned.science?.toString() === actor.id
    );
  }
  if (teacherSubject === 'Reading' || teacherSubject === 'English' || teacherSubject === 'Filipino') {
    return (
      assigned.reading?.toString() === actor.id ||
      assigned.english?.toString() === actor.id ||
      assigned.filipino?.toString() === actor.id
    );
  }
  if (teacherSubject === 'Math') {
    return assigned.math?.toString() === actor.id;
  }
  if (teacherSubject === 'Science') {
    return assigned.science?.toString() === actor.id;
  }
  return false;
}

/**
 * GET /api/teacher/learners/[id]
 * Full profile for one learner: record, mastery, assessments grouped by type,
 * and interventions. Accepts either the LearnerRecord _id, the Mongo ObjectId
 * of the student's User doc, or the Student Number string.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth(req, ['teacher']);

    await connectDB();

    const { id } = await params;

    let record: any = null;

    if (Types.ObjectId.isValid(id)) {
      record =
        (await LearnerRecord.findById(id)) ||
        (await LearnerRecord.findOne({ studentId: id }));
    } else {
      record = await LearnerRecord.findOne({ studentNumber: id });
    }

    if (!record) {
      return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
    }

    const teacherSubject = await getTeacherSubject(actor);

    if (!isTeacherAssignedToRecord(record, actor, teacherSubject)) {
      return NextResponse.json({ error: 'Forbidden: You are not assigned to this learner' }, { status: 403 });
    }

    const studentId = record.studentId;

    const [user, assessments, interventions] = await Promise.all([
      (record as any).populate('studentId', 'name username'),
      Assessment.find({ studentId, ...getSubjectFilter(teacherSubject) }).sort({ date: -1 }),
      Intervention.find({ studentId, ...getInterventionSubjectFilter(teacherSubject) }).sort({ assignedDate: -1 }),
    ]);

    const omrAssessments = assessments
      .filter((a: any) => a.type === 'OMR')
      .map((a: any) => {
        const title = (a.title || '').toLowerCase();
        const category = a.assessmentCategory || (
          title.includes('pre-test') || title.includes('pretest') || title.includes('baseline')
            ? 'pre-test'
            : title.includes('post-test') || title.includes('posttest') || title.includes('endline')
            ? 'post-test'
            : title.includes('exam')
            ? 'exam'
            : 'quiz'
        );
        return {
          id: a._id.toString(),
          date: a.date,
          title: a.title || 'OMR Scan',
          subject: a.subject || (teacherSubject !== 'All' ? teacherSubject : 'General'),
          score: a.score,
          mastery: a.masteryLevel,
          category,
          assessmentCategory: category,
          omrSheetUrl: a.omrSheetUrl || null,
          detectedAnswers: a.detectedAnswers || [],
        };
      });

    // Calculate Pre-Test vs Post-Test Growth & Learning Recovery
    const preAssessments = omrAssessments.filter((a) => a.category === 'pre-test');
    const postAssessments = omrAssessments.filter((a) => a.category === 'post-test');

    const prePostGrowth = {
      hasData: preAssessments.length > 0 || postAssessments.length > 0,
      baselineScore: preAssessments.length > 0 ? preAssessments[preAssessments.length - 1].score : null,
      postTestScore: postAssessments.length > 0 ? postAssessments[0].score : null,
      gainDelta: null as number | null,
      gainStatus: 'no_data' as 'improved' | 'declined' | 'maintained' | 'no_data' | 'pending_post',
      preTestDate: preAssessments.length > 0 ? preAssessments[preAssessments.length - 1].date : null,
      postTestDate: postAssessments.length > 0 ? postAssessments[0].date : null,
      bySubject: {} as Record<string, { baseline: number | null; postTest: number | null; delta: number | null; status: string }>,
    };

    if (prePostGrowth.baselineScore != null && prePostGrowth.postTestScore != null) {
      prePostGrowth.gainDelta = Math.round(prePostGrowth.postTestScore - prePostGrowth.baselineScore);
      prePostGrowth.gainStatus = prePostGrowth.gainDelta > 0 ? 'improved' : prePostGrowth.gainDelta < 0 ? 'declined' : 'maintained';
    } else if (prePostGrowth.baselineScore != null && prePostGrowth.postTestScore == null) {
      prePostGrowth.gainStatus = 'pending_post';
    }

    const growthSubjects: ('Math' | 'Reading' | 'Science')[] =
      teacherSubject === 'Reading' || teacherSubject === 'English' || teacherSubject === 'Filipino'
        ? ['Reading']
        : teacherSubject === 'Math'
        ? ['Math']
        : teacherSubject === 'Science'
        ? ['Science']
        : ['Math', 'Reading', 'Science'];

    growthSubjects.forEach((subj) => {
      const matchesSubj = (aSubj: string) =>
        subj === 'Reading' ? READING_SUBJS.has(aSubj) : aSubj === subj;
      const subPre = omrAssessments.filter((a) => matchesSubj(a.subject) && a.category === 'pre-test');
      const subPost = omrAssessments.filter((a) => matchesSubj(a.subject) && a.category === 'post-test');
      const bScore = subPre.length > 0 ? subPre[subPre.length - 1].score : null;
      const pScore = subPost.length > 0 ? subPost[0].score : null;
      const delta = bScore != null && pScore != null ? Math.round(pScore - bScore) : null;
      const status = delta != null ? (delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'maintained') : bScore != null ? 'pending_post' : 'not_started';
      prePostGrowth.bySubject[subj] = {
        baseline: bScore,
        postTest: pScore,
        delta,
        status,
      };
    });

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
      teacherSubject,
      learner: {
        name: (user as any).studentId?.name || 'Unknown',
        studentNumber: record.studentNumber || (user as any).studentId?.username || '',
        gradeLevel: record.gradeLevel,
        section: record.section,
        guardian: record.guardian || '',
        contact: record.contact || '',
        address: record.address || '',
      },
      performanceLevel: record.masteryStatus || '—',
      riskClassification: record.riskLevel || '—',
      philIri: {
        readingLevel: record.readingLevel || 'Not Assessed',
        oralReadingAccuracy: record.oralReadingAccuracy ?? null,
        oralReadingWpm: record.oralReadingWpm ?? null,
        oralReadingWer: record.oralReadingWer ?? null,
        oralReadingLevel: record.oralReadingLevel || null,
        comprehensionScore: record.comprehensionScore ?? null,
        comprehensionLevel: record.comprehensionLevel || null,
        combinedReadingLevel: record.combinedReadingLevel || null,
        status: record.philIriStatus || 'unassessed',
        lastAssessmentDate: record.lastReadingAssessmentDate || null,
        gstScore: record.gstScore ?? null,
        gstStatus: record.gstStatus || 'Unassessed',
        recommendedStartingLevel: record.recommendedStartingLevel ?? null,
        needsIndividualAssessment: Boolean(record.needsIndividualAssessment),
      },
      omrAssessments,
      prePostGrowth,
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
      record = await LearnerRecord.findOne({ studentNumber: id });
    }
    if (!record) {
      return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
    }

    const teacherSubject = await getTeacherSubject(actor);

    if (!isTeacherAssignedToRecord(record, actor, teacherSubject)) {
      return NextResponse.json({ error: 'Forbidden: You are not assigned to this learner' }, { status: 403 });
    }

    const RISK = ['Low Risk', 'Moderate Risk', 'High Risk', 'Pending Assessment'];
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
      'studentNumber',
      'guardian',
      'contact',
      'address',
      'riskLevel',
      'masteryStatus',
    ];
    for (const f of recordFields) {
      if (body[f] !== undefined) record[f] = body[f] === '' ? undefined : body[f];
    }

    if (body.gstScore !== undefined) {
      if (body.gstScore === null || body.gstScore === '') {
        record.gstScore = null;
        record.gstStatus = 'Unassessed';
        record.recommendedStartingLevel = null;
        record.needsIndividualAssessment = false;
      } else {
        const rawScore = Number(body.gstScore);
        if (Number.isNaN(rawScore) || rawScore < 0 || rawScore > 40) {
          return NextResponse.json({ error: 'GST score must be a number between 0 and 40.' }, { status: 400 });
        }
        const effectiveGrade = body.gradeLevel ? Number(body.gradeLevel) : (record.gradeLevel || 7);
        const gstEval = evaluateGstScore(rawScore, effectiveGrade);
        record.gstScore = rawScore;
        record.gstStatus = gstEval.gstStatus;
        record.recommendedStartingLevel = gstEval.recommendedStartingGrade;
        record.needsIndividualAssessment = !gstEval.isGradeReady;
      }
    }
    await record.save();

    if (record.studentId) {
      const userUpdates: Record<string, string> = {};
      if (body.name && body.name.trim()) userUpdates.name = body.name.trim();
      if (body.studentNumber && body.studentNumber.trim()) userUpdates.username = body.studentNumber.trim();
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(record.studentId, userUpdates);
      }
    }

    const updatedUser = record.studentId ? await User.findById(record.studentId).lean() : null;

    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      role: 'teacher',
      action: 'learner_update',
      targetType: 'LearnerRecord',
      targetId: String(record._id),
      meta: { fields: Object.keys(body) },
    });

    return ok({
      id: String(record._id),
      name: updatedUser?.name || record.name,
      section: record.section,
      gradeLevel: record.gradeLevel,
      studentNumber: record.studentNumber,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Teacher Learner Update API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
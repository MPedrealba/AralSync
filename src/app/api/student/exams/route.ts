import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import AnswerKey from '../../../../../models/AnswerKey';
import Assessment from '../../../../../models/Assessment';
import LearnerRecord from '../../../../../models/LearnerRecord';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['student']);
    await connectDB();

    // 1. Fetch student's record to check section and grade level
    const learner = await LearnerRecord.findOne({ studentId: authUser.id }).lean();
    const studentGrade = learner?.gradeLevel;
    const studentSection = (learner?.section || '').trim().toLowerCase();

    // 2. Query all active online exams
    const query: Record<string, any> = { isOnline: true };
    const allOnlineKeys = await AnswerKey.find(query).sort({ created: -1 }).lean();

    // 3. Filter keys targeted to this student's section/grade if restrictions are set
    const eligibleKeys = allOnlineKeys.filter((k: any) => {
      if (k.targetGrade && studentGrade && k.targetGrade !== studentGrade) {
        return false;
      }
      if (k.targetSection && k.targetSection.trim()) {
        const targetSec = k.targetSection.trim().toLowerCase();
        if (targetSec !== 'all' && studentSection && targetSec !== studentSection) {
          return false;
        }
      }
      return true;
    });

    // 4. Query student's past completed assessments for these keys
    const keyIds = eligibleKeys.map((k: any) => k._id);
    const existingAssessments = await Assessment.find({
      studentId: authUser.id,
      answerKeyRef: { $in: keyIds },
    })
      .sort({ date: -1 })
      .lean();

    const assessmentMap = new Map<string, any>();
    for (const a of existingAssessments) {
      const refStr = String(a.answerKeyRef);
      if (!assessmentMap.has(refStr)) {
        assessmentMap.set(refStr, a);
      }
    }

    // 5. Build response payload
    const formattedExams = eligibleKeys.map((k: any) => {
      const refStr = String(k._id);
      const pastAssessment = assessmentMap.get(refStr);
      const isCompleted = Boolean(pastAssessment);

      const rawAnswers = Array.isArray(k.answers) ? k.answers : (k.answerLetters || []);
      const finalItems = k.questions?.length || rawAnswers.length || k.items || 0;

      return {
        id: refStr,
        title: k.title,
        subject: k.subject || 'General',
        assessmentType: k.assessmentType || (k.title?.toLowerCase().includes('exam') ? 'exam' : 'quiz'),
        topic: k.topic || '',
        topics: Array.isArray(k.topics) && k.topics.length > 0 ? k.topics : (k.topic ? [k.topic] : []),
        items: finalItems,
        timeLimitMinutes: Number(k.timeLimitMinutes) || 0,
        dueDate: k.dueDate || null,
        targetGrade: k.targetGrade ?? null,
        targetSection: k.targetSection || '',
        isOnline: true,
        status: isCompleted ? 'completed' : 'pending',
        score: pastAssessment ? pastAssessment.score : null,
        masteryLevel: pastAssessment ? pastAssessment.masteryLevel : null,
        completedAt: pastAssessment ? pastAssessment.date : null,
        assessmentId: pastAssessment ? String(pastAssessment._id) : null,
        created: k.created,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedExams,
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth';
import connectDB from '../../../../../../../database/db';
import AnswerKey from '../../../../../../../models/AnswerKey';
import Assessment from '../../../../../../../models/Assessment';
import LearnerRecord from '../../../../../../../models/LearnerRecord';
import { logAudit } from '@/lib/audit';
import { syncLearnerPhilIriMetrics, calculateRiskLevelFromScore } from '@/lib/philIriSync';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

function computeMastery(pct: number): string {
  if (pct >= 90) return 'Proficient';
  if (pct >= 75) return 'Approaching';
  if (pct >= 50) return 'Developing';
  return 'Beginning';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = checkRateLimit(req, {
      windowMs: 60 * 1000,
      max: 10,
      keyPrefix: 'student-exam-submit',
    });
    if (!rl.allowed) {
      return rateLimitResponse(rl, 'Submission rate limit reached. Please wait a moment.');
    }

    const authUser = await requireAuth(req, ['student']);
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Exam ID is required.' },
        { status: 400 }
      );
    }

    // 1. Fetch online AnswerKey
    const key = await AnswerKey.findById(id);
    if (!key || !key.isOnline) {
      return NextResponse.json(
        { success: false, error: 'This exam is not active for online submissions.' },
        { status: 404 }
      );
    }

    // 2. Prevent duplicate submission
    const existing = await Assessment.findOne({
      studentId: authUser.id,
      answerKeyRef: key._id,
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'You have already submitted this exam.',
          alreadyCompleted: true,
          score: existing.score,
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const rawAnswers = body?.answers;
    const timeSpentSec = Math.max(0, Number(body?.timeSpentSec) || 0);

    // 3. Extract and normalize teacher's answer key
    const rawKeyAnswers = Array.isArray(key.answers) ? key.answers : (key.answerLetters || []);
    const normalizedKeyAnswers = rawKeyAnswers.map((a: any) => {
      if (!a) return '';
      if (typeof a === 'string') return a.toUpperCase().trim().slice(0, 1);
      if (typeof a === 'object' && a.correctKey) return String(a.correctKey).toUpperCase().trim().slice(0, 1);
      if (typeof a === 'object' && a.letter) return String(a.letter).toUpperCase().trim().slice(0, 1);
      return String(a).toUpperCase().trim().slice(0, 1);
    });

    const keyAnswers: string[] =
      normalizedKeyAnswers.length > 0 && normalizedKeyAnswers.some(Boolean)
        ? normalizedKeyAnswers
        : (key.questions || []).map((q: any) => (q.correctAnswer || q.answer || 'A').toUpperCase().trim().slice(0, 1));

    const totalItems = keyAnswers.length || key.items || 1;

    // 4. Normalize student answers
    const studentAnswers: string[] = [];
    for (let i = 0; i < totalItems; i++) {
      let ans = '';
      if (Array.isArray(rawAnswers)) {
        ans = rawAnswers[i] ?? '';
      } else if (rawAnswers && typeof rawAnswers === 'object') {
        ans = rawAnswers[i] ?? rawAnswers[i + 1] ?? rawAnswers[String(i)] ?? rawAnswers[String(i + 1)] ?? '';
      }
      studentAnswers.push(typeof ans === 'string' ? ans.toUpperCase().trim().slice(0, 1) : '');
    }

    // 5. Auto-grade multiple-choice items
    let mcCorrect = 0;
    for (let i = 0; i < totalItems; i++) {
      if (studentAnswers[i] && keyAnswers[i] && studentAnswers[i] === keyAnswers[i]) {
        mcCorrect++;
      }
    }

    const percentage = totalItems > 0 ? Math.round((mcCorrect / totalItems) * 100) : 0;
    const finalMastery = computeMastery(percentage);
    const calculatedRisk = calculateRiskLevelFromScore(percentage);

    // 6. Create unified Assessment document (deliveryMode: 'online')
    const assessment = new Assessment({
      studentId: authUser.id,
      type: 'OMR',
      deliveryMode: 'online',
      subject: key.subject || 'General',
      title: key.title,
      score: percentage,
      scoredItems: mcCorrect,
      totalItems,
      mcTotal: totalItems,
      writtenMax: 0,
      writtenScore: 0,
      gradingStatus: 'complete',
      status: 'approved',
      masteryLevel: finalMastery,
      competency: key.topic || (key.topics?.[0]) || 'General Assessment',
      topics: key.topics || [],
      answerKeyRef: key._id,
      assessmentCategory: key.assessmentType || 'quiz',
      detectedAnswers: studentAnswers,
      studentAnswers,
      timeSpentSec,
      date: new Date(),
    });

    await assessment.save();

    // 7. Update LearnerRecord with new mastery and risk level
    await LearnerRecord.findOneAndUpdate(
      { studentId: authUser.id },
      { masteryStatus: finalMastery, riskLevel: calculatedRisk }
    ).catch(() => {});

    // If reading, trigger Phil-IRI sync
    if (key.subject === 'Reading') {
      await syncLearnerPhilIriMetrics(authUser.id).catch(() => {});
    }

    // 8. Log Audit Trail
    await logAudit({
      actorId: authUser.id,
      actorName: authUser.name,
      role: 'student',
      action: 'online_exam_submitted',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      meta: {
        examId: String(key._id),
        examTitle: key.title,
        score: percentage,
        mcCorrect,
        totalItems,
        deliveryMode: 'online',
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Exam submitted and graded successfully!',
      data: {
        assessmentId: String(assessment._id),
        score: percentage,
        mcCorrect,
        totalItems,
        masteryLevel: finalMastery,
        riskLevel: calculatedRisk,
        deliveryMode: 'online',
      },
    });
  } catch (e: any) {
    console.error('Error submitting online exam:', e);
    return authErrorResponse(e);
  }
}

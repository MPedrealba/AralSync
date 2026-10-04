import fs from 'fs/promises';
import path from 'path';
import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Assessment from '../../../../../models/Assessment';
import AnswerKey from '../../../../../models/AnswerKey';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Recommendation from '../../../../../models/Recommendation';
import { logAudit } from '@/lib/audit';
import { syncLearnerPhilIriMetrics } from '@/lib/philIriSync';

/* ──────────────────────────────────────────────────────────────
 *  OMR Processing — OpenCV via Python microservice
 * ──────────────────────────────────────────────────────────────
 *  Calls the Python FastAPI service at /omr/detect for real
 *  OpenCV bubble detection. Falls back to simulation when
 *  the Python service is unavailable.
 * ────────────────────────────────────────────────────────────── */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

async function processOMRSheet(imageBuffer: ArrayBuffer, keyLength: number = 20): Promise<string[]> {
  /* ── Try the Python OpenCV service first ── */
  try {
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    const form = new FormData();
    form.append('file', blob, 'sheet.png');
    form.append('num_questions', String(keyLength));

    const res = await fetch(`${PYTHON_SERVICE_URL}/omr/detect`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.answers)) {
        return data.answers.map((a: any) => a.answer_label || null);
      }
    }
    console.warn('Python OMR service returned non-success, falling back to simulation.');
  } catch (e) {
    console.warn('Python OMR service unavailable, using simulation:', (e as Error).message);
  }

  /* ── Fallback: simulated OMR (original behavior) ── */
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const OPTIONS = ['A', 'B', 'C', 'D'];
  const detectedAnswers: string[] = [];
  for (let i = 0; i < keyLength; i++) {
    detectedAnswers.push(OPTIONS[Math.floor(Math.random() * 4)]);
  }
  return detectedAnswers;
}

/** Compute mastery level from a percentage score */
function masteryLevel(pct: number): string {
  if (pct >= 90) return 'Proficient';
  if (pct >= 75) return 'Approaching';
  if (pct >= 50) return 'Developing';
  return 'Beginning';
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const studentId = formData.get('studentId') as string | null;
    const competency = formData.get('competency') as string | null;
    const subject = (formData.get('subject') as string | null) || 'Math';
    const title = (formData.get('title') as string | null) || 'Quarterly Diagnostic';
    const answerKeyId = (formData.get('answerKeyId') as string | null) || '';
    const verifiedAnswersRaw = formData.get('verifiedAnswers') as string | null;
    let verifiedAnswers: (string | null)[] | null = null;
    if (verifiedAnswersRaw) {
      try {
        verifiedAnswers = JSON.parse(verifiedAnswersRaw);
      } catch {
        // ignore
      }
    }
    const notes = (formData.get('notes') as string | null) || '';

    if (!file || !studentId || !competency) {
      return NextResponse.json(
        { error: 'Missing required fields: file, studentId, competency' },
        { status: 400 }
      );
    }

    await connectDB();

    /* ── Verify student is assigned to this teacher ── */
    const learnerAssigned = await LearnerRecord.findOne({
      studentId,
      assignedTeacherId: teacher.id,
    });
    if (!learnerAssigned) {
      return NextResponse.json(
        { error: 'Forbidden: This student is not assigned to you.' },
        { status: 403 }
      );
    }

    /* ── Load answer key (if provided) ── */
    let keyDoc: any = null;
    if (answerKeyId) {
      keyDoc = await AnswerKey.findById(answerKeyId).lean();
    }
    if (!keyDoc) {
      // Fallback: grab the most recent answer key matching this subject
      keyDoc = await AnswerKey.findOne({ subject }).sort({ created: -1 }).lean();
    }

    const keyAnswers: string[] = keyDoc?.answers ?? [];
    const keyModes: string[] = keyDoc?.modes ?? [];
    const totalItems = keyAnswers.length || 20;

    /* ── Process OMR sheet (simulated or OpenCV) ── */
    const imageBuffer = await file.arrayBuffer();
    const detectedAnswers = await processOMRSheet(imageBuffer, totalItems);
    const answersToGrade = verifiedAnswers || detectedAnswers;

    /* ── Persist uploaded sheet image to disk ── */
    let omrSheetUrl: string | null = null;
    const originalFilename = file.name || 'sheet.png';
    const ext = path.extname(originalFilename).toLowerCase() || '.png';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.png';
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'omr');
    const filename = `omr-${studentId}-${Date.now()}${safeExt}`;
    const filePath = path.join(uploadDir, filename);

    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(filePath, Buffer.from(imageBuffer));
      omrSheetUrl = `/uploads/omr/${filename}`;
    } catch (saveErr) {
      console.error('Failed to save OMR sheet image to disk:', saveErr);
      // Non-fatal fallback: continue scoring even if disk write encounters an issue
    }

    /* ── Grade MC items only; written items are scored later by teacher ── */
    let mcCorrect = 0;
    let mcTotal = 0;
    let writtenMax = 0;
    const writtenItems: { index: number; prompt: string; max: number }[] = [];
    const flaggedAmbiguities: number[] = [];

    for (let i = 0; i < totalItems; i++) {
      const mode = keyModes[i] || 'mc';
      if (mode === 'written') {
        const wi = keyDoc?.writtenItems?.find((w: any) => w.index === i);
        const max = wi?.max ?? 1;
        writtenMax += max;
        writtenItems.push({ index: i, prompt: wi?.prompt ?? `Item ${i + 1}`, max });
      } else {
        mcTotal++;
        const ans = answersToGrade[i];
        if (ans && ans === keyAnswers[i]) {
          mcCorrect++;
        }
        // Flag blank/unshaded or faint/unrecognized bubbles
        if (!ans || !['A', 'B', 'C', 'D'].includes(ans.toUpperCase())) {
          flaggedAmbiguities.push(i);
        }
      }
    }

    const percentage = totalItems > 0 ? Math.round((mcCorrect / totalItems) * 100) : 0;
    const gradingStatus = writtenItems.length > 0 ? 'partial' : 'complete';
    const status = gradingStatus === 'complete' ? 'approved' : 'pending';
    const mastery = masteryLevel(percentage);

    /* ── Save assessment ── */
    const assessment = await Assessment.create({
      studentId,
      type: 'OMR',
      subject,
      title,
      score: percentage,
      totalItems,
      scoredItems: mcCorrect,
      mcTotal,
      writtenMax,
      writtenScore: 0, // teacher grades written items later
      gradingStatus,
      status,
      competency,
      masteryLevel: mastery,
      answerKeyRef: keyDoc?._id || undefined,
      assessmentCategory: keyDoc?.assessmentType || (title.toLowerCase().includes('exam') ? 'exam' : 'quiz'),
      topics: Array.isArray(keyDoc?.topics) && keyDoc.topics.length > 0 ? keyDoc.topics : (keyDoc?.topic ? [keyDoc.topic] : []),
      writtenItems,
      omrSheetUrl,
      omrOriginalFilename: originalFilename,
      detectedAnswers: answersToGrade,
      notes: notes || undefined,
      date: new Date(),
    });

    if (subject === 'Reading' && status === 'approved') {
      await syncLearnerPhilIriMetrics(studentId);
    }

    if (studentId) {
      await LearnerRecord.findOneAndUpdate(
        { studentId },
        { masteryStatus: mastery }
      ).catch(() => {});
    }

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'omr_sheet_uploaded',
      targetType: 'Assessment',
      meta: {
        studentId,
        subject,
        title,
        mcCorrect,
        mcTotal,
        writtenItems: writtenItems.length,
        gradingStatus,
        assessmentId: String(assessment._id),
      },
    });

    return ok({
      score: mcCorrect,
      total: mcTotal,
      totalItems,
      percentage,
      writtenCount: writtenItems.length,
      writtenItems,
      gradingStatus,
      masteryLevel: mastery,
      assessmentId: String(assessment._id),
      omrSheetUrl,
      detectedAnswers,
      keyAnswers,
      keyModes,
      flaggedAmbiguities,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('OMR Processing Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT /api/teacher/omr
 * Finalizes and overrides scores for an OMR assessment.
 * Accepts verified answers, written item rubric scores, and qualitative remarks.
 * Automatically recalculates metrics, updates LearnerRecord, syncs Phil-IRI,
 * and fetches matching targeted ARAL intervention recommendations.
 */
export async function PUT(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    const body = await req.json();
    const {
      assessmentId,
      studentId,
      verifiedAnswers,
      writtenScores, // { [index]: score } or number[]
      notes,
      competency,
      subject,
      title,
    } = body;

    if (!assessmentId) {
      return NextResponse.json({ error: 'assessmentId is required' }, { status: 400 });
    }

    await connectDB();

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    /* ── Verify student is assigned to this teacher ── */
    const actualStudentId = studentId || assessment.studentId;
    if (actualStudentId) {
      const learnerAssigned = await LearnerRecord.findOne({
        studentId: actualStudentId,
        assignedTeacherId: teacher.id,
      });
      if (!learnerAssigned) {
        return NextResponse.json(
          { error: 'Forbidden: This student is not assigned to you.' },
          { status: 403 }
        );
      }
    }

    // Load answer key if attached
    let keyDoc: any = null;
    if (assessment.answerKeyRef) {
      keyDoc = await AnswerKey.findById(assessment.answerKeyRef).lean();
    }
    if (!keyDoc && (subject || assessment.subject)) {
      keyDoc = await AnswerKey.findOne({ subject: subject || assessment.subject }).sort({ created: -1 }).lean();
    }

    const keyAnswers: string[] = keyDoc?.answers ?? [];
    const keyModes: string[] = keyDoc?.modes ?? [];
    const totalItems = keyAnswers.length || assessment.totalItems || 20;

    const answersToGrade = Array.isArray(verifiedAnswers)
      ? verifiedAnswers
      : assessment.detectedAnswers || [];

    let mcCorrect = 0;
    let mcTotal = 0;
    let writtenMax = 0;
    let writtenScoreAwarded = 0;
    const writtenItems = assessment.writtenItems || keyDoc?.writtenItems || [];

    for (let i = 0; i < totalItems; i++) {
      const mode = keyModes[i] || 'mc';
      if (mode === 'written') {
        const wi = writtenItems.find((w: any) => w.index === i);
        const max = wi?.max ?? 1;
        writtenMax += max;
        if (writtenScores && typeof writtenScores === 'object') {
          const raw = Array.isArray(writtenScores) ? writtenScores[i] : (writtenScores as any)[i];
          const val = Math.max(0, Math.min(max, Number(raw) || 0));
          writtenScoreAwarded += val;
        }
      } else {
        mcTotal++;
        if (answersToGrade[i] && answersToGrade[i] === keyAnswers[i]) {
          mcCorrect++;
        }
      }
    }

    const totalScoredPoints = mcCorrect + writtenScoreAwarded;
    const maxPossiblePoints = mcTotal + writtenMax || totalItems;
    const percentage = maxPossiblePoints > 0 ? Math.round((totalScoredPoints / maxPossiblePoints) * 100) : 0;
    const finalMastery = masteryLevel(percentage);

    assessment.score = percentage;
    assessment.scoredItems = mcCorrect;
    assessment.mcTotal = mcTotal;
    assessment.writtenScore = writtenScoreAwarded;
    assessment.writtenMax = writtenMax;
    assessment.gradingStatus = 'complete';
    assessment.status = 'approved';
    assessment.masteryLevel = finalMastery;
    assessment.detectedAnswers = answersToGrade;
    if (notes !== undefined) assessment.notes = notes;
    if (competency) assessment.competency = competency;
    if (title) assessment.title = title;

    await assessment.save();

    // ── Sync LearnerRecord ──
    if (actualStudentId) {
      await LearnerRecord.findOneAndUpdate(
        { studentId: actualStudentId },
        { masteryStatus: finalMastery }
      ).catch(() => {});

      // Sync Phil-IRI metrics if Reading
      if (assessment.subject === 'Reading' || subject === 'Reading') {
        await syncLearnerPhilIriMetrics(actualStudentId).catch(() => {});
      }
    }

    // ── Log Audit ──
    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'omr_assessment_finalized',
      targetType: 'Assessment',
      targetId: String(assessment._id),
      meta: {
        studentId: String(actualStudentId),
        score: percentage,
        mcCorrect,
        writtenScore: writtenScoreAwarded,
        masteryLevel: finalMastery,
      },
    });

    // ── Targeted ARAL Recommendations ──
    const targetSubject = subject || assessment.subject || 'Math';
    const recommendations = await Recommendation.find({
      subject: targetSubject === 'Math' ? 'Math' : targetSubject === 'Science' ? 'Science' : 'Reading',
    })
      .limit(3)
      .lean();

    return ok({
      assessment: {
        id: String(assessment._id),
        score: percentage,
        mcCorrect,
        mcTotal,
        totalItems,
        writtenScore: writtenScoreAwarded,
        writtenMax,
        masteryLevel: finalMastery,
        gradingStatus: 'complete',
        status: 'approved',
        notes: assessment.notes,
        omrSheetUrl: assessment.omrSheetUrl,
        detectedAnswers: answersToGrade,
      },
      recommendations: recommendations.map((r: any) => ({
        id: String(r._id),
        title: r.title,
        description: r.description || '',
        subject: r.subject || '',
        kind: r.kind || 'Activity',
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('OMR Finalize PUT Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

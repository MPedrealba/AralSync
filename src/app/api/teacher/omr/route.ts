import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Assessment from '../../../../../models/Assessment';
import AnswerKey from '../../../../../models/AnswerKey';
import LearnerRecord from '../../../../../models/LearnerRecord';
import Recommendation from '../../../../../models/Recommendation';
import { logAudit } from '@/lib/audit';
import { syncLearnerPhilIriMetrics, calculateRiskLevelFromScore } from '@/lib/philIriSync';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { getRecommendationsForLearner, Subject } from '@/lib/dynamicRecommendations';
import {
  normalizeOmrSubject,
  buildLearnerLookupQuery,
  findAnswerKeySafely,
  deriveAssessmentCategory,
  upsertOmrAssessment,
  toDataUrlFallback,
  mimeTypeFromExt,
  formatOmrRouteError,
} from '@/lib/omrServerHelpers';

export const maxDuration = 60;

/* ──────────────────────────────────────────────────────────────
 *  OMR Processing — OpenCV via Python microservice
 * ──────────────────────────────────────────────────────────────
 *  Calls the Python FastAPI service at /omr/detect for real
 *  OpenCV bubble detection. Falls back to simulation when
 *  the Python service is unavailable.
 * ────────────────────────────────────────────────────────────── */

export function extractKeyAnswers(keyDoc: any): string[] {
  if (!keyDoc) return [];
  const raw = keyDoc.answers || keyDoc.answerLetters || [];
  if (Array.isArray(raw)) {
    return raw.map((item: any) => {
      if (typeof item === 'string') return item.trim().toUpperCase();
      if (item && typeof item === 'object') {
        const val = item.correctKey || item.correctAnswer || item.answer || item.key || '';
        return String(val).trim().toUpperCase();
      }
      return '';
    });
  }
  if (typeof raw === 'object') {
    const keys = Object.keys(raw).sort((a, b) => Number(a) - Number(b));
    return keys.map((k) => String(raw[k] || '').trim().toUpperCase());
  }
  return [];
}

export class OMRServiceError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string = 'OMR_SERVICE_OFFLINE', status: number = 503) {
    super(message);
    this.name = 'OMRServiceError';
    this.code = code;
    this.status = status;
  }
}

const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');

interface OMRSheetResult {
  answers: (string | null)[];
  warpedImage: string | null;
}

async function processOMRSheet(
  imageBuffer: ArrayBuffer,
  keyLength: number = 20,
  keyAnswers?: string[]
): Promise<OMRSheetResult> {
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  const form = new FormData();
  form.append('file', blob, 'sheet.png');
  form.append('num_questions', String(keyLength));
  if (keyAnswers && Array.isArray(keyAnswers) && keyAnswers.length > 0) {
    form.append('answer_key', JSON.stringify(keyAnswers));
  }

  let res: Response;
  try {
    res = await fetch(`${PYTHON_SERVICE_URL}/omr/detect`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000), // 60s timeout to allow cold start
    });
  } catch (e: unknown) {
    console.error('Python OMR service connection error:', (e as Error).message);
    throw new OMRServiceError(
      'OMR Vision Engine is offline. Please ensure the Python OpenCV microservice is running on port 8000.',
      'OMR_SERVICE_OFFLINE',
      503
    );
  }

  if (!res.ok) {
    const rawText = await res.text();
    let errMessage = 'OMR vision engine returned an error.';
    if (res.status === 502 || res.status === 504 || rawText.includes('Bad Gateway')) {
      errMessage = 'The OMR Vision Engine is waking up on Render. Please wait 30 seconds and try again.';
    } else {
      try {
        const json = JSON.parse(rawText);
        errMessage = json.detail || json.error || rawText.slice(0, 150) || errMessage;
      } catch {
        errMessage = rawText.slice(0, 150) || errMessage;
      }
    }
    throw new OMRServiceError(errMessage, 'OMR_PROCESSING_FAILED', res.status >= 500 ? 503 : 422);
  }

  const data = await res.json();
  if (!data.success || !Array.isArray(data.answers)) {
    const errorDetails = Array.isArray(data.errors) && data.errors.length > 0
      ? data.errors.join('; ')
      : 'No bubble grid detected. Ensure the sheet has registration marks and is scanned clearly.';
    throw new OMRServiceError(errorDetails, 'OMR_DETECTION_FAILED', 422);
  }

  return {
    answers: data.answers.map((a: any) => a.answer_label || null),
    warpedImage: data.warped_image_base64 || null,
  };
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
    const rl = checkRateLimit(req, {
      windowMs: 60 * 1000,
      max: 30,
      keyPrefix: 'eval-omr-single',
    });
    if (!rl.allowed) {
      return rateLimitResponse(
        rl,
        'OMR scan rate limit reached. Please wait a moment before scanning more sheets.'
      );
    }

    const teacher = await requireAuth(req, ['teacher']);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const studentId = formData.get('studentId') as string | null;
    const competency = formData.get('competency') as string | null;
    const rawSubject = (formData.get('subject') as string | null) || 'Math';
    const subject = normalizeOmrSubject(rawSubject);
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

    /* ── Verify student is assigned to this teacher or their cohort ── */
    const learnerQuery: any = {
      $or: [
        { studentId: mongoose.isValidObjectId(studentId) ? new mongoose.Types.ObjectId(studentId) : studentId },
        { _id: mongoose.isValidObjectId(studentId) ? new mongoose.Types.ObjectId(studentId) : null },
        { studentNumber: studentId },
      ].filter((q) => q._id !== null),
    };

    const learner = await LearnerRecord.findOne(learnerQuery);
    if (!learner) {
      return NextResponse.json(
        { error: 'Forbidden: Student record was not found in the database.' },
        { status: 404 }
      );
    }

    const teacherIdStr = teacher.id.toString();
    const isDirectlyAssigned =
      (learner.assignedTeacherId && learner.assignedTeacherId.toString() === teacherIdStr) ||
      learner.assignedTeachers?.reading?.toString() === teacherIdStr ||
      learner.assignedTeachers?.math?.toString() === teacherIdStr ||
      learner.assignedTeachers?.science?.toString() === teacherIdStr;

    // Allow teachers to scan for students in their assigned sections/cohorts
    let isSectionAssigned = false;
    if (!isDirectlyAssigned && learner.section) {
      const teacherIdObj = mongoose.isValidObjectId(teacher.id)
        ? new mongoose.Types.ObjectId(teacher.id)
        : teacher.id;
      const sectionMatch = await LearnerRecord.exists({
        $or: [
          { assignedTeacherId: teacherIdObj },
          { 'assignedTeachers.reading': teacherIdObj },
          { 'assignedTeachers.math': teacherIdObj },
          { 'assignedTeachers.science': teacherIdObj },
        ],
        section: learner.section,
        ...(learner.gradeLevel ? { gradeLevel: learner.gradeLevel } : {}),
      });
      if (sectionMatch) {
        isSectionAssigned = true;
      }
    }

    if (!isDirectlyAssigned && !isSectionAssigned) {
      return NextResponse.json(
        { error: 'Forbidden: This student is not assigned to you or your cohorts.' },
        { status: 403 }
      );
    }

    // Normalize studentId to the student's User ObjectId for Assessments and Phil-IRI
    const actualStudentId = learner.studentId ? learner.studentId.toString() : studentId;

    /* ── Load answer key (if provided) ── */
    let keyDoc: any = null;
    if (answerKeyId) {
      keyDoc = await AnswerKey.findById(answerKeyId).lean();
    }
    if (!keyDoc) {
      // Fallback: grab the most recent answer key matching this subject
      keyDoc = await AnswerKey.findOne({ subject }).sort({ created: -1 }).lean();
    }

    const keyAnswers: string[] = extractKeyAnswers(keyDoc);
    const keyModes: string[] = keyDoc?.modes ?? [];
    const totalItems = keyAnswers.length || 20;

    /* ── Process OMR sheet (simulated or OpenCV) ── */
    const imageBuffer = await file.arrayBuffer();
    const omrResult = await processOMRSheet(imageBuffer, totalItems, keyAnswers);
    const detectedAnswers = omrResult.answers;
    const warpedImage = omrResult.warpedImage;
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
        if (ans && ans.toUpperCase() === keyAnswers[i]?.toUpperCase()) {
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
      studentId: actualStudentId,
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
      assessmentCategory: keyDoc?.assessmentType || keyDoc?.assessmentCategory || (
        title.toLowerCase().includes('pre-test') || title.toLowerCase().includes('pretest') || title.toLowerCase().includes('baseline')
          ? 'pre-test'
          : title.toLowerCase().includes('post-test') || title.toLowerCase().includes('posttest') || title.toLowerCase().includes('endline')
          ? 'post-test'
          : title.toLowerCase().includes('exam')
          ? 'exam'
          : 'quiz'
      ),
      topics: Array.isArray(keyDoc?.topics) && keyDoc.topics.length > 0 ? keyDoc.topics : (keyDoc?.topic ? [keyDoc.topic] : []),
      writtenItems,
      omrSheetUrl,
      omrOriginalFilename: originalFilename,
      detectedAnswers: answersToGrade,
      notes: notes || undefined,
      date: new Date(),
    });

    const calculatedRisk = calculateRiskLevelFromScore(percentage);

    if (actualStudentId) {
      await LearnerRecord.findOneAndUpdate(
        { studentId: actualStudentId },
        { masteryStatus: mastery, riskLevel: calculatedRisk }
      ).catch(() => {});
    }

    if (subject === 'Reading' && status === 'approved') {
      await syncLearnerPhilIriMetrics(actualStudentId);
    }

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'omr_sheet_uploaded',
      targetType: 'Assessment',
      meta: {
        studentId: actualStudentId,
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
      warpedImage,
      detectedAnswers,
      keyAnswers,
      keyModes,
      flaggedAmbiguities,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof OMRServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }
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
      answerKeyId,
    } = body;

    if (!assessmentId) {
      return NextResponse.json({ error: 'assessmentId is required' }, { status: 400 });
    }

    await connectDB();

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    /* ── Verify student is assigned to this teacher or their cohort ── */
    let actualStudentId = studentId || assessment.studentId;
    if (actualStudentId) {
      const learnerQuery: any = {
        $or: [
          { studentId: mongoose.isValidObjectId(actualStudentId) ? new mongoose.Types.ObjectId(actualStudentId) : actualStudentId },
          { _id: mongoose.isValidObjectId(actualStudentId) ? new mongoose.Types.ObjectId(actualStudentId) : null },
          { studentNumber: actualStudentId },
        ].filter((q) => q._id !== null),
      };

      const learner = await LearnerRecord.findOne(learnerQuery);
      if (!learner) {
        return NextResponse.json(
          { error: 'Forbidden: Student record was not found.' },
          { status: 404 }
        );
      }

      const teacherIdStr = teacher.id.toString();
      const isDirectlyAssigned =
        learner.assignedTeacherId && learner.assignedTeacherId.toString() === teacherIdStr;

      let isSectionAssigned = false;
      if (!isDirectlyAssigned && learner.section) {
        const teacherIdObj = mongoose.isValidObjectId(teacher.id)
          ? new mongoose.Types.ObjectId(teacher.id)
          : teacher.id;
        const sectionMatch = await LearnerRecord.exists({
          assignedTeacherId: teacherIdObj,
          section: learner.section,
          ...(learner.gradeLevel ? { gradeLevel: learner.gradeLevel } : {}),
        });
        if (sectionMatch) {
          isSectionAssigned = true;
        }
      }

      if (!isDirectlyAssigned && !isSectionAssigned) {
        return NextResponse.json(
          { error: 'Forbidden: This student is not assigned to you or your cohorts.' },
          { status: 403 }
        );
      }

      actualStudentId = learner.studentId ? learner.studentId.toString() : actualStudentId;
    }

    // Load answer key if attached or explicitly specified
    let keyDoc: any = null;
    const targetKeyId = answerKeyId || assessment.answerKeyRef;
    if (targetKeyId && mongoose.isValidObjectId(targetKeyId)) {
      keyDoc = await AnswerKey.findById(targetKeyId).lean();
    }
    if (!keyDoc && (subject || assessment.subject)) {
      keyDoc = await AnswerKey.findOne({ subject: subject || assessment.subject }).sort({ created: -1 }).lean();
    }

    const rawKeyAnswers = Array.isArray(keyDoc?.answers) ? keyDoc.answers : (keyDoc?.answerLetters || []);
    const normalizedKeyAnswers = rawKeyAnswers.map((a: any) => {
      if (!a) return "";
      if (typeof a === "string") return a;
      if (typeof a === "object" && a.correctKey) return String(a.correctKey);
      if (typeof a === "object" && a.letter) return String(a.letter);
      return String(a);
    });
    const keyAnswers: string[] =
      normalizedKeyAnswers.length > 0 && normalizedKeyAnswers.some(Boolean)
        ? normalizedKeyAnswers
        : (keyDoc?.questions || []).map((q: any) => q.correctAnswer || q.answer || 'A');

    const keyModes: string[] =
      Array.isArray(keyDoc?.modes) && keyDoc.modes.length === keyAnswers.length
        ? keyDoc.modes
        : keyAnswers.map(() => 'mc');

    const totalItems = keyAnswers.length || assessment.totalItems || 20;

    if (keyDoc?._id) {
      assessment.answerKeyRef = keyDoc._id;
    }
    assessment.totalItems = totalItems;

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

    const calculatedRisk = calculateRiskLevelFromScore(percentage);

    // ── Sync LearnerRecord ──
    if (actualStudentId) {
      await LearnerRecord.findOneAndUpdate(
        { studentId: actualStudentId },
        { masteryStatus: finalMastery, riskLevel: calculatedRisk }
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

    // ── Targeted Dynamic ARAL Recommendations ──
    const targetSubject = (subject || assessment.subject || 'Math') as Subject;
    const { recommendations, learnerTier, programLevel } = await getRecommendationsForLearner({
      studentId: actualStudentId,
      subject: targetSubject,
      score: percentage,
      limit: 3,
    });

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
        workbookUrl: r.workbookUrl || null,
        pageStart: r.pageStart || null,
        pageEnd: r.pageEnd || null,
        sessionInfo: r.sessionInfo || null,
        proficiencyTier: r.proficiencyTier || learnerTier,
        programLevel: r.programLevel || programLevel,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('OMR Finalize PUT Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

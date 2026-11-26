import mongoose from 'mongoose';
import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../../database/db';
import AnswerKey from '../../../../../../../models/AnswerKey';
import LearnerRecord from '../../../../../../../models/LearnerRecord';
import { logAudit } from '@/lib/audit';
import { syncLearnerPhilIriMetrics, calculateRiskLevelFromScore } from '@/lib/philIriSync';
import {
  normalizeOmrSubject,
  buildLearnerLookupQuery,
  findAnswerKeySafely,
  deriveAssessmentCategory,
  upsertOmrAssessment,
  formatOmrRouteError,
} from '@/lib/omrServerHelpers';

interface BatchAssessmentItem {
  studentId: string;
  omrSheetUrl?: string;
  omrOriginalFilename?: string;
  verifiedAnswers: (string | null)[];
  score: number; // percentage
  scoredItems: number;
  totalItems: number;
  masteryLevel: string;
  writtenScores?: Record<number, number>;
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    const body = await req.json();

    const {
      subject: rawSubject = 'Math',
      competency = 'Numeracy',
      title = 'Quarterly Diagnostic Exam',
      answerKeyId,
      gradeLevel,
      section,
      assessments,
    }: {
      subject: string;
      competency: string;
      title: string;
      answerKeyId?: string;
      gradeLevel?: number | string;
      section?: string;
      assessments: BatchAssessmentItem[];
    } = body;

    const subject = normalizeOmrSubject(rawSubject);

    if (!Array.isArray(assessments) || assessments.length === 0) {
      return NextResponse.json(
        { error: 'No assessment records provided to commit.' },
        { status: 400 }
      );
    }

    await connectDB();

    /* ── Load Answer Key (if provided) ── */
    const keyDoc = await findAnswerKeySafely(answerKeyId, subject);

    const keyModes: string[] = keyDoc?.modes ?? [];
    const writtenItems: { index: number; prompt: string; max: number }[] = keyDoc?.writtenItems ?? [];
    let writtenMax = 0;
    writtenItems.forEach((w) => {
      writtenMax += w.max || 1;
    });

    const teacherIdStr = teacher.id.toString();
    const teacherIdObj = mongoose.isValidObjectId(teacher.id)
      ? new mongoose.Types.ObjectId(teacher.id)
      : teacher.id;

    let savedCount = 0;
    const savedAssessmentIds: string[] = [];

    for (const item of assessments) {
      if (!item.studentId) continue;

      // Locate learner record safely (no invalid ObjectId casts)
      const learnerQuery = buildLearnerLookupQuery(item.studentId);

      const learner = await LearnerRecord.findOne(learnerQuery);
      if (!learner) {
        continue;
      }

      // Check teacher assignment or cohort access
      const isDirectlyAssigned =
        (learner.assignedTeacherId && learner.assignedTeacherId.toString() === teacherIdStr) ||
        learner.assignedTeachers?.reading?.toString() === teacherIdStr ||
        learner.assignedTeachers?.math?.toString() === teacherIdStr ||
        learner.assignedTeachers?.science?.toString() === teacherIdStr;

      let isSectionAssigned = false;
      if (!isDirectlyAssigned && learner.section) {
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

      // If not directly or section-assigned, allow if section matches submitted batch cohort
      const isBatchSectionMatch =
        section && learner.section && learner.section.trim().toLowerCase() === section.trim().toLowerCase();

      if (!isDirectlyAssigned && !isSectionAssigned && !isBatchSectionMatch) {
        continue;
      }

      const actualStudentId = learner.studentId ? learner.studentId.toString() : item.studentId;

      // Compute written item scores
      let writtenAwarded = 0;
      if (item.writtenScores && typeof item.writtenScores === 'object') {
        Object.values(item.writtenScores).forEach((sc) => {
          if (typeof sc === 'number') writtenAwarded += sc;
        });
      }

      const totalItems = item.totalItems || 20;
      const scoredItems = item.scoredItems || 0;
      const percentage = item.score ?? (totalItems > 0 ? Math.round((scoredItems / totalItems) * 100) : 0);
      const gradingStatus = writtenItems.length > 0 && writtenAwarded === 0 ? 'partial' : 'complete';
      const status = gradingStatus === 'complete' ? 'approved' : 'pending';

      const assessmentDoc = await upsertOmrAssessment({
        studentId: actualStudentId,
        type: 'OMR',
        subject,
        title,
        score: percentage,
        totalItems,
        scoredItems,
        mcTotal: totalItems - writtenItems.length,
        writtenMax,
        writtenScore: writtenAwarded,
        gradingStatus,
        status,
        competency,
        masteryLevel: item.masteryLevel,
        answerKeyRef: keyDoc?._id || undefined,
        assessmentCategory: deriveAssessmentCategory(keyDoc, title),
        topics: Array.isArray(keyDoc?.topics) && keyDoc.topics.length > 0 ? keyDoc.topics : (keyDoc?.topic ? [keyDoc.topic] : []),
        writtenItems,
        omrSheetUrl: item.omrSheetUrl || null,
        omrOriginalFilename: item.omrOriginalFilename || 'batch-sheet.png',
        detectedAnswers: item.verifiedAnswers || [],
        notes: item.notes || undefined,
        date: new Date(),
      });

      savedCount++;
      savedAssessmentIds.push(String(assessmentDoc._id));

      // Update learner record mastery and risk level
      const calculatedRisk = calculateRiskLevelFromScore(percentage);
      await LearnerRecord.findOneAndUpdate(
        { studentId: actualStudentId },
        { masteryStatus: item.masteryLevel, riskLevel: calculatedRisk }
      ).catch(() => {});

      // Phil-IRI reading metrics sync
      if (
        ['Reading', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'].includes(subject) &&
        status === 'approved'
      ) {
        await syncLearnerPhilIriMetrics(actualStudentId).catch((err) =>
          console.warn('Batch Phil-IRI sync warning:', err)
        );
      }
    }

    await logAudit({
      actorId: teacher.id,
      actorName: teacher.name,
      role: 'teacher',
      action: 'batch_omr_sheets_committed',
      targetType: 'Assessment',
      meta: {
        savedCount,
        totalSubmitted: assessments.length,
        subject,
        competency,
        section: section || 'All',
        gradeLevel: gradeLevel || 'All',
      },
    });

    return ok({
      savedCount,
      totalSubmitted: assessments.length,
      savedAssessmentIds,
      message: `Successfully saved ${savedCount} assessment${savedCount === 1 ? '' : 's'}.`,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return formatOmrRouteError(error, 'Failed to commit batch OMR assessments');
  }
}

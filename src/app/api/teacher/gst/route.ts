import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearnerRecord from '../../../../../models/LearnerRecord';
import { evaluateGstScore } from '@/lib/reading';

/**
 * GET /api/teacher/gst
 * Retrieves class screening roster (DepEd Form 1A data) with Phil-IRI Stage 1 GST scores,
 * DepEd status classification, recommended starting passage levels, and class summary metrics.
 * Supports filtering by grade, section, search, and language stream (english/filipino).
 */
export async function GET(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const gradeParam = searchParams.get('grade');
    const sectionParam = searchParams.get('section');
    const searchParam = (searchParams.get('search') || '').trim().toLowerCase();
    const streamParam = (searchParams.get('stream') || 'english').toLowerCase();
    const isFilipino = streamParam === 'filipino';

    const teacherIdObj = mongoose.Types.ObjectId.isValid(teacher.id)
      ? new mongoose.Types.ObjectId(teacher.id)
      : teacher.id;

    // Strictly scope learners to this teacher's direct or reading/language assignments
    const teacherMatchConditions = [
      { assignedTeacherId: teacher.id },
      { assignedTeacherId: teacherIdObj },
      { 'assignedTeachers.reading': teacher.id },
      { 'assignedTeachers.reading': teacherIdObj },
      { 'assignedTeachers.english': teacher.id },
      { 'assignedTeachers.english': teacherIdObj },
      { 'assignedTeachers.filipino': teacher.id },
      { 'assignedTeachers.filipino': teacherIdObj },
    ];

    const filter: Record<string, any> = {
      $or: teacherMatchConditions,
    };

    if (gradeParam) {
      const g = Number(String(gradeParam).replace(/\D/g, ''));
      if (!Number.isNaN(g) && g > 0) {
        filter.gradeLevel = g;
      }
    }

    if (sectionParam && sectionParam !== 'All') {
      filter.section = sectionParam;
    }

    const records = await LearnerRecord.find(filter)
      .populate('studentId', 'name username email')
      .lean();

    // Available filters: sections belonging to the teacher's assigned learners
    const allSections = await LearnerRecord.distinct('section', {
      $or: teacherMatchConditions,
      section: { $ne: null, $exists: true },
      ...(filter.gradeLevel ? { gradeLevel: filter.gradeLevel } : {}),
    });

    // Map learner rows
    const learners = records
      .map((r: any) => {
        const student = r.studentId || {};
        const name = student.name || 'Unknown Learner';
        const studentId = student._id?.toString() || r._id.toString();
        const gradeLevel = Number(r.gradeLevel) || 7;
        const section = r.section || 'Unassigned';
        const studentNumber = r.studentNumber || 'N/A';

        // Extract language stream metrics
        let gstScore: number | null = null;
        let gstStatus = 'Unassessed';
        let recommendedStartingLevel: number | null = null;
        let needsIndividualAssessment = false;

        if (isFilipino) {
          const fil = r.philIriFilipino;
          if (fil && typeof fil.gstScore === 'number') {
            gstScore = fil.gstScore;
            gstStatus = fil.gstStatus || 'Unassessed';
            recommendedStartingLevel = fil.recommendedStartingLevel ?? null;
            needsIndividualAssessment = !!fil.needsIndividualAssessment;
          } else if (typeof r.gstScore === 'number') {
            gstScore = r.gstScore;
            gstStatus = r.gstStatus || 'Unassessed';
            recommendedStartingLevel = r.recommendedStartingLevel ?? null;
            needsIndividualAssessment = !!r.needsIndividualAssessment;
          }
        } else {
          const eng = r.philIriEnglish;
          if (eng && typeof eng.gstScore === 'number') {
            gstScore = eng.gstScore;
            gstStatus = eng.gstStatus || 'Unassessed';
            recommendedStartingLevel = eng.recommendedStartingLevel ?? null;
            needsIndividualAssessment = !!eng.needsIndividualAssessment;
          } else if (typeof r.gstScore === 'number') {
            gstScore = r.gstScore;
            gstStatus = r.gstStatus || 'Unassessed';
            recommendedStartingLevel = r.recommendedStartingLevel ?? null;
            needsIndividualAssessment = !!r.needsIndividualAssessment;
          }
        }

        // Dynamically compute / ensure accuracy of DepEd Stage 1 evaluation
        if (gstScore !== null) {
          const evaluation = evaluateGstScore(gstScore, gradeLevel);
          gstStatus = isFilipino
            ? evaluation.isGradeReady
              ? 'Handa sa Baitang'
              : 'Nangangailangan ng Karagdagang Pagtataya'
            : evaluation.gstStatus;
          recommendedStartingLevel = evaluation.recommendedStartingGrade;
          needsIndividualAssessment = !evaluation.isGradeReady;
        }

        return {
          id: r._id.toString(),
          studentId,
          name,
          studentNumber,
          gradeLevel,
          section,
          gender: r.gender || (name.toLowerCase().includes('maria') || name.toLowerCase().includes('ana') ? 'Female' : 'Male'),
          gstScore,
          gstStatus,
          isGradeReady: gstScore !== null ? gstScore >= 28 : false,
          recommendedStartingLevel,
          needsIndividualAssessment,
          riskLevel: r.riskLevel || 'Pending Assessment',
        };
      })
      .filter((l: any) => {
        if (!searchParam) return true;
        return (
          l.name.toLowerCase().includes(searchParam) ||
          l.studentNumber.toLowerCase().includes(searchParam)
        );
      });

    // Summary Metrics
    const totalEnrolled = learners.length;
    const screenedLearners = learners.filter((l: any) => l.gstScore !== null);
    const totalScreened = screenedLearners.length;
    const gradeReadyCount = screenedLearners.filter((l: any) => l.gstScore !== null && l.gstScore >= 28).length;
    const needsStage2Count = screenedLearners.filter((l: any) => l.gstScore !== null && l.gstScore < 28).length;

    const gradeReadyPercentage = totalScreened > 0 ? Math.round((gradeReadyCount / totalScreened) * 100) : 0;
    const needsStage2Percentage = totalScreened > 0 ? Math.round((needsStage2Count / totalScreened) * 100) : 0;

    return ok({
      learners,
      summary: {
        totalEnrolled,
        totalScreened,
        gradeReadyCount,
        needsStage2Count,
        gradeReadyPercentage,
        needsStage2Percentage,
        unscreenedCount: totalEnrolled - totalScreened,
      },
      availableSections: allSections.filter(Boolean).sort(),
      stream: isFilipino ? 'filipino' : 'english',
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    console.error('Error in GET /api/teacher/gst:', error);
    return fail('Failed to fetch GST class roster', 500);
  }
}

/**
 * POST /api/teacher/gst
 * Batch or single update for GST raw scores.
 * Automatically runs DepEd Phil-IRI Stage 1 evaluation formula:
 * - Score >= 28: Grade-Ready (exempt from Stage 2)
 * - Score 16-27: Needs Individualized Assessment, starting 2 grades below (floor Grade 4)
 * - Score 0-15: Needs Individualized Assessment, starting 3 grades below (floor Grade 4)
 * Updates root fields and respective language metrics (philIriEnglish / philIriFilipino).
 */
export async function POST(req: NextRequest) {
  try {
    const teacher = await requireAuth(req, ['teacher']);
    await connectDB();

    const body = await req.json();
    const stream = (body.stream || 'english').toLowerCase();
    const isFilipino = stream === 'filipino';

    let updates: Array<{ learnerId: string; gstScore: number | null }> = [];

    if (Array.isArray(body.updates)) {
      updates = body.updates;
    } else if (body.learnerId && (typeof body.gstScore === 'number' || body.gstScore === null)) {
      updates = [{ learnerId: body.learnerId, gstScore: body.gstScore }];
    }

    if (updates.length === 0) {
      return fail('No GST score updates provided', 400);
    }

    const updatedRecords: any[] = [];

    for (const update of updates) {
      const { learnerId, gstScore } = update;
      if (!learnerId) continue;

      const record = await LearnerRecord.findById(learnerId);
      if (!record) continue;

      const gradeLevel = Number(record.gradeLevel) || 7;

      if (gstScore === null || gstScore === undefined || isNaN(Number(gstScore))) {
        // Reset/clear GST score
        record.gstScore = null;
        record.gstStatus = 'Unassessed';
        record.recommendedStartingLevel = null;
        record.needsIndividualAssessment = false;

        if (isFilipino) {
          if (!record.philIriFilipino) record.philIriFilipino = {};
          record.philIriFilipino.gstScore = null;
          record.philIriFilipino.gstStatus = 'Hindi Pa Naitatasa';
          record.philIriFilipino.recommendedStartingLevel = null;
          record.philIriFilipino.needsIndividualAssessment = false;
        } else {
          if (!record.philIriEnglish) record.philIriEnglish = {};
          record.philIriEnglish.gstScore = null;
          record.philIriEnglish.gstStatus = 'Unassessed';
          record.philIriEnglish.recommendedStartingLevel = null;
          record.philIriEnglish.needsIndividualAssessment = false;
        }
      } else {
        const clampedScore = Math.max(0, Math.min(40, Math.round(Number(gstScore))));
        const evalResult = evaluateGstScore(clampedScore, gradeLevel);

        // Update root fields
        record.gstScore = clampedScore;
        record.gstStatus = evalResult.gstStatus;
        record.recommendedStartingLevel = evalResult.recommendedStartingGrade;
        record.needsIndividualAssessment = !evalResult.isGradeReady;

        // Update language-specific metric schema
        if (isFilipino) {
          if (!record.philIriFilipino) record.philIriFilipino = {};
          record.philIriFilipino.gstScore = clampedScore;
          record.philIriFilipino.gstStatus = evalResult.isGradeReady
            ? 'Handa sa Baitang'
            : 'Nangangailangan ng Karagdagang Pagtataya';
          record.philIriFilipino.recommendedStartingLevel = evalResult.recommendedStartingGrade;
          record.philIriFilipino.needsIndividualAssessment = !evalResult.isGradeReady;
        } else {
          if (!record.philIriEnglish) record.philIriEnglish = {};
          record.philIriEnglish.gstScore = clampedScore;
          record.philIriEnglish.gstStatus = evalResult.gstStatus;
          record.philIriEnglish.recommendedStartingLevel = evalResult.recommendedStartingGrade;
          record.philIriEnglish.needsIndividualAssessment = !evalResult.isGradeReady;
        }
      }

      await record.save();
      updatedRecords.push({
        learnerId: record._id.toString(),
        gstScore: record.gstScore,
        gstStatus: record.gstStatus,
        recommendedStartingLevel: record.recommendedStartingLevel,
        needsIndividualAssessment: record.needsIndividualAssessment,
      });
    }

    return ok({
      message: `Successfully updated ${updatedRecords.length} learner GST score(s).`,
      count: updatedRecords.length,
      updatedRecords,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    console.error('Error in POST /api/teacher/gst:', error);
    return fail('Failed to update GST scores', 500);
  }
}

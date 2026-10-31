import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../database/db';
import Assessment from '../../../../../models/Assessment';
import LearnerRecord from '../../../../../models/LearnerRecord';
import mongoose from 'mongoose';
import { getTeacherSubject } from '@/lib/teacherScope';

const SUBJECT_ORDER = ['Numeracy', 'Science', 'Reading'];
const SUBJECT_MAP: Record<string, string> = {
  Math: 'Numeracy',
  Science: 'Science',
  Reading: 'Reading',
};

interface LearnerRecordItem {
  _id?: mongoose.Types.ObjectId;
  gradeLevel?: number | null;
  section?: string | null;
  studentId?: mongoose.Types.ObjectId | null;
}

interface BucketAggItem {
  _id: string;
  below60: number;
  between60_75: number;
  above75: number;
  total: number;
}

interface CompetencyAggItem {
  _id: { subject: string; competency: string };
  avg: number;
}

/**
 * GET /api/teacher/skill-gap
 * Competency mastery: rank distribution per subject (bar chart) and an
 * averaged competency breakdown grouped by subject (skill-gap cards).
 * Optional filters: grade, section. Scoped to teacher's assigned subject.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, ['teacher']);

    await connectDB();

    const teacherSubject = await getTeacherSubject(authUser);

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const section = searchParams.get('section');

    // Gather all available grades and sections from records for stable, dynamic filter dropdowns
    const allRecords: LearnerRecordItem[] = await LearnerRecord.find({})
      .select('gradeLevel section studentId')
      .lean();

    const availableGrades = [
      ...new Set(allRecords.map((r) => (r.gradeLevel != null ? String(r.gradeLevel) : null)).filter(Boolean)),
    ].sort((a, b) => Number(a) - Number(b)) as string[];

    const sectionsByGrade: Record<string, string[]> = {};
    const allSectionsSet = new Set<string>();

    for (const r of allRecords) {
      if (r.section) {
        allSectionsSet.add(r.section);
        if (r.gradeLevel != null) {
          const gKey = String(r.gradeLevel);
          if (!sectionsByGrade[gKey]) sectionsByGrade[gKey] = [];
          if (!sectionsByGrade[gKey].includes(r.section)) {
            sectionsByGrade[gKey].push(r.section);
          }
        }
      }
    }

    for (const g of Object.keys(sectionsByGrade)) {
      sectionsByGrade[g].sort((a, b) => a.localeCompare(b));
    }

    const availableSections = [...allSectionsSet].sort((a, b) => a.localeCompare(b));

    const filterMetadata = {
      grades: availableGrades,
      sections: availableSections,
      sectionsByGrade,
    };

    const relevantOrder =
      teacherSubject !== 'All'
        ? [teacherSubject === 'Math' ? 'Numeracy' : teacherSubject]
        : SUBJECT_ORDER;

    // Resolve the cohort of student ids when filters are present.
    const hasGradeFilter = Boolean(grade && grade !== 'all' && grade !== 'All Grades' && grade.replace(/\D/g, ''));
    const hasSectionFilter = Boolean(section && section !== 'all' && section !== 'All Sections' && section.trim());
    const hasFilter = hasGradeFilter || hasSectionFilter;
    let studentIds: mongoose.Types.ObjectId[] | null = null;

    if (hasFilter) {
      const recordFilter: Record<string, unknown> = {};
      if (hasGradeFilter && grade) {
        const g = Number(grade.replace(/\D/g, ''));
        if (!Number.isNaN(g)) recordFilter.gradeLevel = g;
      }
      if (hasSectionFilter && section) {
        recordFilter.section = section.trim();
      }

      const recs: LearnerRecordItem[] = await LearnerRecord.find(recordFilter).select('studentId').lean();
      studentIds = recs
        .map((r) => r.studentId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

      // If a filter is applied but matches 0 students, return 0% stats immediately (do NOT fall back to all students)
      if (studentIds.length === 0) {
        return ok({
          competencyData: relevantOrder.map((name) => ({
            name,
            below60: 0,
            between60_75: 0,
            above75: 0,
          })),
          skillGaps: [],
          filters: filterMetadata,
        });
      }
    }

    const match: Record<string, unknown> = { score: { $exists: true, $ne: null } };
    if (studentIds) {
      match.studentId = { $in: studentIds };
    }
    if (teacherSubject !== 'All') {
      match.subject = teacherSubject;
    }

    // Bucket counts per subject → percentage bars.
    const bucketAgg: BucketAggItem[] = await Assessment.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subject',
          below60: { $sum: { $cond: [{ $lt: ['$score', 60] }, 1, 0] } },
          between60_75: {
            $sum: {
              $cond: [{ $and: [{ $gte: ['$score', 60] }, { $lte: ['$score', 75] }] }, 1, 0],
            },
          },
          above75: { $sum: { $cond: [{ $gt: ['$score', 75] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]);

    const bucketMap = new Map(
      bucketAgg.map((b) => [
        b._id,
        {
          below60: b.total > 0 ? Math.round((b.below60 / b.total) * 100) : 0,
          between60_75: b.total > 0 ? Math.round((b.between60_75 / b.total) * 100) : 0,
          above75: b.total > 0 ? Math.round((b.above75 / b.total) * 100) : 0,
        },
      ])
    );

    const competencyData = relevantOrder.map((name) => {
      const stats = bucketMap.get(name === 'Numeracy' ? 'Math' : name) || (name === 'Numeracy' ? bucketMap.get('Numeracy') : undefined);
      return {
        name,
        below60: stats?.below60 ?? 0,
        between60_75: stats?.between60_75 ?? 0,
        above75: stats?.above75 ?? 0,
      };
    });

    // Competency-level averages grouped by subject.
    // The competency is normalized BEFORE grouping so assessments created by
    // the reading-fluency flow (which carry no competency label) group
    // together with the seeded ones — otherwise "Oral Reading Fluency" shows
    // twice and comprehension never appears as its own card.
    const competencyAgg: CompetencyAggItem[] = await Assessment.aggregate([
      { $match: match },
      {
        $project: {
          subject: 1,
          score: 1,
          competency: {
            $ifNull: [
              '$competency',
              {
                $cond: [
                  { $eq: ['$type', 'READING_FLUENCY'] },
                  'Oral Reading Fluency',
                  { $cond: [{ $eq: ['$type', 'COMPREHENSION'] }, 'Reading Comprehension', null] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: { subject: '$subject', competency: '$competency' },
          avg: { $avg: '$score' },
        },
      },
      { $sort: { avg: 1 } },
    ]);

    const bySubject: Record<string, Array<{ name: string; mastery: number; level: string }>> = {};
    for (const row of competencyAgg) {
      const key = row._id;
      if (!key?.competency) continue;
      const display = SUBJECT_MAP[key.subject];
      if (!display) continue;
      const avg = Math.round(row.avg);
      const level = avg < 60 ? 'Critical' : avg < 75 ? 'Below' : 'On Track';
      if (!bySubject[display]) bySubject[display] = [];
      bySubject[display].push({ name: key.competency, mastery: avg, level });
    }

    const skillGaps = relevantOrder.map((subject) => ({
      subject,
      competencies: bySubject[subject] || [],
    })).filter((g) => g.competencies.length > 0);

    return ok({
      competencyData,
      skillGaps,
      filters: filterMetadata,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Skill Gap API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

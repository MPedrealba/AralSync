import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import { commitLearnerImportFile, ImportValidationError } from '@/lib/learnerOnboarding';

/**
 * POST /api/coordinator/learners/import
 * Commit a previously-previewed Excel import as Coordinator.
 * Allocates sequential Student Numbers automatically and creates student Users
 * (username = Student Number, default password = student's surname) + LearnerRecords.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req, ['coordinator']);
    await connectDB();

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const assignedTeacherId = form.get('assignedTeacherId') as string | null;

    const summary = await commitLearnerImportFile(file, {
      actorId: actor.id,
      actorName: actor.name,
      role: 'coordinator',
      assignedTeacherId,
    });

    return ok({
      created: summary.created,
      skippedDuplicates: summary.skippedDuplicates,
      failed: summary.failed,
      createdStudentNumbers: summary.createdStudentNumbers,
      createdLearners: summary.createdLearners,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof ImportValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Coordinator learner import error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

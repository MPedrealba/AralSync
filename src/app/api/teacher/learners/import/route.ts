import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import { commitLearnerImportFile, ImportValidationError } from '@/lib/learnerOnboarding';

/**
 * POST /api/teacher/learners/import
 * Commit a previously-previewed Excel import. Allocates sequential Student Numbers
 * automatically and creates student Users + LearnerRecords.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req, ['teacher']);
    await connectDB();

    const form = await req.formData();
    const file = form.get('file') as File | null;

    const summary = await commitLearnerImportFile(file, {
      actorId: actor.id,
      actorName: actor.name,
      role: 'teacher',
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
    console.error('Learner import commit error:', error);
    return NextResponse.json({ error: 'Import failed.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../../database/db';
import { ImportValidationError, previewLearnerImportFile } from '@/lib/learnerOnboarding';

/**
 * POST /api/coordinator/learners/import/preview
 * Parse an uploaded .xlsx/.xls/.csv, detect columns, validate rows, and mark
 * duplicates against the DB for coordinator review before committing.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);
    await connectDB();

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const data = await previewLearnerImportFile(file);
    return ok(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof ImportValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Coordinator learner import preview error:', error);
    return NextResponse.json({ error: 'Failed to parse file.' }, { status: 500 });
  }
}

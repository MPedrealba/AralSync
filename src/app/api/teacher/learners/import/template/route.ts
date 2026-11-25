import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { buildLearnerImportTemplateResponse } from '@/lib/learnerOnboarding';

/**
 * GET /api/teacher/learners/import/template
 * Streams an .xlsx template with canonical headers (Student Number is auto-generated).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);
    return buildLearnerImportTemplateResponse();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Learner import template error:', error);
    return NextResponse.json({ error: 'Failed to generate template.' }, { status: 500 });
  }
}

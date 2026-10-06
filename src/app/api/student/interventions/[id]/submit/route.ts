import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../../database/db';
import Intervention from '../../../../../../../models/Intervention';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/student/interventions/[id]/submit
 * Allows logged-in students to submit their response (text and/or file upload)
 * and marks status as "Submitted".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId, name: studentName } = await requireAuth(req, ['student']);
    const { id } = await params;

    await connectDB();

    const intervention = await Intervention.findById(id);
    if (!intervention) {
      return fail('Intervention not found', 404);
    }

    if (intervention.studentId.toString() !== userId) {
      return fail('You can only submit your own assigned interventions', 403);
    }

    if (intervention.status === 'Reviewed' || intervention.status === 'Completed') {
      return fail('This assignment has already been graded and cannot be resubmitted', 400);
    }

    let submissionText = '';
    let submissionFileUrl: string | null = null;
    let removeFile = false;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      submissionText = (formData.get('submissionText') as string || '').trim();
      removeFile = formData.get('removeFile') === 'true';
      const file = formData.get('file') as File | null;

      if (file && file.size > 0) {
        const origName = file.name || 'submission.pdf';
        const ext = path.extname(origName).toLowerCase() || '.pdf';
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'submissions');
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `sub-${userId}-${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, filename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        submissionFileUrl = `/uploads/submissions/${filename}`;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      submissionText = (body.submissionText || '').trim();
      submissionFileUrl = body.submissionFileUrl || null;
      removeFile = body.removeFile === true;
    }

    const currentFile = removeFile ? null : (submissionFileUrl || intervention.submissionFileUrl);

    // Require at least text or file
    if (!submissionText && !currentFile) {
      return fail('Please provide a written response or upload a completed worksheet file.', 400);
    }

    intervention.submissionText = submissionText;
    if (submissionFileUrl) {
      intervention.submissionFileUrl = submissionFileUrl;
    } else if (removeFile) {
      intervention.submissionFileUrl = null;
    }

    intervention.submittedAt = new Date();
    intervention.status = 'Submitted';
    await intervention.save();

    await logAudit({
      actorId: userId,
      actorName: studentName,
      role: 'student',
      action: 'intervention_submitted',
      targetType: 'Intervention',
      targetId: intervention._id.toString(),
      meta: {
        title: intervention.title,
        status: 'Submitted',
        hasFile: Boolean(submissionFileUrl || intervention.submissionFileUrl),
        hasText: Boolean(submissionText || intervention.submissionText),
      },
    });

    return ok({
      id: intervention._id.toString(),
      title: intervention.title,
      status: intervention.status,
      submittedAt: intervention.submittedAt,
      submissionText: intervention.submissionText,
      submissionFileUrl: intervention.submissionFileUrl,
      teacherRemarks: intervention.teacherRemarks || '',
      gradeScore: intervention.gradeScore ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Student Submit Intervention API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

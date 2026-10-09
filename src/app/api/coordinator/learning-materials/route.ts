import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../database/db';
import LearningMaterial from '../../../../../models/LearningMaterial';
import { logAudit } from '@/lib/audit';
import { ensureDefaultLearningMaterials } from '@/lib/learningMaterialsSeed';

/**
 * POST /api/coordinator/learning-materials
 * Coordinator/Admin-only route. Accepts FormData with uploaded PDF file or JSON,
 * title, subject, keyStage, edition, type, and optional session mapping.
 */
export async function POST(req: NextRequest) {
  try {
    const coordinator = await requireAuth(req, ['coordinator', 'principal']);
    await connectDB();
    await ensureDefaultLearningMaterials();

    const contentType = req.headers.get('content-type') || '';
    let title = '';
    let subject = 'General';
    let keyStage = 'General';
    let gradeLevels: number[] = [];
    let edition = 'DepEd ARAL Current';
    let type = 'Learner Workbook';
    let fileUrl = '';
    let isActive = true;
    let sessionDirectory: Array<{ sessionName: string; pageStart: number; pageEnd: number; topic?: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      title = (formData.get('title') as string || '').trim();
      subject = (formData.get('subject') as string || 'General').trim();
      keyStage = (formData.get('keyStage') as string || 'General').trim();
      edition = (formData.get('edition') as string || 'DepEd ARAL Current').trim();
      type = (formData.get('type') as string || 'Learner Workbook').trim();
      const explicitFileUrl = (formData.get('fileUrl') as string || '').trim();
      isActive = formData.get('isActive') !== 'false';

      // Parse grade levels
      const rawGrades = formData.get('gradeLevels');
      if (rawGrades) {
        try {
          if (typeof rawGrades === 'string' && rawGrades.startsWith('[')) {
            gradeLevels = JSON.parse(rawGrades).map(Number).filter((n: number) => !Number.isNaN(n));
          } else if (typeof rawGrades === 'string') {
            gradeLevels = rawGrades.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
          }
        } catch {
          gradeLevels = [];
        }
      }

      // Parse session directory
      const rawSessions = formData.get('sessionDirectory');
      if (rawSessions && typeof rawSessions === 'string') {
        try {
          const parsed = JSON.parse(rawSessions);
          if (Array.isArray(parsed)) {
            sessionDirectory = parsed
              .filter((s: any) => s && s.sessionName)
              .map((s: any) => ({
                sessionName: String(s.sessionName).trim(),
                pageStart: Number(s.pageStart) || 1,
                pageEnd: Number(s.pageEnd) || Number(s.pageStart) || 1,
                topic: String(s.topic || '').trim(),
              }));
          }
        } catch {
          sessionDirectory = [];
        }
      }

      // Check uploaded file
      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        const origName = file.name || 'material.pdf';
        const ext = path.extname(origName).toLowerCase() || '.pdf';
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'materials');
        await fs.mkdir(uploadDir, { recursive: true });

        const safeBase = origName
          .replace(ext, '')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-');
        const filename = `${safeBase}-${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, filename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        fileUrl = `/uploads/materials/${filename}`;
      } else if (explicitFileUrl) {
        fileUrl = explicitFileUrl;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      title = (body.title || '').trim();
      subject = body.subject || 'General';
      keyStage = body.keyStage || 'General';
      gradeLevels = Array.isArray(body.gradeLevels) ? body.gradeLevels.map(Number).filter((n: number) => !Number.isNaN(n)) : [];
      edition = (body.edition || 'DepEd ARAL Current').trim();
      type = body.type || 'Learner Workbook';
      fileUrl = (body.fileUrl || '').trim();
      isActive = body.isActive !== false;
      if (Array.isArray(body.sessionDirectory)) {
        sessionDirectory = body.sessionDirectory.map((s: any) => ({
          sessionName: String(s.sessionName).trim(),
          pageStart: Number(s.pageStart) || 1,
          pageEnd: Number(s.pageEnd) || Number(s.pageStart) || 1,
          topic: String(s.topic || '').trim(),
        }));
      }
    }

    if (!title) {
      return fail('Material title is required.', 400);
    }

    if (!fileUrl) {
      return fail('A PDF file or valid file URL is required.', 400);
    }

    const created: any = await (LearningMaterial as any).create({
      title,
      subject,
      keyStage,
      gradeLevels,
      edition,
      type,
      fileUrl,
      isActive,
      sessionDirectory,
      uploadedBy: coordinator.id,
      createdAt: new Date(),
    });

    await logAudit({
      actorId: coordinator.id,
      actorName: coordinator.name,
      role: coordinator.role,
      action: 'learning_material_created',
      targetType: 'LearningMaterial',
      targetId: created._id.toString(),
      meta: {
        title,
        edition,
        subject,
        keyStage,
        type,
        fileUrl,
        sessionCount: sessionDirectory.length,
      },
    });

    return ok({
      message: `Created learning material "${title}".`,
      material: created,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Create Learning Material API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import LearningMaterial from '../../../../../../models/LearningMaterial';
import { logAudit } from '@/lib/audit';

/**
 * PATCH /api/coordinator/learning-materials/[id]
 * Updates title, edition, subject, keyStage, gradeLevels, type, isActive, sessionDirectory,
 * and supports re-uploading / replacing the PDF file directly via multipart/form-data.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const coordinator = await requireAuth(req, ['coordinator', 'principal']);
    const { id } = await params;

    if (!id) return fail('Material ID is required', 400);

    await connectDB();
    const material = await LearningMaterial.findById(id);
    if (!material) {
      return fail('Learning material not found', 404);
    }

    const contentType = req.headers.get('content-type') || '';
    let title: any;
    let subject: any;
    let keyStage: any;
    let gradeLevels: any;
    let edition: any;
    let type: any;
    let fileUrl: any;
    let isActive: any;
    let sessionDirectory: any;
    let uploadedFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      title = formData.get('title');
      subject = formData.get('subject');
      keyStage = formData.get('keyStage');
      edition = formData.get('edition');
      type = formData.get('type');
      fileUrl = formData.get('fileUrl');

      const rawActive = formData.get('isActive');
      if (rawActive !== null && rawActive !== undefined) {
        isActive = String(rawActive) === 'true';
      }

      const rawGrades = formData.get('gradeLevels');
      if (rawGrades && typeof rawGrades === 'string') {
        try {
          const parsed = JSON.parse(rawGrades);
          if (Array.isArray(parsed)) {
            gradeLevels = parsed.map(Number).filter((n) => !Number.isNaN(n));
          }
        } catch {
          gradeLevels = rawGrades
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => !Number.isNaN(n));
        }
      }

      const rawSessions = formData.get('sessionDirectory');
      if (rawSessions && typeof rawSessions === 'string') {
        try {
          const parsed = JSON.parse(rawSessions);
          if (Array.isArray(parsed)) sessionDirectory = parsed;
        } catch {
          sessionDirectory = [];
        }
      }

      const f = formData.get('file');
      if (f && typeof f === 'object' && 'arrayBuffer' in f && (f as File).size > 0) {
        uploadedFile = f as File;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      title = body.title;
      subject = body.subject;
      keyStage = body.keyStage;
      gradeLevels = body.gradeLevels;
      edition = body.edition;
      type = body.type;
      fileUrl = body.fileUrl;
      isActive = body.isActive;
      sessionDirectory = body.sessionDirectory;
    }

    // Handle replacement file upload
    if (uploadedFile && uploadedFile.size > 0) {
      const ext = path.extname(uploadedFile.name || 'material.pdf').toLowerCase() || '.pdf';
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'materials');
      await fs.mkdir(uploadDir, { recursive: true });

      const cleanBase = (uploadedFile.name || 'material')
        .replace(ext, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const filename = `aral_mat_${cleanBase || 'doc'}_${Date.now()}${ext}`;
      const filePath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await uploadedFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      // Clean up old file if it existed in public/uploads/materials
      const oldFileUrl = material.fileUrl;
      if (oldFileUrl && typeof oldFileUrl === 'string' && oldFileUrl.startsWith('/uploads/materials/')) {
        const oldClean = oldFileUrl.split(/[#?]/)[0].trim().replace(/^\/+/, '');
        const oldPath = path.resolve(process.cwd(), 'public', oldClean);
        const expectedBaseDir = path.resolve(process.cwd(), 'public', 'uploads', 'materials');
        if (oldPath.startsWith(expectedBaseDir)) {
          try {
            await fs.unlink(oldPath);
          } catch {
            // Ignore if file was missing
          }
        }
      }

      material.fileUrl = `/uploads/materials/${filename}`;
    } else if (fileUrl !== undefined && String(fileUrl).trim()) {
      material.fileUrl = String(fileUrl).trim();
    }

    if (title !== undefined && title !== null) material.title = String(title).trim();
    if (subject !== undefined && subject !== null) material.subject = subject;
    if (keyStage !== undefined && keyStage !== null) material.keyStage = keyStage;
    if (Array.isArray(gradeLevels)) {
      material.gradeLevels = gradeLevels.map(Number).filter((n) => !Number.isNaN(n));
    }
    if (edition !== undefined && edition !== null) material.edition = String(edition).trim();
    if (type !== undefined && type !== null) material.type = type;
    if (isActive !== undefined && isActive !== null) material.isActive = Boolean(isActive);

    if (Array.isArray(sessionDirectory)) {
      material.set(
        'sessionDirectory',
        sessionDirectory
          .filter((s: any) => s && s.sessionName)
          .map((s: any) => ({
            sessionName: String(s.sessionName).trim(),
            pageStart: Number(s.pageStart) || 1,
            pageEnd: Number(s.pageEnd) || Number(s.pageStart) || 1,
            topic: String(s.topic || '').trim(),
          }))
      );
    }

    await material.save();

    await logAudit({
      actorId: coordinator.id,
      actorName: coordinator.name,
      role: coordinator.role,
      action: 'learning_material_updated',
      targetType: 'LearningMaterial',
      targetId: material._id.toString(),
      meta: {
        title: material.title,
        edition: material.edition,
        isActive: material.isActive,
        replacedFile: Boolean(uploadedFile),
        fileUrl: material.fileUrl,
        sessionCount: material.sessionDirectory?.length || 0,
      },
    });

    return ok({
      message: 'Learning material updated successfully.',
      material,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Update Learning Material API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coordinator/learning-materials/[id]
 * Soft-deletes / archives the material (or hard-deletes if ?permanent=true).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const coordinator = await requireAuth(req, ['coordinator', 'principal']);
    const { id } = await params;

    if (!id) return fail('Material ID is required', 400);

    await connectDB();
    const material = await LearningMaterial.findById(id);
    if (!material) {
      return fail('Learning material not found', 404);
    }

    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      await LearningMaterial.findByIdAndDelete(id);
      await logAudit({
        actorId: coordinator.id,
        actorName: coordinator.name,
        role: coordinator.role,
        action: 'learning_material_deleted',
        targetType: 'LearningMaterial',
        targetId: id,
        meta: { title: material.title, edition: material.edition },
      });

      return ok({ message: `Material "${material.title}" permanently deleted.` });
    }

    // Default: Soft-delete / Archive
    material.isActive = false;
    await material.save();

    await logAudit({
      actorId: coordinator.id,
      actorName: coordinator.name,
      role: coordinator.role,
      action: 'learning_material_archived',
      targetType: 'LearningMaterial',
      targetId: material._id.toString(),
      meta: { title: material.title, edition: material.edition },
    });

    return ok({
      message: `Material "${material.title}" archived successfully.`,
      material,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Delete Learning Material API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

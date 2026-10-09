import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import LearningMaterial from '../../../../../../models/LearningMaterial';
import { logAudit } from '@/lib/audit';

/**
 * PATCH /api/coordinator/learning-materials/[id]
 * Updates title, edition, subject, keyStage, gradeLevels, type, isActive, or sessionDirectory.
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

    const body = await req.json();
    const {
      title,
      subject,
      keyStage,
      gradeLevels,
      edition,
      type,
      fileUrl,
      isActive,
      sessionDirectory,
    } = body || {};

    if (title !== undefined) material.title = String(title).trim();
    if (subject !== undefined) material.subject = subject;
    if (keyStage !== undefined) material.keyStage = keyStage;
    if (Array.isArray(gradeLevels)) material.gradeLevels = gradeLevels.map(Number).filter((n) => !Number.isNaN(n));
    if (edition !== undefined) material.edition = String(edition).trim();
    if (type !== undefined) material.type = type;
    if (fileUrl !== undefined) material.fileUrl = String(fileUrl).trim();
    if (isActive !== undefined) material.isActive = Boolean(isActive);

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

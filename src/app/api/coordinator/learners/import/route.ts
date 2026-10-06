import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../../database/db';
import User from '../../../../../../models/User';
import LearnerRecord from '../../../../../../models/LearnerRecord';
import { parseWorksheet } from '@/lib/learnerImport';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/coordinator/learners/import
 * Commit a previously-previewed Excel import as Coordinator.
 * Creates student Users (username & password = LRN) + LearnerRecords.
 * Optionally assigns all newly imported learners to a designated teacher.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req, ['coordinator']);
    await connectDB();

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const assignedTeacherId = form.get('assignedTeacherId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });
    }
    const ext = (file.name || '').split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    let teacherDoc: any = null;
    if (assignedTeacherId && assignedTeacherId !== 'unassigned') {
      teacherDoc = await User.findById(assignedTeacherId);
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      return NextResponse.json({ error: 'No sheet found in the file.' }, { status: 400 });
    }

    const existing = await LearnerRecord.find({}, { lrn: 1 }).lean();
    const existingLrns = new Set(
      existing.map((r: any) => (r.lrn || '').toString().trim().toLowerCase())
    );

    const result = parseWorksheet(ws, existingLrns);

    const createdLrns: string[] = [];
    let skippedDuplicates = 0;
    const failed: { row: number; reason: string }[] = [];

    for (const r of result.rows) {
      if (r.status === 'invalid') {
        failed.push({ row: r.row, reason: r.issues.join('; ') });
        continue;
      }
      const data = r.data!;
      const lrnKey = data.lrn.trim().toLowerCase();
      if (existingLrns.has(lrnKey)) {
        skippedDuplicates++;
        continue;
      }
      try {
        const userDoc = await User.create({
          username: data.lrn,
          password: await bcrypt.hash(data.lrn, 10),
          name: data.name,
          role: 'student',
          active: true,
        });
        await LearnerRecord.create({
          studentId: userDoc._id,
          lrn: data.lrn,
          gradeLevel: data.gradeLevel ?? undefined,
          section: data.section || undefined,
          guardian: data.guardian || undefined,
          contact: data.contact || undefined,
          address: data.address || undefined,
          riskLevel: 'Pending Assessment',
          masteryStatus: 'Beginning',
          assignedTeacherId: teacherDoc ? teacherDoc._id : null,
          assignedTeacherName: teacherDoc ? teacherDoc.name : null,
        });
        existingLrns.add(lrnKey);
        createdLrns.push(data.lrn);
      } catch (e: any) {
        if (e && e.code === 11000) skippedDuplicates++;
        else failed.push({ row: r.row, reason: 'Database error' });
      }
    }

    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      role: 'coordinator',
      action: 'learner_import',
      targetType: 'LearnerRecord',
      meta: {
        created: createdLrns.length,
        skippedDuplicates,
        failed: failed.length,
        assignedTeacherId: teacherDoc?._id?.toString() || null,
        assignedTeacherName: teacherDoc?.name || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        created: createdLrns.length,
        skippedDuplicates,
        failed,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Coordinator learner import error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

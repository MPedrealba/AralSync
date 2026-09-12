import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../../database/db';
import LearnerRecord from '../../../../../../../models/LearnerRecord';
import { parseWorksheet } from '@/lib/learnerImport';

/**
 * POST /api/teacher/learners/import/preview
 * Parse an uploaded .xlsx/.xls/.csv, detect columns, validate rows, and mark
 * duplicates against the DB. Nothing is written — this is the confirm step
 * before the teacher commits the import.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);
    await connectDB();

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });
    }
    const ext = (file.name || '').split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv.' },
        { status: 400 }
      );
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
    if (result.counts.total === 0) {
      return NextResponse.json(
        { error: 'No data rows found. The file should have a header row followed by student rows.' },
        { status: 400 }
      );
    }

    return ok({ ...result, fileName: file.name });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Learner import preview error:', error);
    return NextResponse.json(
      { error: 'Failed to parse the file. Please ensure it is a valid Excel file.' },
      { status: 500 }
    );
  }
}

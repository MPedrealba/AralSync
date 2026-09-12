import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';

/**
 * GET /api/teacher/learners/import/template
 * Streams a one-row .xlsx template with the canonical headers so teachers can
 * format their student records to import cleanly.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    const headers = [
      'LRN',
      'Name',
      'Grade Level',
      'Section',
      'Guardian Name',
      'Contact Number',
      'Address',
    ];
    const data = [
      headers,
      ['123456789012', 'Juan Dela Cruz', 'Grade 7', 'Rosal', 'Maria Dela Cruz', '09171234567', 'Brgy. San Isidro'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Learners');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="learner-import-template.xlsx"',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Learner import template error:', error);
    return NextResponse.json({ error: 'Failed to generate template.' }, { status: 500 });
  }
}

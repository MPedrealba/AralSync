import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';

/**
 * GET /api/coordinator/learners/import/template
 * Streams a one-row .xlsx template with the canonical headers so coordinators
 * can easily distribute or use a standardized format.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['coordinator']);

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
      ['102948', 'Christian Santos', 'Grade 7', 'Rosal', 'Gloria Santos', '09171234567', 'Brgy. San Isidro'],
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
    console.error('Coordinator import template error:', error);
    return NextResponse.json({ error: 'Failed to generate template.' }, { status: 500 });
  }
}

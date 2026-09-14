import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok, fail } from '@/lib/api';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/teacher/answer-keys/scan
 * Detect the bubbled answers on a scanned ANSWER-KEY sheet — the teacher bubbles the
 * correct answer once per item, then this reads those bubbles. Reuses the same OpenCV
 * /omr/detect service that grades student sheets, so the key and the student sheets
 * are read with identical logic.
 *
 * Deliberately NO simulation fallback: a scanned key must come from real OCR detection,
 * otherwise it would store a random key and silently misgrade everything. If the Python
 * service is down we error out and tell the teacher to start it.
 *
 * This route only detects — it does NOT save. The UI shows the detected letters for
 * review (so the teacher can correct any misreads) and saves via POST /answer-keys.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher']);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const numQuestions = Math.max(1, Number(formData.get('items')) || 20);

    if (!file) {
      return fail('Please provide a scanned answer-key sheet image.', 400);
    }

    const imageBuffer = await file.arrayBuffer();

    /* ── Call the Python OMR service (no simulation fallback) ── */
    let letters: (string | null)[] | null = null;
    let detail = '';
    try {
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      const form = new FormData();
      form.append('file', blob, 'key-sheet.png');
      form.append('num_questions', String(numQuestions));

      const res = await fetch(`${PYTHON_SERVICE_URL}/omr/detect`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.answers)) {
          letters = data.answers.map((a: any) => a.answer_label || null);
        } else {
          detail = (data.errors || ['Unknown detection error']).join(' ');
        }
      } else {
        detail = `Detection service responded with status ${res.status}.`;
      }
    } catch (e) {
      detail = (e as Error).message;
    }

    if (!letters) {
      console.error('Scan key sheet — OMR service unavailable:', detail);
      return fail(
        'Could not read the key sheet — the Python OMR service is not running. ' +
          'Start it (see python-service/, port 8000) so real OCR detection can run. ' +
          `Detail: ${detail}`,
        503
      );
    }

    const detected = letters.map((l, i) => ({ item: i + 1, letter: l }));

    return ok({
      title: (formData.get('title') as string) || '',
      subject: (formData.get('subject') as string) || '',
      items: numQuestions,
      detected,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Scan Answer Key API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
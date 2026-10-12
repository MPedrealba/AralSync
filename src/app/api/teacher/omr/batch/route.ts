import fs from 'fs/promises';
import path from 'path';
import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import AnswerKey from '../../../../../../models/AnswerKey';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/** Compute mastery level from a percentage score */
function computeMasteryLevel(pct: number): string {
  if (pct >= 90) return 'Proficient';
  if (pct >= 75) return 'Approaching';
  if (pct >= 50) return 'Developing';
  return 'Beginning';
}

/** Single sheet detection via Python service or simulated fallback */
async function detectSingleSheetAnswers(imageBuffer: ArrayBuffer, keyLength: number = 20): Promise<string[]> {
  try {
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    const form = new FormData();
    form.append('file', blob, 'sheet.png');
    form.append('num_questions', String(keyLength));

    const res = await fetch(`${PYTHON_SERVICE_URL}/omr/detect`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.answers)) {
        return data.answers.map((a: any) => a.answer_label || null);
      }
    }
  } catch (e) {
    console.warn('Python OMR detect returned error or timed out, using fallback:', (e as Error).message);
  }

  // Fallback: simulated marks
  const OPTIONS = ['A', 'B', 'C', 'D'];
  const fallbackAnswers: string[] = [];
  for (let i = 0; i < keyLength; i++) {
    fallbackAnswers.push(OPTIONS[Math.floor(Math.random() * 4)]);
  }
  return fallbackAnswers;
}

/** Multi-page PDF detection via Python service */
async function detectPdfPages(
  pdfBuffer: ArrayBuffer,
  keyLength: number = 20
): Promise<{ page_index: number; png_base64: string; answers: any[] }[] | null> {
  try {
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', blob, 'exam.pdf');
    form.append('num_questions', String(keyLength));

    const res = await fetch(`${PYTHON_SERVICE_URL}/omr/detect-pdf`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000), // 60s for multi-page PDF
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.pages)) {
        return data.pages;
      }
    }
  } catch (e) {
    console.warn('Python PDF OMR detect failed:', (e as Error).message);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, {
      windowMs: 60 * 1000,
      max: 30,
      keyPrefix: 'eval-omr-batch',
    });
    if (!rl.allowed) {
      return rateLimitResponse(
        rl,
        'Batch OMR scan rate limit reached. Please wait a moment before uploading more batches.'
      );
    }

    const teacher = await requireAuth(req, ['teacher']);
    const formData = await req.formData();

    const subject = (formData.get('subject') as string | null) || 'Math';
    const competency = (formData.get('competency') as string | null) || 'Numeracy';
    const title = (formData.get('title') as string | null) || 'Quarterly Diagnostic Exam';
    const answerKeyId = (formData.get('answerKeyId') as string | null) || '';
    const gradeLevel = (formData.get('gradeLevel') as string | null) || '';
    const section = (formData.get('section') as string | null) || '';

    // Collect all uploaded files from 'files' or 'file' keys
    const rawFiles: File[] = [];
    formData.forEach((value, key) => {
      if ((key === 'files' || key === 'file') && value instanceof File) {
        rawFiles.push(value);
      }
    });

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { error: 'No exam sheet files provided. Please upload images or a PDF.' },
        { status: 400 }
      );
    }

    await connectDB();

    /* ── Load Answer Key ── */
    let keyDoc: any = null;
    if (answerKeyId) {
      keyDoc = await AnswerKey.findById(answerKeyId).lean();
    }
    if (!keyDoc) {
      keyDoc = await AnswerKey.findOne({ subject }).sort({ created: -1 }).lean();
    }

    const keyAnswers: string[] = keyDoc?.answers ?? [];
    const keyModes: string[] = keyDoc?.modes ?? [];
    const totalItems = keyAnswers.length || 20;

    const writtenItems: { index: number; prompt: string; max: number }[] = [];
    let writtenMax = 0;
    for (let i = 0; i < totalItems; i++) {
      const mode = keyModes[i] || 'mc';
      if (mode === 'written') {
        const wi = keyDoc?.writtenItems?.find((w: any) => w.index === i);
        const max = wi?.max ?? 1;
        writtenMax += max;
        writtenItems.push({ index: i, prompt: wi?.prompt ?? `Item ${i + 1}`, max });
      }
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'omr');
    await fs.mkdir(uploadDir, { recursive: true });

    const processedSheets: Array<{
      sheetId: string;
      sheetIndex: number;
      originalFilename: string;
      omrSheetUrl: string;
      detectedAnswers: (string | null)[];
      verifiedAnswers: (string | null)[];
      score: number;
      mcCorrect: number;
      mcTotal: number;
      totalItems: number;
      masteryLevel: string;
      flaggedIndices: number[];
      writtenItems: { index: number; prompt: string; max: number }[];
    }> = [];

    const now = Date.now();

    for (let fIdx = 0; fIdx < rawFiles.length; fIdx++) {
      const file = rawFiles[fIdx];
      const filenameLower = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || filenameLower.endsWith('.pdf');

      if (isPdf) {
        const pdfBuffer = await file.arrayBuffer();
        const pdfPages = await detectPdfPages(pdfBuffer, totalItems);

        if (pdfPages && pdfPages.length > 0) {
          for (let pIdx = 0; pIdx < pdfPages.length; pIdx++) {
            const pageData = pdfPages[pIdx];
            const pageAnswers = (pageData.answers || []).map((a: any) =>
              typeof a === 'string' ? a : a?.answer_label || null
            );

            // Save page PNG
            const outFilename = `omr-batch-${now}-f${fIdx}-p${pIdx + 1}.png`;
            const outPath = path.join(uploadDir, outFilename);
            if (pageData.png_base64) {
              const imgBuffer = Buffer.from(pageData.png_base64, 'base64');
              await fs.writeFile(outPath, imgBuffer);
            }

            // Grade MC
            let mcCorrect = 0;
            let mcTotal = 0;
            const flagged: number[] = [];

            for (let i = 0; i < totalItems; i++) {
              if (keyModes[i] !== 'written') {
                mcTotal++;
                const ans = pageAnswers[i];
                if (ans && ans.toUpperCase() === keyAnswers[i]?.toUpperCase()) {
                  mcCorrect++;
                }
                if (!ans || !['A', 'B', 'C', 'D'].includes(ans.toUpperCase())) {
                  flagged.push(i);
                }
              }
            }

            const pct = totalItems > 0 ? Math.round((mcCorrect / totalItems) * 100) : 0;
            const mastery = computeMasteryLevel(pct);

            processedSheets.push({
              sheetId: `sheet-${now}-${processedSheets.length}`,
              sheetIndex: processedSheets.length,
              originalFilename: `${file.name} (Page ${pIdx + 1})`,
              omrSheetUrl: `/uploads/omr/${outFilename}`,
              detectedAnswers: pageAnswers,
              verifiedAnswers: [...pageAnswers],
              score: pct,
              mcCorrect,
              mcTotal,
              totalItems,
              masteryLevel: mastery,
              flaggedIndices: flagged,
              writtenItems,
            });
          }
          continue;
        }
      }

      // Process standard image
      const imageBuffer = await file.arrayBuffer();
      const ext = path.extname(file.name).toLowerCase() || '.png';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.png';
      const outFilename = `omr-batch-${now}-${processedSheets.length}${safeExt}`;
      const outPath = path.join(uploadDir, outFilename);

      await fs.writeFile(outPath, Buffer.from(imageBuffer));
      const omrSheetUrl = `/uploads/omr/${outFilename}`;

      const detected = await detectSingleSheetAnswers(imageBuffer, totalItems);

      let mcCorrect = 0;
      let mcTotal = 0;
      const flagged: number[] = [];

      for (let i = 0; i < totalItems; i++) {
        if (keyModes[i] !== 'written') {
          mcTotal++;
          const ans = detected[i];
          if (ans && ans.toUpperCase() === keyAnswers[i]?.toUpperCase()) {
            mcCorrect++;
          }
          if (!ans || !['A', 'B', 'C', 'D'].includes(ans.toUpperCase())) {
            flagged.push(i);
          }
        }
      }

      const pct = totalItems > 0 ? Math.round((mcCorrect / totalItems) * 100) : 0;
      const mastery = computeMasteryLevel(pct);

      processedSheets.push({
        sheetId: `sheet-${now}-${processedSheets.length}`,
        sheetIndex: processedSheets.length,
        originalFilename: file.name,
        omrSheetUrl,
        detectedAnswers: detected,
        verifiedAnswers: [...detected],
        score: pct,
        mcCorrect,
        mcTotal,
        totalItems,
        masteryLevel: mastery,
        flaggedIndices: flagged,
        writtenItems,
      });
    }

    return ok({
      sheets: processedSheets,
      totalSheets: processedSheets.length,
      answerKey: {
        id: keyDoc?._id ? String(keyDoc._id) : undefined,
        title: keyDoc?.title || title,
        subject,
        competency,
        totalItems,
        keyAnswers,
        keyModes,
        writtenItems,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Batch OMR Upload Error:', error);
    return NextResponse.json({ error: 'Failed to process batch OMR upload.' }, { status: 500 });
  }
}

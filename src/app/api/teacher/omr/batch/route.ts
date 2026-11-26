import fs from 'fs/promises';
import path from 'path';
import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';
import connectDB from '../../../../../../database/db';
import AnswerKey from '../../../../../../models/AnswerKey';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { extractKeyAnswers } from '../route';
import {
  normalizeOmrSubject,
  findAnswerKeySafely,
  toDataUrlFallback,
  mimeTypeFromExt,
  formatOmrRouteError,
} from '@/lib/omrServerHelpers';

export const maxDuration = 60;

async function persistUploadOrDataUrl(opts: {
  diskWritable: boolean;
  filePath: string;
  publicUrl: string;
  data: Buffer | Uint8Array | string;
  mimeType: string;
}): Promise<string> {
  const rawBuf = typeof opts.data === 'string'
    ? Buffer.from(opts.data.replace(/^data:[^;]+;base64,/, ''), 'base64')
    : Buffer.isBuffer(opts.data)
    ? opts.data
    : Buffer.from(opts.data);

  if (opts.diskWritable) {
    try {
      await fs.writeFile(opts.filePath, rawBuf);
      return opts.publicUrl;
    } catch (writeErr) {
      console.warn('Batch OMR disk write skipped (falling back to data URL):', writeErr);
    }
  }
  return toDataUrlFallback(rawBuf, opts.mimeType) || opts.publicUrl;
}

const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');

/** Compute mastery level from a percentage score */
function computeMasteryLevel(pct: number): string {
  if (pct >= 90) return 'Proficient';
  if (pct >= 75) return 'Approaching';
  if (pct >= 50) return 'Developing';
  return 'Beginning';
}

export class OMRServiceError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string = 'OMR_SERVICE_OFFLINE', status: number = 503) {
    super(message);
    this.name = 'OMRServiceError';
    this.code = code;
    this.status = status;
  }
}

/** Single sheet detection via Python OpenCV service */
async function detectSingleSheetAnswers(
  imageBuffer: ArrayBuffer,
  keyLength: number = 20
): Promise<{ answers: (string | null)[]; nameCropBase64?: string | null; warpedImage?: string | null }> {
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  const form = new FormData();
  form.append('file', blob, 'sheet.png');
  form.append('num_questions', String(keyLength));

  let res: Response;
  try {
    res = await fetch(`${PYTHON_SERVICE_URL}/omr/detect`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000), // 60s timeout to allow cold start
    });
  } catch (e: unknown) {
    console.error('Python OMR detect connection error:', (e as Error).message);
    throw new OMRServiceError(
      'OMR Vision Engine is offline. Please ensure the Python OpenCV microservice is running on port 8000.',
      'OMR_SERVICE_OFFLINE',
      503
    );
  }

  if (!res.ok) {
    const rawText = await res.text();
    let errMessage = 'OMR Vision Engine returned an error.';
    if (res.status === 502 || res.status === 504 || rawText.includes('Bad Gateway')) {
      errMessage = 'The OMR Vision Engine is waking up on Render. Please wait 30 seconds and try again.';
    } else {
      try {
        const json = JSON.parse(rawText);
        errMessage = json.detail || json.error || rawText.slice(0, 150) || errMessage;
      } catch {
        errMessage = rawText.slice(0, 150) || errMessage;
      }
    }
    throw new OMRServiceError(errMessage, 'OMR_PROCESSING_FAILED', res.status >= 500 ? 503 : 422);
  }

  const data = await res.json();
  if (!data.success || !Array.isArray(data.answers)) {
    const errorDetails = Array.isArray(data.errors) && data.errors.length > 0
      ? data.errors.join('; ')
      : 'No bubble grid detected on sheet.';
    throw new OMRServiceError(errorDetails, 'OMR_DETECTION_FAILED', 422);
  }

  return {
    answers: data.answers.map((a: any) => a.answer_label || null),
    nameCropBase64: data.name_crop_base64 || null,
    warpedImage: data.warped_image_base64 || null,
  };
}

/** Multi-page PDF detection via Python OpenCV service */
async function detectPdfPages(
  pdfBuffer: ArrayBuffer,
  keyLength: number = 20
): Promise<{ page_index: number; png_base64: string; answers: any[]; name_crop_base64?: string | null }[]> {
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const form = new FormData();
  form.append('file', blob, 'exam.pdf');
  form.append('num_questions', String(keyLength));

  let res: Response;
  try {
    res = await fetch(`${PYTHON_SERVICE_URL}/omr/detect-pdf`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000), // 60s for multi-page PDF
    });
  } catch (e: unknown) {
    console.error('Python PDF OMR connection error:', (e as Error).message);
    throw new OMRServiceError(
      'OMR Vision Engine is offline. Please ensure the Python OpenCV microservice is running on port 8000.',
      'OMR_SERVICE_OFFLINE',
      503
    );
  }

  if (!res.ok) {
    const rawText = await res.text();
    let errMessage = 'Python PDF OMR service error.';
    if (res.status === 502 || res.status === 504 || rawText.includes('Bad Gateway')) {
      errMessage = 'The OMR Vision Engine is waking up on Render. Please wait 30 seconds and try again.';
    } else {
      try {
        const json = JSON.parse(rawText);
        errMessage = json.detail || json.error || rawText.slice(0, 150) || errMessage;
      } catch {
        errMessage = rawText.slice(0, 150) || errMessage;
      }
    }
    throw new OMRServiceError(errMessage, 'OMR_PROCESSING_FAILED', res.status >= 500 ? 503 : 422);
  }

  const data = await res.json();
  if (!data.success || !Array.isArray(data.pages)) {
    const errorDetails = Array.isArray(data.errors) && data.errors.length > 0
      ? data.errors.join('; ')
      : 'Failed to detect exam pages in PDF.';
    throw new OMRServiceError(errorDetails, 'OMR_DETECTION_FAILED', 422);
  }

  return data.pages;
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

    const rawSubject = (formData.get('subject') as string | null) || 'Math';
    const subject = normalizeOmrSubject(rawSubject);
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
    const keyDoc = await findAnswerKeySafely(answerKeyId, subject);

    const keyAnswers: string[] = extractKeyAnswers(keyDoc);
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
    const cropsDir = path.join(uploadDir, 'crops');
    let diskWritable = false;
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(cropsDir, { recursive: true });
      diskWritable = true;
    } catch (mkdirErr) {
      console.warn('Batch OMR mkdir skipped on read-only filesystem (using data URLs):', mkdirErr);
    }

    const processedSheets: Array<{
      sheetId: string;
      sheetIndex: number;
      originalFilename: string;
      omrSheetUrl: string;
      nameCropUrl?: string;
      nameCropBase64?: string;
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

            // Save page PNG or fallback to base64 data URL
            const outFilename = `omr-batch-${now}-f${fIdx}-p${pIdx + 1}.png`;
            const outPath = path.join(uploadDir, outFilename);
            let omrSheetUrl = `/uploads/omr/${outFilename}`;
            if (pageData.png_base64) {
              omrSheetUrl = await persistUploadOrDataUrl({
                diskWritable,
                filePath: outPath,
                publicUrl: `/uploads/omr/${outFilename}`,
                data: pageData.png_base64,
                mimeType: 'image/png',
              });
            }

            // Save Name Crop if available (with data URL fallback on read-only FS)
            let nameCropUrl: string | undefined = undefined;
            if (pageData.name_crop_base64) {
              const cropFilename = `crop-batch-${now}-f${fIdx}-p${pIdx + 1}.jpg`;
              const cropPath = path.join(cropsDir, cropFilename);
              nameCropUrl = await persistUploadOrDataUrl({
                diskWritable,
                filePath: cropPath,
                publicUrl: `/uploads/omr/crops/${cropFilename}`,
                data: pageData.name_crop_base64,
                mimeType: 'image/jpeg',
              });
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
              omrSheetUrl,
              nameCropUrl,
              nameCropBase64: pageData.name_crop_base64 || undefined,
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

      const omrSheetUrl = await persistUploadOrDataUrl({
        diskWritable,
        filePath: outPath,
        publicUrl: `/uploads/omr/${outFilename}`,
        data: Buffer.from(imageBuffer),
        mimeType: mimeTypeFromExt(safeExt),
      });

      const detected = await detectSingleSheetAnswers(imageBuffer, totalItems);

      // Save Name Crop if available (with data URL fallback on read-only FS)
      let nameCropUrl: string | undefined = undefined;
      if (detected.nameCropBase64) {
        const cropFilename = `crop-batch-${now}-${processedSheets.length}.jpg`;
        const cropPath = path.join(cropsDir, cropFilename);
        nameCropUrl = await persistUploadOrDataUrl({
          diskWritable,
          filePath: cropPath,
          publicUrl: `/uploads/omr/crops/${cropFilename}`,
          data: detected.nameCropBase64,
          mimeType: 'image/jpeg',
        });
      }

      let mcCorrect = 0;
      let mcTotal = 0;
      const flagged: number[] = [];

      for (let i = 0; i < totalItems; i++) {
        if (keyModes[i] !== 'written') {
          mcTotal++;
          const ans = detected.answers[i];
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
        nameCropUrl,
        nameCropBase64: detected.nameCropBase64 || undefined,
        detectedAnswers: detected.answers,
        verifiedAnswers: [...detected.answers],
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
    if (error instanceof OMRServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }
    return formatOmrRouteError(error, 'Failed to process batch OMR upload');
  }
}

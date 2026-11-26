import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import Assessment from '../../models/Assessment';
import AnswerKey from '../../models/AnswerKey';

export type ValidAssessmentSubject =
  | 'Math'
  | 'Reading'
  | 'Science'
  | 'English'
  | 'Filipino'
  | 'Reading - Filipino'
  | 'Reading - English';

const VALID_ASSESSMENT_SUBJECTS: readonly ValidAssessmentSubject[] = [
  'Math',
  'Reading',
  'Science',
  'English',
  'Filipino',
  'Reading - Filipino',
  'Reading - English',
];

/**
 * Normalize subject strings to match AssessmentSchema's enum safely.
 */
export function normalizeOmrSubject(rawSubject?: string | null): ValidAssessmentSubject {
  const raw = String(rawSubject || '').trim();
  if ((VALID_ASSESSMENT_SUBJECTS as readonly string[]).includes(raw)) {
    return raw as ValidAssessmentSubject;
  }
  const lower = raw.toLowerCase();
  if (lower === 'reading - filipino' || (lower.includes('reading') && lower.includes('filipino'))) {
    return 'Reading - Filipino';
  }
  if (lower === 'reading - english' || (lower.includes('reading') && lower.includes('english'))) {
    return 'Reading - English';
  }
  if (lower.includes('filipino')) return 'Filipino';
  if (lower.includes('english')) return 'English';
  if (lower.includes('math') || lower.includes('numeracy')) return 'Math';
  if (lower.includes('science')) return 'Science';
  if (lower.includes('read') || lower.includes('literacy')) return 'Reading';
  return 'Math';
}

/**
 * Build a Mongoose query against LearnerRecord without passing invalid strings
 * into ObjectId schema fields (prevents CastError 500s on Student Numbers).
 */
export function buildLearnerLookupQuery(identifier: string): Record<string, any> {
  const trimmed = String(identifier || '').trim();
  const orConditions: Record<string, any>[] = [{ studentNumber: trimmed }];
  if (mongoose.isValidObjectId(trimmed)) {
    const oid = new mongoose.Types.ObjectId(trimmed);
    orConditions.unshift({ studentId: oid }, { _id: oid });
  }
  return { $or: orConditions };
}

/**
 * Safely resolve an AnswerKey document by ObjectId (when valid) or latest subject key.
 */
export async function findAnswerKeySafely(
  answerKeyId: string | null | undefined,
  normalizedSubject: string
): Promise<any | null> {
  let keyDoc: any = null;
  if (answerKeyId && mongoose.isValidObjectId(answerKeyId)) {
    keyDoc = await AnswerKey.findById(answerKeyId).lean();
  }
  if (!keyDoc && normalizedSubject) {
    keyDoc = await AnswerKey.findOne({ subject: normalizedSubject }).sort({ created: -1 }).lean();
  }
  return keyDoc;
}

/**
 * Derive standard assessmentCategory from answer key metadata or title keywords.
 */
export function deriveAssessmentCategory(keyDoc: any, title: string): string {
  const explicit = keyDoc?.assessmentType || keyDoc?.assessmentCategory;
  if (explicit) return explicit;
  const lower = String(title || '').toLowerCase();
  if (lower.includes('pre-test') || lower.includes('pretest') || lower.includes('baseline')) {
    return 'pre-test';
  }
  if (lower.includes('post-test') || lower.includes('posttest') || lower.includes('endline')) {
    return 'post-test';
  }
  if (lower.includes('exam')) {
    return 'exam';
  }
  return 'quiz';
}

/**
 * Create or update an OMR Assessment cleanly, preventing E11000 duplicate key
 * crashes on the unique partial index { studentId, answerKeyRef }.
 */
export async function upsertOmrAssessment(payload: Record<string, any>) {
  if (payload.answerKeyRef && payload.studentId) {
    const existing = await Assessment.findOne({
      studentId: payload.studentId,
      answerKeyRef: payload.answerKeyRef,
    });
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      return existing;
    }
  }
  return Assessment.create(payload);
}

/**
 * Build a data URL string from a Buffer or base64 payload, returning null if
 * `maxBytes` is supplied and exceeded.
 */
export function toDataUrlFallback(
  data: Buffer | Uint8Array | string,
  mimeType: string = 'image/png',
  maxBytes?: number
): string | null {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return null;
    if (maxBytes && Buffer.byteLength(trimmed, 'utf8') > maxBytes) return null;
    return trimmed.startsWith('data:') ? trimmed : `data:${mimeType};base64,${trimmed}`;
  }
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length === 0) return null;
  if (maxBytes && buf.length > maxBytes) return null;
  return `data:${mimeType};base64,${buf.toString('base64')}`;
}

/**
 * Map MIME/extension to image content type for data URLs.
 */
export function mimeTypeFromExt(ext: string): string {
  const clean = ext.toLowerCase();
  if (clean === '.jpg' || clean === '.jpeg') return 'image/jpeg';
  if (clean === '.webp') return 'image/webp';
  return 'image/png';
}

/**
 * Convert known database/request failures into clear, actionable HTTP responses.
 */
export function formatOmrRouteError(
  error: any,
  defaultMessage: string = 'OMR processing failed'
): NextResponse {
  console.error('OMR Route Error:', error);

  if (error?.code === 11000) {
    return NextResponse.json(
      {
        error: 'Duplicate assessment detected for this student and answer key. Please update or rescan the existing record.',
        code: 'DUPLICATE_ASSESSMENT',
      },
      { status: 409 }
    );
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return NextResponse.json(
      {
        error: error.message || 'Invalid assessment or learner identifier.',
        code: error.name,
      },
      { status: 400 }
    );
  }

  const msg = String(error?.message || '');
  if (
    error?.status === 413 ||
    /payload too large|entity too large|body exceeded|FUNCTION_PAYLOAD_TOO_LARGE/i.test(msg)
  ) {
    return NextResponse.json(
      {
        error: 'Uploaded image is too large for serverless processing. Please retake or compress the image and retry.',
        code: 'PAYLOAD_TOO_LARGE',
      },
      { status: 413 }
    );
  }

  return NextResponse.json(
    {
      error: msg ? `${defaultMessage}: ${msg}` : defaultMessage,
      code: error?.code || 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import Assessment from '../../models/Assessment';
import AnswerKey from '../../models/AnswerKey';
import {
  normalizeOmrSubject,
  buildLearnerLookupQuery,
  deriveAssessmentCategory,
  toDataUrlFallback,
  mimeTypeFromExt,
} from './omrPureHelpers';
export type { ValidAssessmentSubject } from './omrPureHelpers';
export {
  normalizeOmrSubject,
  buildLearnerLookupQuery,
  deriveAssessmentCategory,
  toDataUrlFallback,
  mimeTypeFromExt,
};

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

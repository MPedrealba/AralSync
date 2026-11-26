import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeOmrSubject,
  buildLearnerLookupQuery,
  toDataUrlFallback,
} from '../src/lib/omrPureHelpers.ts';
import { isLikelyImageFile, isPdfFile } from '../src/lib/omrImageUtils.ts';

describe('OMR Deployment 500 Fixes & Mobile Camera/Compression Suite', () => {
  const root = process.cwd();

  it('normalizes arbitrary subjects strictly into AssessmentSchema enum values', () => {
    assert.equal(normalizeOmrSubject('Math'), 'Math');
    assert.equal(normalizeOmrSubject('Mathematics'), 'Math');
    assert.equal(normalizeOmrSubject('Numeracy Diagnostic'), 'Math');
    assert.equal(normalizeOmrSubject('Literacy'), 'Reading');
    assert.equal(normalizeOmrSubject('Reading'), 'Reading');
    assert.equal(normalizeOmrSubject('Reading - English'), 'Reading - English');
    assert.equal(normalizeOmrSubject('Reading - Filipino'), 'Reading - Filipino');
    assert.equal(normalizeOmrSubject('Filipino'), 'Filipino');
    assert.equal(normalizeOmrSubject('English'), 'English');
    assert.equal(normalizeOmrSubject('Science'), 'Science');
  });

  it('guards non-ObjectId identifiers in buildLearnerLookupQuery to avoid Mongoose CastError', () => {
    const qStudentNum = buildLearnerLookupQuery('20260001');
    assert.deepEqual(qStudentNum, { $or: [{ studentNumber: '20260001' }] });

    const validHex = '6a9dc58f11eef70f0ba1e841';
    const qObjId = buildLearnerLookupQuery(validHex);
    assert.equal(qObjId.$or.length, 3);
    assert.equal(String(qObjId.$or[0].studentId), validHex);
    assert.equal(String(qObjId.$or[1]._id), validHex);
    assert.equal(qObjId.$or[2].studentNumber, validHex);
  });

  it('respects maxBytes limit on compact data URL fallback while supporting full data URLs when uncapped', () => {
    const smallBuf = Buffer.from('hello-omr');
    const urlSmall = toDataUrlFallback(smallBuf, 'image/jpeg', 150 * 1024);
    assert.ok(urlSmall?.startsWith('data:image/jpeg;base64,'));

    const oversizedBuf = Buffer.alloc(160 * 1024, 65);
    assert.equal(toDataUrlFallback(oversizedBuf, 'image/png', 150 * 1024), null);
    assert.ok(toDataUrlFallback(oversizedBuf, 'image/png')?.startsWith('data:image/png;base64,'));
  });

  it('identifies image and PDF files even when mobile browsers omit MIME type', () => {
    assert.equal(isLikelyImageFile({ type: '', name: 'IMG_20261126.HEIC' }), true);
    assert.equal(isLikelyImageFile({ type: 'application/octet-stream', name: 'sheet.jpg' }), true);
    assert.equal(isLikelyImageFile({ type: 'application/pdf', name: 'batch.pdf' }), false);
    assert.equal(isPdfFile({ type: '', name: 'sheets.PDF' }), true);
  });

  it('exports maxDuration = 60, upserts duplicate assessments, and handles read-only filesystems cleanly across OMR routes', () => {
    const omrSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/omr/route.ts'), 'utf8');
    const batchSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/omr/batch/route.ts'), 'utf8');
    const commitSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/omr/batch/commit/route.ts'), 'utf8');
    const writtenSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/omr/analyze-written/route.ts'), 'utf8');

    assert.ok(omrSrc.includes('export const maxDuration = 60;'));
    assert.ok(batchSrc.includes('export const maxDuration = 60;'));
    assert.ok(writtenSrc.includes('export const maxDuration = 60;'));

    assert.ok(omrSrc.includes('upsertOmrAssessment('), 'POST /api/teacher/omr must upsert instead of crashing on E11000');
    assert.ok(commitSrc.includes('upsertOmrAssessment('), 'POST /api/teacher/omr/batch/commit must upsert instead of crashing on E11000');
    assert.ok(omrSrc.includes('findAnswerKeySafely(') && batchSrc.includes('findAnswerKeySafely(') && commitSrc.includes('findAnswerKeySafely('));
    assert.ok(omrSrc.includes('formatOmrRouteError(') && batchSrc.includes('formatOmrRouteError(') && commitSrc.includes('formatOmrRouteError('));

    assert.ok(batchSrc.includes('persistUploadOrDataUrl('), 'batch/route.ts must guard disk writes with data-URL fallback');
    assert.ok(batchSrc.includes('let diskWritable = false;'), 'batch/route.ts must wrap fs.mkdir in try/catch');
  });

  it('compresses mobile images, supports camera playback with muted + 0-dim guard, and sets accept="image/*"', () => {
    const scanSrc = fs.readFileSync(path.join(root, 'src/app/dashboard/omr-scan/page.tsx'), 'utf8');
    const batchUiSrc = fs.readFileSync(path.join(root, 'src/app/dashboard/omr-scan/BatchWorkstation.tsx'), 'utf8');

    assert.ok(scanSrc.includes('prepareOmrImageFile('));
    assert.ok(batchUiSrc.includes('prepareOmrImageFile('));
    assert.ok(scanSrc.includes('accept="image/*"'));
    assert.ok(scanSrc.includes('muted className="h-full w-full object-contain sm:object-cover"'));
    assert.ok(scanSrc.includes('video.videoWidth === 0 || video.videoHeight === 0'));
    assert.ok(scanSrc.includes('scaleCanvasIfNeeded(canvas, 1600)'));
    assert.ok(scanSrc.includes('}, "image/jpeg", 0.85)'));
    assert.ok(scanSrc.includes('formData.append("scanSource", scanSource);'));
    assert.ok(scanSrc.includes('prepareOmrImageFile(rawFile, { maxEdge: 1800, quality: 0.90 })'));
    assert.ok(scanSrc.includes('Take Photo (Autofocus)'));
    assert.ok(scanSrc.includes('Keep the entire black sheet border comfortably inside the screen'));

    const omrRouteSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/omr/route.ts'), 'utf8');
    const pyMainSrc = fs.readFileSync(path.join(root, 'python-service/app/main.py'), 'utf8');
    const pyOmrSrc = fs.readFileSync(path.join(root, 'python-service/app/omr.py'), 'utf8');

    assert.ok(omrRouteSrc.includes("form.append('scan_source', 'mobile_camera');"));
    assert.ok(pyMainSrc.includes('scan_source: str = Form("standard")'));
    assert.ok(pyOmrSrc.includes('def detect_printed_frame('));
    assert.ok(pyOmrSrc.includes('if scan_source == "mobile_camera":'));
    assert.ok(pyOmrSrc.includes('Could not detect all 4 corners of the sheet border.'));
  });
});

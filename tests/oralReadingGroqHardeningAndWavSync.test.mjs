import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const readingSrc = fs.readFileSync(path.join(ROOT, 'src/lib/reading.ts'), 'utf8');
const teacherRouteSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/teacher/reading/analyze/route.ts'), 'utf8');
const studentRouteSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/student/reading/analyze/route.ts'), 'utf8');
const teacherPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/dashboard/reading-fluency/page.tsx'), 'utf8');
const studentPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/student/reading-fluency/page.tsx'), 'utf8');

describe('Oral Reading Groq Hardening, 16kHz PCM WAV Normalization & Playback Sync', async () => {
  const {
    normalizeGroqResponse,
    hasWhisperHallucinationLoop,
    shouldRetryGroqTranscription,
    pickBetterGroqResult,
  } = await import('../src/lib/reading.ts');

  const {
    peakNormalizeMonoSamples,
    encodePcm16WavBuffer,
    convertAudioBlobToNormalizedWav,
  } = await import('../src/lib/audioWav.ts');

  describe('1. Groq Whisper Prompt Removal, Segment/Word Backfill & Fallback Retry', () => {
    test('transcribeGroq never appends passage text to Whisper prompt parameter', () => {
      const fnStart = readingSrc.indexOf('async function sendGroqTranscriptionRequest');
      const fnEnd = readingSrc.indexOf('export function computeFluencyMetrics', fnStart);
      const groqCode = readingSrc.slice(fnStart, fnEnd);

      assert.ok(!groqCode.includes(".append('prompt'"), 'Must never send prompt parameter to Groq Whisper');
      assert.ok(groqCode.includes("GROQ_MODEL = 'whisper-large-v3'") || groqCode.includes('model: GROQ_MODEL'));
      assert.ok(groqCode.includes("'whisper-large-v3-turbo'") || readingSrc.includes("GROQ_FALLBACK_MODEL = 'whisper-large-v3-turbo'"));
      assert.ok(groqCode.includes("temperature: '0.2'"), 'Fallback retry must use temperature 0.2');
    });

    test('normalizeGroqResponse reconstructs text and proportionally fills missing words from segments', () => {
      const normalized = normalizeGroqResponse({
        text: 'The quick',
        segments: [
          { start: 0.0, end: 2.0, text: 'The quick brown fox' },
          { start: 2.0, end: 5.0, text: 'jumps over the dog' },
        ],
        words: [],
      });

      assert.equal(normalized.text, 'The quick brown fox jumps over the dog');
      assert.equal(normalized.words.length, 8);
      assert.deepEqual(normalized.words[0], { word: 'The', start: 0, end: 0.5 });
      assert.deepEqual(normalized.words[3], { word: 'fox', start: 1.5, end: 2 });
      assert.deepEqual(normalized.words[4], { word: 'jumps', start: 2, end: 2.75 });
      assert.deepEqual(normalized.words[7], { word: 'dog', start: 4.25, end: 5 });
    });

    test('normalizeGroqResponse preserves intact segment word timings while backfilling sparse dropped segments', () => {
      const normalized = normalizeGroqResponse({
        text: 'One two three four five six',
        segments: [
          { start: 0.0, end: 1.5, text: 'One two' },
          { start: 2.0, end: 6.0, text: 'three four five six' },
        ],
        words: [
          { word: 'One', start: 0.1, end: 0.6 },
          { word: 'two', start: 0.7, end: 1.4 },
        ],
      });

      assert.equal(normalized.words.length, 6);
      assert.deepEqual(normalized.words[0], { word: 'One', start: 0.1, end: 0.6 });
      assert.deepEqual(normalized.words[1], { word: 'two', start: 0.7, end: 1.4 });
      assert.deepEqual(normalized.words[2], { word: 'three', start: 2, end: 3 });
      assert.deepEqual(normalized.words[5], { word: 'six', start: 5, end: 6 });
    });

    test('hasWhisperHallucinationLoop catches >5 consecutive repeated n-grams but allows normal stutters', () => {
      assert.equal(hasWhisperHallucinationLoop('the the the'), false);
      assert.equal(hasWhisperHallucinationLoop('thank you thank you thank you'), false);
      assert.equal(
        hasWhisperHallucinationLoop('the the the the the the'),
        true,
        'Should reject 6 consecutive identical 1-grams'
      );
      assert.equal(
        hasWhisperHallucinationLoop('thank you thank you thank you thank you thank you thank you'),
        true,
        'Should reject 6 consecutive identical 2-grams'
      );
    });

    test('shouldRetryGroqTranscription and pickBetterGroqResult handle empty, short/truncated, and loop outputs', () => {
      assert.equal(shouldRetryGroqTranscription({ text: '', segments: [], words: [] }, 20), true);
      assert.equal(
        shouldRetryGroqTranscription(
          { text: 'hello world', segments: [{ start: 0, end: 2 }], words: [] },
          30
        ),
        true
      );
      assert.equal(
        shouldRetryGroqTranscription(
          {
            text: 'this is a reasonable partial transcript with twelve spoken words here',
            segments: [{ start: 0, end: 10 }],
            words: [],
          },
          30
        ),
        true
      );
      assert.equal(
        shouldRetryGroqTranscription(
          {
            text: 'the quick brown fox jumps over the lazy dog near the quiet river bank today',
            segments: [{ start: 0, end: 10.5 }],
            words: [],
          },
          11
        ),
        false
      );

      const primary = { text: 'short text', segments: [], words: [] };
      const betterFallback = {
        text: 'much longer accurate reading transcript with all opening words present',
        segments: [],
        words: [],
      };
      const loopedFallback = {
        text: 'thank you thank you thank you thank you thank you thank you thank you',
        segments: [],
        words: [],
      };

      assert.equal(pickBetterGroqResult(primary, betterFallback), betterFallback);
      assert.equal(pickBetterGroqResult(primary, loopedFallback), primary);
    });
  });

  describe('2. API Route maxDuration & durationSec Forwarding', () => {
    test('exports maxDuration = 60 and passes durationSec into transcribeGroq in both routes', () => {
      assert.ok(teacherRouteSrc.includes('export const maxDuration = 60;'));
      assert.ok(studentRouteSrc.includes('export const maxDuration = 60;'));
      assert.ok(teacherRouteSrc.includes('await transcribeGroq(file, passage, durationSec)'));
      assert.ok(studentRouteSrc.includes('await transcribeGroq(file, passage, durationSec)'));
    });
  });

  describe('3. 16kHz Mono PCM WAV Encoding & Gentle Peak Normalization', async () => {
    test('peakNormalizeMonoSamples boosts quiet speech up to 4x (0.85 target) while leaving silence untouched', () => {
      const silent = new Float32Array([0.001, -0.002, 0.004, 0]);
      const silentOut = peakNormalizeMonoSamples(silent);
      assert.ok(Math.abs(silentOut[0] - 0.001) < 1e-6, 'Must not amplify room silence below 0.005 peak');

      const quiet = new Float32Array([0.1, -0.05, 0.025]);
      const quietOut = peakNormalizeMonoSamples(quiet);
      // peak = 0.1 -> gain = min(4.0, 0.85 / 0.1) = 4.0 -> 0.4
      assert.ok(Math.abs(quietOut[0] - 0.4) < 1e-5);
      assert.ok(Math.abs(quietOut[1] - -0.2) < 1e-5);

      const moderate = new Float32Array([0.425, -0.2]);
      const moderateOut = peakNormalizeMonoSamples(moderate);
      // peak = 0.425 -> gain = 0.85 / 0.425 = 2.0 -> peak normalized to 0.85
      assert.ok(Math.abs(moderateOut[0] - 0.85) < 1e-5);
    });

    test('encodePcm16WavBuffer produces a valid 44-byte RIFF 16kHz 16-bit Mono PCM WAV', () => {
      const samples = new Float32Array([0, 0.5, -0.5, 1.0]);
      const buf = encodePcm16WavBuffer(samples, 16000);
      assert.equal(buf.byteLength, 44 + samples.length * 2);

      const view = new DataView(buf);
      const str = (start, len) => String.fromCharCode(...new Uint8Array(buf, start, len));

      assert.equal(str(0, 4), 'RIFF');
      assert.equal(view.getUint32(4, true), 36 + samples.length * 2);
      assert.equal(str(8, 4), 'WAVE');
      assert.equal(str(12, 4), 'fmt ');
      assert.equal(view.getUint32(16, true), 16);
      assert.equal(view.getUint16(20, true), 1); // PCM
      assert.equal(view.getUint16(22, true), 1); // Mono
      assert.equal(view.getUint32(24, true), 16000); // 16kHz
      assert.equal(view.getUint32(28, true), 32000); // ByteRate
      assert.equal(view.getUint16(32, true), 2); // BlockAlign
      assert.equal(view.getUint16(34, true), 16); // BitsPerSample
      assert.equal(str(36, 4), 'data');
      assert.equal(view.getUint32(40, true), samples.length * 2);
      assert.equal(view.getInt16(44, true), 0);
      assert.ok(view.getInt16(46, true) > 16000);
      assert.ok(view.getInt16(48, true) < -16000);
    });

    test('convertAudioBlobToNormalizedWav falls back safely to recording.webm when AudioContext is unavailable', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' });
      const file = await convertAudioBlobToNormalizedWav(blob);
      assert.equal(file.name, 'recording.webm');
      assert.equal(file.size, 4);
    });
  });

  describe('4. Teacher & Student UI Capture Constraints, WAV Conversion & Spoken-Only Playback Sync', () => {
    test('teacher and student capture disable WebRTC noiseSuppression, remove DynamicsCompressor, and keep 85Hz highPass', () => {
      for (const src of [teacherPageSrc, studentPageSrc]) {
        assert.ok(src.includes('noiseSuppression: false'), 'noiseSuppression must be false');
        assert.ok(src.includes('highPass.frequency.value = 85'), 'highPass must be set to 85Hz');
        assert.ok(!src.includes('createDynamicsCompressor'), 'DynamicsCompressor must be removed');
        assert.ok(src.includes('convertAudioBlobToNormalizedWav(audioBlob)'), 'runAnalysis must convert audio to WAV');
      }
      assert.ok(teacherPageSrc.includes('mr.start(1000)'), 'Teacher MediaRecorder should use 1000ms chunks');
      assert.ok(!teacherPageSrc.includes('mr.start(250)'), 'Must replace 250ms fragmented WebM chunks');
    });

    test('WordByWordReader timedItemsWithIdx excludes omitted and unattempted pills from playback cursor', () => {
      assert.ok(
        teacherPageSrc.includes(
          'it.type !== "omission" && it.type !== "unattempted" && it.startTime != null && Number.isFinite(it.startTime)'
        ),
        'timedItemsWithIdx must exclude omission and unattempted items'
      );
    });
  });
});

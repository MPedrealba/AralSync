const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const pageSource = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/reading-fluency/page.tsx'), 'utf8');
const liveCaptionSource = fs.readFileSync(path.join(__dirname, '../src/hooks/useLiveCaption.ts'), 'utf8');

describe('60-Second Phil-IRI Timed Reading & Live Tracking Speech Accuracy Suite', () => {

  describe('1. 60-Second Auto-Stop & Timer Hard Cap Enforcement', () => {
    test('enforces hard cap at 60 seconds with stopRecording() auto-stop', () => {
      assert.ok(
        pageSource.includes('if (nextTime >= 60)'),
        'Must check for 60 seconds boundary'
      );
      assert.ok(
        pageSource.includes('stopRecording();'),
        'Must call stopRecording() when hitting 60 seconds'
      );
      assert.ok(
        pageSource.includes('return 60;'),
        'Must return 60 to cap timer state'
      );
    });

    test('renders Phil-IRI 1-Min Standard mode indicator and formatted timer', () => {
      assert.ok(
        pageSource.includes('Phil-IRI 1-Min Standard'),
        'Must display Phil-IRI 1-Min Standard indicator'
      );
      assert.ok(
        pageSource.includes('({fmtTimer(recTime)} / 01:00)'),
        'Must render formatted timer relative to 01:00'
      );
    });

    test('renders 10 seconds remaining warning banner when recTime >= 50 during recording', () => {
      assert.ok(
        pageSource.includes('recTime >= 50 && recTime < 60'),
        'Must trigger warning state at 50 seconds'
      );
      assert.ok(
        pageSource.includes('10 seconds remaining — wrap up oral reading'),
        'Must display 10 seconds remaining warning text'
      );
    });

    test('renders 1-Minute Assessment Completed badge when reaching 60 seconds', () => {
      assert.ok(
        pageSource.includes('recTime >= 60 && !isRecording'),
        'Must check for completion when reaching 60s and stopped'
      );
      assert.ok(
        pageSource.includes('1-Minute Assessment Completed'),
        'Must render 1-Minute Assessment Completed badge'
      );
    });

    test('supports early stop and passes actual elapsed durationSec to analysis', () => {
      assert.ok(
        pageSource.includes('fd.append("durationSec", String(Math.max(recTime, 1)))'),
        'Must pass actual elapsed seconds up to stop time for WCPM calculation'
      );
    });
  });

  describe('2. Bounded Live Miscue Classifier (Prevents Mass False Omissions)', () => {
    test('restricts live classifyMiscues reference passage to words reached so far and returns null when < 0', () => {
      assert.ok(
        pageSource.includes('if (!liveSpeech || !cleanPassage || liveActiveWordIndex < 0) return null;'),
        'Must return null when no passage word has matched yet'
      );
      assert.ok(
        pageSource.includes('maxBound = Math.min(pWords.length, liveActiveWordIndex + 1)'),
        'Must bound maxBound strictly to liveActiveWordIndex + 1'
      );
      assert.ok(
        pageSource.includes('attemptedPassage = pWords.slice(0, maxBound).join(" ")'),
        'Must slice passage to bounded attempted words'
      );
      assert.ok(
        pageSource.includes('classifyMiscues(liveSpeech, attemptedPassage)'),
        'Must pass bounded attemptedPassage instead of full passage'
      );
    });
  });

  describe('3. Speech Velocity Limiter & Rapid Advance Protection in useLiveCaption', () => {
    test('accepts elapsedSec option and synchronizes via ref without restarting recognition', () => {
      assert.ok(
        liveCaptionSource.includes('elapsedSec?: number;'),
        'UseLiveCaptionOptions must declare elapsedSec'
      );
      assert.ok(
        liveCaptionSource.includes('elapsedSecRef.current = elapsedSec;'),
        'Must sync elapsedSec into ref'
      );
    });

    test('enforces tight physiological reading velocity clamp (Math.floor(elapsed * 3.0) + 1)', () => {
      assert.ok(
        liveCaptionSource.includes('Math.floor(elapsed * 3.0) + 1'),
        'Must clamp forward progress to 3.0 words/sec + 1'
      );
      assert.ok(
        liveCaptionSource.includes('candidateOrigIdx = Math.min(candidateOrigIdx, maxAllowedOrigIdx, perEventMaxJump);'),
        'Must clamp active word index to maxAllowedOrigIdx and perEventMaxJump'
      );
    });

    test('guards against isolated stopwords triggering ahead-jumps on ambient noise', () => {
      assert.ok(
        liveCaptionSource.includes('const STOP_WORDS = new Set('),
        'Must define common stopwords set'
      );
      assert.ok(
        liveCaptionSource.includes('const isShortOrStop = STOP_WORDS.has(targetNorm) || targetNorm.length <= 3;'),
        'Must check if lookahead word is a short stopword'
      );
    });

    test('clamps spokenWordCount to physiologically plausible human speech limit for elapsed time', () => {
      assert.ok(
        liveCaptionSource.includes('setSpokenWordCount(Math.min(rawWords.length, maxSpokenWords));'),
        'Must clamp spokenWordCount based on elapsed time'
      );
    });
  });
});

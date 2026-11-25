const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Read the TypeScript source directly to test implementation details
const readingSource = fs.readFileSync(path.join(__dirname, '../src/lib/reading.ts'), 'utf8');
const pageSource = fs.readFileSync(path.join(__dirname, '../src/app/dashboard/reading-fluency/page.tsx'), 'utf8');
const teacherRouteSource = fs.readFileSync(path.join(__dirname, '../src/app/api/teacher/reading/analyze/route.ts'), 'utf8');
const studentRouteSource = fs.readFileSync(path.join(__dirname, '../src/app/api/student/reading/analyze/route.ts'), 'utf8');

describe('Oral Reading Audio Playback Sync & Real-Time Miscue Visual Indicators', () => {

  describe('1. Whisper Word-Level Timestamps Request & Interface Verification', () => {
    test('transcribeGroq requests both segment and word timestamp granularities with verbose_json', () => {
      assert.ok(
        readingSource.includes("groqForm.append('timestamp_granularities[]', 'segment');"),
        'Should append segment timestamp granularity'
      );
      assert.ok(
        readingSource.includes("groqForm.append('timestamp_granularities[]', 'word');"),
        'Should append word timestamp granularity'
      );
      assert.ok(
        readingSource.includes("groqForm.append('response_format', 'verbose_json');"),
        'Should request verbose_json response format'
      );
    });

    test('transcribeGroq returns words array alongside text and segments', () => {
      assert.ok(
        readingSource.includes("words: Array<{ word: string; start: number; end: number }>"),
        'transcribeGroq return type must declare words array'
      );
      assert.ok(
        readingSource.includes("words: Array.isArray(groqJson?.words) ? groqJson.words : []"),
        'transcribeGroq must extract and return groqJson.words'
      );
    });

    test('MiscueItem interface includes optional startTime and endTime in both reading.ts and page.tsx', () => {
      assert.ok(
        /interface MiscueItem\s*\{[\s\S]*?startTime\?:\s*number\s*\|\s*null;[\s\S]*?endTime\?:\s*number\s*\|\s*null;/.test(readingSource),
        'reading.ts MiscueItem must include startTime and endTime'
      );
      assert.ok(
        /interface MiscueItem\s*\{[\s\S]*?startTime\?:\s*number\s*\|\s*null;[\s\S]*?endTime\?:\s*number\s*\|\s*null;/.test(pageSource),
        'page.tsx MiscueItem must include startTime and endTime'
      );
    });

    test('Teacher and Student analyze routes extract words and forward wordsInput to computeFluencyMetrics', () => {
      assert.ok(
        teacherRouteSource.includes('const { text, segments, words } = await transcribeGroq(file, passage);'),
        'Teacher route must extract words from transcribeGroq'
      );
      assert.ok(
        teacherRouteSource.includes('wordsInput,'),
        'Teacher route must pass wordsInput to computeFluencyMetrics'
      );
      assert.ok(
        studentRouteSource.includes('const { text, segments, words } = await transcribeGroq(file, passage);'),
        'Student route must extract words from transcribeGroq'
      );
      assert.ok(
        studentRouteSource.includes('wordsInput,'),
        'Student route must pass wordsInput to computeFluencyMetrics'
      );
    });
  });

  describe('2. Miscue Classifier Timestamp Alignment & Omission Interpolation Logic', () => {
    // Pure mirror of classifyMiscues backtracking & interpolation from reading.ts for Node runtime testing
    function testClassifyMiscues(transcript, passage, wordTimestamps) {
      const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
      const spoken = normalize(transcript);
      const expected = normalize(passage);
      if (expected.length === 0) return { items: [] };

      const m = spoken.length;
      const n = expected.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      const dir = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 0; i <= m; i++) dp[i][0] = i;

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = spoken[i - 1] === expected[j - 1] ? 0 : 1;
          const diag = dp[i - 1][j - 1] + cost;
          const up = dp[i - 1][j] + 1;
          const left = dp[i][j - 1] + 1;
          const minVal = Math.min(diag, up, left);
          dp[i][j] = minVal;
          if (minVal === diag) dir[i][j] = 0;
          else if (minVal === left) dir[i][j] = 2;
          else dir[i][j] = 1;
        }
      }

      const rawItems = [];
      let i = m, j = n;
      while (i > 0 || j > 0) {
        const ts = wordTimestamps?.[i - 1];
        const startTime = ts ? ts.start : null;
        const endTime = ts ? ts.end : null;

        if (i > 0 && j > 0 && dir[i][j] === 0) {
          const sp = spoken[i - 1];
          const ex = expected[j - 1];
          if (sp === ex) {
            rawItems.unshift({ type: 'match', position: j - 1, expected: ex, spoken: sp, startTime, endTime });
          } else {
            rawItems.unshift({ type: 'substitution', position: j - 1, expected: ex, spoken: sp, startTime, endTime });
          }
          i--; j--;
        } else if (i > 0 && (j === 0 || dir[i][j] === 1)) {
          rawItems.unshift({ type: 'insertion', position: null, expected: null, spoken: spoken[i - 1], startTime, endTime });
          i--;
        } else {
          rawItems.unshift({ type: 'omission', position: j - 1, expected: expected[j - 1], spoken: null, startTime: null, endTime: null });
          j--;
        }
      }

      // Interpolation pass for omissions
      for (let k = 0; k < rawItems.length; k++) {
        if (rawItems[k].type === 'omission') {
          let runEnd = k;
          while (runEnd + 1 < rawItems.length && rawItems[runEnd + 1].type === 'omission') {
            runEnd++;
          }
          const runLength = runEnd - k + 1;

          let prevEndTime = null;
          for (let p = k - 1; p >= 0; p--) {
            if (rawItems[p].endTime != null) { prevEndTime = rawItems[p].endTime; break; }
            else if (rawItems[p].startTime != null) { prevEndTime = rawItems[p].startTime; break; }
          }

          let nextStartTime = null;
          for (let nIdx = runEnd + 1; nIdx < rawItems.length; nIdx++) {
            if (rawItems[nIdx].startTime != null) { nextStartTime = rawItems[nIdx].startTime; break; }
            else if (rawItems[nIdx].endTime != null) { nextStartTime = rawItems[nIdx].endTime; break; }
          }

          if (prevEndTime != null && nextStartTime != null) {
            const gap = Math.max(0.1, nextStartTime - prevEndTime);
            for (let r = 0; r < runLength; r++) {
              rawItems[k + r].startTime = Math.round((prevEndTime + (r / runLength) * gap) * 100) / 100;
              rawItems[k + r].endTime = Math.round((prevEndTime + ((r + 1) / runLength) * gap) * 100) / 100;
            }
          }
          k = runEnd;
        }
      }

      return { items: rawItems };
    }

    test('correctly maps spoken word timestamps to match and substitution items', () => {
      const passage = 'the quick brown fox';
      const transcript = 'the slow brown fox';
      const wordTimestamps = [
        { word: 'the', start: 0.1, end: 0.4 },
        { word: 'slow', start: 0.45, end: 0.95 },
        { word: 'brown', start: 1.0, end: 1.4 },
        { word: 'fox', start: 1.45, end: 1.9 },
      ];

      const res = testClassifyMiscues(transcript, passage, wordTimestamps);
      assert.equal(res.items.length, 4);

      // 'the' -> match
      assert.equal(res.items[0].type, 'match');
      assert.equal(res.items[0].startTime, 0.1);
      assert.equal(res.items[0].endTime, 0.4);

      // 'quick' vs 'slow' -> substitution
      assert.equal(res.items[1].type, 'substitution');
      assert.equal(res.items[1].expected, 'quick');
      assert.equal(res.items[1].spoken, 'slow');
      assert.equal(res.items[1].startTime, 0.45);
      assert.equal(res.items[1].endTime, 0.95);
    });

    test('interpolates omission timestamp between preceding word endTime and following word startTime', () => {
      const passage = 'the quick brown fox';
      const transcript = 'the fox'; // skipped 'quick' and 'brown'
      const wordTimestamps = [
        { word: 'the', start: 0.2, end: 0.5 },
        { word: 'fox', start: 2.0, end: 2.5 },
      ];

      const res = testClassifyMiscues(transcript, passage, wordTimestamps);
      const omissions = res.items.filter((it) => it.type === 'omission');
      assert.equal(omissions.length, 2);

      // Preceding endTime is 0.5, next startTime is 2.0. Total gap = 1.5.
      // Omission 1 ('quick'): 0.5 to 1.25
      assert.equal(omissions[0].expected, 'quick');
      assert.equal(omissions[0].startTime, 0.5);
      assert.equal(omissions[0].endTime, 1.25);

      // Omission 2 ('brown'): 1.25 to 2.0
      assert.equal(omissions[1].expected, 'brown');
      assert.equal(omissions[1].startTime, 1.25);
      assert.equal(omissions[1].endTime, 2.0);
    });
  });

  describe('3. WordByWordReader Dynamic Cursor Sync & Miscue Visual Indicator Verification', () => {
    // Pure mirror of the cursor index resolution in WordByWordReader
    function getActiveWordIndex(currentTime, duration, isPlaying, items) {
      if (!isPlaying || items.length === 0) return -1;
      const hasTimestamps = items.some((it) => it.startTime != null && it.endTime != null);

      if (hasTimestamps) {
        const directIdx = items.findIndex((it) => {
          if (it.startTime == null || it.endTime == null) return false;
          const s = it.startTime;
          const e = Math.max(it.endTime, s + 0.15);
          return currentTime >= s && currentTime <= e;
        });
        if (directIdx !== -1) return directIdx;

        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.startTime != null && currentTime >= it.startTime) {
            const e = it.endTime != null ? it.endTime : it.startTime + 0.25;
            if (currentTime <= e + 0.25) return i;
            break;
          }
        }
        return -1;
      }

      if (duration > 0) {
        return Math.floor((currentTime / duration) * items.length);
      }
      return -1;
    }

    test('accurately syncs active playing word index with real speech timestamps', () => {
      const items = [
        { type: 'match', expected: 'the', spoken: 'the', startTime: 0.5, endTime: 0.9 },
        { type: 'substitution', expected: 'quick', spoken: 'slow', startTime: 1.8, endTime: 2.4 }, // 0.9s pause hesitation
        { type: 'match', expected: 'fox', spoken: 'fox', startTime: 3.0, endTime: 3.5 },
      ];

      // At 0.7s (during 'the'): index 0
      assert.equal(getActiveWordIndex(0.7, 5.0, true, items), 0);

      // At 1.3s (during the hesitation pause before 'slow'): not in direct window, beyond buffer -> -1 or gap
      assert.equal(getActiveWordIndex(1.3, 5.0, true, items), -1);

      // At 2.1s (during 'slow'): index 1 (the substitution)
      assert.equal(getActiveWordIndex(2.1, 5.0, true, items), 1);

      // At 3.2s (during 'fox'): index 2
      assert.equal(getActiveWordIndex(3.2, 5.0, true, items), 2);
    });

    test('replaces naive green highlighting on miscues with miscue-specific visual styles', () => {
      assert.ok(
        pageSource.includes('function getPlayingStyle(type: MiscueItem["type"])'),
        'page.tsx must define getPlayingStyle'
      );
      assert.ok(
        pageSource.includes('getPlayingStyle(playingItem.type)'),
        'WordByWordReader must use getPlayingStyle(playingItem.type) when isCurrentlyPlaying'
      );

      // Must NOT apply unconditional emerald green to all playing words
      assert.ok(
        !pageSource.includes('isCurrentlyPlaying ? "bg-emerald-100/80 text-emerald-900 rounded-sm" : ""'),
        'Must remove naive unconditional emerald highlight on playing words'
      );
    });

    test('renders live active miscue indicator tooltip showing heard vs expected words', () => {
      assert.ok(
        pageSource.includes('isCurrentlyPlaying && playingItem && playingItem.type !== "match" && !isSelected'),
        'Must show live miscue indicator tooltip when playing a non-match word'
      );
      assert.ok(
        pageSource.includes('playingItem.type === "substitution"'),
        'Tooltip must handle substitution specifically'
      );
      assert.ok(
        pageSource.includes('playingItem.type === "mispronunciation"'),
        'Tooltip must handle mispronunciation specifically'
      );
      assert.ok(
        pageSource.includes('playingItem.type === "omission"'),
        'Tooltip must handle omission specifically'
      );
      assert.ok(
        pageSource.includes('"{playingItem.spoken}"'),
        'Tooltip must display what student spoke'
      );
    });

    test('jumpToWord leverages item.startTime when clicking a word chip', () => {
      assert.ok(
        pageSource.includes('if (item && item.startTime != null && item.startTime >= 0)'),
        'jumpToWord must seek to item.startTime if available'
      );
      assert.ok(
        pageSource.includes('targetSec = Math.max(0, item.startTime - 0.15)'),
        'jumpToWord should include a slight pre-roll before item.startTime'
      );
    });
  });
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const pageSrc = fs.readFileSync(path.join(ROOT, 'src', 'app', 'dashboard', 'reading-fluency', 'page.tsx'), 'utf8');
const captionViewerSrc = fs.readFileSync(path.join(ROOT, 'src', 'components', 'LiveReadingCaptionViewer.tsx'), 'utf8');
const liveCaptionSrc = fs.readFileSync(path.join(ROOT, 'src', 'hooks', 'useLiveCaption.ts'), 'utf8');

describe('Part 1 & Part 2: Oral Reading Word-Pill UI, 1-to-1 Passage Preservation & VAD Live Tracking', async () => {
  const { classifyMiscues, normalizeWords } = await import('../src/lib/reading.ts');

  describe('Part 1.1: classifyMiscues Original Word Preservation, Sub-Token Collapsing & Resilient Timestamps', () => {
    test('preserves original passage casing, punctuation, numbers, hyphens, and 1-to-1 positions', () => {
      const passage = 'The Philippines averages 20 typhoons a year. Use color-coded warnings for 7.5 to 30mm rain.';
      const rawPassageWords = passage.split(/\s+/).filter(Boolean);
      const transcript = 'the philippines averages twenty typhoons a year use color coded warnings for seven five to 30mm rain';

      const res = classifyMiscues(transcript, passage);
      const passageItems = res.items.filter((it) => it.expected !== null);

      assert.equal(passageItems.length, rawPassageWords.length);
      assert.equal(res.wordsTotal, rawPassageWords.length);
      assert.equal(res.totalMiscues, 0);

      passageItems.forEach((item, idx) => {
        assert.equal(item.position, idx, `position for "${rawPassageWords[idx]}" must match raw index ${idx}`);
        assert.equal(item.expected, rawPassageWords[idx], `expected must preserve exact raw token "${rawPassageWords[idx]}"`);
        assert.equal(item.type, 'match');
      });

      const colorCoded = passageItems.find((it) => it.expected === 'color-coded');
      assert.equal(colorCoded?.spoken, 'color coded');
      const decimalWord = passageItems.find((it) => it.expected === '7.5');
      assert.equal(decimalWord?.spoken, 'seven five');
    });

    test('collapses mixed sub-tokens (e.g. partial substitution & mispronunciation) into prioritized passage items', () => {
      const passage = 'See color-coded 7.5 mm charts.';
      // color-coded -> 'color wrong' (substitution); 7.5 -> 'seven nine' (edit distance 2 on len 4 => mispronunciation)
      const transcript = 'see color wrong seven nine mm charts';
      const timestamps = [
        { word: 'see', start: 0.1, end: 0.3 },
        { word: 'color', start: 0.4, end: 0.7 },
        { word: 'wrong', start: 0.8, end: 1.1 },
        { word: 'seven', start: 1.2, end: 1.5 },
        { word: 'nine', start: 1.6, end: 1.9 },
        { word: 'mm', start: 2.0, end: 2.3 },
        { word: 'charts', start: 2.4, end: 2.8 },
      ];

      const res = classifyMiscues(transcript, passage, timestamps);
      const passageItems = res.items.filter((it) => it.expected !== null);

      assert.equal(passageItems.length, 5);
      // color-coded at position 1 (match + substitution => substitution)
      assert.equal(passageItems[1].position, 1);
      assert.equal(passageItems[1].expected, 'color-coded');
      assert.equal(passageItems[1].type, 'substitution');
      assert.equal(passageItems[1].spoken, 'color wrong');
      assert.equal(passageItems[1].startTime, 0.4);
      assert.equal(passageItems[1].endTime, 1.1);

      // 7.5 at position 2 (match + mispronunciation => mispronunciation)
      assert.equal(passageItems[2].position, 2);
      assert.equal(passageItems[2].expected, '7.5');
      assert.equal(passageItems[2].type, 'mispronunciation');
      assert.equal(passageItems[2].spoken, 'seven nine');
      assert.equal(passageItems[2].startTime, 1.2);
      assert.equal(passageItems[2].endTime, 1.9);
      assert.equal(res.counts.substitutions, 1);
      assert.equal(res.counts.mispronunciations, 1);
    });

    test('keeps bullets aligned 1-to-1 and anchors insertions/repetitions with position: null', () => {
      const passage = '• Yellow Warning';
      // Bullet '•' is at raw index 0, 'Yellow' is at raw index 1, 'Warning' is at raw index 2
      const transcript = 'uh yellow extra warning warning';
      const res = classifyMiscues(transcript, passage);

      const yellow = res.items.find((it) => it.expected === 'Yellow');
      const warning = res.items.find((it) => it.expected === 'Warning');
      assert.equal(yellow?.position, 1, 'Yellow position must match raw passage split index 1 even after bullet');
      assert.equal(warning?.position, 2, 'Warning position must match raw passage split index 2');

      const extras = res.items.filter((it) => ['insertion', 'repetition', 'hesitation'].includes(it.type));
      assert.ok(extras.length >= 2);
      for (const ex of extras) {
        assert.equal(ex.position, null, 'Non-passage items must have position: null');
        assert.equal(ex.expected, null, 'Non-passage items must have expected: null');
        assert.notEqual(ex.anchorPosition, undefined, 'Non-passage items should carry anchorPosition');
      }
    });

    test('aligns wordTimestamps sequentially when Whisper expanded word count differs from transcript', () => {
      const passage = 'The sun rose high';
      const transcript = 'the sun rose high';
      // Whisper words contain an extra disfluency token not in cleaned text, making expanded.length (5) !== spoken.length (4)
      const whisperWords = [
        { word: 'Uh,', start: 0.05, end: 0.25 },
        { word: 'the', start: 0.5, end: 0.7 },
        { word: 'sun', start: 0.8, end: 1.1 },
        { word: 'rose', start: 1.2, end: 1.6 },
        { word: 'high.', start: 1.7, end: 2.1 },
      ];

      const res = classifyMiscues(transcript, passage, whisperWords);
      const matchItems = res.items.filter((it) => it.expected !== null);

      // Must align 'the' -> 0.5..0.7, NOT shifted index 0 ('Uh,' 0.05..0.25)!
      assert.equal(matchItems[0].expected, 'The');
      assert.equal(matchItems[0].startTime, 0.5);
      assert.equal(matchItems[0].endTime, 0.7);
      assert.equal(matchItems[3].expected, 'high');
      assert.equal(matchItems[3].startTime, 1.7);
      assert.equal(matchItems[3].endTime, 2.1);
    });
  });

  describe('Part 1.2 & 1.3: WordByWordReader Duplicate Removal, Word-Pill Layout & Post-Stop State', () => {
    test('removes duplicate word span inside WordByWordReader and never splices extras inline', () => {
      const readerStart = pageSrc.indexOf('function WordByWordReader(');
      const readerEnd = pageSrc.indexOf('const fmtTimer =', readerStart);
      const readerCode = pageSrc.slice(readerStart, readerEnd);

      const spanOccurrences = readerCode.match(/<span>\{item\.expected/g) || [];
      assert.equal(spanOccurrences.length, 1, 'WordByWordReader must render each word span exactly once');
      assert.ok(!readerCode.includes('<span>{item.expected || item.spoken}</span>'), 'Duplicate/raw fallback word span must be removed');
      assert.ok(
        readerCode.includes('!["insertion", "repetition", "hesitation"].includes(it.type)'),
        'Must filter out insertion/repetition/hesitation items from inline word pills'
      );
      assert.ok(readerCode.includes('+ Extra'), 'Must display subtle + Extra badge for attached extras');
    });

    test('renders clean natural passage post-recording before Analyze, syncs miscues on Analyze, and updates mic helper text', () => {
      assert.ok(
        pageSrc.includes('Recording oral reading...'),
        'Must render clean passage recording status pill'
      );
      assert.ok(pageSrc.includes('syncMiscuesFromBreakdown('), 'runAnalysis must sync right-hand miscue tracker boxes from analyzed breakdown');
      assert.ok(
        pageSrc.includes('"Analysis complete. Review words or save below."'),
        'Must update mic helper text once result is loaded'
      );
    });
  });

  describe('Part 2: Clean Audio Capture, Gentle Vocal Filter Chain & Token Alignment', () => {
    test('removes AnalyserNode VAD gating from NewSessionTab for clean audio capture and verifies gentle vocal filter chain', () => {
      assert.ok(pageSrc.includes('highPass.frequency.value = 70'), 'Must configure clean highPass at 70Hz');
      assert.ok(pageSrc.includes('compressor.threshold.value = -20'), 'Must configure gentle compressor at -20dB');
      assert.ok(pageSrc.includes('makeupGain.gain.value = 1.5'), 'Must configure post-compressor makeup gain at 1.5x');
    });

    test('useLiveCaption keeps isVoiceActive optional, preserves transcripts across restarts, gates confidence < 0.45, and clamps velocity cleanly', () => {
      assert.ok(liveCaptionSrc.includes('isVoiceActive?: () => boolean;'), 'isVoiceActive must remain optional for student route compatibility');
      assert.ok(liveCaptionSrc.includes('committedFinalRef'), 'Must preserve finalized transcript across SpeechRecognition onend restarts');
      assert.ok(liveCaptionSrc.includes('confidence > 0 && confidence < 0.45'), 'Must reject low-confidence (< 0.45) finalized recognition chunks');
      assert.ok(liveCaptionSrc.includes('listenStartMsRef'), 'Must track internal listen start timestamp so missing elapsed defaults safely');
      assert.ok(liveCaptionSrc.includes('Math.floor(elapsed * 3.0) + 1'), 'Must tighten velocity cap to Math.floor(elapsed * 3.0) + 1');
      assert.ok(liveCaptionSrc.includes('baseline + 3'), 'Must clamp single-event unconfirmed advance to <= 3 positions');
      assert.ok(liveCaptionSrc.includes('prev >= 0 && candidateOrigIdx < prev'), 'Must enforce monotonic activeWordIndex until reset()');
      assert.ok(liveCaptionSrc.includes('expandedPassageRef'), 'Must align expanded normalized passage tokens back to origIdx');
    });

    test('returns null for liveMiscueResult when no passage word has matched yet (liveActiveWordIndex < 0)', () => {
      assert.ok(
        pageSrc.includes('if (!liveSpeech || !cleanPassage || liveActiveWordIndex < 0) return null;'),
        'Must guard against computing miscues before liveActiveWordIndex >= 0'
      );
      assert.ok(
        !pageSrc.includes('liveSpeech.split(/\\s+/).length'),
        'Must remove unstarted liveSpeech word-length fallback from liveMiscueResult'
      );
    });
  });

  describe('Part 3: Unified Single-<audio> Playback, State Sync & WebM Infinity Duration Fix', () => {
    test('unifies NewSessionTab preview <audio> and WordByWordReader via shared playbackAudioRef', () => {
      assert.ok(pageSrc.includes('const playbackAudioRef = useRef<HTMLAudioElement | null>(null);'), 'Must define playbackAudioRef in NewSessionTab');
      assert.ok(pageSrc.includes('<audio ref={playbackAudioRef} controls src={audioUrl}'), 'Preview <audio> must attach playbackAudioRef');
      assert.ok(pageSrc.includes('externalAudioRef={playbackAudioRef}'), 'NewSessionTab must pass externalAudioRef to WordByWordReader');
      assert.ok(pageSrc.includes('fallbackDurationSec={Math.max(recTime, result?.durationSec || 0, 1)}'), 'NewSessionTab must pass finite fallbackDurationSec');
      assert.ok(pageSrc.includes('const audioRef = externalAudioRef ?? internalAudioRef;'), 'WordByWordReader must prefer externalAudioRef when provided');
      assert.ok(pageSrc.includes('renderAudioElement={!externalAudioRef}'), 'AudioPlayerSync must skip duplicate <audio> when externalAudioRef is provided');
    });

    test('syncs playback state on mount/URL change and handles WebM Infinity duration & safe word seeking', () => {
      assert.ok(pageSrc.includes('syncPlaybackState();'), 'Must immediately sync playback state from shared <audio> element');
      assert.ok(pageSrc.includes('!audio.paused && !audio.ended'), 'Must sync isPlaying from active <audio> state');
      assert.ok(pageSrc.includes('"durationchange"'), 'Must listen to durationchange event');
      assert.ok(pageSrc.includes('"ratechange"'), 'Must listen to ratechange event');
      assert.ok(pageSrc.includes('Number.isFinite(audio.duration) && audio.duration > 0'), 'Must guard against WebM Infinity/NaN duration');
      assert.ok(pageSrc.includes('if (!s || !Number.isFinite(s) || s < 0) return "0:00";'), 'fmtAudioTime must guard against non-finite numbers');
      assert.ok(pageSrc.includes('document.querySelectorAll("audio")'), 'Must pause stray audio elements as safety guard');
      assert.ok(pageSrc.includes('estimateEntryTimestampSec'), 'Must interpolate missing word timestamps from adjacent words');
      assert.ok(pageSrc.includes('targetSec = Math.min(finiteDuration, Math.max(0, targetSec));'), 'Must clamp targetSec to [0, finiteDuration]');
    });
  });
});

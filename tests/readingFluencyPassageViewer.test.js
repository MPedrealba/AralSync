import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Reading Fluency Passage Viewer, Dual Selectors & Edit Mode Suite', () => {
  const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'reading-fluency', 'page.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  describe('1. Dedicated Learner and Passage Selectors', () => {
    test('renders separate Learner Selector with label and studentId select', () => {
      assert.ok(content.includes('Select Learner:'), 'Must include Select Learner: label');
      assert.ok(content.includes('value={studentId}'), 'Learner select must bind to studentId');
      assert.ok(content.includes('filteredLearners.map'), 'Learner select must iterate over filteredLearners');
    });

    test('renders separate Passage Selector with label and passageTitle select', () => {
      assert.ok(content.includes('Select Passage:'), 'Must include Select Passage: label');
      assert.ok(content.includes('value={passageTitle}'), 'Passage select must bind to passageTitle');
      assert.ok(content.includes('passages.map'), 'Passage select must iterate over passages');
      assert.ok(content.includes('words'), 'Passage select options must display word counts');
    });

    test('auto-selects Phil-IRI recommended starting grade passage on learner selection', () => {
      assert.ok(content.includes('recommendedStartingLevel'), 'Must support recommendedStartingLevel');
      assert.ok(content.includes('evaluateGstScore'), 'Must support dynamic GST score evaluation');
      assert.ok(content.includes('setPassageTitle(match.title)'), 'Must update passageTitle on starting passage match');
      assert.ok(content.includes('setPassageText(match.text)'), 'Must update passageText on starting passage match');
    });
  });

  describe('2. Prominent Reading Passage Reader Box', () => {
    test('renders normal reading mode with high-contrast typography and card styles', () => {
      assert.ok(
        content.includes('rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 select-none'),
        'Must render spacious high-contrast reading box with specified classes'
      );
      assert.ok(
        content.includes('font-serif text-lg sm:text-xl leading-relaxed text-slate-800'),
        'Must render large legible typography'
      );
      assert.ok(content.includes('space-y-4'), 'Paragraphs must have space-y-4 spacing');
      assert.ok(content.includes('passageText.split'), 'Must split passageText into paragraphs');
    });

    test('connects active recording mode to LiveReadingCaptionViewer', () => {
      assert.ok(content.includes('<LiveReadingCaptionViewer'), 'Must mount LiveReadingCaptionViewer when recording');
      assert.ok(content.includes('activeWordIndex={liveActiveWordIndex}'), 'Must pass activeWordIndex for real-time word highlighting');
      assert.ok(content.includes('spokenWordCount={liveSpokenWordCount}'), 'Must pass spokenWordCount');
    });

    test('renders editing mode with textarea and toggle button', () => {
      assert.ok(content.includes('isEditingPassage'), 'Must support isEditingPassage state');
      assert.ok(content.includes('rows={8}'), 'Editing mode must render 8-row textarea');
      assert.ok(content.includes('value={passageText}'), 'Textarea must bind to passageText');
      assert.ok(content.includes('onChange={(e) => setPassageText(e.target.value)}'), 'Textarea must update passageText on change');
      assert.ok(content.includes('Edit Text'), 'Must include Edit Text button label');
      assert.ok(content.includes('Done Editing'), 'Must include Done Editing button label');
    });

    test('renders word calibration mode when viewMode === "calibration"', () => {
      assert.ok(content.includes('viewMode === "calibration"'), 'Must check viewMode === "calibration"');
      assert.ok(content.includes('<WordByWordReader'), 'Must mount WordByWordReader in calibration mode');
    });
  });

  describe('3. Two-Column Workstation Layout Integrity', () => {
    test('enforces responsive 12-column grid with 7-column reader and 5-column screener deck', () => {
      assert.ok(content.includes('lg:col-span-7'), 'Left column must span 7 columns for passage reader');
      assert.ok(content.includes('lg:col-span-5'), 'Right column must span 5 columns for audio workstation');
      assert.ok(content.includes('Audio Screener Workstation'), 'Right column must host Audio Screener Workstation');
      assert.ok(content.includes('Phil-IRI 2024 Miscue Tracker'), 'Right column must host Phil-IRI Miscue Tracker');
    });
  });

  describe('4. Clean Book-Style Passage Typography & Notion-Style Floating Action Pill', () => {
    test('formats passage as clean, elegant book text without emoji badge clutter or native tooltips', () => {
      assert.ok(content.includes('font-serif text-lg leading-relaxed text-slate-800'), 'Must render clean serif passage typography');
      assert.ok(content.includes('bg-rose-50 text-rose-900 border-b-2 border-rose-400'), 'Substitutions must have subtle red tint and underline');
      assert.ok(content.includes('line-through text-rose-700 decoration-rose-400'), 'Omissions must have subtle strikethrough styling');
      assert.ok(content.includes('text-amber-900 underline decoration-amber-400 decoration-wavy'), 'Mispronunciations must have wavy underline');
      assert.ok(content.includes('bg-blue-50 text-blue-800 text-xs px-1.5 py-0.5 rounded'), 'Insertions must have subtle blue badge');
      assert.ok(!content.includes('title={`Word #${idx + 1}'), 'Must remove native title attributes from word elements');
    });

    test('renders sleek 36px-height Notion-style floating action pill anchored above selected word', () => {
      assert.ok(content.includes('data-floating-pill'), 'Must render floating toolbar pill');
      assert.ok(content.includes('h-9 flex items-center'), 'Floating pill must have compact 36px height');
      assert.ok(content.includes('rounded-full bg-slate-900 text-white shadow-xl'), 'Floating pill must have sleek dark rounded styling');
      assert.ok(content.includes('Mark Correct'), 'Must include single prominent Mark Correct button');
    });

    test('provides compact toggle buttons (Sub, Omit, Mispron), audio replay, and escape key listener', () => {
      assert.ok(content.includes('<span>Sub</span>'), 'Must include compact Sub toggle');
      assert.ok(content.includes('<span>Omit</span>'), 'Must include compact Omit toggle');
      assert.ok(content.includes('<span>Mispron</span>'), 'Must include compact Mispron toggle');
      assert.ok(content.includes('fmtAudioTime(wordEstimatedSec)'), 'Must include compact audio timestamp replay button');
      assert.ok(content.includes('e.key === "Escape"'), 'Must dismiss floating pill on Escape key');
    });

    test('recalculates metrics and syncs with Phil-IRI Miscue Tracker in real time', () => {
      assert.ok(content.includes('handleOverrideWord'), 'Must define handleOverrideWord handler');
      assert.ok(content.includes('substitutions: next.filter'), 'Must recalculate substitutions count on override');
      assert.ok(content.includes('omissions: next.filter'), 'Must recalculate omissions count on override');
      assert.ok(content.includes('setMiscues(updatedMiscues)'), 'Must sync setMiscues in real time');
      assert.ok(content.includes('liveMetrics?.counts'), 'Miscue inputs must bind to liveMetrics counts');
      assert.ok(content.includes('overrideCount'), 'Must display overrideCount badge');
    });

    test('persists teacher-calibrated word classifications and Phil-IRI score seamlessly', () => {
      assert.ok(content.includes('Save &amp; Approve Calibrated Assessment') || content.includes('Save & Approve Calibrated Assessment'), 'Must render Save & Approve Calibrated Assessment button');
      assert.ok(content.includes('miscueItems: calibratedItems'), 'Payload must persist teacher-calibrated miscueItems');
      assert.ok(content.includes('score: liveMetrics.accuracy'), 'Payload must persist updated accuracy score');
      assert.ok(content.includes('philIriLevel: liveMetrics.philIriLevel'), 'Payload must persist Phil-IRI reading level');
    });
  });
});

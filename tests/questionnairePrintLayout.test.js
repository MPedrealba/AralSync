const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Questionnaire Print Layout, Page-Breaks & 4-Part Booklet Formatting Suite', () => {
  const pagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-assessments', 'page.tsx');
  const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'questionnaire', 'generate-reading', 'route.ts');
  const secTypesPath = path.join(__dirname, '..', 'src', 'lib', 'questionnaireSections.ts');

  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const routeContent = fs.readFileSync(routePath, 'utf8');
  const secContent = fs.readFileSync(secTypesPath, 'utf8');

  test('backend generate-reading partitions 40-item reading diagnostic test into 4 distinct 10-item sections', () => {
    assert.ok(routeContent.includes('is4PartPhilIri'), 'route.ts must check is4PartPhilIri');
    assert.ok(
      routeContent.includes('PART ${part}: ${ref.passageTitle.toUpperCase()} (Items ${start}–${end})'),
      'route.ts must generate dynamic PART headers with exact item ranges'
    );
    assert.ok(
      secContent.includes('PART ${part}: ${ref.passageTitle.toUpperCase()} (Items ${start}–${end})'),
      'buildPhilIriG7Sections must format PART headers with exact item ranges'
    );
    assert.ok(routeContent.includes('selection-a'), 'Part I must map to selection-a');
    assert.ok(routeContent.includes('selection-b'), 'Part II must map to selection-b');
    assert.ok(routeContent.includes('selection-c'), 'Part III must map to selection-c');
    assert.ok(routeContent.includes('selection-d'), 'Part IV must map to selection-d');
  });

  test('Page 1 cover page includes all 5 learner info header fields (Name, LRN, Section, Date, Score)', () => {
    assert.ok(pageContent.includes('NAME:'), 'Must include NAME: field');
    assert.ok(pageContent.includes('LRN:'), 'Must include LRN: field');
    assert.ok(pageContent.includes('SECTION:'), 'Must include SECTION: field');
    assert.ok(pageContent.includes('DATE:'), 'Must include DATE: field');
    assert.ok(pageContent.includes('SCORE:'), 'Must include SCORE: field');
  });

  test('enforces page-break-after ONLY at the end of each Part (Part I, Part II, Part III)', () => {
    assert.ok(
      pageContent.includes('breakAfter: !isLastSection ? "page" : "auto"'),
      'Must conditionally break after only when !isLastSection'
    );
    assert.ok(
      pageContent.includes('pageBreakAfter: !isLastSection ? "always" : "auto"'),
      'Must conditionally pageBreakAfter only when !isLastSection'
    );
    assert.ok(
      pageContent.includes('.section-page:not(:last-child) { page-break-after: always !important; break-after: page !important; }'),
      'CSS print rules must use .section-page:not(:last-child)'
    );
  });

  test('applies break-inside avoid to every question container and choices container to prevent page margin slicing', () => {
    assert.ok(pageContent.includes('question-item break-inside-avoid'), 'Question containers must have question-item break-inside-avoid');
    assert.ok(
      pageContent.includes('style={{ breakInside: "avoid", pageBreakInside: "avoid" }}'),
      'Question and choices containers must have inline breakInside avoid style'
    );
    assert.ok(
      pageContent.includes('.question-item, .break-inside-avoid { page-break-inside: avoid !important; break-inside: avoid !important; }'),
      '@media print must enforce page-break-inside: avoid !important'
    );
  });

  test('compacts Poem (Part I) into 2-column stanza layout with text-[10.5px] leading-snug font-serif italic pl-3 border-l-2 border-gray-400 py-1', () => {
    assert.ok(
      pageContent.includes('text-[10.5px] leading-snug font-serif italic pl-3 border-l-2 border-gray-400 py-1'),
      'Poem must use compact 2-column stanza styling'
    );
    assert.ok(
      pageContent.includes('grid grid-cols-2 gap-x-6'),
      'Poem must render in 2-column grid layout'
    );
  });

  test('formats Prose & Articles (Parts II & III) with 2-column justified text layout and text-[10px] leading-tight text-gray-800', () => {
    assert.ok(
      pageContent.includes('columns: 2, columnGap: "1.5rem", textAlign: "justify"'),
      'Prose and articles must use two-column justified layout'
    );
    assert.ok(
      pageContent.includes('text-[10px] leading-tight text-gray-800'),
      'Prose must use compact 10px leading-tight typography'
    );
  });

  test('places Infographic (Part IV) side-by-side with bullet points in 2-column container with max-h-[160px] w-auto', () => {
    assert.ok(
      pageContent.includes('max-h-[160px] w-auto object-contain rounded border border-gray-300'),
      'Infographic image must be constrained to max-h-[160px]'
    );
    assert.ok(
      pageContent.includes('grid grid-cols-12 gap-3 items-center'),
      'Infographic and bullet points must be placed side-by-side in grid container'
    );
  });

  test('formats question choices in tight 2-column grid with gap-x-4 gap-y-0.5 text-[10.5px] leading-tight', () => {
    assert.ok(
      pageContent.includes('grid grid-cols-2 gap-x-4 gap-y-0.5 pl-3 text-[10.5px] leading-tight'),
      'Question choices must be arranged in tight 2-column grid'
    );
  });

  test('reduces question vertical margins to mb-1.5 with leading-tight prompts', () => {
    assert.ok(
      pageContent.includes('question-item break-inside-avoid mb-1.5'),
      'Question items must use mb-1.5 vertical spacing'
    );
    assert.ok(
      pageContent.includes('font-medium text-black leading-tight text-[10.5px]'),
      'Question prompts must use 10.5px leading-tight'
    );
  });

  test('sanitizeDoc auto-partitions any 40-item reading assessment into official 4-part booklet sections', () => {
    assert.ok(pageContent.includes('buildPhilIriG7Sections'), 'page.tsx must import and use buildPhilIriG7Sections');
    assert.ok(secContent.includes('export function buildPhilIriG7Sections'), 'questionnaireSections.ts must export buildPhilIriG7Sections');
    assert.ok(pageContent.includes('is4PartReadingDoc'), 'sanitizeDoc must check is4PartReadingDoc');
  });
});

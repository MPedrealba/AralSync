import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("OMR Assessments & Comprehension Check Grade Filtering Suite", () => {
  const omrAssessmentsPath = path.join(process.cwd(), "src/app/dashboard/omr-assessments/page.tsx");
  const compPagePath = path.join(process.cwd(), "src/app/dashboard/comprehension/page.tsx");

  test("OMR Assessments removes 'reading' GenType and reading story tab", () => {
    const content = fs.readFileSync(omrAssessmentsPath, "utf-8");
    assert.match(content, /type GenType = "aral" \| ("extract" \| )?"upload";/);
    assert.doesNotMatch(content, /genType === "reading"/);
    assert.doesNotMatch(content, /onClick=\{\(\) => setGenType\("reading"\)\}/);
  });

  test("OMR Assessments combines ARAL DepEd and Extract into unified DepEd ARAL Materials with method toggle", () => {
    const content = fs.readFileSync(omrAssessmentsPath, "utf-8");
    assert.match(content, /DepEd ARAL Materials/);
    assert.match(content, /Question Generation Method/);
    assert.match(content, /Curriculum Bank/);
    assert.match(content, /AI Page Scanner/);
    assert.match(content, /availableMaterials/);
  });

  test("OMR Assessments includes dedicated Grade Level dropdown filtering learning materials", () => {
    const content = fs.readFileSync(omrAssessmentsPath, "utf-8");
    assert.match(content, /Grade Level/);
    assert.match(content, /<option value=\{7\}>Grade 7<\/option>/);
    assert.match(content, /<option value=\{8\}>Grade 8<\/option>/);
    assert.match(content, /<option value=\{9\}>Grade 9<\/option>/);
    assert.match(content, /<option value=\{10\}>Grade 10<\/option>/);
  });

  test("Comprehension Check elevates Grade Level selector and filters reading selections in QuestionnaireTab", () => {
    const content = fs.readFileSync(compPagePath, "utf-8");
    // Elevation of targetGrade in QuestionnaireTab
    assert.match(content, /const filteredPassages = useMemo/);
    assert.match(content, /const handleGradeChange =/);
    assert.match(content, /Grade \{targetGrade\} Filtered/);
  });

  test("Comprehension Check Grade Face-to-Face Bubble Sheet (OMR Modal) has Grade and Section filter dropdowns directly above student roster", () => {
    const content = fs.readFileSync(compPagePath, "utf-8");
    assert.match(content, /function GradeOMRModal/);
    assert.match(content, /availableModalSections/);
    assert.match(content, /2\. Filter &amp; Select Student/);
    assert.match(content, /All Sections/);
  });

  test("Comprehension Library has Grade Level filter dropdown in toolbar", () => {
    const content = fs.readFileSync(compPagePath, "utf-8");
    assert.match(content, /function ComprehensionLibraryTab/);
    assert.match(content, /matchesGrade/);
    assert.match(content, /All Grades/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  evaluateReadingPerformance,
  comprehensionLevel,
  combinedReadingLevel,
  compilePassageComprehensionQuestions,
} from "../src/lib/reading.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Unified Phil-IRI Stage 2 Workstation Suite", () => {
  const sidebarPath = path.join(__dirname, "..", "src", "components", "Sidebar.tsx");
  const pagePath = path.join(__dirname, "..", "src", "app", "dashboard", "reading-fluency", "page.tsx");
  const assessmentModelPath = path.join(__dirname, "..", "models", "Assessment.js");
  const apiRoutePath = path.join(__dirname, "..", "src", "app", "api", "teacher", "assessments", "[id]", "route.ts");
  const philIriSyncPath = path.join(__dirname, "..", "src", "lib", "philIriSync.ts");

  const sidebarSrc = fs.readFileSync(sidebarPath, "utf8");
  const pageSrc = fs.readFileSync(pagePath, "utf8");
  const modelSrc = fs.readFileSync(assessmentModelPath, "utf8");
  const apiRouteSrc = fs.readFileSync(apiRoutePath, "utf8");
  const syncSrc = fs.readFileSync(philIriSyncPath, "utf8");

  describe("1. Streamlined Sidebar & Unified Navigation", () => {
    it("removes standalone 'Comprehension Check' from sidebar navigation items", () => {
      // Must not have a separate Comprehension Check navigation link
      assert.ok(!sidebarSrc.includes('name: "Comprehension Check"'));
      assert.ok(!sidebarSrc.includes('name: "Pag-unawa"'));
    });

    it("renames 'Reading Fluency' to 'Oral Reading & Comprehension' pointing to /dashboard/reading-fluency", () => {
      assert.ok(sidebarSrc.includes('name: "Oral Reading & Comprehension"'));
      assert.ok(sidebarSrc.includes('href: "/dashboard/reading-fluency"'));
      // Bilingual Filipino navigation retains Pagbasa at Pag-unawa
      assert.ok(sidebarSrc.includes("Pagbasa at Pag-unawa"));
    });
  });

  describe("2. Embedded Immediate Comprehension Check (DepEd Table 2)", () => {
    it("renders Phil-IRI Comprehension Check section directly below the passage reader", () => {
      assert.ok(pageSrc.includes("Phil-IRI Comprehension Check"));
      assert.ok(pageSrc.includes("DepEd Form 2"));
      assert.ok(pageSrc.includes("lg:col-span-7 space-y-6"));
    });

    it("compiles 5 to 8 questions categorized into Literal, Inferential, and Critical domains", () => {
      const sampleQuestions = [
        { question: "Where did the story take place?", answer: "In the forest", category: "Literal" },
        { question: "Why was the boy afraid?", answer: "Because it was dark", category: "Inferential" },
      ];
      const compiled = compilePassageComprehensionQuestions(
        sampleQuestions,
        "The boy walked through the dark forest. He heard distant sounds and wondered what might happen next. In the end, he found his way safely back home.",
        "The Forest Journey",
        6
      );

      assert.ok(compiled.length >= 5 && compiled.length <= 8);
      const categories = compiled.map((q) => q.category);
      assert.ok(categories.includes("Literal"));
      assert.ok(categories.includes("Inferential"));
      assert.ok(categories.includes("Critical"));
    });

    it("implements DepEd Table 2 comprehension bands correctly", () => {
      // Independent: >= 80%
      assert.equal(comprehensionLevel(100), "Independent");
      assert.equal(comprehensionLevel(80), "Independent");

      // Instructional: 59% to 79%
      assert.equal(comprehensionLevel(79), "Instructional");
      assert.equal(comprehensionLevel(65), "Instructional");
      assert.equal(comprehensionLevel(59), "Instructional");

      // Frustration: <= 58%
      assert.equal(comprehensionLevel(58), "Frustration");
      assert.equal(comprehensionLevel(40), "Frustration");
      assert.equal(comprehensionLevel(0), "Frustration");
    });

    it("provides 1-click answer scoring and quick batch controls", () => {
      assert.ok(pageSrc.includes("handleSetQuestionScore"));
      assert.ok(pageSrc.includes("handleMarkAllCompCorrect"));
      assert.ok(pageSrc.includes("handleResetCompScores"));
      assert.ok(pageSrc.includes("Mark All Correct"));
      assert.ok(pageSrc.includes("compQuestions.map"));
    });
  });

  describe("3. Table 3 Joint Matrix Automatic Reading Level Combination", () => {
    it("applies DepEd Table 3 Joint Matrix combinations accurately", () => {
      // Independent (Oral >= 97%) + Independent (Comp >= 80%) = Independent
      assert.equal(combinedReadingLevel(98, 85), "Independent");

      // Independent (Oral >= 97%) + Instructional (Comp 59-79%) = Instructional
      assert.equal(combinedReadingLevel(98, 70), "Instructional");

      // Independent (Oral >= 97%) + Frustration (Comp <= 58%) = Frustration
      assert.equal(combinedReadingLevel(98, 50), "Frustration");

      // Instructional (Oral 90-96%) + Independent (Comp >= 80%) = Instructional
      assert.equal(combinedReadingLevel(94, 85), "Instructional");

      // Instructional (Oral 90-96%) + Instructional (Comp 59-79%) = Instructional
      assert.equal(combinedReadingLevel(94, 65), "Instructional");

      // Instructional (Oral 90-96%) + Frustration (Comp <= 58%) = Frustration
      assert.equal(combinedReadingLevel(94, 50), "Frustration");

      // Frustration (Oral <= 89%) + Any Comp = Frustration
      assert.equal(combinedReadingLevel(85, 100), "Frustration");
      assert.equal(combinedReadingLevel(85, 75), "Frustration");
      assert.equal(combinedReadingLevel(85, 40), "Frustration");

      // Non-Reader (zero words decoded or <80% without decoding) + Any Comp = Non-Reader
      const nonReaderRes = evaluateReadingPerformance(0, 80, 50, 0);
      assert.equal(nonReaderRes.combinedLevel, "Non-Reader");
    });

    it("displays Phil-IRI Table 3 Joint Profile in the right-hand screener results panel", () => {
      assert.ok(pageSrc.includes("Phil-IRI Table 3 Joint Profile"));
      assert.ok(pageSrc.includes("Oral Reading (Table 1)"));
      assert.ok(pageSrc.includes("Comprehension (Table 2)"));
      assert.ok(pageSrc.includes("combinedLevel"));
    });

    it("persists unified assessment payload with fluency metrics, comprehension score, and Table 3 profile", () => {
      assert.ok(pageSrc.includes("comprehension: {"));
      assert.ok(pageSrc.includes("score: compScorePct"));
      assert.ok(pageSrc.includes("masteryLevel: compLevel"));
      assert.ok(pageSrc.includes("combinedLevel: combinedLevel"));
      assert.ok(pageSrc.includes("Save &amp; Approve Calibrated Assessment"));
    });

    it("Assessment schema in database accepts unified comprehension and combinedLevel", () => {
      assert.ok(modelSrc.includes("comprehensionScore:"));
      assert.ok(modelSrc.includes("comprehensionLevel:"));
      assert.ok(modelSrc.includes("combinedLevel:"));
      assert.ok(modelSrc.includes("comprehension: {"));
    });

    it("PATCH assessment API route persists unified comprehension and combinedLevel", () => {
      assert.ok(apiRouteSrc.includes("combinedLevel"));
      assert.ok(apiRouteSrc.includes("comprehension"));
      assert.ok(apiRouteSrc.includes("comprehensionScore"));
      assert.ok(apiRouteSrc.includes("comprehensionLevel"));
    });

    it("philIriSync automatically synchronizes embedded comprehension and recomputes combinedReadingLevel", () => {
      assert.ok(syncSrc.includes("approvedFluency.comprehensionScore"));
      assert.ok(syncSrc.includes("combinedReadingLevel(oralAccuracy, compScore)"));
    });
  });

  describe("4. Historical Comprehension & CBT Access in Result History Tab", () => {
    it("fetches both READING_FLUENCY and COMPREHENSION assessments", () => {
      assert.ok(pageSrc.includes('fetch("/api/teacher/assessments?type=READING_FLUENCY")'));
      assert.ok(pageSrc.includes('fetch("/api/teacher/assessments?type=COMPREHENSION")'));
    });

    it("provides filter switcher pills for All, Oral Fluency & Combined, and Comprehension CBT", () => {
      assert.ok(pageSrc.includes("All Reading Records"));
      assert.ok(pageSrc.includes("Oral Fluency &amp; Combined"));
      assert.ok(pageSrc.includes("Comprehension CBT"));
    });

    it("FluencyReportModal renders detailed Comprehension & Combined Profile breakdown", () => {
      assert.ok(pageSrc.includes("Phil-IRI Stage 2: Comprehension &amp; Combined Profile"));
      assert.ok(pageSrc.includes("Comprehension Band (Table 2)"));
      assert.ok(pageSrc.includes("Joint Matrix (Table 3)"));
      assert.ok(pageSrc.includes("Question Response Breakdown"));
    });
  });
});

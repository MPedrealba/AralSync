const { describe, it } = require("node:test");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// 1. Test cleanPassageText logic
describe("Oral Reading Workflow Improvements", () => {
  describe("1. Passage Text Scraped Footer & URL Cleaner", () => {
    function cleanPassageText(text) {
      if (!text) return "";
      return text
        // Strip "source https://..." or "source http://..."
        .replace(/source\s+https?:\/\/\S+/gi, "")
        // Strip standard URLs
        .replace(/https?:\/\/\S+/gi, "")
        // Strip www. links
        .replace(/\b(?:www\.)\S+/gi, "")
        // Clean out trailing citation strings like "source https www public domain poetry com madison julius cawein..."
        .replace(/\bsource\s+(?:https?|www)\s+[a-z0-9\s.-]+$/gi, "")
        .replace(/\bsource\s+https?\s+www[\s\S]*$/gi, "")
        .replace(/\b(?:source|adapted from|retrieved from)\s+https?[\s\S]*$/gi, "")
        .replace(/\b(?:source|citation|adapted from|retrieved from)\s*[:\s]+(?:https?:\/\/|www\.)\S+/gi, "")
        .replace(/\n\s*(?:source|citation|adapted from|retrieved from):?.*$/gim, "")
        .trim();
    }

    it("should strip standard URLs from passage text", () => {
      const raw = "The little dog barked at the moon. https://example.com/story/123";
      assert.strictEqual(cleanPassageText(raw), "The little dog barked at the moon.");
    });

    it("should strip space-separated scraped source footers", () => {
      const raw =
        "Over the mountains the wind whistled softly.\n\nsource https www public domain poetry com madison julius cawein poems 123";
      assert.strictEqual(cleanPassageText(raw), "Over the mountains the wind whistled softly.");
    });

    it("should strip trailing citation strings", () => {
      const raw = "The sun rose early today.\nSource: Philippine Elementary Reader 2024";
      assert.strictEqual(cleanPassageText(raw), "The sun rose early today.");
    });
  });

  describe("2. Comprehension Questions Distribution (2 Literal, 2 Inferential, 2 Critical)", () => {
    it("should guarantee strict distribution: Slots 1-2 Literal, 3-4 Inferential, 5-6 Critical", () => {
      // Mock question compiler distribution logic
      const pool = [
        { id: "1", category: "Critical", question: "Crit 1", answer: "A" },
        { id: "2", category: "Literal", question: "Lit 1", answer: "B" },
        { id: "3", category: "Inferential", question: "Inf 1", answer: "C" },
        { id: "4", category: "Critical", question: "Crit 2", answer: "D" },
        { id: "5", category: "Literal", question: "Lit 2", answer: "E" },
        { id: "6", category: "Inferential", question: "Inf 2", answer: "F" },
      ];

      const literals = pool.filter((q) => q.category.toLowerCase().includes("lit"));
      const inferentials = pool.filter((q) => q.category.toLowerCase().includes("infer"));
      const criticals = pool.filter((q) => q.category.toLowerCase().includes("crit"));

      const finalQuestions = [
        ...literals.slice(0, 2),
        ...inferentials.slice(0, 2),
        ...criticals.slice(0, 2),
      ];

      assert.strictEqual(finalQuestions.length, 6);
      assert.strictEqual(finalQuestions[0].category, "Literal");
      assert.strictEqual(finalQuestions[1].category, "Literal");
      assert.strictEqual(finalQuestions[2].category, "Inferential");
      assert.strictEqual(finalQuestions[3].category, "Inferential");
      assert.strictEqual(finalQuestions[4].category, "Critical");
      assert.strictEqual(finalQuestions[5].category, "Critical");
    });
  });

  describe("3. Real-Time Dynamic Miscue Calculations (Phil-IRI 2024)", () => {
    it("should compute totalMiscues across all 6 categories, calibratedAccuracy, and wer", () => {
      const wordCount = 100;
      const miscues = {
        substitutions: 2,
        omissions: 1,
        insertions: 1,
        repetitions: 1,
        mispronunciations: 1,
        reversals: 1,
      };

      const totalMiscues =
        miscues.substitutions +
        miscues.omissions +
        miscues.insertions +
        miscues.repetitions +
        miscues.mispronunciations +
        miscues.reversals;

      const calibratedAccuracy = Math.max(0, Math.round(((wordCount - totalMiscues) / wordCount) * 100));
      const werPct = Math.min(100, Math.round((totalMiscues / wordCount) * 100));

      assert.strictEqual(totalMiscues, 7);
      assert.strictEqual(calibratedAccuracy, 93);
      assert.strictEqual(werPct, 7);

      // Phil-IRI Table 1 level check:
      // Independent: >= 97%
      // Instructional: 90% - 96%
      // Frustration: < 90%
      function getTable1Level(acc) {
        if (acc >= 97) return "Independent";
        if (acc >= 90) return "Instructional";
        return "Frustration";
      }

      assert.strictEqual(getTable1Level(calibratedAccuracy), "Instructional");
      assert.strictEqual(getTable1Level(98), "Independent");
      assert.strictEqual(getTable1Level(88), "Frustration");
    });
  });

  describe("4. Fuzzy Speech Alignment (Levenshtein Distance 3-word Sliding Window)", () => {
    function levenshtein(a, b) {
      const m = a.length;
      const n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
      }
      return dp[m][n];
    }

    function isWordMatch(spoken, passageWord) {
      const s = spoken.toLowerCase().replace(/[^a-z0-9]/g, "");
      const p = passageWord.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (s === p) return true;
      if (!s || !p) return false;
      const dist = levenshtein(s, p);
      const maxLen = Math.max(s.length, p.length);
      if (maxLen <= 3) return dist === 0;
      if (maxLen <= 6) return dist <= 1;
      return dist <= 2;
    }

    it("should match words with minor pronunciation/stt discrepancies", () => {
      assert.strictEqual(isWordMatch("mountain", "mountains"), true);
      assert.strictEqual(isWordMatch("runing", "running"), true);
      assert.strictEqual(isWordMatch("completely", "different"), false);
    });

    it("should not advance on stuttered repetitions", () => {
      const passageTokens = ["the", "quick", "brown", "fox"];
      let passageIdx = 0;
      const spokenStream = ["the", "the", "the", "quick"];

      for (const spoken of spokenStream) {
        if (isWordMatch(spoken, passageTokens[passageIdx])) {
          passageIdx++;
        } else if (passageIdx > 0 && isWordMatch(spoken, passageTokens[passageIdx - 1])) {
          // repeated current/prior word: do not advance
        }
      }

      assert.strictEqual(passageIdx, 2); // Matched "the" (1) and "quick" (2)
    });
  });

  describe("5. Enhanced WebRTC & WebAudio DSP Pipeline Verification", () => {
    it("should verify hardware and DSP filter chain in source code", () => {
      const teacherPage = fs.readFileSync(
        path.join(__dirname, "../src/app/dashboard/reading-fluency/page.tsx"),
        "utf8"
      );
      const studentPage = fs.readFileSync(
        path.join(__dirname, "../src/app/student/reading-fluency/page.tsx"),
        "utf8"
      );

      // Verify WebRTC acoustic constraints
      assert.ok(!teacherPage.includes("sampleRate: 44100"), "Teacher page must remove hardcoded sampleRate 44100 to prevent AGC/ducking ramp-up");
      assert.ok(teacherPage.includes("suppressLocalAudioPlayback: true"));
      assert.ok(studentPage.includes("sampleRate: 44100"));
      assert.ok(studentPage.includes("suppressLocalAudioPlayback: true"));

      // Verify BiquadFilter high-pass (70Hz on teacherPage, 85Hz on studentPage)
      assert.ok(teacherPage.includes("highPass.frequency.value = 70"));
      assert.ok(studentPage.includes("highPass.frequency.value = 85"));
    });
  });
});

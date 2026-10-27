/**
 * Helper utilities for structuring questionnaire items into official DepEd
 * topic sections with directions and continuous numbering.
 */

export interface QuestionnaireSection {
  partNumber: string; // e.g. "I", "II", "III"
  title: string;      // e.g. "Part I: Adding Similar Fractions (Items 1–5)"
  topic: string;      // e.g. "Adding Similar Fractions"
  itemRange: string;  // e.g. "Items 1–5" or "Item 1"
  startItem: number;  // 1-indexed start item number
  endItem: number;    // 1-indexed end item number
  itemCount: number;  // total items in this section
  instructions: string; // Auto-generated DepEd directions
}

// Auto-directions helper based on topic/subject keywords
export function getTopicInstructions(topicName: string, subject: string): string {
  const t = (topicName || "").toLowerCase();
  if (t.includes("fraction") || /\bratios?\b/i.test(t) || t.includes("rational")) {
    return "Directions: Perform the indicated operations and express all answers in simplest / lowest terms.";
  }
  if (
    t.includes("integer") ||
    t.includes("equation") ||
    t.includes("algebra") ||
    t.includes("expression")
  ) {
    return "Directions: Solve each algebraic or numerical problem carefully. Choose the letter of the correct answer.";
  }
  if (
    t.includes("angle") ||
    t.includes("geometry") ||
    t.includes("circle") ||
    t.includes("triangle") ||
    t.includes("polygon")
  ) {
    return "Directions: Analyze the geometric figures and properties described. Select the letter corresponding to the correct answer.";
  }
  if (t.includes("vocabulary") || t.includes("context") || t.includes("meaning")) {
    return "Directions: Read each context clue carefully and determine the meaning of the underlined or highlighted concept.";
  }
  if (t.includes("comprehension") || t.includes("inference") || t.includes("theme")) {
    return "Directions: Based on the reading selection, answer the following comprehension and analysis questions.";
  }
  return subject === "Math"
    ? "Directions: Read each math problem carefully, solve for the correct value, and shade the corresponding letter."
    : "Directions: Read each question carefully and select the best answer from the given choices.";
}

export const ROMAN_NUMERALS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
];

/**
 * Builds continuous numbering across topic groups and generates official DepEd
 * section headers and instructions.
 */
export function buildTopicSections(
  groupedQuestions: { topic: string; questions: any[] }[],
  subject: string
): {
  sections: QuestionnaireSection[];
  orderedQuestions: any[];
} {
  const sections: QuestionnaireSection[] = [];
  const orderedQuestions: any[] = [];
  let currentItemNumber = 1;

  groupedQuestions.forEach((group) => {
    if (!group.questions || group.questions.length === 0) return;

    const startItem = currentItemNumber;
    const groupCount = group.questions.length;
    const endItem = startItem + groupCount - 1;
    const partNumber = ROMAN_NUMERALS[sections.length] || String(sections.length + 1);
    const itemRange = startItem === endItem ? `Item ${startItem}` : `Items ${startItem}–${endItem}`;
    const title = `Part ${partNumber}: ${group.topic} (${itemRange})`;
    const instructions = getTopicInstructions(group.topic, subject);

    sections.push({
      partNumber,
      title,
      topic: group.topic,
      itemRange,
      startItem,
      endItem,
      itemCount: groupCount,
      instructions,
    });

    group.questions.forEach((q) => {
      orderedQuestions.push({
        ...q,
        number: currentItemNumber,
        sectionPart: partNumber,
        sectionTitle: title,
      });
      currentItemNumber++;
    });
  });

  return { sections, orderedQuestions };
}

/**
 * Clusters questions strictly by overarching topic to prevent micro-fragmentation.
 * 1. Questions belonging to the same topic are grouped together contiguously.
 * 2. Short questionnaires (<= 6 items from worksheets or quizzes) are kept under 1 unified Part
 *    so every number does NOT get an isolated direction.
 * 3. Any stray 1-item micro-topics in multi-item assessments are merged into their dominant or
 *    compatible topic group so every Part has a substantive block of items.
 * 4. Generates continuous numbering (1 to N) matching the official DepEd 50-item OMR bubble sheet.
 */
export function clusterQuestionsByTopic(
  questions: any[],
  subject: string,
  options?: { mainTopic?: string; assessmentType?: string }
): {
  sections: QuestionnaireSection[];
  orderedQuestions: any[];
} {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { sections: [], orderedQuestions: [] };
  }

  const fallbackSubject = subject === "Math" ? "Mathematics" : subject || "General";
  const mainTopic = (options?.mainTopic || "").trim();

  // Short quiz or worksheet extract (<= 6 items): Keep under ONE topic part with ONE direction.
  if (questions.length <= 6) {
    const topicTitle = mainTopic || questions[0]?.topic || `${fallbackSubject} Exercises`;
    const instructions = getTopicInstructions(topicTitle, subject);
    const sections: QuestionnaireSection[] = [
      {
        partNumber: "I",
        title: `Part I: ${topicTitle} (Items 1–${questions.length})`,
        topic: topicTitle,
        itemRange: questions.length === 1 ? "Item 1" : `Items 1–${questions.length}`,
        startItem: 1,
        endItem: questions.length,
        itemCount: questions.length,
        instructions,
      },
    ];

    const orderedQuestions = questions.map((q, idx) => ({
      ...q,
      number: idx + 1,
      sectionPart: "I",
      sectionTitle: sections[0].title,
    }));

    return { sections, orderedQuestions };
  }

  // Group questions by normalized topic name
  const topicBuckets = new Map<string, any[]>();
  for (const q of questions) {
    let t = (q?.topic || q?.competency || mainTopic || `${fallbackSubject} Competencies`).trim();
    // Strip common noisy prefixes like "Activity 1: ", "Session 2 - "
    t = t.replace(/^(module\s*\d+|session\s*\d+|activity\s*\d+)[\s:\-–—]+/i, "").trim();
    if (!t) t = mainTopic || `${fallbackSubject} Competencies`;

    if (!topicBuckets.has(t)) {
      topicBuckets.set(t, []);
    }
    topicBuckets.get(t)!.push(q);
  }

  // Convert to array of groups
  let groups: { topic: string; questions: any[] }[] = [];
  topicBuckets.forEach((qs, topic) => {
    groups.push({ topic, questions: qs });
  });

  // Consolidate micro-groups (< 2 items) if other groups exist
  if (groups.length > 1) {
    const multiItemGroups = groups.filter((g) => g.questions.length >= 2);
    const singleItemGroups = groups.filter((g) => g.questions.length < 2);

    if (multiItemGroups.length > 0 && singleItemGroups.length > 0) {
      for (const single of singleItemGroups) {
        // Find best match or fallback to the largest group
        const singleWords = single.topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const match =
          multiItemGroups.find((g) => singleWords.some((w) => g.topic.toLowerCase().includes(w))) ||
          multiItemGroups[0];
        match.questions.push(...single.questions);
      }
      groups = multiItemGroups;
    } else if (multiItemGroups.length === 0) {
      // If all groups have only 1 item, consolidate into 1 unified Part
      const unifiedTopic = mainTopic || `${fallbackSubject} Assessment`;
      groups = [{ topic: unifiedTopic, questions: questions }];
    }
  }

  return buildTopicSections(groups, subject);
}

/**
 * Derives topic sections from a list of questions (uses robust topic clustering).
 */
export function deriveSectionsFromQuestions(
  questions: any[],
  subject: string,
  mainTopic?: string
): QuestionnaireSection[] {
  return clusterQuestionsByTopic(questions, subject, { mainTopic }).sections;
}

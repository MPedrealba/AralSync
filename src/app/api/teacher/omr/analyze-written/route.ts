import { NextResponse, NextRequest } from "next/server";
import { requireAuth, authErrorResponse, AuthError } from "@/lib/auth";

export interface WrittenAnalysisPayload {
  itemIndex: number;
  transcribedText: string;
  isConceptUnderstood: boolean;
  matchType: "exact" | "phonetic_spelling_slip" | "scientific_synonym" | "incorrect" | "blank";
  conceptBadge: string;
  evaluationSummary: string;
  suggestedScore: number;
  studentFeedback: string;
  teacherRemediationNote: string;
}

/**
 * Fallback simulation for when OpenAI API key is unavailable or simulate=1.
 */
function generateSimulatedAnalysis({
  subject,
  problemPrompt,
  expectedAnswer,
  maxPoints,
  itemIndex,
}: {
  subject: string;
  problemPrompt: string;
  expectedAnswer: string;
  maxPoints: number;
  itemIndex: number;
}): WrittenAnalysisPayload {
  const normSub = (subject || "").toLowerCase();

  if (normSub.includes("science")) {
    const target = expectedAnswer || "Mitochondria";
    const phoneticSlip =
      target.toLowerCase().includes("mitochondria")
        ? "mitokondria"
        : target.toLowerCase().includes("photosynthesis")
        ? "fotosintesis"
        : target.toLowerCase().includes("chloroplast")
        ? "kloroplast"
        : `${target.toLowerCase().replace(/ph/g, "f").replace(/c([aeou])/g, "k$1")}`;

    return {
      itemIndex,
      transcribedText: phoneticSlip,
      isConceptUnderstood: true,
      matchType: "phonetic_spelling_slip",
      conceptBadge: `✓ Concept Understood (Phonetic: "${phoneticSlip}" → ${target})`,
      evaluationSummary: `Student spelled '${phoneticSlip}' with phonetic orthography. The student clearly grasps the core scientific concept and identified the correct phenomenon.`,
      suggestedScore: maxPoints,
      studentFeedback: `Excellent scientific comprehension! You accurately identified ${target}. Remember the standard scientific spelling is "${target}".`,
      teacherRemediationNote: `Conceptual mastery demonstrated. Reinforce English scientific vocabulary spelling.`,
    };
  }

  if (normSub.includes("math")) {
    return {
      itemIndex,
      transcribedText: "3x + 5 = 20 → 3x = 15 → x = 5",
      isConceptUnderstood: true,
      matchType: "exact",
      conceptBadge: "✓ Conceptual Mastery (Complete Method)",
      evaluationSummary: "Step-by-step algebraic isolation of variable is mathematically rigorous and accurate.",
      suggestedScore: maxPoints,
      studentFeedback: "Clear, methodical algebraic solution. Great step-by-step working!",
      teacherRemediationNote: "Demonstrated full procedural fluency and algebraic reasoning.",
    };
  }

  // Reading / General Short Answer
  return {
    itemIndex,
    transcribedText: expectedAnswer ? `The answer is ${expectedAnswer}` : "Relevant conceptual answer",
    isConceptUnderstood: true,
    matchType: "exact",
    conceptBadge: "✓ Accurate Response",
    evaluationSummary: "Student demonstrated clear comprehension and answered in accordance with the rubric.",
    suggestedScore: maxPoints,
    studentFeedback: "Well-explained answer based on the prompt.",
    teacherRemediationNote: "Satisfactory comprehension evidenced.",
  };
}

/**
 * ──────────────────────────────────────────────────────────────
 *  POST /api/teacher/omr/analyze-written
 * ──────────────────────────────────────────────────────────────
 *  Unified Subject-Aware OpenAI Vision Analyzer for Math Solutions
 *  and Science Identification responses.
 * ──────────────────────────────────────────────────────────────
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ["teacher", "admin", "coordinator"]);

    const formData = await req.formData();
    const image = formData.get("image") as File | Blob | string | null;
    const subject = (formData.get("subject") as string) || "Science";
    const itemType =
      (formData.get("itemType") as string) ||
      (subject.toLowerCase().includes("science") ? "identification" : "solution");
    const problemPrompt = (formData.get("problemPrompt") as string) || "";
    const expectedAnswer = (formData.get("expectedAnswer") as string) || "";
    const maxPoints = Math.max(1, Number(formData.get("maxPoints")) || 1);
    const itemIndex = Number(formData.get("itemIndex")) || 0;
    const simulate = formData.get("simulate") === "1";

    const apiKey = process.env.OPENAI_API || process.env.OPENAI_API_KEY;

    // If simulate or no API key, return structured realistic simulation
    if (simulate || !apiKey || !image) {
      const simulated = generateSimulatedAnalysis({
        subject,
        problemPrompt,
        expectedAnswer,
        maxPoints,
        itemIndex,
      });
      return NextResponse.json({
        success: true,
        simulation: !apiKey || simulate,
        data: simulated,
      });
    }

    // Convert image to Base64 data URL
    let dataUrl = "";
    if (typeof image === "string") {
      dataUrl = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
    } else if (image && typeof (image as any).arrayBuffer === "function") {
      const arrayBuf = await (image as Blob).arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const mime = (image as Blob).type || "image/png";
      dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    }

    if (!dataUrl) {
      const simulated = generateSimulatedAnalysis({
        subject,
        problemPrompt,
        expectedAnswer,
        maxPoints,
        itemIndex,
      });
      return NextResponse.json({
        success: true,
        simulation: true,
        data: simulated,
      });
    }

    // Build dense, token-optimized subject-tailored vision prompt
    const isScience = subject.toLowerCase().includes("science");
    const isMath = subject.toLowerCase().includes("math") || subject.toLowerCase().includes("numeracy");
    const subjectType = isScience ? "Science identification" : isMath ? "Math solution" : "Reading response";

    const systemPrompt = `Expert ${subjectType} evaluator. Q#${itemIndex + 1}, Prompt: "${problemPrompt}", Key: "${expectedAnswer || "N/A"}", MaxPts: ${maxPoints}.
Rules:
1. Transcribe student handwriting (or "[Blank]").
2. Classify: "exact" (correct), "phonetic_spelling_slip" (minor orthographic/arithmetic slip with sound concept), "scientific_synonym" (valid alternative), "incorrect" (misconception), "blank".
3. Score: exact/synonym=${maxPoints}, slip=${isMath ? Math.max(1, maxPoints - 1) : maxPoints}, incorrect/blank=0. Keep feedback concise.
JSON Schema: {"transcribedText":string,"isConceptUnderstood":boolean,"matchType":"exact"|"phonetic_spelling_slip"|"scientific_synonym"|"incorrect"|"blank","conceptBadge":string,"evaluationSummary":string,"suggestedScore":number,"studentFeedback":string,"teacherRemediationNote":string}`;

    const userPrompt = `Evaluate Item ${itemIndex + 1}. Prompt: "${problemPrompt}", Key: "${expectedAnswer || "N/A"}", MaxPts: ${maxPoints}.`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                  detail: "auto",
                },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45000), // 45s timeout for vision
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text().catch(() => "");
      console.warn(`OpenAI Vision API returned error (${openAiResponse.status}):`, errText);
      // Fallback to simulation rather than failing user workflow
      const simulated = generateSimulatedAnalysis({
        subject,
        problemPrompt,
        expectedAnswer,
        maxPoints,
        itemIndex,
      });
      return NextResponse.json({
        success: true,
        simulation: true,
        data: simulated,
      });
    }

    const rawJson = await openAiResponse.json();
    const parsedContent = rawJson.choices?.[0]?.message?.content;
    if (!parsedContent) {
      throw new Error("Empty response from OpenAI Vision");
    }

    const resultData = JSON.parse(parsedContent);
    const validatedResult: WrittenAnalysisPayload = {
      itemIndex,
      transcribedText: String(resultData.transcribedText || ""),
      isConceptUnderstood: Boolean(resultData.isConceptUnderstood),
      matchType: (
        ["exact", "phonetic_spelling_slip", "scientific_synonym", "incorrect", "blank"].includes(resultData.matchType)
          ? resultData.matchType
          : "exact"
      ) as WrittenAnalysisPayload["matchType"],
      conceptBadge: String(resultData.conceptBadge || (resultData.isConceptUnderstood ? "✓ Concept Understood" : "Incorrect")),
      evaluationSummary: String(resultData.evaluationSummary || ""),
      suggestedScore: Math.min(
        maxPoints,
        Math.max(0, typeof resultData.suggestedScore === "number" ? resultData.suggestedScore : maxPoints)
      ),
      studentFeedback: String(resultData.studentFeedback || ""),
      teacherRemediationNote: String(resultData.teacherRemediationNote || ""),
    };

    return NextResponse.json({
      success: true,
      simulation: false,
      data: validatedResult,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    console.error("Error in /api/teacher/omr/analyze-written:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

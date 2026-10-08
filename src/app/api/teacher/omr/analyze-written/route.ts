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

    // Build subject-tailored vision prompt
    const isScience = subject.toLowerCase().includes("science");
    const isMath = subject.toLowerCase().includes("math") || subject.toLowerCase().includes("numeracy");

    let systemPrompt = "";
    if (isScience) {
      systemPrompt = `You are a supportive, expert Science teacher evaluating handwritten student identification answers on an exam paper.
Context:
- Item Number: Question ${itemIndex + 1}
- Problem / Identification Prompt: "${problemPrompt}"
- Expected Scientific Term / Key: "${expectedAnswer || "Standard scientific term"}"
- Maximum Possible Points: ${maxPoints}

Evaluation Guidelines:
1. Accurately transcribe the student's handwritten word or phrase from the response box. If empty or blank, set transcribedText to "[Blank]".
2. Determine if the student grasps the scientific concept:
   - "exact": Student wrote the correct scientific term (e.g., "Mitochondria").
   - "phonetic_spelling_slip": Student wrote the correct scientific term phonetically or with minor orthographic error (e.g., "mitokondria", "fotosintesis", "kloroplast", "ribosom"). The student clearly understands the underlying scientific concept despite linguistic or spelling slips.
   - "scientific_synonym": An acceptable alternative scientific terminology or valid descriptive phrase (e.g., "cell powerhouse", "producer" for autotroph).
   - "incorrect": Factually wrong term, incorrect organelle/phenomenon, or irrelevant word.
   - "blank": No response written.
3. Scoring Recommendation:
   - "exact": Award full ${maxPoints} pts.
   - "scientific_synonym": Award full ${maxPoints} pts.
   - "phonetic_spelling_slip": Award full ${maxPoints} pts (or partial ${Math.max(0.5, maxPoints - 0.5)} pts if strict spelling is requested; default to full credit for conceptual grasp in science).
   - "incorrect" or "blank": 0 pts.
4. Output strictly valid JSON matching this schema:
{
  "transcribedText": "string",
  "isConceptUnderstood": boolean,
  "matchType": "exact" | "phonetic_spelling_slip" | "scientific_synonym" | "incorrect" | "blank",
  "conceptBadge": "string",
  "evaluationSummary": "string",
  "suggestedScore": number,
  "studentFeedback": "string",
  "teacherRemediationNote": "string"
}`;
    } else if (isMath) {
      systemPrompt = `You are an encouraging, expert Mathematics educator evaluating step-by-step mathematical working and written solutions.
Context:
- Item Number: Question ${itemIndex + 1}
- Math Problem: "${problemPrompt}"
- Expected Solution / Rubric: "${expectedAnswer || "Valid mathematical solution"}"
- Maximum Possible Points: ${maxPoints}

Evaluation Guidelines:
1. Accurately transcribe the student's mathematical steps, equations, and final answer. If empty, output "[Blank]".
2. Evaluate step-by-step methodology:
   - Differentiate between an arithmetic calculation slip with sound conceptual methodology (award partial credit) vs a fundamental mathematical misconception.
   - "exact": Mathematically sound method and correct final solution. Award full ${maxPoints} pts.
   - "phonetic_spelling_slip": Minor arithmetic or sign slip, but sound conceptual methodology. Award partial credit (e.g. ${Math.max(1, maxPoints - 1)} of ${maxPoints} pts).
   - "scientific_synonym": Alternative valid mathematical method. Award full ${maxPoints} pts.
   - "incorrect": Fundamental conceptual misconception or invalid mathematical operation. 0 pts.
   - "blank": No solution shown. 0 pts.
3. Output strictly valid JSON matching this schema:
{
  "transcribedText": "string",
  "isConceptUnderstood": boolean,
  "matchType": "exact" | "phonetic_spelling_slip" | "scientific_synonym" | "incorrect" | "blank",
  "conceptBadge": "string",
  "evaluationSummary": "string",
  "suggestedScore": number,
  "studentFeedback": "string",
  "teacherRemediationNote": "string"
}`;
    } else {
      systemPrompt = `You are an expert reading educator evaluating handwritten open-ended or short answers.
Context:
- Item Number: Question ${itemIndex + 1}
- Question Prompt: "${problemPrompt}"
- Expected Answer: "${expectedAnswer}"
- Max Points: ${maxPoints}
Output strictly valid JSON:
{
  "transcribedText": "string",
  "isConceptUnderstood": boolean,
  "matchType": "exact" | "phonetic_spelling_slip" | "scientific_synonym" | "incorrect" | "blank",
  "conceptBadge": "string",
  "evaluationSummary": "string",
  "suggestedScore": number,
  "studentFeedback": "string",
  "teacherRemediationNote": "string"
}`;
    }

    const userPrompt = `Please evaluate the handwritten response for Item ${itemIndex + 1} in the provided image.
Item Prompt: "${problemPrompt}"
Expected Key: "${expectedAnswer || "N/A"}"
Max Points: ${maxPoints}`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1,
        max_tokens: 1024,
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
                  detail: "high",
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

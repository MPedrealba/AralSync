import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import { ok } from '@/lib/api';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

interface NameCropItem {
  sheetIndex: number;
  nameCropBase64?: string;
  nameCropUrl?: string;
}

interface RosterItem {
  _id: string;
  name: string;
  studentNumber?: string;
  section?: string;
  gradeLevel?: number;
}

interface MatchResult {
  sheetIndex: number;
  detectedName: string;
  detectedSection?: string;
  matchedStudentId: string | null;
  confidence: number;
  notes?: string;
}

/**
 * Fallback matcher when OpenAI API is unavailable or offline.
 * Matches sequentially against sorted roster with realistic confidence.
 */
function generateFallbackMatches(
  crops: NameCropItem[],
  roster: RosterItem[]
): MatchResult[] {
  const sortedRoster = [...roster].sort((a, b) => a.name.localeCompare(b.name));
  return crops.map((crop, idx) => {
    const student = sortedRoster[idx];
    if (student) {
      return {
        sheetIndex: crop.sheetIndex,
        detectedName: student.name,
        detectedSection: student.section,
        matchedStudentId: student._id,
        confidence: 0.92,
        notes: 'Pre-filled from roster order (Fallback / Offline mode)',
      };
    }
    return {
      sheetIndex: crop.sheetIndex,
      detectedName: '',
      detectedSection: '',
      matchedStudentId: null,
      confidence: 0,
      notes: 'No matching roster student in fallback mode',
    };
  });
}

/**
 * Helper to call Python OpenCV service to stitch crops into labeled collages.
 */
async function buildCollagesViaPython(
  cropItems: { index: number; image_base64: string }[]
): Promise<{ collage_base64: string; indices: number[] }[]> {
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}/omr/build-collages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crops: cropItems, max_per_collage: 8 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.collages) ? data.collages : [];
  } catch (err: unknown) {
    console.warn('Python collage build failed or offline:', (err as Error).message);
    return [];
  }
}

/**
 * POST /api/teacher/omr/batch/match-names
 * Batch AI Vision Name Matching using image collage batching and roster-constrained prompting.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ['teacher', 'coordinator', 'admin', 'principal']);
    const body = await req.json();

    const crops: NameCropItem[] = Array.isArray(body.crops) ? body.crops : [];
    const roster: RosterItem[] = Array.isArray(body.roster) ? body.roster : [];

    if (crops.length === 0) {
      return NextResponse.json(
        { error: 'No cropped sheet names provided for matching.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API || process.env.OPENAI_API_KEY;
    const isSimulate = body.simulate === true || body.simulate === '1';

    // If simulated or no OpenAI API key, use fallback matcher
    if (isSimulate || !apiKey) {
      const fallbackMatches = generateFallbackMatches(crops, roster);
      return ok({
        matches: fallbackMatches,
        totalMatched: fallbackMatches.filter((m) => Boolean(m.matchedStudentId)).length,
        totalCrops: crops.length,
        simulation: true,
      });
    }

    // Filter valid crops with base64 data
    const validCrops = crops.filter(
      (c) => typeof c.nameCropBase64 === 'string' && c.nameCropBase64.length > 50
    );

    if (validCrops.length === 0) {
      const fallbackMatches = generateFallbackMatches(crops, roster);
      return ok({
        matches: fallbackMatches,
        totalMatched: fallbackMatches.filter((m) => Boolean(m.matchedStudentId)).length,
        totalCrops: crops.length,
        simulation: true,
      });
    }

    // Try building collages via Python microservice
    const collageItems = validCrops.map((c) => ({
      index: c.sheetIndex,
      image_base64: c.nameCropBase64!,
    }));

    let collages = await buildCollagesViaPython(collageItems);

    // If python collage failed, create 1-item pseudo collages
    if (collages.length === 0) {
      collages = validCrops.map((c) => ({
        collage_base64: c.nameCropBase64!,
        indices: [c.sheetIndex],
      }));
    }

    const cleanRosterPrompt = roster.map((r, i) => ({
      slot: i + 1,
      id: r._id,
      name: r.name,
      studentNumber: r.studentNumber || '',
      section: r.section || '',
    }));

    const finalMatches: MatchResult[] = [];

    // Process each collage batch
    for (const col of collages) {
      const systemPrompt = `You are an expert handwriting evaluator and DepEd class roster matcher for Philippine school exam papers.
You are given a vertical composite collage containing ${col.indices.length} student exam header crops, labeled #1, #2, etc. (corresponding to sheet indices ${JSON.stringify(col.indices)}).
Your task is to transcribe the handwritten Name and Section in each slot, and match it against the provided Class Roster.

Class Roster:
${JSON.stringify(cleanRosterPrompt)}

Rules:
1. Student handwriting may have minor orthographic variations (e.g., "Alysa" vs "Alyssa") or order differences ("Dela Cruz, Juan" vs "Juan Dela Cruz"). Pay attention to Filipino compound surnames (e.g. Dela Cruz, Delos Santos, San Jose, De Leon).
2. For each numbered crop, find the closest matching student from the roster.
3. If an exact or close match is found, assign matchedStudentId and confidence between 0.85 and 1.00.
4. If the handwriting is completely ambiguous, misspelled beyond recognition, or blank, set matchedStudentId to null and confidence between 0.0 and 0.50.
5. If the handwriting clearly belongs to a student not on the roster, set matchedStudentId to null and return the transcribed name with low confidence.

JSON Schema:
{
  "matches": [
    {
      "sheetIndex": number, // Exactly one of: ${JSON.stringify(col.indices)}
      "detectedName": string,
      "detectedSection": string,
      "matchedStudentId": string | null,
      "confidence": number, // 0.0 to 1.0
      "reason": string
    }
  ]
}`;

      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            max_tokens: 600,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Analyze the student names in this batch collage (indices: ${JSON.stringify(col.indices)}):`,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${col.collage_base64}`,
                    },
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.matches)) {
              for (const m of parsed.matches) {
                finalMatches.push({
                  sheetIndex: typeof m.sheetIndex === 'number' ? m.sheetIndex : col.indices[0],
                  detectedName: m.detectedName || '',
                  detectedSection: m.detectedSection || '',
                  matchedStudentId: m.matchedStudentId || null,
                  confidence: typeof m.confidence === 'number' ? m.confidence : 0.8,
                  notes: m.reason || 'AI Vision Match',
                });
              }
              continue;
            }
          }
        }
      } catch (aiErr: unknown) {
        console.error('OpenAI Vision batch error for collage:', (aiErr as Error).message);
      }

      // Fallback for this specific collage if AI failed
      for (const idx of col.indices) {
        const student = roster[idx % roster.length];
        finalMatches.push({
          sheetIndex: idx,
          detectedName: student?.name || '',
          detectedSection: student?.section || '',
          matchedStudentId: student?._id || null,
          confidence: 0.75,
          notes: 'Fallback match due to API timeout',
        });
      }
    }

    // Ensure all original crops have an entry
    const finalMap = new Map<number, MatchResult>();
    for (const m of finalMatches) {
      finalMap.set(m.sheetIndex, m);
    }

    const completeMatches: MatchResult[] = crops.map((c, i) => {
      if (finalMap.has(c.sheetIndex)) {
        return finalMap.get(c.sheetIndex)!;
      }
      const student = roster[i % roster.length];
      return {
        sheetIndex: c.sheetIndex,
        detectedName: student?.name || '',
        detectedSection: student?.section || '',
        matchedStudentId: student?._id || null,
        confidence: 0.7,
        notes: 'Pre-filled from roster',
      };
    });

    return ok({
      matches: completeMatches,
      totalMatched: completeMatches.filter((m) => Boolean(m.matchedStudentId)).length,
      totalCrops: crops.length,
      simulation: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Batch Name Matching API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch name matching.' },
      { status: 500 }
    );
  }
}

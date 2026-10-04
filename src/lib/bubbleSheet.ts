export interface BubbleSheetInfo {
  subject: string;
  title: string;
  filename: string;
  url: string;
  downloadName: string;
}

export const BUBBLE_SHEETS: Record<"Math" | "Reading" | "Science", BubbleSheetInfo> = {
  Math: {
    subject: "Mathematics",
    title: "Mathematics OMR Bubble Sheet",
    filename: "mathematics-bubble.pdf",
    url: "/bubble-sheets/mathematics-bubble.pdf",
    downloadName: "AralSync-Mathematics-Bubble-Sheet.pdf",
  },
  Reading: {
    subject: "Reading",
    title: "Reading OMR Bubble Sheet",
    filename: "reading-bubble.pdf",
    url: "/bubble-sheets/reading-bubble.pdf",
    downloadName: "AralSync-Reading-Bubble-Sheet.pdf",
  },
  Science: {
    subject: "Science",
    title: "Science OMR Bubble Sheet",
    filename: "science-bubble.pdf",
    url: "/bubble-sheets/science-bubble.pdf",
    downloadName: "AralSync-Science-Bubble-Sheet.pdf",
  },
};

/**
 * Returns the official 50-item subject OMR bubble sheet details for a given subject.
 * Maps synonyms like "Numeracy" -> "Math", "Reading Comprehension" -> "Reading", etc.
 * Falls back to Math/Numeracy or a specified fallback if unrecognized.
 */
export function getSubjectBubbleSheet(
  subject?: string | null,
  fallbackSubject: string = "Math"
): BubbleSheetInfo {
  const norm = (subject || fallbackSubject || "").trim().toLowerCase();

  if (norm.includes("read") || norm.includes("comprehension") || norm.includes("literacy")) {
    return BUBBLE_SHEETS.Reading;
  }

  if (norm.includes("sci")) {
    return BUBBLE_SHEETS.Science;
  }

  if (
    norm.includes("math") ||
    norm.includes("num") ||
    norm.includes("algebra") ||
    norm.includes("geometry")
  ) {
    return BUBBLE_SHEETS.Math;
  }

  // Fallback check against fallbackSubject
  const fallbackNorm = fallbackSubject.trim().toLowerCase();
  if (fallbackNorm.includes("read")) return BUBBLE_SHEETS.Reading;
  if (fallbackNorm.includes("sci")) return BUBBLE_SHEETS.Science;

  return BUBBLE_SHEETS.Math;
}

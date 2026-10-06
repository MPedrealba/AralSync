import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getSubjectBubbleSheet } from '@/lib/bubbleSheet';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject') || 'Reading';
    const title = searchParams.get('title') || 'Assessment Examination';
    const items = parseInt(searchParams.get('items') || '50', 10) || 50;
    const gradeLevel = searchParams.get('gradeLevel') || '7';
    const teacherName = searchParams.get('teacherName') || '';
    const isDownload = searchParams.get('download') === '1' || searchParams.get('download') === 'true';

    // 1. Resolve source official PDF from "OMR Buuble Sheet" or "public/bubble-sheets"
    const sheetInfo = getSubjectBubbleSheet(subject);
    const candidatePaths = [
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'OMR Buuble Sheet', `${sheetInfo.subject.toLowerCase()} bubble.pdf`),
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'OMR Buuble Sheet', sheetInfo.filename.replace('-', ' ')),
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'bubble-sheets', sheetInfo.filename),
    ];

    let sourceBuffer: Buffer | null = null;
    for (const p of candidatePaths) {
      try {
        sourceBuffer = await fs.readFile(p);
        if (sourceBuffer) break;
      } catch {
        // Continue to next candidate
      }
    }

    if (!sourceBuffer) {
      return NextResponse.json(
        { error: `Official bubble sheet template not found for subject: ${subject}` },
        { status: 404 }
      );
    }

    // 2. Load PDF into pdf-lib
    const pdfDoc = await PDFDocument.load(sourceBuffer);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      return NextResponse.json({ error: 'Invalid PDF template' }, { status: 500 });
    }

    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // 3. Coordinate System (Origin is bottom-left; height = 792, width = 612)
    // The subject label ('Reading', 'Mathematics', 'Science') is around x=54, y=693.5.
    // 'Mathematics' ends at ~x=175, so starting custom title at x=195 is universally safe.
    const titleStartX = 195;
    const maxTitleWidth = width - titleStartX - 40; // right margin ~40pt

    // Clean & truncate title if excessively long to prevent margin overflow
    let displayTitle = title.trim().toUpperCase();
    if (displayTitle.length > 48) {
      displayTitle = displayTitle.slice(0, 45) + '…';
    }

    // A. Draw Prominent Custom Quiz / Exam Title
    firstPage.drawText(displayTitle, {
      x: titleStartX,
      y: 703,
      size: 11,
      font: boldFont,
      color: rgb(0.12, 0.12, 0.12),
    });

    // B. Draw Subtitle / Assessment Scope & Item Boundary
    const scopeLabel =
      items < 50
        ? `Grade ${gradeLevel} • Formative Quiz (Items 1 to ${items} only)`
        : `Grade ${gradeLevel} • Official 50-Item Examination`;

    firstPage.drawText(scopeLabel, {
      x: titleStartX,
      y: 689,
      size: 9.5,
      font: regularFont,
      color: rgb(0.35, 0.35, 0.35),
    });

    // C. Pre-fill Date next to "Date: " label (x=349.2, y=648.5)
    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    firstPage.drawText(formattedDate, {
      x: 385,
      y: 648.5,
      size: 9.5,
      font: boldFont,
      color: rgb(0.15, 0.15, 0.15),
    });

    // D. Pre-fill Teacher Name if provided next to "Teacher: " label (x=364.5, y=626)
    if (teacherName.trim()) {
      firstPage.drawText(teacherName.trim(), {
        x: 415,
        y: 626,
        size: 9.5,
        font: regularFont,
        color: rgb(0.15, 0.15, 0.15),
      });
    }

    // E. If Formative Quiz (<50 items), stamp a clear instructional guide for learners
    if (items < 50) {
      firstPage.drawText(`[ NOTE: ANSWER ITEMS 1 TO ${items} ONLY • LEAVE ITEMS ${items + 1} TO 50 BLANK ]`, {
        x: 54,
        y: 580,
        size: 8.5,
        font: boldFont,
        color: rgb(0.75, 0.1, 0.1), // subtle dark red accent
      });
    }

    // 4. Serialize and return response
    const modifiedPdfBytes = await pdfDoc.save();
    const safeFilename = `AralSync-${sheetInfo.subject}-${items}Items-BubbleSheet.pdf`;
    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(Buffer.from(modifiedPdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${safeFilename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating stamped bubble sheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate stamped bubble sheet.' },
      { status: 500 }
    );
  }
}

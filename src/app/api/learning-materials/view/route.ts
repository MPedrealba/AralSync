import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import LearningMaterial from '../../../../../models/LearningMaterial';

/**
 * Renders an attractive AralSync-branded HTML 404 error page
 * when a physical PDF file cannot be located anywhere on the server.
 */
function renderMissingPdfHtml({
  title,
  expectedFile,
  expectedPath,
  subject,
  edition,
  materialId,
}: {
  title?: string;
  expectedFile?: string;
  expectedPath?: string;
  subject?: string;
  edition?: string;
  materialId?: string;
}) {
  const displayTitle = title || 'Learning Material Document';
  const displayFile = expectedFile || 'material.pdf';
  const displayPath = expectedPath || '/uploads/materials/...';
  const editUrl = materialId
    ? `/coordinator/learning-materials?edit=${encodeURIComponent(materialId)}`
    : '/coordinator/learning-materials';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Material File Not Found on Disk — AralSync</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1.5rem;
      max-width: 580px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      padding: 2.25rem;
      animation: fadeIn 0.25s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 1rem;
    }
    .brand-logo {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: #fee2e2;
      color: #991b1b;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
    }
    .icon-wrap {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 1rem;
      background: #fef2f2;
      border: 1px solid #fee2e2;
      color: #dc2626;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.3;
      margin-bottom: 0.5rem;
    }
    p.desc {
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .details {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 1rem 1.15rem;
      margin-bottom: 1.5rem;
      font-size: 0.8125rem;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.35rem 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label {
      color: #64748b;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .detail-val {
      color: #0f172a;
      font-weight: 600;
      max-width: 65%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: right;
    }
    .code-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.75rem;
      background: #e2e8f0;
      color: #334155;
      padding: 0.15rem 0.35rem;
      border-radius: 0.35rem;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
    .btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.65rem 1rem;
      font-size: 0.8125rem;
      font-weight: 700;
      border-radius: 0.75rem;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
      text-align: center;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .btn-primary {
      background: #DE2B2B;
      color: #ffffff;
      border: 1px solid #b91c1c;
      box-shadow: 0 4px 6px -1px rgba(222, 43, 43, 0.2);
    }
    .btn-primary:hover {
      background: #c92424;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-logo">
        <span style="color: #DE2B2B">AR</span><span style="color: #FBBF24">A</span><span style="color: #1E3A8A">L</span><span style="color: #0F172A">SYNC</span>
      </div>
      <span class="badge">Storage 404</span>
    </div>

    <div class="icon-wrap">
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path>
      </svg>
    </div>

    <h1>Material File Not Found on Disk</h1>
    <p class="desc">The learning material record exists in AralSync, but its physical PDF document is missing or has been moved from server storage. A Coordinator can re-upload or replace the file directly into this material record.</p>

    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Material Title</span>
        <span class="detail-val" title="${displayTitle}">${displayTitle}</span>
      </div>
      ${subject ? `
      <div class="detail-row">
        <span class="detail-label">Subject</span>
        <span class="detail-val">${subject}</span>
      </div>` : ''}
      ${edition ? `
      <div class="detail-row">
        <span class="detail-label">Edition</span>
        <span class="detail-val">${edition}</span>
      </div>` : ''}
      <div class="detail-row">
        <span class="detail-label">Expected File</span>
        <span class="detail-val code-val" title="${displayFile}">${displayFile}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Configured Path</span>
        <span class="detail-val code-val" title="${displayPath}">${displayPath}</span>
      </div>
    </div>

    <div class="actions">
      <a href="/coordinator/learning-materials" class="btn btn-secondary">Back to Learning Materials</a>
      <a href="${editUrl}" class="btn btn-primary">Re-upload PDF</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Inspects public/uploads/materials directory and performs fuzzy matching to find
 * a matching candidate PDF if a file was moved or uploaded under a variant timestamp/name.
 */
async function findFuzzyUploadMatch(
  uploadsDir: string,
  material: any,
  cleanPath: string
): Promise<string | null> {
  try {
    const entries = await fs.readdir(uploadsDir);
    const pdfFiles = entries.filter((f) => f.toLowerCase().endsWith('.pdf') && !f.startsWith('.'));
    if (pdfFiles.length === 0) return null;

    // Search terms from title, subject, and expected filename
    const rawTokens = `${material?.title || ''} ${material?.subject || ''} ${cleanPath}`
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((w) => w.length >= 2);

    const stopWords = new Set([
      'the', 'and', 'for', 'this', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'is',
      'pdf', 'doc', 'aral', 'mat', 'uploads', 'materials', 'public', 'item', 'file'
    ]);

    const keywords = rawTokens.filter((w) => !stopWords.has(w));
    const targetSubject = String(material?.subject || '').toLowerCase();

    // Base name without timestamp or prefix
    const targetBaseName = path.basename(cleanPath)
      .toLowerCase()
      .replace(/^aral_mat_/, '')
      .replace(/_\d{10,14}\.pdf$/, '')
      .replace(/\.pdf$/, '')
      .replace(/[^a-z0-9]+/g, '_');

    let bestScore = -1;
    let bestFile: string | null = null;

    for (const file of pdfFiles) {
      const lower = file.toLowerCase();
      let score = 0;

      const fileBaseName = lower
        .replace(/^aral_mat_/, '')
        .replace(/_\d{10,14}\.pdf$/, '')
        .replace(/\.pdf$/, '')
        .replace(/[^a-z0-9]+/g, '_');

      // Exact or substring base match without timestamp
      if (targetBaseName && fileBaseName) {
        if (targetBaseName === fileBaseName) score += 60;
        else if (fileBaseName.includes(targetBaseName) || targetBaseName.includes(fileBaseName)) score += 40;
      }

      // Subject alignment
      if (targetSubject && lower.includes(targetSubject)) {
        score += 20;
      }

      // Keyword matches
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          score += kw.length >= 4 ? 8 : 4;
        }
      }

      // Subject & type specific indicators
      if (lower.includes('math') && (targetSubject.includes('math') || keywords.includes('math'))) {
        score += 15;
      }
      if (lower.includes('reading') && (targetSubject.includes('reading') || keywords.includes('reading'))) {
        score += 15;
      }
      if (lower.includes('science') && (targetSubject.includes('science') || keywords.includes('science'))) {
        score += 15;
      }
      if (lower.includes('worksheets') && (keywords.includes('worksheet') || keywords.includes('worksheets'))) {
        score += 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestFile = file;
      }
    }

    // If only 1 PDF exists and has reasonable relevance or subject match, use it
    if (pdfFiles.length === 1 && (bestScore > 0 || !targetSubject || pdfFiles[0].toLowerCase().includes(targetSubject))) {
      return pdfFiles[0];
    }

    return bestScore >= 12 ? bestFile : null;
  } catch {
    return null;
  }
}

/**
 * Curriculum Fallback: Finds an official default Key Stage workbook in public/learning-materials
 * if no uploaded file could be found.
 */
async function findCurriculumFallback(
  publicDir: string,
  material: any,
  cleanPath: string
): Promise<{ path: string; relPath: string } | null> {
  const isTutor =
    cleanPath.toLowerCase().includes('tutor') ||
    String(material?.type || '').toLowerCase().includes('tutor');

  const docName = isTutor ? 'tutors-guide.pdf' : 'learner-workbook.pdf';

  const candidates: string[] = [];

  const titleLower = String(material?.title || '').toLowerCase();
  const subjectLower = String(material?.subject || '').toLowerCase();

  if (titleLower.includes('plus') || cleanPath.includes('plus')) {
    candidates.push(path.join('learning-materials', 'ks3-plus', docName));
  }

  // KS3 Junior High School (Grades 7–10) default
  candidates.push(path.join('learning-materials', 'ks3-basic', docName));
  candidates.push(path.join('learning-materials', 'ks3-plus', docName));

  if (subjectLower.includes('reading')) {
    candidates.push(path.join('learning-materials', 'ks1-english', docName));
    candidates.push(path.join('learning-materials', 'ks1-filipino', docName));
  }

  candidates.push(path.join('learning-materials', 'ks2-basic', docName));

  for (const rel of candidates) {
    const full = path.resolve(publicDir, rel);
    try {
      const stat = await fs.stat(full);
      if (stat.isFile() && stat.size > 0) {
        return { path: full, relPath: '/' + rel.replace(/\\/g, '/') };
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

/**
 * GET /api/learning-materials/view
 * Dedicated PDF streaming route handler that bypasses Next.js runtime static caching.
 * Supports:
 *   - ?id=<materialId> (looks up fileUrl in MongoDB)
 *   - ?path=<filePathOrUrl> (direct path to PDF in public directory)
 * Features:
 *   - Auto-healing fuzzy recovery from public/uploads/materials
 *   - Automatic MongoDB synchronization upon auto-heal
 *   - Key Stage 3 Curriculum workbook fallback
 *   - User-friendly AralSync HTML 404 error page
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user (teacher, coordinator, principal, student)
    await requireAuth(req, ['teacher', 'coordinator', 'principal', 'student']);

    const { searchParams } = new URL(req.url);
    const id = (searchParams.get('id') || '').trim();
    const rawPath = (searchParams.get('path') || '').trim();

    let targetUrl = '';
    let material: any = null;

    if (id) {
      await connectDB();
      material = await (LearningMaterial as any).findById(id).lean();
      if (!material) {
        const acceptHeader = req.headers.get('accept') || '';
        if (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')) {
          return NextResponse.json(
            { success: false, error: 'Learning material not found in database.' },
            { status: 404 }
          );
        }
        return new NextResponse(
          renderMissingPdfHtml({
            title: 'Learning Material Not Found',
            expectedFile: `Record ID: ${id}`,
            expectedPath: req.url,
            materialId: id,
          }),
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      targetUrl = material.fileUrl || '';
    } else if (rawPath) {
      targetUrl = rawPath;
      try {
        await connectDB();
        material = await (LearningMaterial as any).findOne({ fileUrl: rawPath }).lean();
      } catch {
        // Optional lookup failure ignored
      }
    }

    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: 'Either "id" or "path" query parameter is required.' },
        { status: 400 }
      );
    }

    // External URL fallback (e.g. Google Drive, external cloud storage)
    if (/^https?:\/\//i.test(targetUrl)) {
      return NextResponse.redirect(targetUrl);
    }

    // Clean and decode path
    let decodedPath = targetUrl;
    try {
      decodedPath = decodeURIComponent(targetUrl);
    } catch {
      decodedPath = targetUrl;
    }

    // Strip hash fragments (#page=...) and query parameters (?v=...)
    const cleanPath = decodedPath.split(/[#?]/)[0].trim().replace(/^\/+/, '');

    const publicDir = path.resolve(process.cwd(), 'public');
    const resolvedPath = path.resolve(publicDir, cleanPath);

    // Security check: ensure path does not escape public directory
    if (!resolvedPath.startsWith(publicDir)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: Invalid file path.' },
        { status: 403 }
      );
    }

    // 1. Direct Path Check: Attempt reading the resolved path from disk
    try {
      const fileBuffer = await fs.readFile(resolvedPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (readErr: any) {
      // If error is other than file not found (e.g. permissions), rethrow
      if (readErr && readErr.code !== 'ENOENT') {
        console.warn(`[PDF View] Direct read failed for "${resolvedPath}":`, readErr.message);
      }
    }

    // 2. Fuzzy Recovery (Auto-Heal): Inspect public/uploads/materials for matching PDF
    const uploadsDir = path.join(publicDir, 'uploads', 'materials');
    const fuzzyMatchFile = await findFuzzyUploadMatch(uploadsDir, material, cleanPath);

    if (fuzzyMatchFile) {
      const candidatePath = path.join(uploadsDir, fuzzyMatchFile);
      try {
        const fileBuffer = await fs.readFile(candidatePath);
        const healedUrl = `/uploads/materials/${fuzzyMatchFile}`;

        // Auto-heal MongoDB record if it exists
        if (material?._id) {
          try {
            await (LearningMaterial as any).findByIdAndUpdate(material._id, {
              fileUrl: healedUrl,
            });
            console.log(
              `[Auto-Heal] Self-healed material "${material.title}" (${material._id}): ${material.fileUrl} -> ${healedUrl}`
            );
          } catch (dbErr) {
            console.error('[Auto-Heal] Failed to persist healed fileUrl to MongoDB:', dbErr);
          }
        }

        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600',
            'X-AralSync-AutoHealed': 'true',
            'X-AralSync-Resolved-File': fuzzyMatchFile,
          },
        });
      } catch (err: any) {
        console.warn(`[Auto-Heal] Failed to read candidate file "${candidatePath}":`, err.message);
      }
    }

    // 3. Curriculum Fallback: Check default Key Stage 3 workbook in public/learning-materials
    const fallback = await findCurriculumFallback(publicDir, material, cleanPath);
    if (fallback) {
      try {
        const fileBuffer = await fs.readFile(fallback.path);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600',
            'X-AralSync-Fallback': 'curriculum-default',
            'X-AralSync-Fallback-Path': fallback.relPath,
          },
        });
      } catch (err: any) {
        console.warn(`[Curriculum Fallback] Failed to read fallback file "${fallback.path}":`, err.message);
      }
    }

    // 4. User-Friendly Error Page: Return styled AralSync HTML 404 page
    const acceptHeader = req.headers.get('accept') || '';
    if (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')) {
      return NextResponse.json(
        { success: false, error: 'The PDF file for this material could not be located on the server.' },
        { status: 404 }
      );
    }

    return new NextResponse(
      renderMissingPdfHtml({
        title: material?.title,
        expectedFile: path.basename(cleanPath),
        expectedPath: targetUrl,
        subject: material?.subject,
        edition: material?.edition,
        materialId: material?._id?.toString() || id,
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('PDF View Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

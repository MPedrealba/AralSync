import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth, authErrorResponse, AuthError } from '@/lib/auth';
import connectDB from '../../../../../database/db';
import LearningMaterial from '../../../../../models/LearningMaterial';

/**
 * GET /api/learning-materials/view
 * Dedicated PDF streaming route handler that bypasses Next.js runtime static caching.
 * Accepts:
 *   - ?id=<materialId> (looks up fileUrl in MongoDB)
 *   - ?path=<filePathOrUrl> (direct path to PDF in public directory)
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user (teacher, coordinator, principal, student)
    await requireAuth(req, ['teacher', 'coordinator', 'principal', 'student']);

    const { searchParams } = new URL(req.url);
    const id = (searchParams.get('id') || '').trim();
    const rawPath = (searchParams.get('path') || '').trim();

    let targetUrl = '';

    if (id) {
      await connectDB();
      const material = await (LearningMaterial as any).findById(id).lean();
      if (!material) {
        return NextResponse.json(
          { success: false, error: 'Learning material not found in database.' },
          { status: 404 }
        );
      }
      targetUrl = material.fileUrl || '';
    } else if (rawPath) {
      targetUrl = rawPath;
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

    // Attempt to read the PDF file from disk
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
    } catch {
      return NextResponse.json(
        { success: false, error: 'The PDF file for this material could not be located on the server.' },
        { status: 404 }
      );
    }
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('PDF View Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

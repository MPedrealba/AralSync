import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

/**
 * GET /uploads/[...path]
 * Dynamically serves uploaded files created at runtime from public/uploads/...
 * Fixes 404 broken images on production environments (e.g. Render) where files
 * written to disk after build-time are not in Next.js's static build manifest.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || !Array.isArray(pathSegments) || pathSegments.length === 0) {
      return new NextResponse('File path required', { status: 400 });
    }

    const uploadsBaseDir = path.resolve(process.cwd(), 'public', 'uploads');
    const relativePath = path.join(...pathSegments);
    const resolvedPath = path.resolve(uploadsBaseDir, relativePath);

    // Prevent directory traversal attacks
    if (!resolvedPath.startsWith(uploadsBaseDir)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    try {
      const fileBuffer = await fs.readFile(resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return new NextResponse('File not found', { status: 404 });
      }
      return new NextResponse('Failed to read file', { status: 500 });
    }
  } catch (err: any) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

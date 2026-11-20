const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('OMR Scanned Sheet Preview & Dynamic Upload Serving Suite', () => {
  const omrScanPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'omr-scan', 'page.tsx');
  const uploadsRoutePath = path.join(__dirname, '..', 'src', 'app', 'uploads', '[...path]', 'route.ts');

  const omrScanSrc = fs.readFileSync(omrScanPagePath, 'utf8');
  const uploadsRouteSrc = fs.readFileSync(uploadsRoutePath, 'utf8');

  test('1. omr-scan/page.tsx retains local in-memory preview with localUrl || data.omrSheetUrl', () => {
    assert.ok(
      omrScanSrc.includes('setSheetImage(localUrl || data.omrSheetUrl)'),
      'processUploadedImage must prefer localUrl to prevent broken remote image requests'
    );
    assert.ok(
      !omrScanSrc.includes('setSheetImage(data.omrSheetUrl || localUrl)'),
      'processUploadedImage must not overwrite localUrl with remote omrSheetUrl'
    );
  });

  test('2. uploads/[...path]/route.ts validates parameters and guards against directory traversal', () => {
    assert.ok(
      uploadsRouteSrc.includes('public') && uploadsRouteSrc.includes('uploads'),
      'Route must target public/uploads base directory'
    );
    assert.ok(
      uploadsRouteSrc.includes('!resolvedPath.startsWith(uploadsBaseDir)'),
      'Route must guard against directory traversal attacks'
    );
    assert.ok(
      uploadsRouteSrc.includes("status: 403"),
      'Route must respond with 403 Forbidden when directory traversal is attempted'
    );
  });

  test('3. uploads/[...path]/route.ts maps MIME types for image formats (jpeg, png, webp)', () => {
    assert.ok(
      uploadsRouteSrc.includes("'image/jpeg'") &&
      uploadsRouteSrc.includes("'image/png'") &&
      uploadsRouteSrc.includes("'image/webp'"),
      'Route must map jpeg, png, and webp content types'
    );
    assert.ok(
      uploadsRouteSrc.includes("fs.readFile(resolvedPath)"),
      'Route must read file from disk using fs.readFile'
    );
    assert.ok(
      uploadsRouteSrc.includes("status: 404"),
      'Route must return 404 when file does not exist (ENOENT)'
    );
  });

  test('4. file resolution logic correctly resolves public/uploads files and detects MIME types', () => {
    const MIME_TYPES = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    const uploadsBaseDir = path.resolve(process.cwd(), 'public', 'uploads');
    const pathSegments = ['omr', 'sample_sheet.png'];
    const resolvedPath = path.resolve(uploadsBaseDir, path.join(...pathSegments));

    assert.ok(resolvedPath.startsWith(uploadsBaseDir), 'Resolved path must be inside uploadsBaseDir');
    assert.ok(fs.existsSync(resolvedPath), 'sample_sheet.png must exist in public/uploads/omr');

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext];
    assert.equal(contentType, 'image/png', 'MIME type must be image/png');
  });

  test('5. directory traversal attempt is detected and blocked by uploadsBaseDir boundary', () => {
    const uploadsBaseDir = path.resolve(process.cwd(), 'public', 'uploads');
    const maliciousSegments = ['..', '..', 'package.json'];
    const resolvedPath = path.resolve(uploadsBaseDir, path.join(...maliciousSegments));

    const isBlocked = !resolvedPath.startsWith(uploadsBaseDir);
    assert.equal(isBlocked, true, 'Path traversing outside public/uploads must be blocked');
  });
});

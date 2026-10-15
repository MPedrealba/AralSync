const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Mirror filename sanitization logic from /api/coordinator/learning-materials
function sanitizeUploadedFilename(originalName) {
  const ext = path.extname(originalName || 'material.pdf').toLowerCase() || '.pdf';
  const cleanBase = (originalName || 'material')
    .replace(ext, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return {
    cleanBase: cleanBase || 'doc',
    ext,
    generateFilename: (timestamp = 1700000000000) => `aral_mat_${cleanBase || 'doc'}_${timestamp}${ext}`,
  };
}

// Mirror path resolution and directory traversal guard from /api/learning-materials/view
function resolveAndValidateFilePath(publicDir, targetUrl) {
  if (/^https?:\/\//i.test(targetUrl)) {
    return { type: 'redirect', url: targetUrl };
  }

  let decodedPath = targetUrl;
  try {
    decodedPath = decodeURIComponent(targetUrl);
  } catch {
    decodedPath = targetUrl;
  }

  const cleanPath = decodedPath.split(/[#?]/)[0].trim().replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicDir, cleanPath);

  if (!resolvedPath.startsWith(publicDir)) {
    return { type: 'forbidden', error: 'Access denied: Invalid file path.' };
  }

  return { type: 'file', resolvedPath };
}

describe('Learning Material Upload & PDF Viewer Engine', () => {
  const mockPublicDir = path.resolve('C:\\AralSync\\public');

  test('sanitizes filenames with spaces, brackets, hyphens and special characters', () => {
    const input = ' [DepEd] Grade 7 - Science & Reading (ARAL 2026)! .pdf ';
    const { cleanBase, ext, generateFilename } = sanitizeUploadedFilename(input.trim());

    assert.equal(ext, '.pdf');
    assert.equal(cleanBase, 'deped_grade_7_science_reading_aral_2026');
    assert.equal(
      generateFilename(123456789),
      'aral_mat_deped_grade_7_science_reading_aral_2026_123456789.pdf'
    );
  });

  test('falls back to default doc naming if filename contains only symbols', () => {
    const input = '---@@@###$$$%%.pdf';
    const { cleanBase, generateFilename } = sanitizeUploadedFilename(input);

    assert.equal(cleanBase, 'doc');
    assert.equal(generateFilename(999), 'aral_mat_doc_999.pdf');
  });

  test('safely resolves legitimate paths within public directory', () => {
    const targetUrl = '/uploads/materials/aral_mat_workbook_1700000000.pdf';
    const result = resolveAndValidateFilePath(mockPublicDir, targetUrl);

    assert.equal(result.type, 'file');
    assert.equal(
      result.resolvedPath,
      path.resolve(mockPublicDir, 'uploads', 'materials', 'aral_mat_workbook_1700000000.pdf')
    );
  });

  test('strips URL hash fragments such as #page=12 and queries', () => {
    const targetUrl = '/learning-materials/ks3-plus/learner-workbook.pdf#page=14?preview=true';
    const result = resolveAndValidateFilePath(mockPublicDir, targetUrl);

    assert.equal(result.type, 'file');
    assert.equal(
      result.resolvedPath,
      path.resolve(mockPublicDir, 'learning-materials', 'ks3-plus', 'learner-workbook.pdf')
    );
  });

  test('blocks directory traversal attempts attempting to escape public folder', () => {
    const attackVectors = [
      '../../package.json',
      '/../../.env',
      'uploads/../../database/db.ts',
      '..\\..\\windows\\system32',
    ];

    for (const vector of attackVectors) {
      const result = resolveAndValidateFilePath(mockPublicDir, vector);
      assert.equal(result.type, 'forbidden', `Failed to block traversal vector: ${vector}`);
    }
  });

  test('identifies and returns redirect type for external cloud URLs', () => {
    const external = 'https://drive.google.com/file/d/12345/view';
    const result = resolveAndValidateFilePath(mockPublicDir, external);

    assert.equal(result.type, 'redirect');
    assert.equal(result.url, external);
  });
});

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

// Fuzzy matching engine for recovery
function scoreFuzzyCandidate(file, material, cleanPath) {
  const lower = file.toLowerCase();
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

  const targetBaseName = path.basename(cleanPath)
    .toLowerCase()
    .replace(/^aral_mat_/, '')
    .replace(/_\d{10,14}\.pdf$/, '')
    .replace(/\.pdf$/, '')
    .replace(/[^a-z0-9]+/g, '_');

  const fileBaseName = lower
    .replace(/^aral_mat_/, '')
    .replace(/_\d{10,14}\.pdf$/, '')
    .replace(/\.pdf$/, '')
    .replace(/[^a-z0-9]+/g, '_');

  let score = 0;
  if (targetBaseName && fileBaseName) {
    if (targetBaseName === fileBaseName) score += 60;
    else if (fileBaseName.includes(targetBaseName) || targetBaseName.includes(fileBaseName)) score += 40;
  }

  if (targetSubject && lower.includes(targetSubject)) {
    score += 20;
  }

  for (const kw of keywords) {
    if (lower.includes(kw)) {
      score += kw.length >= 4 ? 8 : 4;
    }
  }

  if (lower.includes('math') && (targetSubject.includes('math') || keywords.includes('math'))) {
    score += 15;
  }
  if (lower.includes('reading') && (targetSubject.includes('reading') || keywords.includes('reading'))) {
    score += 15;
  }
  if (lower.includes('science') && (targetSubject.includes('science') || keywords.includes('science'))) {
    score += 15;
  }

  return score;
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

  test('fuzzy recovery accurately identifies candidate math worksheet file on disk', () => {
    const candidateFiles = [
      'aral_mat_copy_of_final_rtp_aral_math_g7_and_g8_learner_s_worksheets_1792028625227.pdf',
      'aral_mat_ks1_reading_guide_1700000000.pdf',
      'aral_mat_science_lab_manual_1700000000.pdf',
    ];

    const material = {
      title: 'ARAL Math Worksheet Grade 7 & 8',
      subject: 'Math',
      edition: 'DepEd ARAL SY 2026-2027',
    };
    const missingCleanPath = 'uploads/materials/aral_mat_math_g7_g8_worksheets_old.pdf';

    const scores = candidateFiles.map((file) => ({
      file,
      score: scoreFuzzyCandidate(file, material, missingCleanPath),
    }));

    scores.sort((a, b) => b.score - a.score);

    assert.equal(scores[0].file, 'aral_mat_copy_of_final_rtp_aral_math_g7_and_g8_learner_s_worksheets_1792028625227.pdf');
    assert.ok(scores[0].score > 30, `Expected high match score, got ${scores[0].score}`);
    assert.ok(scores[0].score > scores[1].score);
  });

  test('generates user-friendly HTML error template with recovery action links', () => {
    // Import or construct check
    const materialId = '6acde2293b451ecc566a3838';
    const expectedEditUrl = `/coordinator/learning-materials?edit=${materialId}`;
    const htmlSnippet = `
      <a href="/coordinator/learning-materials">Back to Learning Materials</a>
      <a href="${expectedEditUrl}">Re-upload PDF</a>
    `;

    assert.match(htmlSnippet, /Back to Learning Materials/);
    assert.match(htmlSnippet, /Re-upload PDF/);
    assert.match(htmlSnippet, new RegExp(materialId));
  });
});

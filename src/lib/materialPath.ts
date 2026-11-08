import fs from 'fs';
import path from 'path';

/**
 * Resolves the physical on-disk file path for an uploaded or static LearningMaterial PDF.
 * Checks public directory, uploads, and applies resilient fuzzy-matching fallbacks.
 */
export function resolveMaterialFilePath(material: any): string | null {
  if (!material) return null;
  const rawUrl = typeof material.fileUrl === 'string' ? material.fileUrl.trim() : '';
  if (!rawUrl) return null;

  const publicDir = path.resolve(process.cwd(), 'public');
  const cleanRel = rawUrl.split(/[#?]/)[0].trim().replace(/^\/+/, '');
  if (!cleanRel) return null;

  const directPath = path.resolve(publicDir, cleanRel);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  const cwdCandidate = path.resolve(process.cwd(), cleanRel);
  if (fs.existsSync(cwdCandidate) && fs.statSync(cwdCandidate).isFile()) {
    return cwdCandidate;
  }

  // Search in public/uploads/materials
  const uploadsDir = path.join(publicDir, 'uploads', 'materials');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir).filter((f) => f.toLowerCase().endsWith('.pdf') && !f.startsWith('.'));
    const titleSlug = (material.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const titleMatch = files.find((f) => titleSlug.length > 3 && f.toLowerCase().includes(titleSlug.slice(0, 15)));
    if (titleMatch) {
      return path.join(uploadsDir, titleMatch);
    }

    if (material.subject === 'Reading' || /phil[-_]?iri|reading/i.test(material.title || '')) {
      const readingMatch = files.find((f) => /phil[-_]?iri|reading/i.test(f));
      if (readingMatch) return path.join(uploadsDir, readingMatch);
    }

    if (material.subject === 'Math' || /math/i.test(material.title || '')) {
      const mathMatch = files.find((f) => /math/i.test(f));
      if (mathMatch) return path.join(uploadsDir, mathMatch);
    }

    if (files.length > 0) {
      return path.join(uploadsDir, files[0]);
    }
  }

  // Fallbacks in public/learning-materials
  const ks3Basic = path.join(publicDir, 'learning-materials', 'ks3-basic', 'learner-workbook.pdf');
  if (fs.existsSync(ks3Basic)) return ks3Basic;

  const ks3Plus = path.join(publicDir, 'learning-materials', 'ks3-plus', 'learner-workbook.pdf');
  if (fs.existsSync(ks3Plus)) return ks3Plus;

  return null;
}

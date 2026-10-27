import fs from 'fs';
import path from 'path';
import LearningMaterial from '../../models/LearningMaterial';

// Coordinator Learning Materials Management
// System relies exclusively on materials manually uploaded by the ARAL Coordinator for the active School Year.

export const DEFAULT_ARAL_MATERIALS: any[] = [];

/**
 * Verifies that all LearningMaterial records in MongoDB correspond to physical files on disk in public/uploads/materials.
 */
export async function alignLearningMaterials() {
  try {
    const publicDir = path.resolve(process.cwd(), 'public');
    const materials = await (LearningMaterial as any).find({});

    const uploadsDir = path.join(publicDir, 'uploads', 'materials');
    let availableUploads: string[] = [];
    if (fs.existsSync(uploadsDir)) {
      availableUploads = fs.readdirSync(uploadsDir).filter((f) => f.toLowerCase().endsWith('.pdf') && !f.startsWith('.'));
    }

    for (const m of materials) {
      if (!m.fileUrl) continue;
      const cleanRel = m.fileUrl.split(/[#?]/)[0].trim().replace(/^\/+/, '');
      const fullPath = path.resolve(publicDir, cleanRel);

      if (!fs.existsSync(fullPath)) {
        if (availableUploads.length > 0) {
          // If the referenced file was renamed or moved, link to the nearest uploaded file in public/uploads/materials
          const match = availableUploads.find(
            (f) => (m.subject === 'Math' && f.toLowerCase().includes('math')) ||
                   (m.subject === 'Reading' && f.toLowerCase().includes('reading'))
          ) || availableUploads[0];
          m.fileUrl = `/uploads/materials/${match}`;
          await m.save();
          console.log(`[Material Alignment] Re-linked material "${m.title}" -> ${m.fileUrl}`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to align learning materials:', err);
  }
}

export async function ensureDefaultLearningMaterials() {
  try {
    // Run alignment to verify physical files match DB records
    await alignLearningMaterials();
  } catch (err) {
    console.error('Failed to verify ARAL learning materials:', err);
  }
}


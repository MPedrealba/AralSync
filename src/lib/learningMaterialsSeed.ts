import fs from 'fs';
import path from 'path';
import LearningMaterial from '../../models/LearningMaterial';

// Coordinator Learning Materials Management
// System relies exclusively on materials manually uploaded by the ARAL Coordinator for the active School Year.

export const DEFAULT_ARAL_MATERIALS: any[] = [];

export const PHIL_IRI_SESSION_DIRECTORY = [
  // Grade 7
  { sessionName: "Full Group Screening Test (Grade 7)", pageStart: 15, pageEnd: 24, topic: "Group Screening Test - Grade 7" },
  { sessionName: "Selection A: What Little Things! (Grade 7, Items 1–10)", pageStart: 15, pageEnd: 17, topic: "What Little Things!" },
  { sessionName: "Selection B: Plant Intelligence (Grade 7, Items 11–20)", pageStart: 17, pageEnd: 19, topic: "Plant Intelligence" },
  { sessionName: "Selection C: Get to Know PAGASA's Rainfall Warnings (Grade 7, Items 21–30)", pageStart: 19, pageEnd: 21, topic: "Get to Know PAGASA's Rainfall Warnings" },
  { sessionName: "Selection D: Solid Waste Management (Grade 7, Items 31–40)", pageStart: 21, pageEnd: 24, topic: "Solid Waste Management" },

  // Grade 8
  { sessionName: "Full Group Screening Test (Grade 8)", pageStart: 25, pageEnd: 34, topic: "Group Screening Test - Grade 8" },
  { sessionName: "Selection A: Africa's Plea (Grade 8, Items 1–10)", pageStart: 25, pageEnd: 27, topic: "Africa's Plea" },
  { sessionName: "Selection B: Dinagsa Festival (Grade 8, Items 11–20)", pageStart: 27, pageEnd: 29, topic: "Dinagsa Festival: Colorful Hues of Gaiety" },
  { sessionName: "Selection C: The Negro Speaks of Rivers (Grade 8, Items 21–30)", pageStart: 30, pageEnd: 31, topic: "The Negro Speaks of Rivers" },
  { sessionName: "Selection D: Deforestation (Grade 8, Items 31–40)", pageStart: 32, pageEnd: 34, topic: "Deforestation" },

  // Grade 9
  { sessionName: "Full Group Screening Test (Grade 9)", pageStart: 35, pageEnd: 44, topic: "Group Screening Test - Grade 9" },
  { sessionName: "Selection A: The Road Not Taken (Grade 9, Items 1–10)", pageStart: 35, pageEnd: 37, topic: "The Road Not Taken" },
  { sessionName: "Selection B: Depression: How Serious Can It Get? (Grade 9, Items 11–20)", pageStart: 37, pageEnd: 39, topic: "Depression: How Serious Can It Get?" },
  { sessionName: "Selection C: Tsunamis (Grade 9, Items 21–30)", pageStart: 39, pageEnd: 41, topic: "Tsunamis" },
  { sessionName: "Selection D: Brain Aneurysms (Grade 9, Items 31–40)", pageStart: 42, pageEnd: 44, topic: "Brain Aneurysms" },

  // Grade 10
  { sessionName: "Full Group Screening Test (Grade 10)", pageStart: 45, pageEnd: 55, topic: "Group Screening Test - Grade 10" },
  { sessionName: "Selection A: Still I Rise (Grade 10, Items 1–10)", pageStart: 45, pageEnd: 47, topic: "Still I Rise" },
  { sessionName: "Selection B: Mental Health, Too (Grade 10, Items 11–20)", pageStart: 48, pageEnd: 51, topic: "Mental Health, Too" },
  { sessionName: "Selection C: Arachne (Grade 10, Items 21–30)", pageStart: 51, pageEnd: 53, topic: "Arachne" },
  { sessionName: "Selection D: Transforming Philippine Agriculture (Grade 10, Items 31–40)", pageStart: 53, pageEnd: 55, topic: "Transforming Philippine Agriculture" },
];

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
      // Auto-populate Phil-IRI session directory if empty or missing
      if (
        /phil[-_]?iri/i.test(m.title || '') &&
        (!m.sessionDirectory || m.sessionDirectory.length === 0)
      ) {
        m.sessionDirectory = PHIL_IRI_SESSION_DIRECTORY;
        await m.save();
        console.log(`[Material Alignment] Populated session directory for "${m.title}"`);
      }

      // Auto-calibrate gradeLevels based on explicit title if present (e.g., Grade 7 & 8, Grade 9 to 10)
      if (m.title) {
        const titleMatch = m.title.match(/Grade[s]?\s*(\d+)(?:\s*(?:to|&|-)\s*(\d+))?/i);
        if (titleMatch) {
          const start = Number(titleMatch[1]);
          const end = titleMatch[2] ? Number(titleMatch[2]) : start;
          const expectedGrades: number[] = [];
          for (let g = start; g <= end; g++) expectedGrades.push(g);
          if (JSON.stringify(m.gradeLevels) !== JSON.stringify(expectedGrades)) {
            m.gradeLevels = expectedGrades;
            await m.save();
          }
        }
      }

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


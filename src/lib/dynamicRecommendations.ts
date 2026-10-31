import connectDB from '../../database/db.js';
import LearningMaterial from '../../models/LearningMaterial.js';
import ReadingPassage from '../../models/ReadingPassage.js';
import Recommendation from '../../models/Recommendation.js';
import LearnerRecord from '../../models/LearnerRecord.js';

export type Subject = 'Reading' | 'Math' | 'Science';
export type ProgramLevel = 'Basic' | 'Plus';
export type ProficiencyTier =
  | 'Beginning'
  | 'Developing'
  | 'Proficient'
  | 'Frustration'
  | 'Instructional'
  | 'Independent';

export interface DynamicRecommendationItem {
  title: string;
  kind: 'Module' | 'Activity' | 'Quiz' | 'Video';
  subject: Subject;
  description: string;
  meta: {
    items?: number;
    lessons?: number;
    duration?: string;
    level?: string;
    proficiencyTier?: ProficiencyTier;
  };
  depedCode?: string;
  source: string;
  workbookUrl: string;
  tutorGuideUrl?: string | null;
  keyStage: string;
  programLevel: ProgramLevel;
  proficiencyTier: ProficiencyTier;
  targetGrades: number[];
  pageStart: number | null;
  pageEnd: number | null;
  sessionInfo: string;
  materialId?: any;
  passageId?: any;
  isDynamic: boolean;
}

/**
 * Extracts numeric grade levels from title if gradeLevels array is empty.
 * e.g. "ARAL Math Worksheet Grade 7 & 8" -> [7, 8]
 */
function extractGrades(title: string, existingGrades?: number[]): number[] {
  if (Array.isArray(existingGrades) && existingGrades.length > 0) {
    return existingGrades;
  }
  const match = title.match(/Grade[s]?\s*(\d+)(?:\s*(?:to|&|-)\s*(\d+))?/i);
  if (match) {
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    const grades: number[] = [];
    for (let g = start; g <= end; g++) {
      grades.push(g);
    }
    return grades;
  }
  return [7]; // Default KS3 secondary grade
}

/**
 * Scans all active uploaded LearningMaterial and ReadingPassage documents in MongoDB,
 * dynamically generating proficiency-aligned recommendation items.
 */
export async function scanLearningMaterialsForRecommendations(): Promise<DynamicRecommendationItem[]> {
  await connectDB();

  const [materials, passages] = await Promise.all([
    (LearningMaterial as any).find({ isActive: { $ne: false } }).lean(),
    (ReadingPassage as any).find().lean(),
  ]);

  const items: DynamicRecommendationItem[] = [];

  // Map to easily look up materials by ID
  const materialMap = new Map<string, any>();
  for (const m of materials) {
    materialMap.set(String(m._id), m);
  }

  // 1. Process each active uploaded LearningMaterial
  for (const mat of materials) {
    const rawSubject = mat.subject || 'General';
    let subject: Subject = 'Math';
    if (rawSubject === 'Reading' || /reading|english|filipino|literacy/i.test(mat.title)) {
      subject = 'Reading';
    } else if (rawSubject === 'Science' || /science/i.test(mat.title)) {
      subject = 'Science';
    } else {
      subject = 'Math';
    }

    const grades = extractGrades(mat.title, mat.gradeLevels);
    const keyStage = mat.keyStage && mat.keyStage !== 'General'
      ? mat.keyStage
      : grades[0] >= 7
      ? 'KS3'
      : grades[0] >= 4
      ? 'KS2'
      : 'KS1';

    const sessions = Array.isArray(mat.sessionDirectory) ? mat.sessionDirectory : [];

    if (sessions.length > 0) {
      // Material has explicitly mapped sessions
      const totalSessions = sessions.length;
      sessions.forEach((sess: any, idx: number) => {
        let progLevel: ProgramLevel = 'Plus';
        let tier: ProficiencyTier = subject === 'Reading' ? 'Instructional' : 'Developing';

        if (idx === 0 || /intro|basic|foundat|review/i.test(sess.topic || sess.sessionName)) {
          progLevel = 'Basic';
          tier = subject === 'Reading' ? 'Frustration' : 'Beginning';
        } else if (idx === totalSessions - 1 || /mastery|advanc|eval/i.test(sess.topic || sess.sessionName)) {
          progLevel = 'Plus';
          tier = subject === 'Reading' ? 'Independent' : 'Proficient';
        }

        let kind: 'Module' | 'Activity' | 'Quiz' = 'Activity';
        if (/quiz|assessment|evaluat|check/i.test(sess.topic || sess.sessionName)) {
          kind = 'Quiz';
        } else if (/module|lesson|unit/i.test(sess.topic || sess.sessionName)) {
          kind = 'Module';
        }

        items.push({
          title: `${mat.title} — ${sess.sessionName}${sess.topic ? ': ' + sess.topic : ''}`,
          kind,
          subject,
          description: `Targeted ARAL ${subject} practice on "${sess.topic || sess.sessionName}" from ${mat.title} (pp. ${sess.pageStart}–${sess.pageEnd}). Aligned with ${tier} proficiency.`,
          meta: {
            duration: '30–45 mins',
            level: `${keyStage} • ${progLevel}`,
            proficiencyTier: tier,
          },
          source: `${mat.title} (${sess.sessionName})`,
          workbookUrl: mat.fileUrl,
          keyStage,
          programLevel: progLevel,
          proficiencyTier: tier,
          targetGrades: grades,
          pageStart: sess.pageStart,
          pageEnd: sess.pageEnd,
          sessionInfo: sess.sessionName,
          materialId: mat._id,
          isDynamic: true,
        });
      });

      // If only 1 session was mapped, ensure complementary tiers exist so all proficiency levels are covered
      if (sessions.length === 1) {
        // Tier 2: Core
        items.push({
          title: `${mat.title} — Core Skill Application (Tier 2)`,
          kind: 'Module',
          subject,
          description: `Standard grade-level exercises and structured skills practice from ${mat.title} (pp. 16–35). Aligned with ${subject === 'Reading' ? 'Instructional' : 'Developing'} proficiency.`,
          meta: {
            duration: '45 mins',
            lessons: 8,
            level: `${keyStage} • Plus`,
            proficiencyTier: subject === 'Reading' ? 'Instructional' : 'Developing',
          },
          source: mat.title,
          workbookUrl: mat.fileUrl,
          keyStage,
          programLevel: 'Plus',
          proficiencyTier: subject === 'Reading' ? 'Instructional' : 'Developing',
          targetGrades: grades,
          pageStart: 16,
          pageEnd: 35,
          sessionInfo: 'Core Application Tier',
          materialId: mat._id,
          isDynamic: true,
        });

        // Tier 3: Mastery
        items.push({
          title: `${mat.title} — Advanced Mastery & Synthesis (Tier 3)`,
          kind: 'Quiz',
          subject,
          description: `Advanced problem-solving exercises and mastery assessment from ${mat.title} (pp. 36+). Aligned with ${subject === 'Reading' ? 'Independent' : 'Proficient'} proficiency.`,
          meta: {
            duration: '45 mins',
            items: 20,
            level: `${keyStage} • Plus`,
            proficiencyTier: subject === 'Reading' ? 'Independent' : 'Proficient',
          },
          source: mat.title,
          workbookUrl: mat.fileUrl,
          keyStage,
          programLevel: 'Plus',
          proficiencyTier: subject === 'Reading' ? 'Independent' : 'Proficient',
          targetGrades: grades,
          pageStart: 36,
          pageEnd: null,
          sessionInfo: 'Mastery Tier',
          materialId: mat._id,
          isDynamic: true,
        });
      }
    } else {
      // Material has NO pre-mapped sessions: Generate standard 3-tier ARAL recommendations
      // Tier 1: Remediation / Foundational
      items.push({
        title: `${mat.title} — Guided Foundational Remediation (Tier 1)`,
        kind: 'Activity',
        subject,
        description: `Targeted guided review and foundational practice from ${mat.title} (pp. 1–15). Specially calibrated for learners requiring intensive remediation.`,
        meta: {
          duration: '30 mins',
          level: `${keyStage} • Basic`,
          proficiencyTier: subject === 'Reading' ? 'Frustration' : 'Beginning',
        },
        source: mat.title,
        workbookUrl: mat.fileUrl,
        keyStage,
        programLevel: 'Basic',
        proficiencyTier: subject === 'Reading' ? 'Frustration' : 'Beginning',
        targetGrades: grades,
        pageStart: 1,
        pageEnd: 15,
        sessionInfo: 'Foundational Tier',
        materialId: mat._id,
        isDynamic: true,
      });

      // Tier 2: Core Skill Application
      items.push({
        title: `${mat.title} — Core Skill Application & Exercises (Tier 2)`,
        kind: 'Module',
        subject,
        description: `Standard grade-level exercises and structured skills application from ${mat.title} (pp. 16–35). Calibrated for learners in the core developing stage.`,
        meta: {
          duration: '45 mins',
          lessons: 10,
          level: `${keyStage} • Plus`,
          proficiencyTier: subject === 'Reading' ? 'Instructional' : 'Developing',
        },
        source: mat.title,
        workbookUrl: mat.fileUrl,
        keyStage,
        programLevel: 'Plus',
        proficiencyTier: subject === 'Reading' ? 'Instructional' : 'Developing',
        targetGrades: grades,
        pageStart: 16,
        pageEnd: 35,
        sessionInfo: 'Core Application Tier',
        materialId: mat._id,
        isDynamic: true,
      });

      // Tier 3: Advanced Mastery
      items.push({
        title: `${mat.title} — Advanced Mastery & Problem Solving (Tier 3)`,
        kind: 'Quiz',
        subject,
        description: `Higher-order thinking, comprehensive word problems, and mastery review from ${mat.title} (pp. 36+). Calibrated for proficient/independent learners.`,
        meta: {
          duration: '50 mins',
          items: 20,
          level: `${keyStage} • Plus`,
          proficiencyTier: subject === 'Reading' ? 'Independent' : 'Proficient',
        },
        source: mat.title,
        workbookUrl: mat.fileUrl,
        keyStage,
        programLevel: 'Plus',
        proficiencyTier: subject === 'Reading' ? 'Independent' : 'Proficient',
        targetGrades: grades,
        pageStart: 36,
        pageEnd: null,
        sessionInfo: 'Mastery Tier',
        materialId: mat._id,
        isDynamic: true,
      });
    }
  }

  // 2. Process each ReadingPassage
  for (const passage of passages) {
    const parentMat = passage.materialId ? materialMap.get(String(passage.materialId)) : null;
    const qCount = Array.isArray(passage.questions) ? passage.questions.length : 0;
    const grade = passage.gradeLevel || 7;
    const keyStage = passage.keyStage || (grade >= 7 ? 'KS3' : grade >= 4 ? 'KS2' : 'KS1');
    const workbookUrl = parentMat?.fileUrl || '/uploads/materials/reading-default.pdf';

    // Shorter stories with <= 4 questions -> Instructional / Basic Activity
    // Longer stories with > 4 questions -> Independent / Plus Quiz
    const isBasic = qCount <= 4;
    const tier: ProficiencyTier = isBasic ? 'Instructional' : 'Independent';
    const progLevel: ProgramLevel = isBasic ? 'Basic' : 'Plus';

    items.push({
      title: `Reading Selection: ${passage.title}`,
      kind: qCount > 0 ? 'Quiz' : 'Activity',
      subject: 'Reading',
      description: `Reading comprehension passage and ${qCount}-item assessment from ${passage.sourceMaterial || 'DepEd ARAL Workbook'}. Calibrated for ${tier} reading level.`,
      meta: {
        items: qCount,
        duration: '25 mins',
        level: `${keyStage} • ${progLevel}`,
        proficiencyTier: tier,
      },
      source: passage.sourceMaterial || passage.title,
      workbookUrl,
      keyStage,
      programLevel: progLevel,
      proficiencyTier: tier,
      targetGrades: [grade],
      pageStart: null,
      pageEnd: null,
      sessionInfo: 'Reading Selection',
      materialId: passage.materialId || parentMat?._id,
      passageId: passage._id,
      isDynamic: true,
    });
  }

  return items;
}

/**
 * Synchronizes scanned recommendations with MongoDB Recommendation collection.
 * - Removes old static seeds and orphans from deleted materials.
 * - Upserts dynamic recommendations so they have permanent ObjectId references.
 */
export async function syncDynamicRecommendations() {
  await connectDB();

  const dynamicItems = await scanLearningMaterialsForRecommendations();

  // 1. Remove obsolete recommendations that don't have isDynamic = true or point to deleted materials
  const activeMaterialIds = (
    await (LearningMaterial as any).find({ isActive: { $ne: false } }).select('_id').lean()
  ).map((m: any) => m._id);

  // Delete legacy static seeds and deleted material references
  await (Recommendation as any).deleteMany({
    $or: [
      { isDynamic: { $ne: true } },
      { workbookUrl: null },
      { materialId: { $exists: true, $nin: activeMaterialIds }, passageId: null },
    ],
  });

  // 2. Upsert each dynamic recommendation
  const savedDocs = [];
  for (const item of dynamicItems) {
    const filter: Record<string, any> = {
      title: item.title,
      subject: item.subject,
    };
    if (item.materialId) filter.materialId = item.materialId;
    if (item.passageId) filter.passageId = item.passageId;

    const doc = await (Recommendation as any).findOneAndUpdate(
      filter,
      { $set: item },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    savedDocs.push(doc);
  }

  return savedDocs;
}

/**
 * Resolves a learner's proficiency tier based on their profile and assessment metrics.
 */
export function resolveLearnerProficiency(
  learner: any,
  subject: Subject,
  score?: number
): { tier: ProficiencyTier; progLevel: ProgramLevel } {
  // If a specific assessment score was passed (e.g. from OMR or Comprehension check)
  if (score != null) {
    if (score < 50) {
      return {
        tier: subject === 'Reading' ? 'Frustration' : 'Beginning',
        progLevel: 'Basic',
      };
    }
    if (score < 75) {
      return {
        tier: subject === 'Reading' ? 'Instructional' : 'Developing',
        progLevel: 'Plus',
      };
    }
    return {
      tier: subject === 'Reading' ? 'Independent' : 'Proficient',
      progLevel: 'Plus',
    };
  }

  // Reading profile check
  if (subject === 'Reading') {
    const rLevel =
      learner?.combinedReadingLevel ||
      learner?.readingLevel ||
      learner?.comprehensionLevel ||
      learner?.oralReadingLevel;

    if (rLevel === 'Non-Reader' || rLevel === 'Frustration') {
      return { tier: 'Frustration', progLevel: 'Basic' };
    }
    if (rLevel === 'Instructional') {
      return { tier: 'Instructional', progLevel: 'Plus' };
    }
    if (rLevel === 'Independent') {
      return { tier: 'Independent', progLevel: 'Plus' };
    }
  }

  // Math / General profile check
  const mStatus = learner?.masteryStatus;
  const risk = learner?.riskLevel;

  if (mStatus === 'Beginning' || risk === 'High Risk') {
    return {
      tier: subject === 'Reading' ? 'Frustration' : 'Beginning',
      progLevel: 'Basic',
    };
  }
  if (mStatus === 'Developing' || mStatus === 'Approaching' || risk === 'Moderate Risk') {
    return {
      tier: subject === 'Reading' ? 'Instructional' : 'Developing',
      progLevel: 'Plus',
    };
  }
  if (mStatus === 'Proficient' || risk === 'Low Risk') {
    return {
      tier: subject === 'Reading' ? 'Independent' : 'Proficient',
      progLevel: 'Plus',
    };
  }

  // Default fallback
  return {
    tier: subject === 'Reading' ? 'Instructional' : 'Developing',
    progLevel: 'Plus',
  };
}

/**
 * Returns dynamic recommendations tailored to a specific learner's proficiency level and grade.
 */
export async function getRecommendationsForLearner(options: {
  studentId?: string;
  subject?: Subject;
  score?: number;
  gradeLevel?: number;
  limit?: number;
}) {
  await connectDB();

  // Ensure dynamic recommendations are synced
  const count = await (Recommendation as any).countDocuments({ isDynamic: true });
  if (count === 0) {
    await syncDynamicRecommendations();
  }

  const { studentId, subject = 'Reading', score, limit = 3 } = options;

  let learner: any = null;
  if (studentId) {
    learner = await (LearnerRecord as any).findOne({ studentId }).lean();
  }

  const grade = options.gradeLevel || learner?.gradeLevel || 7;
  const { tier, progLevel } = resolveLearnerProficiency(learner, subject, score);

  // 1. Try exact match: subject + targetGrades includes grade + proficiencyTier
  let recs = await (Recommendation as any)
    .find({
      subject,
      targetGrades: grade,
      proficiencyTier: tier,
    })
    .limit(limit)
    .lean();

  // 2. If not enough, loosen to matching subject + programLevel
  if (recs.length < limit) {
    const additional = await (Recommendation as any)
      .find({
        subject,
        programLevel: progLevel,
        _id: { $nin: recs.map((r: any) => r._id) },
      })
      .limit(limit - recs.length)
      .lean();
    recs = recs.concat(additional);
  }

  // 3. Fallback to any in subject
  if (recs.length < limit) {
    const fallback = await (Recommendation as any)
      .find({
        subject,
        _id: { $nin: recs.map((r: any) => r._id) },
      })
      .limit(limit - recs.length)
      .lean();
    recs = recs.concat(fallback);
  }

  return {
    learnerTier: tier,
    programLevel: progLevel,
    gradeLevel: grade,
    recommendations: recs,
  };
}

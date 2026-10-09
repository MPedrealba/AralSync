import LearningMaterial from '../../models/LearningMaterial';

export const DEFAULT_ARAL_MATERIALS = [
  {
    title: 'Key Stage 3 — Basic Science, Math & Reading Workbook',
    subject: 'Reading',
    keyStage: 'KS3',
    gradeLevels: [7, 8, 9, 10],
    edition: 'DepEd ARAL SY 2026-2027',
    type: 'Learner Workbook',
    fileUrl: '/learning-materials/ks3-basic/learner-workbook.pdf',
    isActive: true,
    sessionDirectory: [
      { sessionName: 'Session 1: Expository Text & Main Idea Extraction', pageStart: 6, pageEnd: 14, topic: 'Informational Reading' },
      { sessionName: 'Session 2: Scientific Inquiries & Ecological Concepts', pageStart: 15, pageEnd: 25, topic: 'Science Concepts' },
      { sessionName: 'Session 3: Algebra & Quantitative Problem Solving', pageStart: 26, pageEnd: 36, topic: 'Algebraic Thinking' },
    ],
  },
  {
    title: 'Key Stage 3 — Basic Tutor\'s Guide',
    subject: 'Reading',
    keyStage: 'KS3',
    gradeLevels: [7, 8, 9, 10],
    edition: 'DepEd ARAL SY 2026-2027',
    type: 'Tutors Guide',
    fileUrl: '/learning-materials/ks3-basic/tutors-guide.pdf',
    isActive: true,
    sessionDirectory: [],
  },
  {
    title: 'Key Stage 3 — Plus Accelerated Workbook',
    subject: 'Reading',
    keyStage: 'KS3',
    gradeLevels: [7, 8, 9, 10],
    edition: 'DepEd ARAL SY 2026-2027',
    type: 'Learner Workbook',
    fileUrl: '/learning-materials/ks3-plus/learner-workbook.pdf',
    isActive: true,
    sessionDirectory: [
      { sessionName: 'Session 1: Complex Synthesis & Informational Texts', pageStart: 5, pageEnd: 16, topic: 'Advanced Literacy' },
      { sessionName: 'Session 2: Scientific Models & Data Interpretation', pageStart: 17, pageEnd: 28, topic: 'Data Analysis & Science' },
      { sessionName: 'Session 3: Functions, Equations & Word Problems', pageStart: 29, pageEnd: 42, topic: 'Advanced Numeracy' },
    ],
  },
  {
    title: 'Key Stage 3 — Plus Tutor\'s Guide',
    subject: 'Reading',
    keyStage: 'KS3',
    gradeLevels: [7, 8, 9, 10],
    edition: 'DepEd ARAL SY 2026-2027',
    type: 'Tutors Guide',
    fileUrl: '/learning-materials/ks3-plus/tutors-guide.pdf',
    isActive: true,
    sessionDirectory: [],
  },
];

export async function ensureDefaultLearningMaterials() {
  try {
    // Clean up any legacy elementary materials (KS1 and KS2) so only High School (KS3 / Grades 7-10) materials exist
    await (LearningMaterial as any).deleteMany({ keyStage: { $in: ['KS1', 'KS2'] } });

    const count = await LearningMaterial.countDocuments();
    if (count === 0) {
      await LearningMaterial.insertMany(DEFAULT_ARAL_MATERIALS);
    }
  } catch (err) {
    console.error('Failed to auto-seed default ARAL learning materials:', err);
  }
}

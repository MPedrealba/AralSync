const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('./db');
const Recommendation = require('../models/Recommendation');
const ReadingPassage = require('../models/ReadingPassage');

const aralRecommendations = [
  {
    title: 'ARAL Reading Plus — Key Stage 3 (Grades 7–10)',
    kind: 'Module',
    subject: 'Reading',
    description: 'Comprehensive 8-week secondary reading recovery curriculum covering context clues, structural word analysis, inferencing, point of view, and informational texts.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf',
    depedCode: 'EN7RC-Ia-1 / ARAL-KS3-PLUS',
    source: 'DepEd ARAL Program',
    meta: { lessons: 32, duration: '8 Weeks', level: 'Grades 7–10 (Key Stage 3)' },
  },
  {
    title: 'ARAL Reading Basic — Key Stage 3 (Grades 7–10)',
    kind: 'Module',
    subject: 'Reading',
    description: 'Foundational literacy remediation for secondary learners. Emphasizes letter-sound relationships, phonetic decoding, sight words, and guided passage reading.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf',
    depedCode: 'EN7F-Ia-1 / ARAL-KS3-BASIC',
    source: 'DepEd ARAL Program',
    meta: { lessons: 32, duration: '8 Weeks', level: 'Grades 7–10 (Key Stage 3)' },
  },
  {
    title: 'ARAL Reading Plus — Key Stage 2 (Grades 4–6)',
    kind: 'Module',
    subject: 'Reading',
    description: 'Intermediate reading comprehension, vocabulary expansion, and reading fluency enrichment for elementary key stage 2 learners.',
    keyStage: 'KS2',
    programLevel: 'Plus',
    targetGrades: [4, 5, 6],
    workbookUrl: '/learning-materials/ks2-plus/learner-workbook.pdf',
    tutorGuideUrl: '/learning-materials/ks2-plus/tutors-guide.pdf',
    depedCode: 'EN4RC-Ia-1 / ARAL-KS2-PLUS',
    source: 'DepEd ARAL Program',
    meta: { lessons: 32, duration: '8 Weeks', level: 'Grades 4–6 (Key Stage 2)' },
  },
  {
    title: 'ARAL Reading Basic — Key Stage 2 (Grades 4–6)',
    kind: 'Module',
    subject: 'Reading',
    description: 'Targeted reading intervention focused on word attack skills, syllable recognition, vocabulary building, and sentence comprehension.',
    keyStage: 'KS2',
    programLevel: 'Basic',
    targetGrades: [4, 5, 6],
    workbookUrl: '/learning-materials/ks2-basic/learner-workbook.pdf',
    tutorGuideUrl: '/learning-materials/ks2-basic/tutors-guide.pdf',
    depedCode: 'EN4F-Ia-1 / ARAL-KS2-BASIC',
    source: 'DepEd ARAL Program',
    meta: { lessons: 32, duration: '8 Weeks', level: 'Grades 4–6 (Key Stage 2)' },
  },
  {
    title: 'ARAL English — Key Stage 1 (Grades 1–3)',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Early English literacy materials featuring alphabet recognition, basic phonetic blending, sight vocabulary, and shared reading activities.',
    keyStage: 'KS1',
    programLevel: 'Basic',
    targetGrades: [1, 2, 3],
    workbookUrl: '/learning-materials/ks1-english/learner-workbook.pdf',
    tutorGuideUrl: '/learning-materials/ks1-english/tutors-guide.pdf',
    depedCode: 'EN1OL-Ia-1 / ARAL-KS1-ENG',
    source: 'DepEd ARAL Program',
    meta: { lessons: 24, duration: '6 Weeks', level: 'Grades 1–3 (Key Stage 1)' },
  },
  {
    title: 'ARAL Filipino — Key Stage 1 (Grades 1–3)',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Panimulang pagbasa sa Filipino: pagkilala sa mga tunog ng titik, pantig, pagbuo ng salita, at pagbasa ng mga maiikling kuwento at tula.',
    keyStage: 'KS1',
    programLevel: 'Basic',
    targetGrades: [1, 2, 3],
    workbookUrl: '/learning-materials/ks1-filipino/learner-workbook.pdf',
    tutorGuideUrl: '/learning-materials/ks1-filipino/tutors-guide.pdf',
    depedCode: 'F1PN-Ia-1 / ARAL-KS1-FIL',
    source: 'DepEd ARAL Program',
    meta: { lessons: 24, duration: '6 Weeks', level: 'Grades 1–3 (Key Stage 1)' },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // KEY STAGE 3 PLUS ACTIVITIES (Grades 7–10: Comprehension & Fluency Recovery)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    title: 'ARAL KS3 Plus W1: Context Clues & Structural Analysis',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Practice using context clues, prefixes, and suffixes to unlock the meaning of unfamiliar words in authentic texts. Includes word association and confidence checks.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=4',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=4',
    pageStart: 4,
    pageEnd: 24,
    sessionInfo: 'Week 1 Sessions 1–4',
    depedCode: 'EN7RC-Ia-1 / ARAL-KS3-P-W1',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 7, duration: '60 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Plus W2: Oral Reading Fluency & Expressive Reading',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Read aloud with proper phrasing, pacing, and expression. Self-assess reading accuracy and self-correct reading miscues during guided passage reading.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=25',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=12',
    pageStart: 25,
    pageEnd: 49,
    sessionInfo: 'Week 2 Sessions 1–4',
    depedCode: 'EN7F-Ib-2 / ARAL-KS3-P-W2',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 6, duration: '60 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Plus W3: Story Elements & Chronological Sequencing',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Analyze short narrative texts to identify characters, setting, conflict, and resolution. Sequence key events using narrative transition markers.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=50',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=30',
    pageStart: 50,
    pageEnd: 77,
    sessionInfo: 'Week 3 Sessions 1–4',
    depedCode: 'EN7RC-Ic-3 / ARAL-KS3-P-W3',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 8, duration: '60 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Plus W4: Inferencing, Predicting & Drawing Conclusions',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Go beyond literal recall by making logical predictions, inferring characters’ motives, and drawing valid conclusions supported by textual evidence.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=78',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=57',
    pageStart: 78,
    pageEnd: 93,
    sessionInfo: 'Week 4 Sessions 1–4',
    depedCode: 'EN7RC-Id-4 / ARAL-KS3-P-W4',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 8, duration: '60 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Plus W5: Author’s Point of View & Purpose',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Identify first-person and third-person perspectives in narratives and expository texts. Distinguish whether the author’s purpose is to inform, persuade, or entertain.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=94',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=72',
    pageStart: 94,
    pageEnd: 112,
    sessionInfo: 'Week 5 Sessions 1–4',
    depedCode: 'EN7RC-Ie-5 / ARAL-KS3-P-W5',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 7, duration: '60 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Plus W6: Figurative Language & Literary Devices',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Examine common figures of speech including simile, metaphor, personification, and hyperbole in literary passages. Determine their connotative meanings.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=113',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=85',
    pageStart: 113,
    pageEnd: 118,
    sessionInfo: 'Week 6 Sessions 1–4',
    depedCode: 'EN7LT-If-6 / ARAL-KS3-P-W6',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 6, duration: '60 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Plus W7: Informational Texts, Main Idea & Details',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Identify topic sentences, stated vs. implied main ideas, and supporting details in secondary science and social studies reading selections.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=119',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=95',
    pageStart: 119,
    pageEnd: 142,
    sessionInfo: 'Week 7 Sessions 1–4',
    depedCode: 'EN7SS-Ig-7 / ARAL-KS3-P-W7',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 8, duration: '60 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Plus W8: Evaluating & Synthesizing Reading Selections',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Synthesize insights from multiple passages, summarize key ideas, and complete the comprehensive end-of-quarter reading recovery check.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-plus/learner-workbook.pdf#page=143',
    tutorGuideUrl: '/learning-materials/ks3-plus/tutors-guide.pdf#page=105',
    pageStart: 143,
    pageEnd: 163,
    sessionInfo: 'Week 8 Sessions 1–4',
    depedCode: 'EN7RC-Ih-8 / ARAL-KS3-P-W8',
    source: 'ARAL KS3 Plus Learner Workbook',
    meta: { items: 10, duration: '60 mins', level: 'Grades 7–10' },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // KEY STAGE 3 BASIC ACTIVITIES (Grades 7–10: Remediation & Foundational Literacy)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    title: 'ARAL KS3 Basic W1: Letter-Sound Decoding & Core Vocabulary',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Foundational phonetic remediation focusing on letter-sound matching, short vowel sounds, consonant blends, and basic sight vocabulary recognition.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=3',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=3',
    pageStart: 3,
    pageEnd: 8,
    sessionInfo: 'Week 1 Sessions 1–4',
    depedCode: 'EN7F-Ia-1 / ARAL-KS3-B-W1',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 6, duration: '45 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Basic W2: Sight Word Recognition & Phrase Fluency',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Reinforce high-frequency English sight words and practice two-to-three word phrase reading drills to build smooth word recognition without stumbling.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=9',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=15',
    pageStart: 9,
    pageEnd: 15,
    sessionInfo: 'Week 2 Sessions 1–4',
    depedCode: 'EN7F-Ib-2 / ARAL-KS3-B-W2',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 6, duration: '45 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Basic W3: Syllable Segmentation & Word Attack Skills',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Learn to break multi-syllable unfamiliar words into decodable syllable chunks. Build confidence with compound words and familiar root forms.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=16',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=25',
    pageStart: 16,
    pageEnd: 19,
    sessionInfo: 'Week 3 Sessions 1–4',
    depedCode: 'EN7F-Ic-3 / ARAL-KS3-B-W3',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 6, duration: '45 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Basic W4: Guided Sentence Reading & Literal Recall',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Read guided simple sentences and short paragraphs aloud. Answer direct who, what, and where questions based on explicit text details.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=20',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=35',
    pageStart: 20,
    pageEnd: 27,
    sessionInfo: 'Week 4 Sessions 1–4',
    depedCode: 'EN7RC-Id-4 / ARAL-KS3-B-W4',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 7, duration: '45 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Basic W5: Story Sequencing with Visual & Text Clues',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Put chronological story illustrations and sentences in correct order (Beginning, Middle, End). Practice retelling using sequence transition words.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=28',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=45',
    pageStart: 28,
    pageEnd: 31,
    sessionInfo: 'Week 5 Sessions 1–4',
    depedCode: 'EN7RC-Ie-5 / ARAL-KS3-B-W5',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 5, duration: '45 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Basic W6: Functional Reading (Signs, Labels & Short Notices)',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Practice practical real-world literacy: deciphering school campus signage, instructional labels, simple schedules, and bulletin notices.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=32',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=55',
    pageStart: 32,
    pageEnd: 37,
    sessionInfo: 'Week 6 Sessions 1–4',
    depedCode: 'EN7SS-If-6 / ARAL-KS3-B-W6',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 6, duration: '45 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Basic W7: Guided Narrative Comprehension & Characters',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Read an engaging short narrative passage. Identify the main character, their goal, and the problem they encountered.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=38',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=65',
    pageStart: 38,
    pageEnd: 52,
    sessionInfo: 'Week 7 Sessions 1–4',
    depedCode: 'EN7RC-Ig-7 / ARAL-KS3-B-W7',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 7, duration: '45 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL KS3 Basic W8: Foundational Literacy Review & Progress Check',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Comprehensive review of basic phonics, sight vocabulary, sentence fluency, and short passage comprehension to evaluate transition readiness.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    workbookUrl: '/learning-materials/ks3-basic/learner-workbook.pdf#page=53',
    tutorGuideUrl: '/learning-materials/ks3-basic/tutors-guide.pdf#page=75',
    pageStart: 53,
    pageEnd: 67,
    sessionInfo: 'Week 8 Sessions 1–4',
    depedCode: 'EN7RC-Ih-8 / ARAL-KS3-B-W8',
    source: 'ARAL KS3 Basic Learner Workbook',
    meta: { items: 8, duration: '45 mins', level: 'Grades 7–10' },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // KEY STAGE 2 ACTIVITIES (Grades 4–6: Intermediate Reading Interventions)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    title: 'ARAL KS2 Plus: Vocabulary Expansion & Context Clues',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Use context clues and synonyms in sentences to deduce unfamiliar words. Complete comprehension activities from the KS2 Plus workbook.',
    keyStage: 'KS2',
    programLevel: 'Plus',
    targetGrades: [4, 5, 6],
    workbookUrl: '/learning-materials/ks2-plus/learner-workbook.pdf#page=4',
    tutorGuideUrl: '/learning-materials/ks2-plus/tutors-guide.pdf#page=4',
    pageStart: 4,
    pageEnd: 16,
    sessionInfo: 'Week 1 Sessions 1–4',
    depedCode: 'EN4V-Ia-1 / ARAL-KS2-P-W1',
    source: 'ARAL KS2 Plus Learner Workbook',
    meta: { items: 7, duration: '50 mins', level: 'Grades 4–6' },
  },
  {
    title: 'ARAL KS2 Plus: Main Ideas & Supporting Details',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Read informational paragraphs and determine the central message. Highlight evidence that supports the main idea.',
    keyStage: 'KS2',
    programLevel: 'Plus',
    targetGrades: [4, 5, 6],
    workbookUrl: '/learning-materials/ks2-plus/learner-workbook.pdf#page=32',
    tutorGuideUrl: '/learning-materials/ks2-plus/tutors-guide.pdf#page=25',
    pageStart: 32,
    pageEnd: 44,
    sessionInfo: 'Week 3 Sessions 1–4',
    depedCode: 'EN4RC-Ic-3 / ARAL-KS2-P-W3',
    source: 'ARAL KS2 Plus Learner Workbook',
    meta: { items: 8, duration: '50 mins', level: 'Grades 4–6' },
  },
  {
    title: 'ARAL KS2 Basic: Syllable Decoding & High-Frequency Words',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Elementary reading intervention emphasizing syllable division, vowel digraphs, and rapid sight word identification.',
    keyStage: 'KS2',
    programLevel: 'Basic',
    targetGrades: [4, 5, 6],
    workbookUrl: '/learning-materials/ks2-basic/learner-workbook.pdf#page=3',
    tutorGuideUrl: '/learning-materials/ks2-basic/tutors-guide.pdf#page=3',
    pageStart: 3,
    pageEnd: 25,
    sessionInfo: 'Week 1 Sessions 1–4',
    depedCode: 'EN4F-Ia-1 / ARAL-KS2-B-W1',
    source: 'ARAL KS2 Basic Learner Workbook',
    meta: { items: 6, duration: '45 mins', level: 'Grades 4–6' },
  },
  {
    title: 'ARAL KS2 Basic: Guided Sentence Reading & Wh-Questions',
    kind: 'Activity',
    subject: 'Reading',
    description: 'Sentence-by-sentence reading practice followed by answering explicit comprehension questions to build confidence.',
    keyStage: 'KS2',
    programLevel: 'Basic',
    targetGrades: [4, 5, 6],
    workbookUrl: '/learning-materials/ks2-basic/learner-workbook.pdf#page=58',
    tutorGuideUrl: '/learning-materials/ks2-basic/tutors-guide.pdf#page=45',
    pageStart: 58,
    pageEnd: 71,
    sessionInfo: 'Week 5 Sessions 1–4',
    depedCode: 'EN4RC-Ie-5 / ARAL-KS2-B-W5',
    source: 'ARAL KS2 Basic Learner Workbook',
    meta: { items: 6, duration: '45 mins', level: 'Grades 4–6' },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // MATH & SCIENCE INTERVENTIONS (Core DepEd Competencies)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    title: 'ARAL Math Numeracy: Fundamental Operations & Integers',
    kind: 'Activity',
    subject: 'Math',
    description: 'Targeted numeracy remediation on addition, subtraction, multiplication, and division of integers and real-world word problems.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    depedCode: 'M7NS-Ic-1 / ARAL-MATH-01',
    source: 'DepEd ARAL Mathematics Program',
    meta: { items: 10, duration: '50 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL Math: Fractions, Decimals & Percent Conversion',
    kind: 'Activity',
    subject: 'Math',
    description: 'Step-by-step guided activity converting between fractions, decimals, and percentages with visual models and real-life scenarios.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    depedCode: 'M7NS-Id-2 / ARAL-MATH-02',
    source: 'DepEd ARAL Mathematics Program',
    meta: { items: 10, duration: '50 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL Science: Scientific Method & Experimental Design',
    kind: 'Activity',
    subject: 'Science',
    description: 'Learn to formulate hypotheses, identify independent and dependent variables, and interpret experimental data tables.',
    keyStage: 'KS3',
    programLevel: 'Plus',
    targetGrades: [7, 8, 9, 10],
    depedCode: 'S7MT-Ia-1 / ARAL-SCI-01',
    source: 'DepEd ARAL Science Program',
    meta: { items: 8, duration: '50 mins', level: 'Grades 7–10' },
  },
  {
    title: 'ARAL Science: States of Matter & Phase Changes',
    kind: 'Activity',
    subject: 'Science',
    description: 'Interactive science activity modeling particle arrangement in solids, liquids, and gases during temperature shifts.',
    keyStage: 'KS3',
    programLevel: 'Basic',
    targetGrades: [7, 8, 9, 10],
    depedCode: 'S7MT-Ib-2 / ARAL-SCI-02',
    source: 'DepEd ARAL Science Program',
    meta: { items: 8, duration: '50 mins', level: 'Grades 7–10' },
  },
];

const aralPassages = [
  {
    title: 'ARAL KS3 Plus W1: Be Stunned',
    text: `One place in the province of Batangas that also caught my attention is Lobo. Lobo is a 4th-class municipality. For a traveler and adventure seeker like me, it offers numerous attractions and activities. Starting from the beautiful coral and rich marine life of the ocean to the stunning views and challenging climb of the mountains, one would literally have a memorable stay in Lobo.

I personally love Jaybanga Rice Terraces, which is 30 hectares of land located in the highlands of the village of Jaybanga. It is far less expansive compared to the popular and famed Banaue Rice Terraces of Ifugao province. But its verdant landscape and quiet mountain charm provide a peaceful haven.

When in Lobo, one cannot help but notice that most beaches are pebbly and not sandy, particularly Malabrigo Beach. The strong current that pushes the pebbles to the surface from the deep sea explains it. The crystal-clear water reveals vibrant marine sanctuaries protected by local fishermen. Visiting Lobo reminds every adventurer of the raw beauty hidden in our provinces.`,
    gradeLevel: 7,
    questions: [
      {
        question: 'What kind of municipality is Lobo in the province of Batangas?',
        options: ['1st-class municipality', '2nd-class municipality', '3rd-class municipality', '4th-class municipality'],
        answer: '4th-class municipality',
      },
      {
        question: 'Which attraction in the highlands of Lobo is compared to the Banaue Rice Terraces?',
        options: ['Jaybanga Rice Terraces', 'Malabrigo Point', 'Mount Daguldol', 'Taal Volcano'],
        answer: 'Jaybanga Rice Terraces',
      },
      {
        question: 'What distinctive characteristic do most beaches in Lobo, such as Malabrigo Beach, have?',
        options: ['Powder white sand', 'Pebbly shores pushed up by currents', 'Black volcanic ash', 'Muddy mangrove coastline'],
        answer: 'Pebbly shores pushed up by currents',
      },
      {
        question: 'What does the word "verdant" most likely mean in the context of the terraces landscape?',
        options: ['Dry and dusty', 'Lush and green', 'Steep and rocky', 'Urban and crowded'],
        answer: 'Lush and green',
      },
      {
        question: 'Why are the marine sanctuaries in Lobo well-preserved according to the text?',
        options: ['Industrial fish farms', 'They are protected by local fishermen', 'Tourists are strictly banned', 'Cold winter ocean storms'],
        answer: 'They are protected by local fishermen',
      },
      {
        question: 'What is the author’s primary purpose in writing "Be Stunned"?',
        options: ['To complain about tourism infrastructure', 'To highlight the diverse natural beauty of Lobo', 'To advertise private resort hotels', 'To compare Batangas with foreign countries'],
        answer: 'To highlight the diverse natural beauty of Lobo',
      },
      {
        question: 'How large is the Jaybanga Rice Terraces mentioned in the passage?',
        options: ['10 hectares', '30 hectares', '100 hectares', '300 hectares'],
        answer: '30 hectares',
      },
      {
        question: 'What natural force explains why pebbles cover the surface of Malabrigo Beach?',
        options: ['Earthquakes and landslides', 'Strong currents pushing pebbles from the sea', 'Volcanic lava deposits', 'Human landscaping'],
        answer: 'Strong currents pushing pebbles from the sea',
      },
      {
        question: 'Which word from the text acts as a synonym for "expansive"?',
        options: ['Memorable', 'Wide-ranging or vast', 'Challenging', 'Hidden'],
        answer: 'Wide-ranging or vast',
      },
      {
        question: 'What overall impression does the author leave regarding traveling to Lobo?',
        options: ['It is too difficult and not worth the visit', 'It is a memorable adventure with both ocean and mountain charms', 'It is only enjoyable during typhoon season', 'It is identical to Banaue in every way'],
        answer: 'It is a memorable adventure with both ocean and mountain charms',
      },
    ],
  },
  {
    title: 'ARAL KS3 Plus W5: My Birthday Disaster',
    text: `I remember my disastrous birthday like it was yesterday. It was my 8th birthday and I was so excited for my big party. My family and I had spent the whole week preparing the decorations and creating invitations. My Mother had spent all morning baking an enormous chocolate cake and it looked absolutely delicious.

All my friends started to arrive just after lunch time and everyone was playing happily outside in the backyard. The clown was standing in front of the cake making balloon animals for all of us when disaster struck.

One of my balloons burst with a loud BANG! The noise startled my dog, Lenny, who leapt into the air and bolted straight for the table. It was like a hippopotamus jumping into a muddy river! Brown chocolate cake flew all over the place, completely covering the tablecloth, the clown's colorful costume, and even Lenny's furry face.

At first, there was total silence. Then, the clown began to chuckle. Soon, all my friends burst into uncontrollable laughter. Even though my birthday cake was ruined, seeing everyone laugh together turned my disaster into the most memorable party of my childhood.`,
    gradeLevel: 8,
    questions: [
      {
        question: 'How old was the narrator turning on this eventful birthday?',
        options: ['7 years old', '8 years old', '9 years old', '10 years old'],
        answer: '8 years old',
      },
      {
        question: 'What triggered the chain of events leading to the disaster?',
        options: ['A sudden rainstorm', 'A balloon popping with a loud bang', 'A power outage', 'The dog knocking over a chair'],
        answer: 'A balloon popping with a loud bang',
      },
      {
        question: 'What did the dog, Lenny, do after being startled?',
        options: ['He hid under the couch', 'He bolted straight for the cake table', 'He ran out into the street', 'He chased the clown outside'],
        answer: 'He bolted straight for the cake table',
      },
      {
        question: 'Which figurative language device is used in "like a hippopotamus jumping into a muddy river"?',
        options: ['Simile', 'Metaphor', 'Personification', 'Hyperbole'],
        answer: 'Simile',
      },
      {
        question: 'How did the crowd react after the initial silence?',
        options: ['The children cried and went home', 'The clown and children burst into laughter', 'The mother scolded the dog harshly', 'Everyone demanded a refund'],
        answer: 'The clown and children burst into laughter',
      },
      {
        question: 'What text genre best categorizes "My Birthday Disaster"?',
        options: ['Scientific report', 'Personal narrative / Recount', 'Expository essay', 'Persuasive editorial'],
        answer: 'Personal narrative / Recount',
      },
      {
        question: 'What was the mother doing all morning before the party?',
        options: ['Buying presents at the mall', 'Baking an enormous chocolate cake', 'Hiring the clown', 'Blowing up balloons'],
        answer: 'Baking an enormous chocolate cake',
      },
      {
        question: 'What is the central theme or lesson of the recount?',
        options: ['Pets should never be allowed at parties', 'Unexpected mishaps can turn into joyful, unforgettable memories', 'Store-bought cakes are safer than homemade cakes', 'Birthdays are stressful and should be avoided'],
        answer: 'Unexpected mishaps can turn into joyful, unforgettable memories',
      },
      {
        question: 'What word from the text describes the size of the chocolate cake?',
        options: ['Tiny', 'Enormous', 'Plain', 'Disastrous'],
        answer: 'Enormous',
      },
      {
        question: 'What perspective or point of view is the story told from?',
        options: ['First-person ("I")', 'Second-person ("You")', 'Third-person omniscient', 'Third-person limited'],
        answer: 'First-person ("I")',
      },
    ],
  },
  {
    title: 'ARAL KS2 Plus W1: Mealtime with Family',
    text: `It was a rainy evening at our home in Manila. The aroma of Filipino cooking filled the kitchen. My brother Ben and I could hardly wait for mealtime. That night, we were having chicken adobo with rice – everyone’s favorite!

“Maya, Ben, maghugas na kayo ng kamay!” Nanay called warmly from the kitchen. We rushed to the sink and splashed water as we cleaned our hands. I felt happy because mealtime was always a special moment for us.

We excitedly sat at the table, which was full of delicious food: steaming white rice, savory adobo, and a fresh pitcher of cold sago't gulaman. Tatay led the family in a short prayer of thanks before we scooped food onto our plates.

Between hearty bites, Nanay shared funny stories from her trip to the public market, and Tatay asked Ben and me about our school projects. Mealtime was more than just eating; it was our family's favorite way to reconnect, listen, and show love for one another after a long day.`,
    gradeLevel: 5,
    questions: [
      {
        question: 'Where did the family meal take place on this rainy evening?',
        options: ['At a restaurant in Cebu', 'At their home in Manila', 'At school in the cafeteria', 'At their grandparents’ farm'],
        answer: 'At their home in Manila',
      },
      {
        question: 'What main Filipino dish was prepared for dinner?',
        options: ['Sinigang na baboy', 'Chicken adobo with rice', 'Pancit canton', 'Beef kare-kare'],
        answer: 'Chicken adobo with rice',
      },
      {
        question: 'What did Nanay ask Maya and Ben to do before eating?',
        options: ['Finish their homework', 'Wash their hands', 'Feed the dog', 'Set up the umbrella'],
        answer: 'Wash their hands',
      },
      {
        question: 'What refreshing beverage was served with dinner?',
        options: ['Hot chocolate', 'Sago’t gulaman', 'Orange juice', 'Iced tea'],
        answer: 'Sago’t gulaman',
      },
      {
        question: 'What did the family do immediately before scooping food onto their plates?',
        options: ['Watched television', 'Offered a prayer of gratitude', 'Took photographs', 'Cleared the table'],
        answer: 'Offered a prayer of gratitude',
      },
      {
        question: 'What made mealtime special for the author beyond simply eating food?',
        options: ['It was a chance to watch movies', 'It was a time to connect, share stories, and show family love', 'They received allowance from Tatay', 'They did not have to wash dishes'],
        answer: 'It was a time to connect, share stories, and show family love',
      },
      {
        question: 'Who are the two siblings mentioned in the story?',
        options: ['Maya and Ben', 'Mia and Sam', 'Helen and Lenny', 'Lobo and Batangas'],
        answer: 'Maya and Ben',
      },
      {
        question: 'What did Nanay talk about during dinner?',
        options: ['Her funny experiences at the public market', 'Her office work', 'The weather forecast for tomorrow', 'Traffic in the city'],
        answer: 'Her funny experiences at the public market',
      },
      {
        question: 'What word in the story describes the savory smell filling the kitchen?',
        options: ['Smoke', 'Aroma', 'Current', 'Disaster'],
        answer: 'Aroma',
      },
      {
        question: 'What mood or tone best characterizes the narrative?',
        options: ['Gloomy and sad', 'Warm and affectionate', 'Angry and strict', 'Mysterious and fearful'],
        answer: 'Warm and affectionate',
      },
    ],
  },
  {
    title: 'ARAL KS2 Basic W1: Si Mia at ang Masayang Sabado',
    text: `Isang umaga ng Sabado, masayang gumising si Mia. Sumikat ang ginintuang araw sa kanyang bintana.

"Maglilinis ako ng silid at mag-aalaga ng aking mga alagang hayop!" masiglang sabi ni Mia. Una niyang pinakain ang kanyang alagang aso na si Tagpi at ang munting ibon sa hawla. Kumahol nang masigla si Tagpi at humuni naman ang ibon na tila nagpapasalamat.

Pagkatapos, kinuha ni Mia ang walis at nagsimulang maglinis ng sala. Maya-maya pa, dumating ang kanyang kapatid na si Sam bitbit ang basahan. "Tutulungan na kita, Mia, para mas mabilis tayong matapos!" masayang alok ni Sam.

Nang matapos ang kanilang mga gawaing-bahay, naghanda ang kanilang ina ng masarap na meryenda. Masayang nagkwentuhan ang magkapatid habang nagpapahinga. Natutunan ni Mia na ang pagtutulungan at pagkukusa ay nagdudulot ng kagalakan at kapayapaan sa tahanan.`,
    gradeLevel: 4,
    questions: [
      {
        question: 'Anong araw ng linggo naganap ang kuwento ni Mia?',
        options: ['Lunes', 'Biyernes', 'Sabado', 'Linggo'],
        answer: 'Sabado',
      },
      {
        question: 'Ano ang unang ginawa ni Mia pagkagising sa umaga?',
        options: ['Nood ng telebisyon', 'Pinakain ang kanyang mga alagang hayop', 'Nagluto ng agahan', 'Naligo sa ilog'],
        answer: 'Pinakain ang kanyang mga alagang hayop',
      },
      {
        question: 'Sino ang tumulong kay Mia sa paglilinis ng kanilang bahay?',
        options: ['Ang kanyang kapatid na si Sam', 'Ang kanyang guro', 'Ang kanyang kapitbahay', 'Si Nanay lamang'],
        answer: 'Ang kanyang kapatid na si Sam',
      },
      {
        question: 'Anong kagamitan ang ginamit ni Sam upang tumulong sa paglilinis?',
        options: ['Walis tambo', 'Basahan', 'Pandakot', 'Mop'],
        answer: 'Basahan',
      },
      {
        question: 'Ano ang pangunahing aral na natutunan ni Mia sa kuwento?',
        options: ['Matulog buong Sabado', 'Ang pagtutulungan at pagkukusa ay nagdudulot ng kagalakan', 'Huwag pakainin ang alagang aso', 'Iasa ang lahat ng gawain sa kapatid'],
        answer: 'Ang pagtutulungan at pagkukusa ay nagdudulot ng kagalakan',
      },
      {
        question: 'Ano ang pangalan ng alagang aso ni Mia?',
        options: ['Lenny', 'Tagpi', 'Bantay', 'Brownie'],
        answer: 'Tagpi',
      },
      {
        question: 'Bakit nag-alok si Sam na tumulong kay Mia?',
        options: ['Para mapagalitan si Mia', 'Para mas mabilis silang matapos sa gawain', 'Dahil inutusan siya ng pulis', 'Wala siyang ibang magawa'],
        answer: 'Para mas mabilis silang matapos sa gawain',
      },
      {
        question: 'Ano ang inihanda ng ina pagkatapos nilang maglinis?',
        options: ['Mabibigat na trabaho', 'Masarap na meryenda', 'Mga bagong damit', 'Pagsusulit'],
        answer: 'Masarap na meryenda',
      },
      {
        question: 'Ano ang damdamin ni Mia nang gumising siya noong Sabado?',
        options: ['Malungkot', 'Galit', 'Masaya at masigla', 'Natatakot'],
        answer: 'Masaya at masigla',
      },
      {
        question: 'Anong uri ng teksto ang binasa?',
        options: ['Maikling kuwentong may aral', 'Balita sa diyaryo', 'Resipe sa pagluluto', 'Liham pangkalakal'],
        answer: 'Maikling kuwentong may aral',
      },
    ],
  },
];

async function seed() {
  await connectDB();
  console.log('Seeding ARAL Recommendations...');

  for (const rec of aralRecommendations) {
    const existing = await Recommendation.findOne({ title: rec.title });
    if (existing) {
      await Recommendation.updateOne({ _id: existing._id }, { $set: rec });
      console.log(`  Updated: ${rec.title}`);
    } else {
      await Recommendation.create(rec);
      console.log(`  Created: ${rec.title}`);
    }
  }

  console.log('\nSeeding ARAL Reading Passages for OMR & Reading Assessments...');
  for (const p of aralPassages) {
    const existing = await ReadingPassage.findOne({ title: p.title });
    if (existing) {
      await ReadingPassage.updateOne({ _id: existing._id }, { $set: p });
      console.log(`  Updated passage: ${p.title}`);
    } else {
      await ReadingPassage.create(p);
      console.log(`  Created passage: ${p.title}`);
    }
  }

  console.log('\nARAL Materials & Passages seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error seeding ARAL materials:', err);
  process.exit(1);
});

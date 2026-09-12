const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const User = require('../models/User');
const LearnerRecord = require('../models/LearnerRecord');
const Assessment = require('../models/Assessment');
const Intervention = require('../models/Intervention');
const Recommendation = require('../models/Recommendation');
const AnswerKey = require('../models/AnswerKey');
const ReadingPassage = require('../models/ReadingPassage');
const Question = require('../models/Question');

/** Date n weeks in the past (so charts have real weekly/monthly buckets). */
const weeksAgo = (weeks) =>
  new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

/** Mastery label from a percentage score. */
const masteryFromScore = (pct) => {
  if (pct >= 90) return 'Proficient';
  if (pct >= 75) return 'Approaching';
  if (pct >= 50) return 'Developing';
  return 'Beginning';
};

const seedDB = async () => {
  await connectDB();

  try {
    console.log('Clearing existing collections...');
    await User.deleteMany({});
    await LearnerRecord.deleteMany({});
    await Assessment.deleteMany({});
    await Intervention.deleteMany({});
    await Recommendation.deleteMany({});
    await AnswerKey.deleteMany({});
    await ReadingPassage.deleteMany({});
    await Question.deleteMany({});

    console.log('Hashing passwords...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    console.log('Creating users...');

    const principal = await User.create({
      username: 'principal1',
      password: hashedPassword,
      name: 'Principal Santos',
      role: 'principal',
    });

    const coordinator = await User.create({
      username: 'coordinator1',
      password: hashedPassword,
      name: 'ARAL Coordinator',
      role: 'coordinator',
    });

    const teacher = await User.create({
      username: 'teacher1',
      password: hashedPassword,
      name: 'Teacher Miguel',
      role: 'teacher',
      specialization: 'reading',
    });

    // Ability drives how well each student performs (0..1).
    const studentsData = [
      { username: 'student1', name: 'Juan dela Cruz', grade: 7, section: 'Rosal', risk: 'High Risk', mastery: 'Beginning', ability: 0.5, lrn: '102938' },
      { username: 'student2', name: 'Ana Reyes', grade: 7, section: 'Rosal', risk: 'Moderate Risk', mastery: 'Developing', ability: 0.65, lrn: '102939' },
      { username: 'student3', name: 'Carlos Mendoza', grade: 7, section: 'Rosal', risk: 'Low Risk', mastery: 'Proficient', ability: 0.82, lrn: '102940' },
      { username: 'student4', name: 'Elena Torres', grade: 8, section: 'Sampaguita', risk: 'High Risk', mastery: 'Beginning', ability: 0.48, lrn: '102941' },
      { username: 'student5', name: 'Sofia Bautista', grade: 8, section: 'Sampaguita', risk: 'Moderate Risk', mastery: 'Developing', ability: 0.62, lrn: '102942' },
      { username: 'student6', name: 'Jose Ramos', grade: 8, section: 'Sampaguita', risk: 'Low Risk', mastery: 'Approaching', ability: 0.78, lrn: '102943' },
      { username: 'student7', name: 'Maria Lopez', grade: 9, section: 'Ilang-Ilang', risk: 'Moderate Risk', mastery: 'Developing', ability: 0.66, lrn: '102944' },
      { username: 'student8', name: 'Pedro Santos', grade: 9, section: 'Ilang-Ilang', risk: 'Low Risk', mastery: 'Approaching', ability: 0.76, lrn: '102945' },
      { username: 'student9', name: 'Rosa Garcia', grade: 10, section: 'Ilang-Ilang', risk: 'Low Risk', mastery: 'Proficient', ability: 0.85, lrn: '102946' },
      { username: 'student10', name: 'Luis Cruz', grade: 10, section: 'Sampaguita', risk: 'Moderate Risk', mastery: 'Approaching', ability: 0.7, lrn: '102947' },
    ];

    const guardians = [
      'Gloria dela Cruz', 'Marites Reyes', 'Ramon Mendoza', 'Liza Torres',
      'Nestor Bautista', 'Carmen Ramos', 'Asis Lopez', 'Elena Santos',
      'Romeo Garcia', 'Fely Cruz',
    ];

    const records = [];
    const students = [];

    for (let i = 0; i < studentsData.length; i++) {
      const d = studentsData[i];
      const user = await User.create({
        username: d.username,
        password: hashedPassword,
        name: d.name,
        role: 'student',
      });
      students.push({ user, ...d });

      // 1. Learner Record
      records.push(
        await LearnerRecord.create({
          studentId: user._id,
          lrn: d.lrn,
          gradeLevel: d.grade,
          section: d.section,
          riskLevel: d.risk,
          masteryStatus: d.mastery,
          guardian: d.name.includes('Juan') ? 'Gloria dela Cruz' : guardians[i],
          contact: `09${100000000 + i * 111111}`.slice(0, 11),
          address: `Blk ${i + 1} St. ${d.section}, San Isidro`,
        })
      );
    }

    console.log('Creating Assessments...');

    const OMR_MATH = [
      { title: 'Number Sense Baseline', competency: 'Number Sense & Operations' },
      { title: 'Solving Linear Equations', competency: 'Solving Linear Equations' },
      { title: 'Fractions & Decimals', competency: 'Fractions & Decimals' },
      { title: 'Geometry Diagnostic', competency: 'Geometry & Measurement' },
    ];

    const FLUENCY = {
      title: 'Oral Reading Fluency',
      competency: 'Oral Reading Fluency',
    };

    // Comprehension is the Silent Reading (SRT) component of the reading
    // assessment — always subject 'Reading', never a science competency.
    const COMP_READ = [
      { title: 'Reading Comprehension', passageTitle: 'The Greedy Dog', competency: 'Reading Comprehension' },
      { title: 'Reading Comprehension', passageTitle: 'The Crow and the Pitcher', competency: 'Reading Comprehension' },
      { title: 'Reading Comprehension', passageTitle: 'The Ant and the Dove', competency: 'Reading Comprehension' },
    ];

    for (const s of students) {
      const a = s.ability;
      const jitter = () => (Math.random() - 0.5) * 8;

      // OMR Math assessments across ~10 weeks
      for (let k = 0; k < OMR_MATH.length; k++) {
        const pct = Math.round(Math.min(98, Math.max(25, a * 100 + jitter())));
        await Assessment.create({
          studentId: s.user._id,
          type: 'OMR',
          subject: 'Math',
          title: OMR_MATH[k].title,
          competency: OMR_MATH[k].competency,
          score: pct,
          masteryLevel: masteryFromScore(pct),
          date: weeksAgo(10 - k * 2),
        });
      }

      // READING_FLUENCY across ~9 weeks
      for (let k = 0; k < 3; k++) {
        const base = Math.round(a * 100); // ability-based accuracy
        await Assessment.create({
          studentId: s.user._id,
          type: 'READING_FLUENCY',
          subject: 'Reading',
          title: FLUENCY.title,
          competency: FLUENCY.competency,
          score: Math.round(Math.min(98, base + jitter())),
          wpm: Math.round(40 + a * 80 + (Math.random() - 0.5) * 20),
          accuracy: Math.round(Math.min(100, base + jitter())),
          pauses: Math.round(2 + (1 - a) * 8),
          durationSec: Math.round(60 + (1 - a) * 60),
          notes: a < 0.6 ? 'Needs decoding practice' : 'Good pace and expression',
          masteryLevel: a < 0.6 ? 'Frustration' : a < 0.75 ? 'Instructional' : 'Independent',
          date: weeksAgo(9 - k * 3),
        });
      }

      // COMPREHENSION (Reading · Silent Reading) across ~8 weeks, with subskills breakdown
      for (let k = 0; k < COMP_READ.length; k++) {
        const pct = Math.round(Math.min(98, Math.max(25, a * 100 + jitter())));
        await Assessment.create({
          studentId: s.user._id,
          type: 'COMPREHENSION',
          subject: 'Reading',
          title: COMP_READ[k].title,
          passageTitle: COMP_READ[k].passageTitle,
          competency: COMP_READ[k].competency,
          score: pct,
          masteryLevel: masteryFromScore(pct),
          subskills: [
            { name: 'Literal', status: pct >= 75 ? 'OK' : 'Needs Work', score: Math.round(pct + 5) },
            { name: 'Inference', status: pct >= 75 ? 'OK' : 'Needs Work', score: Math.round(pct - 10) },
            { name: 'Main Idea', status: pct >= 75 ? 'OK' : 'Needs Work', score: Math.round(pct) },
          ],
          date: weeksAgo(8 - k * 3),
        });
      }
    }

    console.log('Creating Interventions...');

    const interventionTemplates = [
      { title: 'Intensive Reading', category: 'Reading Intervention', type: 'Video' },
      { title: 'Basic Operation Drills', category: 'Numeracy', type: 'Activity' },
      { title: 'Phonics Reinforcement', category: 'Reading Intervention', type: 'Activity' },
      { title: 'Vocabulary Building', category: 'Reading Intervention', type: 'Module' },
      { title: 'Fractions Workshop', category: 'Numeracy', type: 'Activity' },
      { title: 'Guided Reading Sessions', category: 'Reading Intervention', type: 'Module' },
      { title: 'Cell Biology Module', category: 'Science', type: 'Module' },
      { title: 'Number Talks', category: 'Numeracy', type: 'Video' },
      { title: 'Comprehension Strategies', category: 'Reading Intervention', type: 'Video' },
      { title: 'Geometry Visuals', category: 'Science', type: 'Activity' },
    ];

    const statuses = ['Not Started', 'In Progress', 'Completed'];
    for (let i = 0; i < students.length; i++) {
      // Assign several interventions per student, cycling status.
      const count = 2 + (i % 3);
      for (let k = 0; k < count; k++) {
        const t = interventionTemplates[(i + k) % interventionTemplates.length];
        await Intervention.create({
          studentId: students[i].user._id,
          title: t.title,
          category: t.category,
          type: t.type,
          status: statuses[(i + k) % statuses.length],
          assignedDate: weeksAgo(students[i].risk === 'High Risk' ? 8 - k : 6 - k),
        });
      }
    }

    console.log('Creating Recommendations...');

    const recommendations = [
      { title: 'Decodable Readers Series', kind: 'Video', subject: 'Reading', description: 'Structured phonics videos with leveled decodable readers.', depedCode: 'EN7LT-Ia-1', source: 'DepEd Grade 7 English LM', meta: { lessons: 8, duration: '15 min' } },
      { title: 'Multiplication Mastery', kind: 'Quiz', subject: 'Math', description: 'Interactive timed quizzes on times tables.', depedCode: 'M7NS-Ia-1', source: 'DepEd Grade 7 Math LM', meta: { items: 20 } },
      { title: 'Fraction Manipulatives', kind: 'Activity', subject: 'Math', description: 'Hands-on fraction tiles and visual exercises.', depedCode: 'M7NS-If-1', source: 'DepEd Grade 7 Math LM', meta: { duration: '30 min' } },
      { title: 'Comprehension Toolkit', kind: 'Module', subject: 'Reading', description: 'Self-paced module on main idea and inference.', depedCode: 'EN8RC-Ib-7.2', source: 'DepEd Grade 8 English LM', meta: { lessons: 6, duration: '20 min' } },
      { title: 'Linear Equations Drill', kind: 'Activity', subject: 'Math', description: 'Guided practice on solving linear equations.', depedCode: 'M8AL-Ie-1', source: 'DepEd Grade 8 Math LM', meta: { duration: '25 min' } },
      { title: 'Cell Structure Explainer', kind: 'Video', subject: 'Science', description: 'Visual walkthrough of plant and animal cells.', depedCode: 'S7LT-IIe-5', source: 'DepEd Grade 7 Science LM', meta: { duration: '12 min' } },
      { title: 'Vocabulary Builder', kind: 'Module', subject: 'Reading', description: 'Context-based vocabulary with grade-level texts.', depedCode: 'EN8V-Ia-10.2', source: 'DepEd Grade 8 English LM', meta: { lessons: 5, duration: '18 min' } },
      { title: 'Force & Motion Lab', kind: 'Activity', subject: 'Science', description: 'Simple experiments illustrating force and motion.', depedCode: 'S7FE-IIIb-1', source: 'DepEd Grade 7 Science LM', meta: { duration: '40 min' } },
      { title: 'Number Talks', kind: 'Video', subject: 'Math', description: 'Short mental-math strategy videos.', depedCode: 'M7NS-IIa-1', source: 'DepEd Grade 7 Math LM', meta: { duration: '10 min' } },
    ];
    await Recommendation.insertMany(recommendations);

    console.log('Creating Answer Keys...');

    const answerKeys = [
      { title: 'Number Sense Baseline', subject: 'Math', items: 20, answers: ['A','C','B','D','A','B','C','D','A','B','C','A','D','B','C','A','D','B','C','A'] },
      { title: 'Quarterly Diagnostic', subject: 'Science', items: 20, answers: ['B','A','D','C','B','D','A','C','B','A','C','D','A','B','A','D','C','B','D','C'] },
      { title: 'Geometry Diagnostic', subject: 'Math', items: 15, answers: ['C','D','A','B','C','A','D','B','C','D','A','C','B','A','D'] },
    ];
    await AnswerKey.insertMany(answerKeys);

    console.log('Creating Question Bank...');

    const questionBank = [
      // ── Math · Number Sense & Operations (M7NS) ──
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Number Sets', difficulty: 'easy', prompt: 'Which of the following is NOT an integer?', choices: ['-2', '0', '1.5', '9'], correctAnswer: 'C', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ib-1', competency: 'Number Sense & Operations', topic: 'Integers', difficulty: 'easy', prompt: 'What is the sum of (-8) and 5?', choices: ['-13', '-3', '3', '13'], correctAnswer: 'B', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ic-1', competency: 'Number Sense & Operations', topic: 'Absolute Value', difficulty: 'easy', prompt: 'What is the value of |−7|?', choices: ['-7', '0', '7', '14'], correctAnswer: 'C', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ie-1', competency: 'Number Sense & Operations', topic: 'Integer Operations', difficulty: 'mid', prompt: 'What is (−4) × (−6)?', choices: ['-24', '-10', '10', '24'], correctAnswer: 'D', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ie-1', competency: 'Number Sense & Operations', topic: 'Integer Operations', difficulty: 'mid', prompt: 'Evaluate: 15 ÷ (−3)', choices: ['-5', '-3', '3', '5'], correctAnswer: 'A', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-If-1', competency: 'Fractions & Decimals', topic: 'Fractions', difficulty: 'easy', prompt: 'Which fraction is equivalent to 0.5?', choices: ['1/4', '1/2', '2/3', '3/4'], correctAnswer: 'B', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-If-1', competency: 'Fractions & Decimals', topic: 'Fractions', difficulty: 'mid', prompt: 'What is 1/3 + 1/6?', choices: ['1/9', '1/2', '2/9', '3/6'], correctAnswer: 'B', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ih-1', competency: 'Fractions & Decimals', topic: 'Decimals & Percent', difficulty: 'mid', prompt: 'Write 0.25 as a percent.', choices: ['0.25%', '2.5%', '25%', '250%'], correctAnswer: 'C', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ih-1', competency: 'Fractions & Decimals', topic: 'Decimals & Percent', difficulty: 'hard', prompt: 'What is 40% of 150?', choices: ['40', '55', '60', '75'], correctAnswer: 'C', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIa-2', competency: 'Number Sense & Operations', topic: 'Rational Numbers', difficulty: 'mid', prompt: 'Which of the following is a rational number?', choices: ['√2', 'π', '0.75', '√3'], correctAnswer: 'C', source: 'DepEd Grade 7 Math LM' },
      // ── Math · Algebra (M7NS-II, M8AL) ──
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIc-1', competency: 'Algebraic Expressions', topic: 'Evaluation', difficulty: 'mid', prompt: 'Evaluate 3x − 2 when x = 4.', choices: ['7', '10', '12', '14'], correctAnswer: 'B', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ia-1', competency: 'Algebra', topic: 'Factoring', difficulty: 'hard', prompt: 'Factor x² − 9.', choices: ['(x − 3)(x + 3)', '(x − 3)(x − 3)', '(x + 9)(x − 1)', 'x(x − 9)'], correctAnswer: 'A', source: 'DepEd Grade 8 Math LM' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ie-1', competency: 'Solving Linear Equations', topic: 'Linear Equations', difficulty: 'easy', prompt: 'Solve for x: 2x + 3 = 11.', choices: ['x = 3', 'x = 4', 'x = 5', 'x = 7'], correctAnswer: 'B', source: 'DepEd Grade 8 Math LM' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ie-1', competency: 'Solving Linear Equations', topic: 'Linear Equations', difficulty: 'mid', prompt: 'Solve for x: 3(x − 2) = 9.', choices: ['x = 3', 'x = 4', 'x = 5', 'x = 7'], correctAnswer: 'C', source: 'DepEd Grade 8 Math LM' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ie-1', competency: 'Solving Linear Equations', topic: 'Linear Equations', difficulty: 'mid', prompt: 'Which equation represents "a number decreased by 4 is 12"?', choices: ['n + 4 = 12', 'n − 4 = 12', '4n = 12', 'n / 4 = 12'], correctAnswer: 'B', source: 'DepEd Grade 8 Math LM' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ie-1', competency: 'Quadratic Equations', topic: 'Quadratics', difficulty: 'hard', prompt: 'Solve for x: x² = 49.', choices: ['x = 7 only', 'x = ±7', 'x = 49', 'x = ±49'], correctAnswer: 'B', source: 'DepEd Grade 9 Math LM' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-2', competency: 'Sequences', topic: 'Number Patterns', difficulty: 'easy', prompt: 'What is the next term in the sequence 2, 4, 8, 16, …?', choices: ['20', '24', '32', '64'], correctAnswer: 'C', source: 'DepEd Grade 10 Math LM' },
      // ── Math · Geometry & Measurement (M7GE, M8GE, M9GE) ──
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIa-1', competency: 'Geometry & Measurement', topic: 'Basics', difficulty: 'easy', prompt: 'Which of the following is an undefined term in geometry?', choices: ['Angle', 'Triangle', 'Point', 'Square'], correctAnswer: 'C', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIb-1', competency: 'Geometry & Measurement', topic: 'Angles', difficulty: 'easy', prompt: 'What is the measure of a right angle?', choices: ['45°', '90°', '180°', '270°'], correctAnswer: 'B', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIc-1', competency: 'Geometry & Measurement', topic: 'Angle Pairs', difficulty: 'mid', prompt: 'Two angles are supplementary when their measures add up to:', choices: ['45°', '90°', '180°', '360°'], correctAnswer: 'C', source: 'DepEd Grade 7 Math LM' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVb-1', competency: 'Geometry & Measurement', topic: 'Quadrilaterals', difficulty: 'mid', prompt: 'Which quadrilateral has all four sides equal in length?', choices: ['Trapezoid', 'Rectangle', 'Rhombus', 'Parallelogram'], correctAnswer: 'C', source: 'DepEd Grade 8 Math LM' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Iva-1', competency: 'Geometry & Measurement', topic: 'Triangles', difficulty: 'easy', prompt: 'The sum of the interior angles of any triangle is:', choices: ['90°', '120°', '180°', '360°'], correctAnswer: 'C', source: 'DepEd Grade 9 Math LM' },
      // ── Science · Life Science (S7LT, S9LT) ──
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIe-5', competency: 'Life Science', topic: 'Cells', difficulty: 'easy', prompt: 'Which organelle produces energy (ATP) for the cell?', choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Vacuole'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIe-5', competency: 'Life Science', topic: 'Cells', difficulty: 'easy', prompt: 'The basic unit of structure and function of all living things is the:', choices: ['Tissue', 'Organ', 'Cell', 'System'], correctAnswer: 'C', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIf-6', competency: 'Life Science', topic: 'Cells', difficulty: 'mid', prompt: 'Which structure controls the activities of the cell?', choices: ['Cell wall', 'Cytoplasm', 'Nucleus', 'Cell membrane'], correctAnswer: 'C', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIe-5', competency: 'Life Science', topic: 'Cells', difficulty: 'mid', prompt: 'Which organelle is found ONLY in plant cells?', choices: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Ribosome'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ib-14', competency: 'Life Science', topic: 'Photosynthesis', difficulty: 'hard', prompt: 'Photosynthesis primarily takes place in the:', choices: ['Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome'], correctAnswer: 'C', source: 'DepEd Grade 9 Science LM' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIIc-33', competency: 'Life Science', topic: 'Biomolecules', difficulty: 'mid', prompt: 'The building blocks of proteins are called:', choices: ['Nucleotides', 'Amino acids', 'Fatty acids', 'Monosaccharides'], correctAnswer: 'B', source: 'DepEd Grade 10 Science LM' },
      // ── Science · Matter / Physical Science (S7MT, S8MT) ──
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-Ia-1', competency: 'Physical Science', topic: 'Matter', difficulty: 'easy', prompt: 'Which of the following is a pure substance?', choices: ['Saltwater', 'Distilled water', 'Orange juice', 'Muddy water'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-Ia-1', competency: 'Physical Science', topic: 'Matter', difficulty: 'easy', prompt: 'Which example is a mixture?', choices: ['Iron', 'Oxygen', 'Saltwater', 'Distilled water'], correctAnswer: 'C', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-Ib-1', competency: 'Physical Science', topic: 'Mixtures', difficulty: 'mid', prompt: 'A mixture that looks the same throughout is called:', choices: ['Heterogeneous', 'Homogeneous', 'Suspension', 'Colloid'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-Ig-h-5', competency: 'Physical Science', topic: 'Solutions', difficulty: 'hard', prompt: 'In a salt solution, salt is the:', choices: ['Solvent', 'Solute', 'Suspension', 'Precipitate'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIIb-c-3', competency: 'Physical Science', topic: 'Atoms', difficulty: 'easy', prompt: 'The smallest unit of an element that retains its properties is the:', choices: ['Molecule', 'Atom', 'Compound', 'Ion'], correctAnswer: 'B', source: 'DepEd Grade 8 Science LM' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIId-e-3', competency: 'Physical Science', topic: 'Periodic Table', difficulty: 'mid', prompt: 'How many protons does a neutral atom with atomic number 8 have?', choices: ['4', '8', '12', '16'], correctAnswer: 'B', source: 'DepEd Grade 8 Science LM' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-Ia-b-21', competency: 'Physical Science', topic: 'Acids & Bases', difficulty: 'mid', prompt: 'The pH scale measures the:', choices: ['Temperature of a solution', 'Concentration of hydrogen ions', 'Density of a liquid', 'Mass of a solute'], correctAnswer: 'B', source: 'DepEd Grade 10 Science LM' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIa-15', competency: 'Physical Science', topic: 'Electromagnetic Waves', difficulty: 'hard', prompt: 'Which electromagnetic wave has the HIGHEST frequency?', choices: ['Radio waves', 'Microwaves', 'X-rays', 'Gamma rays'], correctAnswer: 'D', source: 'DepEd Grade 10 Science LM' },
      // ── Science · Force & Motion (S7FE, S8FE, S9FE) ──
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIa-1', competency: 'Physical Science', topic: 'Force & Motion', difficulty: 'easy', prompt: 'What is the SI unit of force?', choices: ['Joule', 'Newton', 'Watt', 'Pascal'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIb-1', competency: 'Physical Science', topic: 'Force & Motion', difficulty: 'easy', prompt: 'Speed is defined as:', choices: ['Distance ÷ time', 'Distance × time', 'Time ÷ distance', 'Force ÷ mass'], correctAnswer: 'A', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIb-2', competency: 'Physical Science', topic: 'Force & Motion', difficulty: 'mid', prompt: 'Velocity describes both speed and:', choices: ['Mass', 'Direction', 'Temperature', 'Friction'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIc-1', competency: 'Physical Science', topic: 'Gravity', difficulty: 'easy', prompt: 'Which force pulls objects toward the center of the Earth?', choices: ['Friction', 'Magnetism', 'Gravity', 'Tension'], correctAnswer: 'C', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIId-3', competency: 'Physical Science', topic: 'Friction', difficulty: 'easy', prompt: 'Friction is a force that:', choices: ['Speeds objects up', 'Opposes the motion of an object', 'Lifts objects upward', 'Changes mass of an object'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIId-3', competency: 'Physical Science', topic: 'Friction', difficulty: 'mid', prompt: 'Which surface would produce the MOST friction with a sliding box?', choices: ['Ice', 'Rough concrete', 'Glass', 'Wet tiles'], correctAnswer: 'B', source: 'DepEd Grade 7 Science LM' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-Ia-16', competency: 'Physical Science', topic: "Newton's Laws", difficulty: 'mid', prompt: "Newton's First Law of Motion is also known as the law of:", choices: ['Acceleration', 'Action–reaction', 'Inertia', 'Universal gravitation'], correctAnswer: 'C', source: 'DepEd Grade 8 Science LM' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-Ia-16', competency: 'Physical Science', topic: "Newton's Laws", difficulty: 'mid', prompt: "Newton's Second Law relates force, mass, and:", choices: ['Acceleration', 'Velocity', 'Weight', 'Momentum'], correctAnswer: 'A', source: 'DepEd Grade 8 Science LM' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ia-1', competency: 'Physical Science', topic: 'Work & Energy', difficulty: 'mid', prompt: 'What is the SI unit of work?', choices: ['Newton', 'Watt', 'Joule', 'Pascal'], correctAnswer: 'C', source: 'DepEd Grade 9 Science LM' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ic-3', competency: 'Physical Science', topic: 'Energy', difficulty: 'mid', prompt: 'Which type of energy does a moving car possess?', choices: ['Potential', 'Chemical', 'Kinetic', 'Nuclear'], correctAnswer: 'C', source: 'DepEd Grade 9 Science LM' },
    ];
    // ── EXPANDED QUESTION BANK (60 per subject+grade for 50-item exam support) ──
    const expandedBank = [
      // ── MATH GRADE 7 ── (need ~49 more; have 11)
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Number Sets', difficulty: 'easy', prompt: 'Which set contains only whole numbers?', choices: ['-1, 0, 1', '0, 1, 2', '½, ⅓, ¼', '1.5, 2.5, 3.5'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ib-1', competency: 'Number Sense & Operations', topic: 'Integers', difficulty: 'easy', prompt: 'What is the opposite of −9?', choices: ['-9', '0', '9', '81'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ic-1', competency: 'Number Sense & Operations', topic: 'Absolute Value', difficulty: 'mid', prompt: 'What is |−12| + |3|?', choices: ['-9', '9', '15', '-15'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ie-1', competency: 'Number Sense & Operations', topic: 'Integer Operations', difficulty: 'easy', prompt: 'What is 7 + (−3)?', choices: ['-10', '-4', '4', '10'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ie-1', competency: 'Number Sense & Operations', topic: 'Integer Operations', difficulty: 'mid', prompt: 'What is (−5) − (−8)?', choices: ['-13', '-3', '3', '13'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ie-1', competency: 'Number Sense & Operations', topic: 'Integer Operations', difficulty: 'hard', prompt: 'What is (−3) × 4 × (−2)?', choices: ['-24', '-12', '12', '24'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-If-1', competency: 'Fractions & Decimals', topic: 'Fractions', difficulty: 'easy', prompt: 'What is 1/4 + 1/4?', choices: ['1/8', '2/8', '1/2', '2/4'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-If-1', competency: 'Fractions & Decimals', topic: 'Fractions', difficulty: 'mid', prompt: 'What is 3/4 − 1/2?', choices: ['1/4', '2/2', '1/8', '2/6'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-If-1', competency: 'Fractions & Decimals', topic: 'Fractions', difficulty: 'hard', prompt: 'What is 2/3 × 3/4?', choices: ['5/12', '6/12', '1/2', '6/7'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ih-1', competency: 'Fractions & Decimals', topic: 'Decimals & Percent', difficulty: 'easy', prompt: 'Convert 0.75 to a fraction.', choices: ['7/10', '3/4', '75/1000', '1/4'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ih-1', competency: 'Fractions & Decimals', topic: 'Decimals & Percent', difficulty: 'mid', prompt: 'What is 15% of 200?', choices: ['15', '25', '30', '35'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ih-1', competency: 'Fractions & Decimals', topic: 'Decimals & Percent', difficulty: 'hard', prompt: 'A shirt costs ₱450 and is 20% off. What is the sale price?', choices: ['₱350', '₱360', '₱375', '₱400'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIa-2', competency: 'Number Sense & Operations', topic: 'Rational Numbers', difficulty: 'mid', prompt: 'Which of these is between 1/3 and 1/2?', choices: ['1/4', '2/5', '3/8', '1/6'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIa-2', competency: 'Number Sense & Operations', topic: 'Rational Numbers', difficulty: 'hard', prompt: 'Order from least to greatest: 0.6, 2/3, 0.65', choices: ['0.6, 0.65, 2/3', '0.65, 0.6, 2/3', '2/3, 0.65, 0.6', '0.6, 2/3, 0.65'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIc-1', competency: 'Algebraic Expressions', topic: 'Evaluation', difficulty: 'easy', prompt: 'If x = 3, what is x + 5?', choices: ['7', '8', '9', '15'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIc-1', competency: 'Algebraic Expressions', topic: 'Evaluation', difficulty: 'hard', prompt: 'Evaluate 2a + 3b when a = 4 and b = −2.', choices: ['2', '6', '14', '-2'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIa-1', competency: 'Geometry & Measurement', topic: 'Basics', difficulty: 'easy', prompt: 'How many sides does a hexagon have?', choices: ['5', '6', '7', '8'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIa-1', competency: 'Geometry & Measurement', topic: 'Basics', difficulty: 'mid', prompt: 'A line segment has:', choices: ['No endpoints', 'One endpoint', 'Two endpoints', 'Infinite endpoints'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIb-1', competency: 'Geometry & Measurement', topic: 'Angles', difficulty: 'mid', prompt: 'What type of angle measures exactly 180°?', choices: ['Acute', 'Right', 'Obtuse', 'Straight'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIb-1', competency: 'Geometry & Measurement', topic: 'Angles', difficulty: 'hard', prompt: 'If two angles are complementary and one measures 35°, what is the other?', choices: ['45°', '55°', '145°', '125°'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIc-1', competency: 'Geometry & Measurement', topic: 'Angle Pairs', difficulty: 'easy', prompt: 'Two angles that add up to 90° are called:', choices: ['Supplementary', 'Complementary', 'Vertical', 'Adjacent'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIId-1', competency: 'Geometry & Measurement', topic: 'Perimeter & Area', difficulty: 'easy', prompt: 'What is the perimeter of a rectangle with length 8 cm and width 3 cm?', choices: ['11 cm', '22 cm', '24 cm', '26 cm'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIId-1', competency: 'Geometry & Measurement', topic: 'Perimeter & Area', difficulty: 'mid', prompt: 'What is the area of a triangle with base 10 cm and height 5 cm?', choices: ['15 cm²', '25 cm²', '50 cm²', '100 cm²'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIId-1', competency: 'Geometry & Measurement', topic: 'Perimeter & Area', difficulty: 'hard', prompt: 'A square has a perimeter of 36 cm. What is its area?', choices: ['81 cm²', '36 cm²', '72 cm²', '144 cm²'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIe-1', competency: 'Statistics & Probability', topic: 'Data', difficulty: 'easy', prompt: 'The middle value of an ordered data set is the:', choices: ['Mean', 'Median', 'Mode', 'Range'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIe-1', competency: 'Statistics & Probability', topic: 'Data', difficulty: 'mid', prompt: 'Find the mode: 4, 7, 2, 7, 9, 7, 3', choices: ['2', '4', '7', '9'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIe-1', competency: 'Statistics & Probability', topic: 'Data', difficulty: 'hard', prompt: 'The mean of 5, 8, 12, x is 10. What is x?', choices: ['10', '12', '14', '15'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIf-1', competency: 'Statistics & Probability', topic: 'Probability', difficulty: 'easy', prompt: 'What is the probability of getting heads when flipping a fair coin?', choices: ['0', '¼', '½', '1'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIf-1', competency: 'Statistics & Probability', topic: 'Probability', difficulty: 'mid', prompt: 'A die is rolled once. What is the probability of getting a number greater than 4?', choices: ['1/6', '1/3', '1/2', '2/3'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Number Sets', difficulty: 'mid', prompt: 'Which number is an irrational number?', choices: ['0.5', '√4', '√3', '22/7'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ib-1', competency: 'Number Sense & Operations', topic: 'Integers', difficulty: 'hard', prompt: 'On a number line, which integer is farthest from −3?', choices: ['-5', '0', '2', '4'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ie-1', competency: 'Number Sense & Operations', topic: 'Integer Operations', difficulty: 'easy', prompt: 'What is 10 − 15?', choices: ['-5', '5', '25', '-25'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-If-1', competency: 'Fractions & Decimals', topic: 'Fractions', difficulty: 'easy', prompt: 'Which is the largest: 1/2, 1/3, or 1/4?', choices: ['1/4', '1/3', '1/2', 'They are equal'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-If-1', competency: 'Fractions & Decimals', topic: 'Fractions', difficulty: 'hard', prompt: 'What is 5/6 ÷ 1/2?', choices: ['5/12', '5/3', '5/6', '2/5'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIa-1', competency: 'Geometry & Measurement', topic: 'Basics', difficulty: 'hard', prompt: 'How many diagonals does a pentagon have?', choices: ['3', '4', '5', '6'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIc-1', competency: 'Algebraic Expressions', topic: 'Simplifying', difficulty: 'mid', prompt: 'Simplify: 4x + 3x', choices: ['7x', '12x', '7x²', 'x'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIc-1', competency: 'Algebraic Expressions', topic: 'Simplifying', difficulty: 'mid', prompt: 'Simplify: 5(2y − 1)', choices: ['10y − 1', '10y − 5', '7y − 5', '10y + 5'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIc-1', competency: 'Algebraic Expressions', topic: 'Translating', difficulty: 'hard', prompt: 'Translate "the sum of a number and 8, doubled" into an expression:', choices: ['2n + 8', '2(n + 8)', 'n + 16', '2n × 8'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIb-1', competency: 'Geometry & Measurement', topic: 'Angles', difficulty: 'easy', prompt: 'An angle that measures less than 90° is called:', choices: ['Obtuse', 'Acute', 'Right', 'Straight'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7GE-IIIc-1', competency: 'Geometry & Measurement', topic: 'Angle Pairs', difficulty: 'hard', prompt: 'Vertical angles are always:', choices: ['Complementary', 'Supplementary', 'Equal', 'Adjacent'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Estimation', difficulty: 'easy', prompt: 'Estimate the sum: 49 + 36 ≈', choices: ['75', '80', '85', '90'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 7, competencyCode: 'M7NS-IIe-1', competency: 'Statistics & Probability', topic: 'Data', difficulty: 'easy', prompt: 'The range of {3, 7, 1, 9, 5} is:', choices: ['5', '6', '8', '9'], correctAnswer: 'C' },

      // ── MATH GRADE 8 ── (need ~46 more; have 4)
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ia-1', competency: 'Algebra', topic: 'Polynomials', difficulty: 'easy', prompt: 'Which of the following is a monomial?', choices: ['x + 1', '3x²', '2x + 3y', 'x² − 1'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ia-1', competency: 'Algebra', topic: 'Polynomials', difficulty: 'mid', prompt: 'What is the degree of 4x³ − 2x + 7?', choices: ['1', '2', '3', '4'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ia-1', competency: 'Algebra', topic: 'Factoring', difficulty: 'mid', prompt: 'Factor: x² + 5x + 6', choices: ['(x + 2)(x + 3)', '(x + 1)(x + 6)', '(x − 2)(x − 3)', '(x + 5)(x + 1)'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ia-1', competency: 'Algebra', topic: 'Factoring', difficulty: 'hard', prompt: 'Factor: 2x² − 8', choices: ['2(x² − 4)', '2(x − 2)(x + 2)', '2(x − 4)(x + 4)', 'Both A and B'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ib-1', competency: 'Algebra', topic: 'Exponents', difficulty: 'easy', prompt: 'What is x³ × x²?', choices: ['x⁵', 'x⁶', 'x⁹', '2x⁵'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ib-1', competency: 'Algebra', topic: 'Exponents', difficulty: 'mid', prompt: 'What is (2³)²?', choices: ['2⁵', '2⁶', '2⁸', '4⁶'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ib-1', competency: 'Algebra', topic: 'Exponents', difficulty: 'hard', prompt: 'Simplify: (3x²y)³', choices: ['9x⁶y³', '27x⁶y³', '27x⁵y³', '3x⁶y³'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ic-1', competency: 'Algebra', topic: 'Scientific Notation', difficulty: 'easy', prompt: 'Write 5,000 in scientific notation.', choices: ['5 × 10²', '5 × 10³', '50 × 10²', '0.5 × 10⁴'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ic-1', competency: 'Algebra', topic: 'Scientific Notation', difficulty: 'mid', prompt: 'What is (3 × 10⁴)(2 × 10³)?', choices: ['5 × 10⁷', '6 × 10⁷', '6 × 10¹²', '5 × 10¹²'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ie-1', competency: 'Solving Linear Equations', topic: 'Linear Equations', difficulty: 'hard', prompt: 'Solve: (x/2) + 3 = 7', choices: ['x = 4', 'x = 6', 'x = 8', 'x = 10'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ie-1', competency: 'Solving Linear Equations', topic: 'Linear Equations', difficulty: 'easy', prompt: 'Solve for x: x − 5 = 12', choices: ['x = 5', 'x = 7', 'x = 17', 'x = 60'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-If-1', competency: 'Solving Linear Equations', topic: 'Systems of Equations', difficulty: 'mid', prompt: 'Solve: y = 2x and x + y = 9. What is x?', choices: ['2', '3', '4', '6'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-If-1', competency: 'Solving Linear Equations', topic: 'Systems of Equations', difficulty: 'hard', prompt: 'Solve: 2x + y = 10 and x − y = 2. What is x?', choices: ['2', '3', '4', '6'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ig-1', competency: 'Functions', topic: 'Linear Functions', difficulty: 'easy', prompt: 'In y = 2x + 1, what is the slope?', choices: ['1', '2', '3', '2x'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ig-1', competency: 'Functions', topic: 'Linear Functions', difficulty: 'mid', prompt: 'What is the y-intercept of y = −3x + 7?', choices: ['-3', '3', '7', '-7'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ig-1', competency: 'Functions', topic: 'Linear Functions', difficulty: 'hard', prompt: 'A line passes through (2, 5) and (4, 9). What is the slope?', choices: ['1', '2', '3', '4'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVa-1', competency: 'Geometry & Measurement', topic: 'Transformations', difficulty: 'easy', prompt: 'A reflection creates a:', choices: ['Similar figure', 'Larger figure', 'Mirror image', 'Rotated figure'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVa-1', competency: 'Geometry & Measurement', topic: 'Transformations', difficulty: 'mid', prompt: 'Which transformation changes the size of a figure?', choices: ['Translation', 'Reflection', 'Rotation', 'Dilation'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVb-1', competency: 'Geometry & Measurement', topic: 'Quadrilaterals', difficulty: 'easy', prompt: 'A rectangle has how many lines of symmetry?', choices: ['0', '1', '2', '4'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVb-1', competency: 'Geometry & Measurement', topic: 'Quadrilaterals', difficulty: 'hard', prompt: 'Which quadrilateral has opposite sides parallel and equal, but no right angles?', choices: ['Rectangle', 'Square', 'Rhombus', 'Trapezoid'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-Va-1', competency: 'Geometry & Measurement', topic: 'Pythagorean Theorem', difficulty: 'easy', prompt: 'In a right triangle with legs 3 and 4, what is the hypotenuse?', choices: ['5', '6', '7', '12'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-Va-1', competency: 'Geometry & Measurement', topic: 'Pythagorean Theorem', difficulty: 'mid', prompt: 'A right triangle has a hypotenuse of 13 and one leg of 5. What is the other leg?', choices: ['8', '10', '11', '12'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-Va-1', competency: 'Geometry & Measurement', topic: 'Pythagorean Theorem', difficulty: 'hard', prompt: 'Is a triangle with sides 7, 24, 25 a right triangle?', choices: ['Yes', 'No', 'Cannot be determined', 'Only if isosceles'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ih-1', competency: 'Algebra', topic: 'Inequalities', difficulty: 'easy', prompt: 'Solve: x + 3 > 7', choices: ['x > 3', 'x > 4', 'x > 10', 'x < 4'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ih-1', competency: 'Algebra', topic: 'Inequalities', difficulty: 'mid', prompt: 'Solve: −2x ≤ 8', choices: ['x ≤ −4', 'x ≥ −4', 'x ≤ 4', 'x ≥ 4'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ii-1', competency: 'Algebra', topic: 'Rational Expressions', difficulty: 'mid', prompt: 'Simplify: (x² − 9)/(x + 3)', choices: ['x − 3', 'x + 3', 'x² − 3', 'x + 9'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ii-1', competency: 'Algebra', topic: 'Rational Expressions', difficulty: 'hard', prompt: 'What is the domain of f(x) = 1/(x − 2)?', choices: ['All real numbers', 'x ≠ 0', 'x ≠ 2', 'x > 2'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Real Numbers', difficulty: 'easy', prompt: '√49 equals:', choices: ['6', '7', '8', '49'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Real Numbers', difficulty: 'mid', prompt: 'Between which two consecutive integers does √20 lie?', choices: ['4 and 5', '5 and 6', '6 and 7', '3 and 4'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Real Numbers', difficulty: 'hard', prompt: 'Simplify √72.', choices: ['6√2', '8√2', '3√8', '4√3'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVc-1', competency: 'Geometry & Measurement', topic: 'Surface Area & Volume', difficulty: 'easy', prompt: 'What is the volume of a cube with side 3 cm?', choices: ['9 cm³', '18 cm³', '27 cm³', '81 cm³'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVc-1', competency: 'Geometry & Measurement', topic: 'Surface Area & Volume', difficulty: 'mid', prompt: 'What is the volume of a cylinder with radius 3 and height 5? (Use π ≈ 3.14)', choices: ['47.1', '94.2', '141.3', '28.26'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8GE-IVc-1', competency: 'Geometry & Measurement', topic: 'Surface Area & Volume', difficulty: 'hard', prompt: 'A rectangular prism has dimensions 2 × 3 × 4. What is its surface area?', choices: ['24', '48', '52', '56'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ig-1', competency: 'Functions', topic: 'Linear Functions', difficulty: 'easy', prompt: 'If f(x) = 3x − 2, what is f(4)?', choices: ['10', '12', '14', '16'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ia-1', competency: 'Algebra', topic: 'Polynomials', difficulty: 'easy', prompt: 'What is (x + 3)(x + 2)?', choices: ['x² + 5x + 6', 'x² + 6x + 5', 'x² + 5x + 5', 'x² + 6x + 6'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8AL-Ia-1', competency: 'Algebra', topic: 'Factoring', difficulty: 'easy', prompt: 'Factor x² − 4.', choices: ['(x − 2)(x − 2)', '(x + 2)(x − 2)', '(x + 4)(x − 1)', '(x − 4)(x + 1)'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8NS-IIa-1', competency: 'Number Sense & Operations', topic: 'Square Roots', difficulty: 'mid', prompt: 'Which is irrational: √16, √25, √50, √81?', choices: ['√16', '√25', '√50', '√81'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 8, competencyCode: 'M8NS-IIa-1', competency: 'Number Sense & Operations', topic: 'Square Roots', difficulty: 'hard', prompt: 'Simplify: √(18/2)', choices: ['3', '√3', '9', '3√2'], correctAnswer: 'A' },

      // ── MATH GRADE 9 ── (need ~51 more; have 2)
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ia-1', competency: 'Algebra', topic: 'Polynomials', difficulty: 'easy', prompt: 'What is the degree of 5x⁴ + 2x − 1?', choices: ['1', '2', '4', '5'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ia-1', competency: 'Algebra', topic: 'Polynomials', difficulty: 'mid', prompt: 'Add: (3x² + 2x − 1) + (x² − 4x + 5)', choices: ['4x² − 2x + 4', '4x² + 2x + 4', '2x² − 2x + 4', '4x² − 6x + 4'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ib-1', competency: 'Algebra', topic: 'Rational Expressions', difficulty: 'mid', prompt: 'Simplify: (x² − 4)/(x − 2)', choices: ['x + 2', 'x − 2', 'x² + 2', 'x − 4'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ib-1', competency: 'Algebra', topic: 'Rational Expressions', difficulty: 'hard', prompt: 'What is (1/x) + (1/y) simplified?', choices: ['2/(x+y)', '(x+y)/xy', '(x+y)/(x²y²)', '1/xy'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ic-1', competency: 'Algebra', topic: 'Radical Expressions', difficulty: 'easy', prompt: 'Simplify √12.', choices: ['2√3', '3√2', '4√3', '6√2'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ic-1', competency: 'Algebra', topic: 'Radical Expressions', difficulty: 'mid', prompt: 'Simplify: √50 + √18', choices: ['√68', '7√2', '8√2', '5√2 + 3√2'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ic-1', competency: 'Algebra', topic: 'Radical Expressions', difficulty: 'hard', prompt: 'Rationalize: 1/(√3 − 1)', choices: ['(√3 + 1)/2', '(√3 − 1)/2', '√3 + 1', '2/(√3 + 1)'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Id-1', competency: 'Algebra', topic: 'Logarithms', difficulty: 'easy', prompt: 'What is log₂(8)?', choices: ['2', '3', '4', '8'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Id-1', competency: 'Algebra', topic: 'Logarithms', difficulty: 'mid', prompt: 'What is log₁₀(1000)?', choices: ['1', '2', '3', '10'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ie-1', competency: 'Quadratic Equations', topic: 'Quadratics', difficulty: 'easy', prompt: 'What are the roots of x² − 5x + 6 = 0?', choices: ['x = 1 and x = 6', 'x = 2 and x = 3', 'x = −2 and x = −3', 'x = −1 and x = −6'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ie-1', competency: 'Quadratic Equations', topic: 'Quadratics', difficulty: 'mid', prompt: 'How many real roots does x² + 4 = 0 have?', choices: ['0', '1', '2', 'Cannot determine'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ie-1', competency: 'Quadratic Equations', topic: 'Quadratics', difficulty: 'hard', prompt: 'Solve by factoring: 2x² − 7x + 3 = 0', choices: ['x = 3, x = ½', 'x = −3, x = ½', 'x = 3, x = −½', 'x = 1, x = 3'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ie-1', competency: 'Quadratic Equations', topic: 'Quadratic Formula', difficulty: 'hard', prompt: 'Use the discriminant: x² + 2x + 5 = 0. How many real solutions?', choices: ['0', '1', '2', 'Infinite'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-If-1', competency: 'Functions', topic: 'Quadratic Functions', difficulty: 'easy', prompt: 'The vertex of y = (x − 2)² + 3 is:', choices: ['(2, 3)', '(−2, 3)', '(2, −3)', '(−2, −3)'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-If-1', competency: 'Functions', topic: 'Quadratic Functions', difficulty: 'mid', prompt: 'Which way does y = −x² open?', choices: ['Upward', 'Downward', 'Left', 'Right'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-If-1', competency: 'Functions', topic: 'Quadratic Functions', difficulty: 'hard', prompt: 'Find the axis of symmetry for y = x² − 6x + 8.', choices: ['x = −3', 'x = 3', 'x = −6', 'x = 6'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Ia-1', competency: 'Geometry & Measurement', topic: 'Triangle Congruence', difficulty: 'easy', prompt: 'SSS stands for:', choices: ['Side-Side-Side', 'Side-Same-Side', 'Same-Side-Same', 'Side-Side-Same'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Ia-1', competency: 'Geometry & Measurement', topic: 'Triangle Congruence', difficulty: 'mid', prompt: 'Which congruence criterion uses two sides and the included angle?', choices: ['SSS', 'SAS', 'ASA', 'AAS'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Ib-1', competency: 'Geometry & Measurement', topic: 'Similarity', difficulty: 'easy', prompt: 'Similar triangles have:', choices: ['Equal sides', 'Equal angles', 'Equal area', 'Equal perimeters'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Ib-1', competency: 'Geometry & Measurement', topic: 'Similarity', difficulty: 'mid', prompt: 'If △ABC ~ △DEF and AB = 6, DE = 3, what is the scale factor from ABC to DEF?', choices: ['1:2', '2:1', '1:3', '3:1'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Ib-1', competency: 'Geometry & Measurement', topic: 'Similarity', difficulty: 'hard', prompt: 'Two similar triangles have areas 25 and 49. What is the ratio of their corresponding sides?', choices: ['5:7', '25:49', '7:5', '√5:√7'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Iva-1', competency: 'Geometry & Measurement', topic: 'Triangles', difficulty: 'mid', prompt: 'In △ABC, ∠A = 50° and ∠B = 60°. What is ∠C?', choices: ['60°', '70°', '80°', '110°'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-Iva-1', competency: 'Geometry & Measurement', topic: 'Triangles', difficulty: 'hard', prompt: 'The exterior angle of a triangle is equal to:', choices: ['The sum of the other two exterior angles', 'The sum of the two remote interior angles', 'The difference of the two remote interior angles', '180° minus the interior angle'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9FE-Ia-1', competency: 'Statistics & Probability', topic: 'Probability', difficulty: 'easy', prompt: 'Two dice are rolled. What is the probability of getting a sum of 7?', choices: ['1/6', '1/12', '7/36', '1/36'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9FE-Ia-1', competency: 'Statistics & Probability', topic: 'Probability', difficulty: 'mid', prompt: 'A card is drawn from a standard deck. What is P(face card)?', choices: ['1/13', '3/13', '1/4', '4/52'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Sets', difficulty: 'easy', prompt: 'If A = {1, 2, 3} and B = {2, 3, 4}, what is A ∩ B?', choices: ['{1, 2, 3, 4}', '{2, 3}', '{1, 4}', '{1, 2, 3}'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9NS-Ia-1', competency: 'Number Sense & Operations', topic: 'Sets', difficulty: 'mid', prompt: 'If A = {1, 2, 5} and B = {2, 3, 5}, what is A ∪ B?', choices: ['{2, 5}', '{1, 2, 3, 5}', '{1, 3}', '{1, 2, 5, 2, 3, 5}'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9NS-Ib-1', competency: 'Number Sense & Operations', topic: 'Logic', difficulty: 'easy', prompt: 'The negation of "x > 5" is:', choices: ['x < 5', 'x ≤ 5', 'x ≥ 5', 'x = 5'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9NS-Ib-1', competency: 'Number Sense & Operations', topic: 'Logic', difficulty: 'mid', prompt: 'The converse of "If it rains, then the ground is wet" is:', choices: ['If it does not rain, the ground is not wet', 'If the ground is wet, then it rained', 'If the ground is not wet, then it did not rain', 'It rains and the ground is wet'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ig-1', competency: 'Functions', topic: 'Exponential Functions', difficulty: 'easy', prompt: 'What is 2⁵?', choices: ['16', '32', '64', '128'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ig-1', competency: 'Functions', topic: 'Exponential Functions', difficulty: 'mid', prompt: 'If f(x) = 3ˣ, what is f(0)?', choices: ['0', '1', '3', 'Undefined'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ig-1', competency: 'Functions', topic: 'Exponential Functions', difficulty: 'hard', prompt: 'Solve: 2ˣ = 16', choices: ['x = 2', 'x = 3', 'x = 4', 'x = 8'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-IIa-1', competency: 'Geometry & Measurement', topic: 'Circles', difficulty: 'easy', prompt: 'What is the formula for the circumference of a circle?', choices: ['πr²', '2πr', '2πr²', 'πd²'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-IIa-1', competency: 'Geometry & Measurement', topic: 'Circles', difficulty: 'mid', prompt: 'A circle has a diameter of 10 cm. What is its area? (Use π ≈ 3.14)', choices: ['31.4 cm²', '78.5 cm²', '153.86 cm²', '314 cm²'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9GE-IIa-1', competency: 'Geometry & Measurement', topic: 'Circles', difficulty: 'hard', prompt: 'A sector has a central angle of 60° in a circle of radius 6. What is the arc length? (Use π ≈ 3.14)', choices: ['3.14', '6.28', '12.56', '18.84'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ie-1', competency: 'Quadratic Equations', topic: 'Quadratics', difficulty: 'mid', prompt: 'Factor: x² + 6x + 9', choices: ['(x + 3)(x + 3)', '(x + 1)(x + 9)', '(x − 3)(x − 3)', '(x + 6)(x + 1)'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 9, competencyCode: 'M9AL-Ia-1', competency: 'Algebra', topic: 'Polynomials', difficulty: 'hard', prompt: 'What is (2x − 1)(x + 3)?', choices: ['2x² + 5x − 3', '2x² + 5x + 3', '2x² − 5x − 3', '2x² + 7x − 3'], correctAnswer: 'A' },

      // ── MATH GRADE 10 ── (need ~49 more; have 1)
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-Ia-1', competency: 'Algebra', topic: 'Functions', difficulty: 'easy', prompt: 'If f(x) = x² − 1, what is f(3)?', choices: ['2', '5', '8', '10'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-Ia-1', competency: 'Algebra', topic: 'Functions', difficulty: 'mid', prompt: 'Find the inverse of f(x) = 2x + 6.', choices: ['f⁻¹(x) = (x − 6)/2', 'f⁻¹(x) = (x + 6)/2', 'f⁻¹(x) = 2x − 6', 'f⁻¹(x) = x/2 + 3'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-Ia-1', competency: 'Algebra', topic: 'Functions', difficulty: 'hard', prompt: 'If f(x) = x + 3 and g(x) = 2x, what is f(g(4))?', choices: ['11', '14', '20', '24'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-Ib-1', competency: 'Algebra', topic: 'Polynomial Functions', difficulty: 'easy', prompt: 'How many turning points can a polynomial of degree 4 have at most?', choices: ['1', '2', '3', '4'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-Ib-1', competency: 'Algebra', topic: 'Polynomial Functions', difficulty: 'mid', prompt: 'What is the remainder when x³ − 2x + 1 is divided by (x − 1)?', choices: ['0', '1', '-1', '2'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-Ib-1', competency: 'Algebra', topic: 'Polynomial Functions', difficulty: 'hard', prompt: 'By the Factor Theorem, (x − 2) is a factor of P(x) if:', choices: ['P(2) > 0', 'P(2) = 0', 'P(0) = 2', 'P(x) has even degree'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIa-1', competency: 'Algebra', topic: 'Rational Functions', difficulty: 'easy', prompt: 'What is the vertical asymptote of f(x) = 1/(x − 3)?', choices: ['x = 0', 'x = 1', 'x = 3', 'y = 3'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIa-1', competency: 'Algebra', topic: 'Rational Functions', difficulty: 'mid', prompt: 'What is the horizontal asymptote of f(x) = (2x + 1)/(x − 3)?', choices: ['y = 0', 'y = 1', 'y = 2', 'y = 3'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIa-1', competency: 'Algebra', topic: 'Rational Functions', difficulty: 'hard', prompt: 'For f(x) = (x² − 1)/(x − 1), what is the hole at?', choices: ['x = 0', 'x = 1', 'x = −1', 'There is no hole'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-1', competency: 'Algebra', topic: 'Exponential & Logarithmic', difficulty: 'easy', prompt: 'Solve: log₂(x) = 3', choices: ['x = 6', 'x = 8', 'x = 9', 'x = 16'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-1', competency: 'Algebra', topic: 'Exponential & Logarithmic', difficulty: 'mid', prompt: 'Simplify: log₃(9) + log₃(3)', choices: ['2', '3', '4', '5'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-1', competency: 'Algebra', topic: 'Exponential & Logarithmic', difficulty: 'hard', prompt: 'Solve: log₂(x + 1) = 4', choices: ['x = 15', 'x = 16', 'x = 17', 'x = 32'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-2', competency: 'Sequences', topic: 'Arithmetic Sequences', difficulty: 'easy', prompt: 'What is the common difference of 3, 7, 11, 15, …?', choices: ['3', '4', '5', '7'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-2', competency: 'Sequences', topic: 'Arithmetic Sequences', difficulty: 'mid', prompt: 'Find the 10th term of 2, 5, 8, 11, …', choices: ['26', '29', '32', '35'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-2', competency: 'Sequences', topic: 'Geometric Sequences', difficulty: 'easy', prompt: 'What is the common ratio of 3, 9, 27, 81, …?', choices: ['3', '6', '9', '27'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-2', competency: 'Sequences', topic: 'Geometric Sequences', difficulty: 'mid', prompt: 'Find the 5th term of 2, 6, 18, 54, …', choices: ['162', '216', '486', '1458'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10AL-IIb-3', competency: 'Sequences', topic: 'Series', difficulty: 'hard', prompt: 'Find the sum of the first 5 terms: 3, 6, 12, 24, 48', choices: ['63', '93', '96', '192'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-Ia-1', competency: 'Geometry & Measurement', topic: 'Trigonometry', difficulty: 'easy', prompt: 'In a right triangle, sin θ =', choices: ['adjacent/hypotenuse', 'opposite/hypotenuse', 'opposite/adjacent', 'hypotenuse/opposite'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-Ia-1', competency: 'Geometry & Measurement', topic: 'Trigonometry', difficulty: 'mid', prompt: 'What is sin 30°?', choices: ['√3/2', '1/2', '√2/2', '1'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-Ia-1', competency: 'Geometry & Measurement', topic: 'Trigonometry', difficulty: 'hard', prompt: 'In a right triangle with opposite side 5 and hypotenuse 13, what is cos θ?', choices: ['5/13', '12/13', '13/5', '13/12'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-Ib-1', competency: 'Geometry & Measurement', topic: 'Trigonometric Identities', difficulty: 'mid', prompt: 'What is sin²θ + cos²θ?', choices: ['0', '1', '2', '2sin²θ'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-Ib-1', competency: 'Geometry & Measurement', topic: 'Trigonometric Identities', difficulty: 'hard', prompt: 'What is tan θ if sin θ = 3/5 and cos θ = 4/5?', choices: ['3/4', '4/3', '5/3', '5/4'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-IIa-1', competency: 'Geometry & Measurement', topic: 'Coordinate Geometry', difficulty: 'easy', prompt: 'What is the distance between (0, 0) and (3, 4)?', choices: ['3', '4', '5', '7'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-IIa-1', competency: 'Geometry & Measurement', topic: 'Coordinate Geometry', difficulty: 'mid', prompt: 'What is the midpoint of (2, 6) and (8, 4)?', choices: ['(5, 5)', '(6, 10)', '(4, 2)', '(10, 10)'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-IIa-1', competency: 'Geometry & Measurement', topic: 'Coordinate Geometry', difficulty: 'hard', prompt: 'What is the slope of the line perpendicular to y = (2/3)x + 1?', choices: ['2/3', '-2/3', '3/2', '-3/2'], correctAnswer: 'D' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-IIIa-1', competency: 'Geometry & Measurement', topic: 'Solid Mensuration', difficulty: 'easy', prompt: 'What is the volume of a sphere with radius 3? (Use π ≈ 3.14)', choices: ['36π', '108π', '113.04', '216π'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-IIIa-1', competency: 'Geometry & Measurement', topic: 'Solid Mensuration', difficulty: 'mid', prompt: 'What is the lateral area of a cylinder with radius 5 and height 10?', choices: ['50π', '100π', '150π', '200π'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10GE-IIIa-1', competency: 'Geometry & Measurement', topic: 'Solid Mensuration', difficulty: 'hard', prompt: 'What is the volume of a cone with radius 6 and height 9? (Use π ≈ 3.14)', choices: ['108π', '324π', '54π', '216π'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10STAT-Ia-1', competency: 'Statistics & Probability', topic: 'Measures of Position', difficulty: 'easy', prompt: 'The quartile Q₁ is the same as:', choices: ['The mean', 'The median', 'The 25th percentile', 'The 75th percentile'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10STAT-Ia-1', competency: 'Statistics & Probability', topic: 'Measures of Position', difficulty: 'mid', prompt: 'In the data set {2, 5, 7, 8, 10, 12, 15}, what is the median?', choices: ['7', '8', '9', '10'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10STAT-Ia-1', competency: 'Statistics & Probability', topic: 'Measures of Variability', difficulty: 'hard', prompt: 'Data set: 4, 8, 6, 5, 3. What is the standard deviation? (rounded)', choices: ['1.6', '1.8', '2.0', '2.2'], correctAnswer: 'B' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10STAT-Ib-1', competency: 'Statistics & Probability', topic: 'Probability', difficulty: 'easy', prompt: 'What is P(not A) if P(A) = 0.35?', choices: ['0.35', '0.50', '0.65', '0.75'], correctAnswer: 'C' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10STAT-Ib-1', competency: 'Statistics & Probability', topic: 'Probability', difficulty: 'mid', prompt: 'Two events A and B are independent. P(A) = 0.4, P(B) = 0.5. What is P(A ∩ B)?', choices: ['0.2', '0.45', '0.9', '0.7'], correctAnswer: 'A' },
      { subject: 'Math', gradeLevel: 10, competencyCode: 'M10STAT-Ib-1', competency: 'Statistics & Probability', topic: 'Probability', difficulty: 'hard', prompt: 'A bag has 3 red, 5 blue, and 2 green marbles. What is P(blue or green)?', choices: ['1/2', '7/10', '3/5', '2/5'], correctAnswer: 'B' },

      // ── SCIENCE GRADE 7 ── (need ~37 more; have 13)
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIf-6', competency: 'Life Science', topic: 'Cells', difficulty: 'easy', prompt: 'What is the function of the cell membrane?', choices: ['Store genetic info', 'Control what enters and exits', 'Make proteins', 'Produce energy'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIg-7', competency: 'Life Science', topic: 'Body Systems', difficulty: 'easy', prompt: 'Which organ system breaks down food?', choices: ['Circulatory', 'Respiratory', 'Digestive', 'Nervous'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIg-7', competency: 'Life Science', topic: 'Body Systems', difficulty: 'mid', prompt: 'The heart is part of which organ system?', choices: ['Digestive', 'Respiratory', 'Circulatory', 'Excretory'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIh-8', competency: 'Life Science', topic: 'Ecology', difficulty: 'easy', prompt: 'An organism that makes its own food is called a:', choices: ['Consumer', 'Decomposer', 'Producer', 'Predator'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIh-8', competency: 'Life Science', topic: 'Ecology', difficulty: 'mid', prompt: 'Which is an example of an ecosystem?', choices: ['A single tree', 'A pond and all its organisms', 'A flock of birds', 'A population of fish'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIh-8', competency: 'Life Science', topic: 'Ecology', difficulty: 'hard', prompt: 'In a food chain, what happens when a top predator is removed?', choices: ['Nothing changes', 'Producers decrease', 'Primary consumers increase then decrease', 'All organisms increase'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIa-2', competency: 'Physical Science', topic: 'States of Matter', difficulty: 'easy', prompt: 'Which state of matter has a definite shape and volume?', choices: ['Gas', 'Liquid', 'Solid', 'Plasma'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIa-2', competency: 'Physical Science', topic: 'States of Matter', difficulty: 'mid', prompt: 'Water boils at:', choices: ['50°C', '75°C', '100°C', '212°C'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIb-3', competency: 'Physical Science', topic: 'Changes of Matter', difficulty: 'easy', prompt: 'Ice melting into water is an example of:', choices: ['Evaporation', 'Condensation', 'Melting', 'Freezing'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIb-3', competency: 'Physical Science', topic: 'Changes of Matter', difficulty: 'mid', prompt: 'Which change is reversible?', choices: ['Burning wood', 'Rusting iron', 'Melting ice', 'Cooking an egg'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIc-4', competency: 'Physical Science', topic: 'Heat', difficulty: 'easy', prompt: 'Heat transfers from:', choices: ['Cold to hot', 'Hot to cold', 'Equally in both directions', 'Neither direction'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIc-4', competency: 'Physical Science', topic: 'Heat', difficulty: 'mid', prompt: 'Which is a good insulator?', choices: ['Copper', 'Aluminum', 'Wood', 'Iron'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIc-4', competency: 'Physical Science', topic: 'Heat', difficulty: 'hard', prompt: 'Water is used in radiators because it has:', choices: ['Low density', 'High specific heat capacity', 'Low boiling point', 'High evaporation rate'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIe-4', competency: 'Physical Science', topic: 'Sound', difficulty: 'easy', prompt: 'Sound travels fastest through:', choices: ['Air', 'Water', 'Steel', 'Vacuum'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIe-4', competency: 'Physical Science', topic: 'Sound', difficulty: 'mid', prompt: 'Pitch is determined by:', choices: ['Amplitude', 'Loudness', 'Frequency', 'Wavelength only'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIf-5', competency: 'Physical Science', topic: 'Light', difficulty: 'easy', prompt: 'Light travels in:', choices: ['Curves', 'Straight lines', 'Circles', 'Random paths'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIf-5', competency: 'Physical Science', topic: 'Light', difficulty: 'mid', prompt: 'The bending of light as it passes from air to water is called:', choices: ['Reflection', 'Refraction', 'Diffraction', 'Absorption'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIf-5', competency: 'Physical Science', topic: 'Light', difficulty: 'hard', prompt: 'A mirror produces a:', choices: ['Real image', 'Virtual image', 'No image', 'Inverted real image only'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ia-1', competency: 'Earth Science', topic: 'Earth\'s Interior', difficulty: 'easy', prompt: 'What is the outermost layer of the Earth?', choices: ['Mantle', 'Core', 'Crust', 'Asthenosphere'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ia-1', competency: 'Earth Science', topic: 'Earth\'s Interior', difficulty: 'mid', prompt: 'The thickest layer of the Earth is the:', choices: ['Crust', 'Mantle', 'Outer core', 'Inner core'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ib-2', competency: 'Earth Science', topic: 'Plate Tectonics', difficulty: 'easy', prompt: 'Earthquakes often occur at:', choices: ['Plate boundaries', 'Plate centers', 'The equator', 'The poles'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ib-2', competency: 'Earth Science', topic: 'Plate Tectonics', difficulty: 'mid', prompt: 'When two plates collide, the denser plate:', choices: ['Rises', 'Subducts beneath the other', 'Stops moving', 'Breaks apart'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ic-3', competency: 'Earth Science', topic: 'Weathering & Erosion', difficulty: 'easy', prompt: 'Which is an example of weathering?', choices: ['River carrying sand', 'Wind breaking rocks', 'Rain falling', 'Snow melting'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ic-3', competency: 'Earth Science', topic: 'Weathering & Erosion', difficulty: 'mid', prompt: 'Which agent causes the MOST erosion?', choices: ['Wind', 'Ice', 'Water', 'Gravity'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ic-3', competency: 'Earth Science', topic: 'Soil', difficulty: 'hard', prompt: 'Which soil type holds the most water?', choices: ['Sandy', 'Silty', 'Clay', 'Gravel'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Id-4', competency: 'Earth Science', topic: 'Earth\'s Rotation', difficulty: 'easy', prompt: 'Day and night are caused by:', choices: ['Earth\'s revolution', 'Earth\'s rotation', 'The Moon\'s orbit', 'The Sun\'s movement'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Id-4', competency: 'Earth Science', topic: 'Earth\'s Rotation', difficulty: 'mid', prompt: 'How long does it take Earth to rotate once?', choices: ['12 hours', '24 hours', '30 days', '365 days'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Id-4', competency: 'Earth Science', topic: 'Earth\'s Revolution', difficulty: 'hard', prompt: 'Seasons are caused by:', choices: ['Earth\'s distance from the Sun', 'The tilt of Earth\'s axis', 'The Moon\'s gravity', 'Changes in the Sun\'s temperature'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIe-5', competency: 'Life Science', topic: 'Classification', difficulty: 'easy', prompt: 'Kingdoms are the broadest category in:', choices: ['Ecology', 'Taxonomy', 'Genetics', 'Anatomy'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIe-5', competency: 'Life Science', topic: 'Classification', difficulty: 'mid', prompt: 'Bacteria belong to which kingdom?', choices: ['Animalia', 'Plantae', 'Fungi', 'Monera'], correctAnswer: 'D' },

      // ── SCIENCE GRADE 8 ── (need ~45 more; have 5)
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ia-1', competency: 'Life Science', topic: 'Genetics', difficulty: 'easy', prompt: 'Genes are found on:', choices: ['Ribosomes', 'Chromosomes', 'Mitochondria', 'Cell walls'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ia-1', competency: 'Life Science', topic: 'Genetics', difficulty: 'mid', prompt: 'What is the genotype of an organism with alleles Tt?', choices: ['Homozygous dominant', 'Homozygous recessive', 'Heterozygous', 'Dihybrid'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ia-1', competency: 'Life Science', topic: 'Genetics', difficulty: 'hard', prompt: 'In a cross Tt × Tt, what fraction of offspring is tt?', choices: ['1/4', '1/2', '3/4', '1/3'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ib-2', competency: 'Life Science', topic: 'Heredity', difficulty: 'easy', prompt: 'Who is known as the "Father of Genetics"?', choices: ['Darwin', 'Mendel', 'Watson', 'Lamarck'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ib-2', competency: 'Life Science', topic: 'Heredity', difficulty: 'mid', prompt: 'A trait controlled by one gene with two alleles is:', choices: ['Polygenic', 'Multifactorial', 'Monohybrid', 'Dihybrid'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ic-3', competency: 'Life Science', topic: 'Evolution', difficulty: 'easy', prompt: 'Natural selection was proposed by:', choices: ['Lamarck', 'Darwin', 'Linnaeus', 'Mendel'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ic-3', competency: 'Life Science', topic: 'Evolution', difficulty: 'mid', prompt: 'Which is evidence of evolution?', choices: ['Fossils', 'Photosynthesis', 'Respiration', 'Digestion'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ic-3', competency: 'Life Science', topic: 'Evolution', difficulty: 'hard', prompt: 'Vestigial structures in whales include:', choices: ['Blowhole', 'Pelvic bones', 'Flukes', 'Baleen'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ia-1', competency: 'Physical Science', topic: 'Chemical Reactions', difficulty: 'easy', prompt: 'In a chemical reaction, atoms are:', choices: ['Created', 'Destroyed', 'Rearranged', 'Enlarged'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ia-1', competency: 'Physical Science', topic: 'Chemical Reactions', difficulty: 'mid', prompt: 'Which is NOT a sign of a chemical change?', choices: ['Color change', 'Gas production', 'Change in temperature', 'Change in shape'], correctAnswer: 'D' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ib-2', competency: 'Physical Science', topic: 'Chemical Bonds', difficulty: 'easy', prompt: 'Ionic bonds form between:', choices: ['Two metals', 'A metal and a nonmetal', 'Two nonmetals', 'Noble gases'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ib-2', competency: 'Physical Science', topic: 'Chemical Bonds', difficulty: 'mid', prompt: 'How many electrons does the outer shell of neon have?', choices: ['2', '4', '6', '8'], correctAnswer: 'D' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ib-2', competency: 'Physical Science', topic: 'Chemical Bonds', difficulty: 'hard', prompt: 'A covalent bond involves:', choices: ['Transfer of electrons', 'Sharing of electrons', 'Magnetic attraction', 'Nuclear fusion'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIa-3', competency: 'Physical Science', topic: 'Chemical Equations', difficulty: 'easy', prompt: 'In the equation 2H₂ + O₂ → 2H₂O, what are the reactants?', choices: ['H₂O', 'H₂ and O₂', 'O₂ and H₂O', '2H₂ and O₂'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIa-3', competency: 'Physical Science', topic: 'Chemical Equations', difficulty: 'mid', prompt: 'Balance: _Fe + _O₂ → _Fe₂O₃', choices: ['4, 3, 2', '2, 3, 1', '2, 1, 2', '4, 2, 2'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIb-4', competency: 'Physical Science', topic: 'Acids & Bases', difficulty: 'easy', prompt: 'Litmus paper turns red in:', choices: ['Base', 'Acid', 'Neutral solution', 'Pure water'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIb-4', competency: 'Physical Science', topic: 'Acids & Bases', difficulty: 'mid', prompt: 'The pH of pure water is:', choices: ['0', '7', '14', '1'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIb-4', competency: 'Physical Science', topic: 'Acids & Bases', difficulty: 'hard', prompt: 'A solution with pH 3 is how many times more acidic than pH 5?', choices: ['2 times', '10 times', '100 times', '1000 times'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIa-1', competency: 'Physical Science', topic: 'Energy', difficulty: 'easy', prompt: 'What is the SI unit of energy?', choices: ['Newton', 'Joule', 'Watt', 'Pascal'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIa-1', competency: 'Physical Science', topic: 'Energy', difficulty: 'mid', prompt: 'Potential energy depends on:', choices: ['Speed', 'Mass and height', 'Acceleration', 'Temperature'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIa-1', competency: 'Physical Science', topic: 'Energy', difficulty: 'hard', prompt: 'A 2 kg ball at 5 m height has what PE? (g = 9.8 m/s²)', choices: ['19.6 J', '49 J', '98 J', '10 J'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIb-2', competency: 'Physical Science', topic: 'Machines', difficulty: 'easy', prompt: 'A lever is a:', choices: ['Simple machine', 'Complex machine', 'Source of energy', 'Chemical compound'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIb-2', competency: 'Physical Science', topic: 'Machines', difficulty: 'mid', prompt: 'Mechanical advantage is:', choices: ['Output force × input force', 'Output force / input force', 'Input force / output force', 'Distance × force'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIb-2', competency: 'Physical Science', topic: 'Machines', difficulty: 'hard', prompt: 'A lever with MA > 1 means:', choices: ['Less output force', 'More output force', 'Equal forces', 'No friction'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8Ea-Ia-1', competency: 'Earth Science', topic: 'Earth\'s History', difficulty: 'easy', prompt: 'Fossils are primarily found in:', choices: ['Igneous rocks', 'Sedimentary rocks', 'Metamorphic rocks', 'Volcanic rocks'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8Ea-Ia-1', competency: 'Earth Science', topic: 'Earth\'s History', difficulty: 'mid', prompt: 'The era of dinosaurs was the:', choices: ['Paleozoic', 'Mesozoic', 'Cenozoic', 'Precambrian'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8Ea-Ib-2', competency: 'Earth Science', topic: 'Water Cycle', difficulty: 'easy', prompt: 'Evaporation changes water from:', choices: ['Solid to liquid', 'Liquid to gas', 'Gas to liquid', 'Solid to gas'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8Ea-Ib-2', competency: 'Earth Science', topic: 'Water Cycle', difficulty: 'mid', prompt: 'Which process forms clouds?', choices: ['Evaporation', 'Condensation', 'Precipitation', 'Transpiration'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8Ea-Ib-2', competency: 'Earth Science', topic: 'Water Cycle', difficulty: 'hard', prompt: 'Transpiration is:', choices: ['Water evaporating from oceans', 'Water evaporating from leaves', 'Water seeping into soil', 'Water flowing in rivers'], correctAnswer: 'B' },

      // ── SCIENCE GRADE 9 ── (need ~45 more; have 5)
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ia-1', competency: 'Life Science', topic: 'Cell Division', difficulty: 'easy', prompt: 'Mitosis produces:', choices: ['2 identical cells', '4 identical cells', '2 different cells', '4 different cells'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ia-1', competency: 'Life Science', topic: 'Cell Division', difficulty: 'mid', prompt: 'Meiosis produces how many gametes?', choices: ['1', '2', '3', '4'], correctAnswer: 'D' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ia-1', competency: 'Life Science', topic: 'Cell Division', difficulty: 'hard', prompt: 'Crossing over occurs during:', choices: ['Prophase I of meiosis', 'Metaphase I of meiosis', 'Anaphase of mitosis', 'Prophase of mitosis'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ib-2', competency: 'Life Science', topic: 'DNA', difficulty: 'easy', prompt: 'DNA stands for:', choices: ['Deoxyribonucleic acid', 'Dinitrogen acid', 'Deoxyribose nucleic acid', 'Dynamic nucleic acid'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ib-2', competency: 'Life Science', topic: 'DNA', difficulty: 'mid', prompt: 'Which bases pair together in DNA?', choices: ['A-T and C-G', 'A-C and T-G', 'A-G and T-C', 'A-A and T-T'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ib-2', competency: 'Life Science', topic: 'DNA', difficulty: 'hard', prompt: 'Which enzyme unwinds the DNA double helix during replication?', choices: ['DNA polymerase', 'RNA polymerase', 'Helicase', 'Ligase'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ic-3', competency: 'Life Science', topic: 'Ecosystems', difficulty: 'easy', prompt: 'The sun is the primary source of:', choices: ['Water', 'Nutrients', 'Energy', 'Carbon'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ic-3', competency: 'Life Science', topic: 'Ecosystems', difficulty: 'mid', prompt: 'Decomposers recycle nutrients by:', choices: ['Photosynthesis', 'Breaking down dead matter', 'Absorbing sunlight', 'Filtering water'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ic-3', competency: 'Life Science', topic: 'Biogeochemical Cycles', difficulty: 'hard', prompt: 'The carbon cycle involves release of CO₂ by:', choices: ['Photosynthesis only', 'Respiration and combustion', 'Condensation', 'Evaporation'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Id-4', competency: 'Life Science', topic: 'Biodiversity', difficulty: 'easy', prompt: 'Biodiversity is the variety of:', choices: ['Rocks', 'Living things in an area', 'Weather patterns', 'Chemical elements'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Id-4', competency: 'Life Science', topic: 'Biodiversity', difficulty: 'mid', prompt: 'Which is a major threat to biodiversity?', choices: ['Pollination', 'Habitat destruction', 'Reproduction', 'Seed dispersal'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ia-1', competency: 'Physical Science', topic: 'Sound & Light', difficulty: 'easy', prompt: 'Sound is a:', choices: ['Transverse wave', 'Longitudinal wave', 'Electromagnetic wave', 'Standing wave'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ia-1', competency: 'Physical Science', topic: 'Sound & Light', difficulty: 'mid', prompt: 'The speed of light is approximately:', choices: ['300 km/s', '3,000 km/s', '300,000 km/s', '3,000,000 km/s'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ia-1', competency: 'Physical Science', topic: 'Waves', difficulty: 'hard', prompt: 'When two waves meet and produce a larger wave, it is called:', choices: ['Diffraction', 'Interference (constructive)', 'Reflection', 'Refraction'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ib-2', competency: 'Physical Science', topic: 'Electricity', difficulty: 'easy', prompt: 'Current is measured in:', choices: ['Volts', 'Watts', 'Amperes', 'Ohms'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ib-2', competency: 'Physical Science', topic: 'Electricity', difficulty: 'mid', prompt: 'Ohm\'s Law states V =', choices: ['I/R', 'IR', 'R/I', 'I + R'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ib-2', competency: 'Physical Science', topic: 'Electricity', difficulty: 'hard', prompt: 'Two resistors (4Ω and 12Ω) are in parallel. What is the equivalent resistance?', choices: ['3Ω', '4Ω', '8Ω', '16Ω'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ic-3', competency: 'Physical Science', topic: 'Magnetism', difficulty: 'easy', prompt: 'A magnet has two poles:', choices: ['East and West', 'North and South', 'Positive and Negative', 'Red and Blue'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ic-3', competency: 'Physical Science', topic: 'Magnetism', difficulty: 'mid', prompt: 'Like poles of a magnet:', choices: ['Attract', 'Repel', 'Do nothing', 'Cancel out'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ib-1', competency: 'Physical Science', topic: 'Heat Transfer', difficulty: 'easy', prompt: 'Conduction transfers heat through:', choices: ['Air movement', 'Direct contact', 'Radiation', 'Waves'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ib-1', competency: 'Physical Science', topic: 'Heat Transfer', difficulty: 'mid', prompt: 'Which is an example of convection?', choices: ['A radiator warming a room', 'Boiling water circulating', 'Sunlight warming the floor', 'A campfire warming hands'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ib-1', competency: 'Physical Science', topic: 'Heat Transfer', difficulty: 'hard', prompt: 'Thermal radiation can travel through:', choices: ['Water only', 'Solids only', 'A vacuum', 'Dense materials'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ic-3', competency: 'Physical Science', topic: 'Energy Conservation', difficulty: 'easy', prompt: 'Energy cannot be:', choices: ['Created or destroyed', 'Transformed', 'Transferred', 'Measured'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ic-3', competency: 'Physical Science', topic: 'Energy Conservation', difficulty: 'mid', prompt: 'When a ball is thrown upward, KE converts to:', choices: ['Heat', 'Sound', 'Gravitational PE', 'Chemical energy'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ic-3', competency: 'Physical Science', topic: 'Energy Conservation', difficulty: 'hard', prompt: 'In an ideal pendulum, total mechanical energy:', choices: ['Increases', 'Decreases', 'Stays constant', 'Doubles each cycle'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ia-1', competency: 'Earth Science', topic: 'Minerals & Rocks', difficulty: 'easy', prompt: 'The hardest mineral on the Mohs scale is:', choices: ['Quartz', 'Topaz', 'Diamond', 'Corundum'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ia-1', competency: 'Earth Science', topic: 'Minerals & Rocks', difficulty: 'mid', prompt: 'Igneous rocks form from:', choices: ['Sediment', 'Magma or lava', 'Heat and pressure', 'Evaporation'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ia-1', competency: 'Earth Science', topic: 'Rock Cycle', difficulty: 'hard', prompt: 'Marble is a metamorphic form of:', choices: ['Granite', 'Limestone', 'Sandstone', 'Basalt'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ib-2', competency: 'Earth Science', topic: 'Earthquakes', difficulty: 'easy', prompt: 'The point inside the Earth where an earthquake starts is the:', choices: ['Epicenter', 'Focus (hypocenter)', 'Fault line', 'Seismic zone'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ib-2', competency: 'Earth Science', topic: 'Earthquakes', difficulty: 'mid', prompt: 'P-waves are _____ than S-waves.', choices: ['Slower', 'Faster', 'Same speed', 'Invisible'], correctAnswer: 'B' },

      // ── SCIENCE GRADE 10 ── (need ~46 more; have 4)
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-Ia-1', competency: 'Life Science', topic: 'Molecular Biology', difficulty: 'easy', prompt: 'DNA replication produces:', choices: ['Two identical copies', 'One copy and one new strand', 'Four copies', 'Three copies'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-Ia-1', competency: 'Life Science', topic: 'Molecular Biology', difficulty: 'mid', prompt: 'Transcription converts:', choices: ['DNA to protein', 'DNA to mRNA', 'mRNA to DNA', 'Protein to DNA'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-Ia-1', competency: 'Life Science', topic: 'Molecular Biology', difficulty: 'hard', prompt: 'Translation occurs at the:', choices: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-Ib-2', competency: 'Life Science', topic: 'Genetic Engineering', difficulty: 'easy', prompt: 'GMO stands for:', choices: ['General Molecular Organism', 'Genetically Modified Organism', 'Gene Mapping Operation', 'Genetic Mutation Output'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-Ib-2', competency: 'Life Science', topic: 'Genetic Engineering', difficulty: 'mid', prompt: 'Which tool is used to cut DNA at specific sequences?', choices: ['DNA polymerase', 'Restriction enzyme', 'Ligase', 'Ribosome'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-Ib-2', competency: 'Life Science', topic: 'Biotechnology', difficulty: 'hard', prompt: 'PCR is used to:', choices: ['Cut DNA', 'Copy DNA', 'Translate DNA', 'Destroy DNA'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIa-3', competency: 'Life Science', topic: 'Human Reproduction', difficulty: 'easy', prompt: 'The egg cell is produced in the:', choices: ['Oviduct', 'Uterus', 'Ovary', 'Vagina'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIa-3', competency: 'Life Science', topic: 'Human Reproduction', difficulty: 'mid', prompt: 'Fertilization occurs in the:', choices: ['Ovary', 'Uterus', 'Fallopian tube', 'Cervix'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIa-3', competency: 'Life Science', topic: 'Human Reproduction', difficulty: 'hard', prompt: 'The placenta allows exchange of:', choices: ['Only oxygen', 'Only nutrients', 'Nutrients, gases, and waste', 'Only antibodies'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIb-4', competency: 'Life Science', topic: 'Disease', difficulty: 'easy', prompt: 'Vaccines work by:', choices: ['Killing bacteria', 'Producing antibodies', 'Adding antibiotics', 'Removing organs'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIb-4', competency: 'Life Science', topic: 'Disease', difficulty: 'mid', prompt: 'HIV attacks which cells?', choices: ['Red blood cells', 'B cells', 'T-helper cells', 'Platelets'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIb-4', competency: 'Life Science', topic: 'Disease', difficulty: 'hard', prompt: 'Antibiotic resistance develops because:', choices: ['Viruses mutate', 'Bacteria with resistance genes survive and multiply', 'Antibiotics weaken over time', 'The immune system fails'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIa-1', competency: 'Physical Science', topic: 'Thermochemistry', difficulty: 'easy', prompt: 'An exothermic reaction:', choices: ['Absorbs heat', 'Releases heat', 'Produces no heat', 'Only occurs at high temperature'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIa-1', competency: 'Physical Science', topic: 'Thermochemistry', difficulty: 'mid', prompt: 'Breaking bonds is:', choices: ['Exothermic', 'Endothermic', 'Neutral', 'Catalytic'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIa-1', competency: 'Physical Science', topic: 'Thermochemistry', difficulty: 'hard', prompt: 'If ΔH is negative, the reaction is:', choices: ['Endothermic', 'Exothermic', 'Neutral', 'Impossible'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIb-2', competency: 'Physical Science', topic: 'Kinetics', difficulty: 'easy', prompt: 'A catalyst speeds up a reaction by:', choices: ['Adding energy', 'Lowering activation energy', 'Increasing temperature', 'Adding mass'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIb-2', competency: 'Physical Science', topic: 'Kinetics', difficulty: 'mid', prompt: 'Higher temperature usually:', choices: ['Slows reactions', 'Speeds up reactions', 'Has no effect', 'Stops reactions'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIb-2', competency: 'Physical Science', topic: 'Kinetics', difficulty: 'hard', prompt: 'The rate of reaction depends on:', choices: ['Only concentration', 'Only temperature', 'Concentration, temperature, and surface area', 'Only catalyst'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIIa-3', competency: 'Physical Science', topic: 'Organic Chemistry', difficulty: 'easy', prompt: 'Organic compounds always contain:', choices: ['Nitrogen', 'Carbon', 'Oxygen', 'Hydrogen only'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIIa-3', competency: 'Physical Science', topic: 'Organic Chemistry', difficulty: 'mid', prompt: 'The simplest alkane is:', choices: ['Ethane', 'Methane', 'Propane', 'Butane'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIIa-3', competency: 'Physical Science', topic: 'Organic Chemistry', difficulty: 'hard', prompt: 'How many isomers does butane (C₄H₁₀) have?', choices: ['1', '2', '3', '4'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ia-1', competency: 'Physical Science', topic: 'Nuclear Chemistry', difficulty: 'easy', prompt: 'Radioactive decay is:', choices: ['Controlled', 'Spontaneous', 'Man-made only', 'Always dangerous'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ia-1', competency: 'Physical Science', topic: 'Nuclear Chemistry', difficulty: 'mid', prompt: 'Alpha particles are:', choices: ['Electrons', 'Neutrons', 'Helium nuclei', 'Photons'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ia-1', competency: 'Physical Science', topic: 'Nuclear Chemistry', difficulty: 'hard', prompt: 'Half-life is the time for:', choices: ['All atoms to decay', 'Half the atoms to decay', 'One atom to decay', 'No atoms to decay'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ib-2', competency: 'Physical Science', topic: 'Nuclear Energy', difficulty: 'easy', prompt: 'Nuclear fission splits:', choices: ['Molecules', 'Atoms', 'Electrons', 'Protons'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ib-2', competency: 'Physical Science', topic: 'Nuclear Energy', difficulty: 'mid', prompt: 'Nuclear fusion combines:', choices: ['Atoms', 'Electrons', 'Neutrons', 'Nuclei of light atoms'], correctAnswer: 'D' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ib-2', competency: 'Physical Science', topic: 'Nuclear Energy', difficulty: 'hard', prompt: 'Nuclear power plants primarily use:', choices: ['Fusion', 'Fission of uranium-235', 'Chemical reactions', 'Solar energy'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIb-3', competency: 'Physical Science', topic: 'Environmental Chemistry', difficulty: 'easy', prompt: 'The ozone layer protects us from:', choices: ['Meteorites', 'Ultraviolet radiation', 'Acid rain', 'Gravity'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIb-3', competency: 'Physical Science', topic: 'Environmental Chemistry', difficulty: 'mid', prompt: 'Acid rain is caused primarily by:', choices: ['Carbon dioxide', 'Sulfur dioxide and nitrogen oxides', 'Ozone', 'Methane'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIb-3', competency: 'Physical Science', topic: 'Environmental Chemistry', difficulty: 'hard', prompt: 'The greenhouse effect traps:', choices: ['UV radiation', 'Infrared radiation', 'Visible light', 'X-rays'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10Ea-Ia-1', competency: 'Earth Science', topic: 'Earth Systems', difficulty: 'easy', prompt: 'The hydrosphere includes:', choices: ['Only oceans', 'All water on Earth', 'Only freshwater', 'Water vapor only'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10Ea-Ia-1', competency: 'Earth Science', topic: 'Earth Systems', difficulty: 'mid', prompt: 'The atmosphere is mainly:', choices: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10Ea-Ia-1', competency: 'Earth Science', topic: 'Natural Hazards', difficulty: 'hard', prompt: 'The Ring of Fire is associated with:', choices: ['Tornadoes', 'Volcanoes and earthquakes', 'Hurricanes', 'Tsunamis only'], correctAnswer: 'B' },
    ];

    // ── Programmatic Math variants (fills every grade to 50+ so 50-item auto-exams work) ──
    const letterFrom = (correct, wrongNums) => {
      const s = [correct, ...wrongNums].sort(() => Math.random() - 0.5);
      const idx = s.indexOf(correct);
      return { choices: s.map((n) => String(n)), correctAnswer: 'ABCD'[idx] };
    };
    const mkQ = (gradeLevel, code, competency, topic, difficulty, prompt, correct, wrongs) =>
      Object.assign({ subject: 'Math', gradeLevel: gradeLevel, competencyCode: code, competency: competency, topic: topic, difficulty: difficulty, prompt: prompt, source: `DepEd Grade ${gradeLevel} Math LM` }, letterFrom(correct, wrongs));

    // 2-step linear: a*x + b = c  → x = (c-b)/a  (a in 2..5, b in -6..6, c-b divisible by a)
    const twoStep = (gradeLevel, dif) => [[2,3],[3,5],[-2,1],[4,7],[5,2],[-3,4],[2,-5],[3,-2]].map(([a,b]) => {
      const cExpr = [1,2,3].map((k) => a*k + b)[Math.floor(Math.random()*3)];
      const x = (cExpr - b) / a;
      return mkQ(gradeLevel, 'M8AL-Ie-1', 'Solving Linear Equations', 'Linear Equations', dif,
        `Solve: ${a < 0 ? '(' + a + ')' : a}x ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)} = ${cExpr}`,
        x, [x+1, x-1, x+2]);
    });
    // Percent of n
    const pctOf = (gradeLevel, dif) => [ [10,200],[20,150],[25,120],[50,80],[15,300],[30,90],[45,60],[5,240] ].map(([p,n]) => {
      const c = p*n/100;
      return mkQ(gradeLevel, 'M7NS-Ih-1', 'Fractions & Decimals', 'Decimals & Percent', dif,
        `What is ${p}% of ${n}?`, c, [c+2, c-2, c+1]);
    });
    // Arithmetic sequence nth term: nth = a1 + (n-1)d
    const seqNth = (gradeLevel, dif) => [ [[2,3,5]], [[5,4,8]], [[1,7,6]], [[3,2,10]] ].map(([[a1,d,n]]) => {
      const c = a1 + (n-1)*d;
      return mkQ(gradeLevel, 'M10AL-IIb-2', 'Sequences', 'Arithmetic Sequences', dif,
        `Find the ${n}th term of the sequence: ${a1}, ${a1 + d}, ${a1 + 2 * d}, ...`,
        c, [c+1, c-1, c+2]);
    });
    // Evaluate power: base^exp
    const powEval = (gradeLevel, dif) => [ [2,4],[3,3],[5,3],[2,6],[3,4],[4,3],[2,7],[7,2] ].map(([b,e]) => {
      const c = Math.pow(b, e);
      return mkQ(gradeLevel, 'M9AL-Ig-1', 'Functions', 'Exponential Functions', dif,
        `What is ${b}^${e}?`, c, [c+2, c-2, c+4]);
    });
    // Integer arithmetic
    const intAdd = (gradeLevel, dif) => [ [-8,5],[7,-3],[-6,-4],[9,-9],[-5,-7],[12,-5],[-2,6],[-9,9] ].map(([a,b]) => {
      const c = a + b;
      return mkQ(gradeLevel, 'M7NS-Ie-1', 'Number Sense & Operations', 'Integer Operations', dif,
        `What is (${a}) + (${b})?`, c, [c+1, c-1, c+2]);
    });
    const intSub = (gradeLevel, dif) => [ [3,8],[-1,5],[-7,-2],[10,14],[-3,9],[6,11],[-4,-6],[8,13] ].map(([a,b]) => {
      const c = a - b;
      return mkQ(gradeLevel, 'M7NS-Ie-1', 'Number Sense & Operations', 'Integer Operations', dif,
        `What is (${a}) − (${b})?`, c, [c+2, c-2, c+1]);
    });
    const intMul = (gradeLevel, dif) => [ [-4,6],[8,-3],[-7,-5],[9,4],[-6,7],[5,-8] ].map(([a,b]) => {
      const c = a * b;
      return mkQ(gradeLevel, 'M7NS-Ie-1', 'Number Sense & Operations', 'Integer Operations', dif,
        `What is (${a}) × (${b})?`, c, [c+2, c-2, c+4]);
    });

    // Push variants: G8 → twoStep(12) + intAdd(4) ; G9 → powEval(16); G10 → seqNth(12) + pctOf(8)
    expandedBank.push(
      ...twoStep(8, 'mid'), ...twoStep(8, 'hard').slice(0, 4), ...intAdd(8, 'easy').slice(0, 4),
      ...powEval(9, 'easy'), ...powEval(9, 'mid'), ...powEval(9, 'hard'),
      ...seqNth(10, 'mid'), ...seqNth(10, 'hard'), ...pctOf(10, 'mid')
    );

    // ── Additional Science items to top up each grade to 50+ ──
    const extraScience = [
      // G7 (+12)
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIc-4', competency: 'Physical Science', topic: 'Heat', difficulty: 'easy', prompt: 'Wood is a good __ of heat.', choices: ['Conductor', 'Insulator', 'Emitter', 'Absorber'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIa-1', competency: 'Physical Science', topic: 'Force & Motion', difficulty: 'mid', prompt: 'Acceleration is the rate of change of:', choices: ['Displacement', 'Velocity', 'Mass', 'Force'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIe-5', competency: 'Life Science', topic: 'Cells', difficulty: 'hard', prompt: 'Which cell part is called the "powerhouse"?', choices: ['Nucleus', 'Golgi body', 'Mitochondrion', 'Lysosome'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-Ia-1', competency: 'Physical Science', topic: 'Matter', difficulty: 'mid', prompt: 'The amount of matter in an object is its:', choices: ['Weight', 'Volume', 'Mass', 'Density'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-Ia-1', competency: 'Physical Science', topic: 'Matter', difficulty: 'hard', prompt: 'Density is calculated as:', choices: ['Mass × volume', 'Mass ÷ volume', 'Volume ÷ mass', 'Mass + volume'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIb-2', competency: 'Physical Science', topic: 'Force & Motion', difficulty: 'mid', prompt: 'Distance traveled per unit time is:', choices: ['Acceleration', 'Velocity', 'Speed', 'Displacement'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIId-3', competency: 'Physical Science', topic: 'Friction', difficulty: 'hard', prompt: 'Friction producing heat when you rub hands is a form of:', choices: ['Sound energy', 'Thermal energy', 'Light energy', 'Chemical energy'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7Ea-Ib-2', competency: 'Earth Science', topic: 'Plate Tectonics', difficulty: 'hard', prompt: 'The supercontinent that existed millions of years ago was:', choices: ['Atlantis', 'Pangaea', 'Gondwana', 'Rodinia'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIg-7', competency: 'Life Science', topic: 'Body Systems', difficulty: 'hard', prompt: 'Which organ filters blood and forms urine?', choices: ['Liver', 'Lungs', 'Kidney', 'Spleen'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7LT-IIg-7', competency: 'Life Science', topic: 'Body Systems', difficulty: 'mid', prompt: 'Which blood cells fight infection?', choices: ['Red blood cells', 'Platelets', 'White blood cells', 'Plasma proteins'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7MT-IIb-3', competency: 'Physical Science', topic: 'Changes of Matter', difficulty: 'mid', prompt: 'Burning wood is an example of a:', choices: ['Physical change', 'Chemical change', 'Phase change', 'Mechanical change'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 7, competencyCode: 'S7FE-IIIf-5', competency: 'Physical Science', topic: 'Light', difficulty: 'mid', prompt: 'Which color has the longest wavelength in visible light?', choices: ['Violet', 'Blue', 'Green', 'Red'], correctAnswer: 'D' },

      // G8 (+22)
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ia-1', competency: 'Life Science', topic: 'Genetics', difficulty: 'hard', prompt: 'How many chromosomes do human body cells have?', choices: ['23', '44', '46', '48'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ib-2', competency: 'Life Science', topic: 'Heredity', difficulty: 'hard', prompt: 'Brown eyes (B) dominant, blue (b) recessive. bb × Bb: what fraction is blue-eyed?', choices: ['0', '1/4', '1/2', '3/4'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ia-1', competency: 'Physical Science', topic: 'Chemical Reactions', difficulty: 'mid', prompt: 'Rusting of iron requires:', choices: ['Oxygen and water', 'Only air', 'Heat and salt', 'Carbon dioxide'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ib-2', competency: 'Physical Science', topic: 'Chemical Bonds', difficulty: 'mid', prompt: 'Magnesium (Mg) is most likely to form:', choices: ['Covalent bonds', 'Ionic bonds', 'Metallic bonds only', 'No bonds'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIb-4', competency: 'Physical Science', topic: 'Acids & Bases', difficulty: 'mid', prompt: 'Which is a common acid found in the stomach?', choices: ['HCl', 'NaOH', 'KCl', 'CaCO₃'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIb-4', competency: 'Physical Science', topic: 'Acids & Bases', difficulty: 'mid', prompt: 'Baking soda is a:', choices: ['Strong acid', 'Weak acid', 'Base', 'Neutral compound'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIa-1', competency: 'Physical Science', topic: 'Energy', difficulty: 'easy', prompt: 'Energy of motion is called:', choices: ['Potential energy', 'Kinetic energy', 'Chemical energy', 'Nuclear energy'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIa-1', competency: 'Physical Science', topic: 'Energy', difficulty: 'mid', prompt: 'Stored energy due to position is:', choices: ['Kinetic energy', 'Potential energy', 'Sound energy', 'Radiant energy'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIb-2', competency: 'Physical Science', topic: 'Machines', difficulty: 'mid', prompt: 'An inclined plane that is longer needs __ force to lift.', choices: ['More', 'Less', 'Equal', 'No'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-IIb-2', competency: 'Physical Science', topic: 'Machines', difficulty: 'hard', prompt: 'A pulley with a mechanical advantage of 2 gives:', choices: ['Half the force', 'Double the force', 'Same force', 'No advantage'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8Ea-Ia-1', competency: 'Earth Science', topic: 'Earth\'s History', difficulty: 'mid', prompt: 'The oldest fossils are found in __ layers.', choices: ['Upper', 'Lower', 'Middle', 'Weathered'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8Ea-Ib-2', competency: 'Earth Science', topic: 'Water Cycle', difficulty: 'easy', prompt: 'Water falling from clouds is:', choices: ['Evaporation', 'Precipitation', 'Condensation', 'Infiltration'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIId-e-3', competency: 'Physical Science', topic: 'Periodic Table', difficulty: 'easy', prompt: 'Elements are arranged by increasing:', choices: ['Mass only', 'Atomic number', 'Density', 'Alphabetical order'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIId-e-3', competency: 'Physical Science', topic: 'Periodic Table', difficulty: 'mid', prompt: 'Metals are usually:', choices: ['Brittle', 'Good conductors', 'Dull', 'Gaseous'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIId-e-3', competency: 'Physical Science', topic: 'Periodic Table', difficulty: 'hard', prompt: 'Which element is a halogen?', choices: ['Na', 'Cl', 'Ca', 'Fe'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-Ia-16', competency: 'Physical Science', topic: "Newton's Laws", difficulty: 'hard', prompt: "Newton's Third Law states that for every action there is:", choices: ['An equal and opposite reaction', 'No reaction', 'A larger reaction', 'A smaller reaction'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8FE-Ia-16', competency: 'Physical Science', topic: "Newton's Laws", difficulty: 'mid', prompt: 'F = m × a is:', choices: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", 'Law of Gravitation'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIId-e-3', competency: 'Physical Science', topic: 'Periodic Table', difficulty: 'mid', prompt: 'The chemical symbol for gold is:', choices: ['Go', 'Gd', 'Au', 'Ag'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIId-e-3', competency: 'Physical Science', topic: 'Periodic Table', difficulty: 'mid', prompt: 'Which group of elements is least reactive?', choices: ['Alkali metals', 'Alkaline earth', 'Halogens', 'Noble gases'], correctAnswer: 'D' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8LT-Ia-1', competency: 'Life Science', topic: 'Genetics', difficulty: 'easy', prompt: 'Each parent contributes how many alleles for a trait?', choices: ['1', '2', '3', '4'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-Ib-2', competency: 'Physical Science', topic: 'Chemical Bonds', difficulty: 'easy', prompt: 'A neutral atom has equal numbers of:', choices: ['Protons and electrons', 'Protons and neutrons', 'Neutrons and electrons', 'Nuclei and electrons'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 8, competencyCode: 'S8MT-IIb-4', competency: 'Physical Science', topic: 'Acids & Bases', difficulty: 'hard', prompt: 'Which pH value is MOST basic?', choices: ['3', '7', '9', '13'], correctAnswer: 'D' },

      // G9 (+22)
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ib-2', competency: 'Life Science', topic: 'DNA', difficulty: 'easy', prompt: 'You Just Found out that DNA appears like a:', choices: ['Straight ladder', 'Twisted ladder', 'Circle', 'Flat sheet'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Id-4', competency: 'Life Science', topic: 'Biodiversity', difficulty: 'hard', prompt: 'The direct value of biodiversity includes:', choices: ['Food and medicine', 'Pollution control', 'Soil formation', 'Recreation only'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ia-1', competency: 'Physical Science', topic: 'Waves', difficulty: 'easy', prompt: 'The highest point of a wave is the:', choices: ['Trough', 'Crest', 'Amplitude', 'Wavelength'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ia-1', competency: 'Physical Science', topic: 'Waves', difficulty: 'mid', prompt: 'The number of waves passing one point per second is:', choices: ['Wavelength', 'Frequency', 'Amplitude', 'Velocity'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ib-2', competency: 'Physical Science', topic: 'Electricity', difficulty: 'easy', prompt: 'Resistance is measured in:', choices: ['Volts', 'Amperes', 'Ohms', 'Watts'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ib-2', competency: 'Physical Science', topic: 'Electricity', difficulty: 'mid', prompt: 'A 3Ω resistor with 9V across it has a current of:', choices: ['0.33 A', '3 A', '12 A', '27 A'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ib-2', competency: 'Physical Science', topic: 'Electricity', difficulty: 'hard', prompt: 'Two 6Ω resistors in series have a total resistance of:', choices: ['3Ω', '6Ω', '12Ω', '36Ω'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ic-3', competency: 'Physical Science', topic: 'Magnetism', difficulty: 'hard', prompt: 'The space around a magnet where its force acts is the:', choices: ['Magnetic pole', 'Magnetic field', 'Magnetic axis', 'Magnetic storm'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ia-1', competency: 'Physical Science', topic: 'Work & Energy', difficulty: 'easy', prompt: 'Work is done when a force:', choices: ['Moves an object through a distance', 'Acts on a stationary object', 'Overcomes friction', 'Is applied upward'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ia-1', competency: 'Physical Science', topic: 'Work & Energy', difficulty: 'mid', prompt: 'A 5 N force moves a box 4 m. How much work?', choices: ['9 J', '20 J', '5 J', '4 J'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ia-1', competency: 'Physical Science', topic: 'Work & Energy', difficulty: 'hard', prompt: 'Power is the rate of doing work, measured in:', choices: ['Joules', 'Watts', 'Newtons', 'Pascals'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ia-1', competency: 'Earth Science', topic: 'Minerals & Rocks', difficulty: 'mid', prompt: 'Which property describes how a mineral reflects light?', choices: ['Streak', 'Luster', 'Hardness', 'Cleavage'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ia-1', competency: 'Earth Science', topic: 'Minerals & Rocks', difficulty: 'mid', prompt: 'Sedimentary rocks often contain:', choices: ['Crystals', 'Fossils', 'Gas', 'Magma'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ia-1', competency: 'Earth Science', topic: 'Minerals & Rocks', difficulty: 'hard', prompt: 'Heat and pressure change rocks into:', choices: ['Igneous rocks', 'Metamorphic rocks', 'Sedimentary rocks', 'Lava'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ib-2', competency: 'Earth Science', topic: 'Earthquakes', difficulty: 'mid', prompt: 'The instrument that measures earthquakes is the:', choices: ['Barometer', 'Seismograph', 'Thermometer', 'Anemometer'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9Ea-Ib-2', competency: 'Earth Science', topic: 'Earthquakes', difficulty: 'hard', prompt: 'The point on the surface directly above the focus is the:', choices: ['Epicenter', 'Hypocenter', 'Fault', 'Seismic gap'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ic-3', competency: 'Life Science', topic: 'Biogeochemical Cycles', difficulty: 'mid', prompt: 'Nitrogen is fixed into usable forms by:', choices: ['Plants', 'Bacteria', 'Fungi', 'Animals'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9LT-Ia-1', competency: 'Life Science', topic: 'Cell Division', difficulty: 'mid', prompt: 'The result of cytokinesis in animal cells is:', choices: ['Cell wall formation', 'Pinching into two cells', 'Nuclear fusion', 'Membrane duplication'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ia-1', competency: 'Physical Science', topic: 'Sound & Light', difficulty: 'mid', prompt: 'In a vacuum, sound cannot travel because:', choices: ['No air to compress', 'Light interferes', 'Too cold', 'No gravity'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9MT-Ia-1', competency: 'Physical Science', topic: 'Sound & Light', difficulty: 'hard', prompt: 'The Doppler effect causes a sound\'s pitch to:', choices: ['Rise as source approaches', 'Fall as source approaches', 'Stay constant', 'Only change underwater'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ic-3', competency: 'Physical Science', topic: 'Energy Conservation', difficulty: 'mid', prompt: 'In a pendulum, energy converts between:', choices: ['Heat and light', 'KE and gravitational PE', 'Sound and heat', 'Chemical and nuclear'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 9, competencyCode: 'S9FE-Ic-3', competency: 'Physical Science', topic: 'Energy Conservation', difficulty: 'hard', prompt: 'A falling object converts __ to __.', choices: ['PE to KE', 'KE to PE', 'Heat to KE', 'Chemical to thermal'], correctAnswer: 'A' },

      // G10 (+20)
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-Ia-1', competency: 'Life Science', topic: 'Molecular Biology', difficulty: 'mid', prompt: 'A gene is a segment of:', choices: ['Protein', 'DNA', 'Lipid', 'Carbohydrate'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIb-4', competency: 'Life Science', topic: 'Disease', difficulty: 'mid', prompt: 'Which is a bacterial disease?', choices: ['Influenza', 'Tuberculosis', 'Measles', 'COVID-19'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10LT-IIb-4', competency: 'Life Science', topic: 'Disease', difficulty: 'hard', prompt: 'Sterilization kills microbes on equipment using:', choices: ['Water', 'Heat or chemicals', 'Light only', 'Cold air'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIa-1', competency: 'Physical Science', topic: 'Thermochemistry', difficulty: 'mid', prompt: 'Melting ice is an __ process.', choices: ['Exothermic', 'Endothermic', 'Isothermal', 'Sublimation'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIa-1', competency: 'Physical Science', topic: 'Thermochemistry', difficulty: 'mid', prompt: 'Burning methane releases heat; this is:', choices: ['Endothermic', 'Exothermic', 'Endergonic', 'Spontaneous only at low T'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIb-2', competency: 'Physical Science', topic: 'Kinetics', difficulty: 'mid', prompt: 'Grinding a solid into powder increases the rate of reaction by:', choices: ['Increasing temperature', 'Increasing surface area', 'Adding a catalyst', 'Decreasing pressure'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIb-2', competency: 'Physical Science', topic: 'Kinetics', difficulty: 'hard', prompt: 'A substance that slows a reaction is an __.', choices: ['Inhibitor', 'Catalyst', 'Enzyme', 'Accelerant'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIIa-3', competency: 'Physical Science', topic: 'Organic Chemistry', difficulty: 'mid', prompt: 'The functional group −OH is found in:', choices: ['Alkanes', 'Alcohols', 'Ketones', 'Ethers'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIIa-3', competency: 'Physical Science', topic: 'Organic Chemistry', difficulty: 'mid', prompt: 'The general formula for alkanes is:', choices: ['CₙH₂ₙ', 'CₙH₂ₙ₊₂', 'CₙH₂ₙ₋₂', 'CₙHₙ'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10MT-IIIa-3', competency: 'Physical Science', topic: 'Organic Chemistry', difficulty: 'hard', prompt: 'Which alkene has the formula C₂H₄?', choices: ['Ethane', 'Ethene', 'Ethyne', 'Methane'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ia-1', competency: 'Physical Science', topic: 'Nuclear Chemistry', difficulty: 'mid', prompt: 'Which radiation has the MOST penetrating power?', choices: ['Alpha', 'Beta', 'Gamma', 'Neutron'], correctAnswer: 'C' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ia-1', competency: 'Physical Science', topic: 'Nuclear Chemistry', difficulty: 'mid', prompt: 'A beta particle is:', choices: ['A proton', 'An electron', 'A helium nucleus', 'A photon'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-Ia-1', competency: 'Physical Science', topic: 'Nuclear Chemistry', difficulty: 'hard', prompt: 'After 2 half-lives, what fraction of a sample remains?', choices: ['1/2', '1/4', '1/8', '0'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIb-3', competency: 'Physical Science', topic: 'Environmental Chemistry', difficulty: 'mid', prompt: 'CFCs damage which layer?', choices: ['Troposphere', 'Ozone layer', 'Magnetosphere', 'Ionosphere'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIb-3', competency: 'Physical Science', topic: 'Environmental Chemistry', difficulty: 'mid', prompt: 'Eutrophication is caused by excess:', choices: ['Oxygen', 'Nutrients (nitrates/phosphates)', 'Salt', 'Carbon monoxide'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIb-3', competency: 'Physical Science', topic: 'Environmental Chemistry', difficulty: 'hard', prompt: 'Smog formation is worsened by:', choices: ['Rainfall', 'Sunlight reacting with pollutants', 'Low temperature', 'High humidity only'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10Ea-Ia-1', competency: 'Earth Science', topic: 'Earth Systems', difficulty: 'mid', prompt: 'Which system includes moving glaciers?', choices: ['Atmosphere', 'Hydrosphere', 'Geosphere', 'Biosphere'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10Ea-Ia-1', competency: 'Earth Science', topic: 'Natural Hazards', difficulty: 'easy', prompt: 'A sudden shaking of the ground is an:', choices: ['Earthquake', 'Typhoon', 'Landslide', 'Flood'], correctAnswer: 'A' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10Ea-Ia-1', competency: 'Earth Science', topic: 'Natural Hazards', difficulty: 'hard', prompt: 'Typhoons form over warm waters in which ocean basin?', choices: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], correctAnswer: 'B' },
      { subject: 'Science', gradeLevel: 10, competencyCode: 'S10FE-IIa-15', competency: 'Physical Science', topic: 'Electromagnetic Waves', difficulty: 'mid', prompt: 'Which EM wave is used in remote controls?', choices: ['Radio', 'Infrared', 'Ultraviolet', 'Gamma'], correctAnswer: 'B' },
    ];
    expandedBank.push(...extraScience);

    // Merge into questionBank and insert all at once
    const allQuestions = [...questionBank, ...expandedBank];
    await Question.insertMany(allQuestions);

    console.log('Creating Reading Passages...');

    const passages = [
      {
        title: 'The Living Cell',
        gradeLevel: 7,
        text: 'Every living thing is made of cells, the basic building blocks of life. Some organisms are made of a single cell, while others, like humans, are made of trillions. Inside a cell, structures called organelles perform specific jobs, such as producing energy or making proteins.',
        questions: [
          { question: 'What is the basic building block of life?', options: ['Tissue', 'Cell', 'Organ', 'Molecule'], answer: 'Cell' },
          { question: 'Which of these is made of trillions of cells?', options: ['Single-celled organisms', 'Humans', 'Viruses', 'Dust'], answer: 'Humans' },
          { question: 'What job do organelles perform?', options: ['Specific jobs', 'No job', 'Only sleeping', 'Only eating'], answer: 'Specific jobs' },
        ],
      },
      {
        title: 'How Things Move',
        gradeLevel: 7,
        text: 'Force is a push or pull that can change how an object moves. When you kick a ball, you apply force to it. Friction is a force that slows moving objects down. Gravity pulls objects toward the Earth.',
        questions: [
          { question: 'What can a force do?', options: ['Change how an object moves', 'Make objects invisible', 'Grow plants', 'Create sound only'], answer: 'Change how an object moves' },
          { question: 'Which force slows moving objects down?', options: ['Gravity', 'Magnetism', 'Friction', 'Electricity'], answer: 'Friction' },
          { question: 'What pulls objects toward the Earth?', options: ['Magnetism', 'Gravity', 'Friction', 'Wind'], answer: 'Gravity' },
        ],
      },
    ];
    await ReadingPassage.insertMany(passages);

    console.log('✅ Database seeded successfully!');
    console.log(`   Users: ${students.length + 2} | LearnerRecords: ${records.length}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
};

seedDB();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('./db');
const User = require('../models/User');
const LearnerRecord = require('../models/LearnerRecord');
const {
  allocateStudentNumbers,
  setStudentNumberCounter,
} = require('../models/Counter');
const Assessment = require('../models/Assessment');
const Intervention = require('../models/Intervention');
const ReadingPassage = require('../models/ReadingPassage');
const Recommendation = require('../models/Recommendation');
const NotificationAck = require('../models/NotificationAck');

const STUDENT_COUNT = 110;
const ACADEMIC_YEAR = 2026;

const FIRST_NAMES_MALE = [
  'Angelo', 'Christian', 'Daniel', 'Ethan', 'Gabriel', 'Ian', 'Joshua', 'Kevin',
  'Lance', 'Marco', 'Nathan', 'Paolo', 'Rafael', 'Sean', 'Tristan', 'Vince',
  'Adrian', 'Benedict', 'Carlo', 'Diego', 'Emil', 'Francis', 'Gerald', 'Harvey',
  'Jerome', 'Kurt', 'Lorenzo', 'Mark', 'Nico', 'Patrick', 'Juan', 'Jose',
];

const FIRST_NAMES_FEMALE = [
  'Alyssa', 'Beatrice', 'Chloe', 'Danielle', 'Ella', 'Faith', 'Giselle', 'Hannah',
  'Isabella', 'Jasmine', 'Katrina', 'Lianne', 'Maria', 'Nicole', 'Patricia', 'Rhea',
  'Sofia', 'Trina', 'Vanessa', 'Ysabelle', 'Angel', 'Bianca', 'Clarisse', 'Diana',
  'Erika', 'Francesca', 'Grace', 'Hazel', 'Janine', 'Kristine', 'Ana', 'Rosa',
];

const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres',
  'Tomas', 'Andrada', 'Castillo', 'Flores', 'Villanueva', 'Ramos', 'Castro', 'Rivera',
  'Aquino', 'Navarro', 'Salazar', 'Mercado', 'Dela Cruz', 'Pascual', 'Soriano', 'Aguilar',
  'Dizon', 'Valenzuela', 'Vergara', 'Cabrera', 'Bernardo', 'De Leon', 'Miranda', 'Espiritu',
];

const GUARDIAN_FIRST_NAMES = ['Maria', 'Jose', 'Luz', 'Ramon', 'Teresa', 'Eduardo', 'Gloria', 'Liza'];

const SECTIONS_BY_GRADE = {
  7: ['Rosal', 'Sampaguita', 'Camia', 'Daisy'],
  8: ['Jasmine', 'Dahlia', 'Tulip', 'Orchid'],
  9: ['Ilang-Ilang', 'Gumamela', 'Everlasting', 'Sunflower'],
  10: ['Acacia', 'Molave', 'Narra', 'Kamagong'],
};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000);
}

/**
 * CJS equivalent of extractSurnamePassword(fullName, fallbackStudentNumber)
 * in src/lib/nameUtils.ts so seeded passwords match login self-healing & reset logic.
 */
function extractSurnamePasswordCjs(fullName, fallbackStudentNumber) {
  const safeFallback = String(fallbackStudentNumber || '').trim().toLowerCase();
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return safeFallback;

  let surname = '';
  if (trimmed.includes(',')) {
    surname = trimmed.split(',')[0].trim();
  } else {
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      surname = parts[0];
    } else {
      const compoundPrefixes = ['dela', 'delos', 'de', 'del', 'san', 'santa'];
      const penultimate = parts[parts.length - 2].toLowerCase();
      surname = compoundPrefixes.includes(penultimate)
        ? parts.slice(-2).join('')
        : parts[parts.length - 1];
    }
  }
  const clean = surname.toLowerCase().replace(/[^a-z0-9]/gi, '');
  return clean || safeFallback;
}

function evaluateGstLocal(score, gradeLevel) {
  const isGradeReady = score >= 28;
  const gstStatus = isGradeReady ? 'Grade-Ready' : 'Needs Individualized Assessment';
  let recommendedStartingLevel = gradeLevel;
  if (!isGradeReady) {
    const deficitOffset = score < 14 ? 3 : 2;
    recommendedStartingLevel = Math.max(4, gradeLevel - deficitOffset);
  }
  return {
    isGradeReady,
    gstStatus,
    recommendedStartingLevel,
    needsIndividualAssessment: !isGradeReady,
  };
}

async function seed110StudentsReset() {
  await connectDB();
  console.log('Connected to MongoDB Atlas.');

  try {
    // 1. Clean-reset existing student records & student activity data FIRST
    const staffUsers = await User.find({ role: { $ne: 'student' } }).lean();
    const teachers = staffUsers.filter((u) => u.role === 'teacher');
    if (teachers.length === 0) {
      console.error('No teacher accounts found! Run database/seedUsers.js first.');
      process.exit(1);
    }

    console.log('Clearing old student Users, LearnerRecords, Assessments, and Interventions...');
    const oldStudentUsers = await User.find({ role: 'student' }, { _id: 1 }).lean();
    const oldStudentIds = oldStudentUsers.map((u) => u._id);

    await Promise.all([
      User.deleteMany({ role: 'student' }),
      LearnerRecord.deleteMany({}),
      Assessment.deleteMany({}),
      Intervention.deleteMany({}),
      oldStudentIds.length > 0
        ? NotificationAck.deleteMany({ userId: { $in: oldStudentIds } })
        : Promise.resolve(),
      setStudentNumberCounter(0, ACADEMIC_YEAR),
    ]);

    // 2. Cleanly migrate LearnerRecord indexes after empty collection reset
    try {
      await LearnerRecord.collection.dropIndex('lrn_1');
      console.log('Dropped legacy lrn_1 unique index from learnerrecords.');
    } catch (err) {
      if (err && err.codeName !== 'IndexNotFound' && err.code !== 27) {
        console.warn('Note dropping lrn_1 index:', err.message);
      }
    }
    await LearnerRecord.syncIndexes();
    console.log('Synchronized LearnerRecord indexes (studentNumber unique).');

    const readingTeachers = teachers.filter(
      (t) => t.specialization === 'reading' || ['Reading', 'English', 'Filipino', 'English & Filipino', 'All'].includes(t.assignedSubject)
    );
    const mathTeachers = teachers.filter((t) => ['Math', 'All'].includes(t.assignedSubject));
    const scienceTeachers = teachers.filter((t) => ['Science', 'All'].includes(t.assignedSubject));

    const fallbackTeacher = teachers[0];
    const effectiveReadingTeachers = readingTeachers.length > 0 ? readingTeachers : [fallbackTeacher];
    const effectiveMathTeachers = mathTeachers.length > 0 ? mathTeachers : [fallbackTeacher];
    const effectiveScienceTeachers = scienceTeachers.length > 0 ? scienceTeachers : [fallbackTeacher];

    // 3. Fetch KS3 Reading Passages & ARAL Recommendations
    const ks3Passages = await ReadingPassage.find({}).lean();
    const recs = await Recommendation.find({}).lean();
    console.log(`Found ${ks3Passages.length} ReadingPassages and ${recs.length} Recommendations.`);

    // 4. Atomically allocate 110 sequential Student Numbers (20260001 .. 20260110)
    const studentNumbers = await allocateStudentNumbers(STUDENT_COUNT, ACADEMIC_YEAR);
    console.log(`Allocated ${studentNumbers.length} Student Numbers: ${studentNumbers[0]} .. ${studentNumbers[studentNumbers.length - 1]}`);

    // Pre-cache bcrypt hashes per surname for fast seeding
    const passwordHashCache = new Map();
    async function getHashedPassword(plain) {
      if (!passwordHashCache.has(plain)) {
        passwordHashCache.set(plain, await bcrypt.hash(plain, 10));
      }
      return passwordHashCache.get(plain);
    }

    const userDocs = [];
    const recordDocs = [];
    const assessmentDocs = [];
    const interventionDocs = [];

    for (let idx = 0; idx < STUDENT_COUNT; idx++) {
      const studentNumber = studentNumbers[idx];
      const userId = new mongoose.Types.ObjectId();

      const isMale = idx % 2 === 0;
      const firstName = isMale
        ? FIRST_NAMES_MALE[idx % FIRST_NAMES_MALE.length]
        : FIRST_NAMES_FEMALE[idx % FIRST_NAMES_FEMALE.length];
      const lastName = LAST_NAMES[(idx * 7 + Math.floor(idx / 4)) % LAST_NAMES.length];
      const fullName = `${firstName} ${lastName}`;

      const grade = 7 + (idx % 4);
      const possibleSections = SECTIONS_BY_GRADE[grade];
      const section = possibleSections[Math.floor(idx / 4) % possibleSections.length];

      const readingTeacher = effectiveReadingTeachers[idx % effectiveReadingTeachers.length];
      const mathTeacher = effectiveMathTeachers[idx % effectiveMathTeachers.length];
      const scienceTeacher = effectiveScienceTeachers[idx % effectiveScienceTeachers.length];
      const primaryTeacher = readingTeacher;

      const defaultPasswordPlain = extractSurnamePasswordCjs(fullName, studentNumber);
      const passwordHash = await getHashedPassword(defaultPasswordPlain);

      userDocs.push({
        _id: userId,
        username: studentNumber,
        password: passwordHash,
        name: fullName,
        role: 'student',
        active: true,
        mustChangePassword: false,
        email: `${studentNumber}@student.aralsync.edu`,
      });

      // Profile tier distribution (~35% Low, ~35% Moderate, ~22% High, ~8% Pending)
      const roll = (idx * 19 + 11) % 100;
      const isPending = roll >= 92;

      let riskLevel = 'Pending Assessment';
      let masteryStatus = 'Beginning';
      let readingLevel = 'Not Assessed';
      let oralAccuracy = null;
      let wcpm = null;
      let wer = null;
      let compScore = null;
      let compLevel = 'Not Assessed';
      let gstScore = null;
      let mathPreScore = null;
      let mathPostScore = null;
      let scienceScore = null;

      if (!isPending) {
        if (roll < 22) {
          riskLevel = 'High Risk';
          masteryStatus = 'Beginning';
          readingLevel = roll < 5 ? 'Non-Reader' : 'Frustration';
          oralAccuracy = roll < 5 ? getRandomInt(68, 79) : getRandomInt(80, 88);
          wcpm = roll < 5 ? getRandomInt(38, 55) : getRandomInt(58, 82);
          wer = 100 - oralAccuracy;
          compScore = getRandomInt(30, 56);
          compLevel = 'Frustration';
          gstScore = getRandomInt(10, 21);
          mathPreScore = getRandomInt(32, 48);
          mathPostScore = Math.min(72, mathPreScore + getRandomInt(4, 15));
          scienceScore = getRandomInt(38, 58);
        } else if (roll < 57) {
          riskLevel = 'Moderate Risk';
          masteryStatus = roll < 42 ? 'Developing' : 'Approaching';
          readingLevel = 'Instructional';
          oralAccuracy = getRandomInt(90, 96);
          wcpm = getRandomInt(86, 118);
          wer = 100 - oralAccuracy;
          compScore = getRandomInt(60, 78);
          compLevel = 'Instructional';
          gstScore = getRandomInt(22, 27);
          mathPreScore = getRandomInt(52, 68);
          mathPostScore = Math.min(86, mathPreScore + getRandomInt(6, 16));
          scienceScore = getRandomInt(60, 76);
        } else {
          riskLevel = 'Low Risk';
          masteryStatus = roll < 75 ? 'Approaching' : 'Proficient';
          readingLevel = 'Independent';
          oralAccuracy = getRandomInt(97, 100);
          wcpm = getRandomInt(122, 158);
          wer = 100 - oralAccuracy;
          compScore = getRandomInt(82, 100);
          compLevel = 'Independent';
          gstScore = getRandomInt(28, 39);
          mathPreScore = getRandomInt(72, 86);
          mathPostScore = Math.min(100, mathPreScore + getRandomInt(4, 14));
          scienceScore = getRandomInt(80, 98);
        }
      }

      const gstEval = gstScore !== null ? evaluateGstLocal(gstScore, grade) : null;
      const filReadingMap = {
        Independent: 'Malaya',
        Instructional: 'Pampagkatuto',
        Frustration: 'Pagkabigo',
        'Non-Reader': 'Hindi Makabasa',
        'Not Assessed': 'Hindi Pa Naitatasa',
      };
      const filGstMap = {
        'Grade-Ready': 'Handa sa Baitang',
        'Needs Individualized Assessment': 'Nangangailangan ng Karagdagang Pagtataya',
      };

      const birthYear = 2012 - (grade - 7);
      const birthMonth = String(((idx * 3) % 12) + 1).padStart(2, '0');
      const birthDay = String(((idx * 5) % 28) + 1).padStart(2, '0');
      const guardianName = `${GUARDIAN_FIRST_NAMES[idx % GUARDIAN_FIRST_NAMES.length]} ${lastName}`;

      let readingAssessmentId = null;
      let readingAssessmentDate = null;

      if (!isPending) {
        const mathComp =
          grade === 7
            ? 'Number Sense & Algebra'
            : grade === 8
            ? 'Linear Equations & Systems'
            : grade === 9
            ? 'Quadratic Equations'
            : 'Polynomials & Statistics';

        assessmentDocs.push({
          studentId: userId,
          type: 'OMR',
          subject: 'Math',
          title: `Grade ${grade} Mathematics Pre-Test`,
          score: mathPreScore,
          totalItems: 25,
          scoredItems: Math.round((mathPreScore / 100) * 25),
          mcTotal: 25,
          gradingStatus: 'complete',
          assessmentCategory: 'pre-test',
          competency: mathComp,
          masteryLevel: mathPreScore >= 80 ? 'Proficient' : mathPreScore >= 60 ? 'Developing' : 'Beginning',
          status: 'approved',
          date: daysAgo(getRandomInt(28, 45)),
        });

        assessmentDocs.push({
          studentId: userId,
          type: 'OMR',
          subject: 'Math',
          title: `Grade ${grade} Mathematics Post-Test`,
          score: mathPostScore,
          totalItems: 25,
          scoredItems: Math.round((mathPostScore / 100) * 25),
          mcTotal: 25,
          gradingStatus: 'complete',
          assessmentCategory: 'post-test',
          competency: mathComp,
          masteryLevel: masteryStatus,
          status: 'approved',
          date: daysAgo(getRandomInt(3, 18)),
        });

        assessmentDocs.push({
          studentId: userId,
          type: 'OMR',
          subject: 'Science',
          title: `Grade ${grade} Science Diagnostic Quiz`,
          score: scienceScore,
          totalItems: 20,
          scoredItems: Math.round((scienceScore / 100) * 20),
          mcTotal: 20,
          gradingStatus: 'complete',
          assessmentCategory: 'quiz',
          competency: grade === 7 ? 'Matter & Living Systems' : grade === 8 ? 'Force, Motion & Earth' : 'Chemical Reactions & Genetics',
          masteryLevel: scienceScore >= 85 ? 'Proficient' : scienceScore >= 70 ? 'Approaching' : scienceScore >= 55 ? 'Developing' : 'Beginning',
          status: 'approved',
          date: daysAgo(getRandomInt(5, 25)),
        });

        assessmentDocs.push({
          studentId: userId,
          type: 'OMR',
          subject: 'Reading',
          title: `Phil-IRI Stage 1 GST — Grade ${grade}`,
          score: Math.round((gstScore / 40) * 100),
          totalItems: 40,
          scoredItems: gstScore,
          mcTotal: 40,
          gstRawScore: gstScore,
          gstStage: 1,
          gradingStatus: 'complete',
          assessmentCategory: 'gst',
          competency: 'Group Screening Test (GST)',
          masteryLevel: gstEval.isGradeReady ? 'Independent' : 'Instructional',
          status: 'approved',
          date: daysAgo(getRandomInt(25, 42)),
        });

        const passage = ks3Passages.length > 0 ? ks3Passages[idx % ks3Passages.length] : null;
        const passageTitle = passage ? passage.title : `ARAL KS3 Grade ${grade} Reading Benchmark`;
        const passageWordCount = passage && passage.text ? passage.text.split(/\s+/).filter(Boolean).length : 135;
        const miscues = Math.max(0, Math.round(passageWordCount * (wer / 100)));

        readingAssessmentId = new mongoose.Types.ObjectId();
        readingAssessmentDate = daysAgo(getRandomInt(1, 20));

        assessmentDocs.push({
          _id: readingAssessmentId,
          studentId: userId,
          type: 'READING_FLUENCY',
          subject: idx % 3 === 0 ? 'Filipino' : 'Reading',
          title: `Phil-IRI Oral Fluency — ${passageTitle}`,
          score: oralAccuracy,
          accuracy: oralAccuracy,
          wpm: wcpm,
          wer,
          durationSec: Math.min(60, Math.max(25, Math.round((passageWordCount / wcpm) * 60))),
          speechDurationSec: Math.min(55, Math.max(20, Math.round((passageWordCount / wcpm) * 50))),
          wordsAttempted: passageWordCount,
          miscueTotal: miscues,
          miscueBreakdown: {
            mispronunciations: Math.round(miscues * 0.4),
            substitutions: Math.round(miscues * 0.3),
            omissions: Math.round(miscues * 0.2),
            insertions: Math.round(miscues * 0.1),
            repetitions: riskLevel === 'High Risk' ? 2 : 1,
            reversals: 0,
          },
          hesitations: riskLevel === 'High Risk' ? getRandomInt(3, 6) : getRandomInt(0, 2),
          longestPause: riskLevel === 'High Risk' ? getRandomInt(2, 4) : 1,
          passageTitle,
          comprehensionScore: compScore,
          comprehensionLevel: compLevel,
          masteryLevel: readingLevel,
          combinedLevel: readingLevel,
          status: 'approved',
          date: readingAssessmentDate,
        });

        assessmentDocs.push({
          studentId: userId,
          type: 'COMPREHENSION',
          subject: 'Reading',
          title: `Silent Reading Comprehension — ${passageTitle}`,
          score: compScore,
          comprehensionScore: compScore,
          comprehensionLevel: compLevel,
          masteryLevel: compLevel,
          passageTitle,
          competency: 'Reading Comprehension',
          status: 'approved',
          date: readingAssessmentDate,
        });

        if (riskLevel === 'High Risk' || riskLevel === 'Moderate Risk') {
          const rec = recs.length > 0 ? recs[idx % recs.length] : null;
          const intStatus = ['In Progress', 'Submitted', 'Not Started', 'Completed'][idx % 4];
          interventionDocs.push({
            studentId: userId,
            title:
              riskLevel === 'High Risk'
                ? `Intensive ARAL KS3 Reading Recovery: Fluency & Decoding (Grade ${grade})`
                : `Targeted ARAL KS3 Guided Comprehension & Vocabulary (Grade ${grade})`,
            category: 'Reading Recovery',
            type: idx % 2 === 0 ? 'Module' : 'Worksheet',
            status: intStatus,
            weakness: 'Reading Comprehension & Oral Fluency',
            keyStage: 'KS3',
            recommendationRef: rec ? rec._id : undefined,
            workbookUrl: rec?.workbookUrl || '/learning-materials/ks3-basic/learner-workbook.pdf',
            tutorGuideUrl: rec?.tutorGuideUrl || undefined,
            section,
            subject: 'Reading',
            assignedBy: readingTeacher._id,
            assignedDate: daysAgo(getRandomInt(2, 14)),
            dueDate: new Date(Date.now() + getRandomInt(5, 21) * 86400000),
            instructions:
              'Complete the assigned ARAL Key Stage 3 reading practice, review tricky words, and answer the comprehension check questions.',
            reviewed: intStatus === 'Completed',
            gradeScore: intStatus === 'Completed' ? getRandomInt(78, 95) : null,
          });

          if (mathPreScore < 60) {
            interventionDocs.push({
              studentId: userId,
              title: `ARAL Mathematics Remediation: ${mathComp} (Grade ${grade})`,
              category: 'Mathematics Recovery',
              type: 'Activity',
              status: idx % 2 === 0 ? 'In Progress' : 'Not Started',
              weakness: mathComp,
              keyStage: 'KS3',
              section,
              subject: 'Math',
              assignedBy: mathTeacher._id,
              assignedDate: daysAgo(getRandomInt(1, 10)),
              dueDate: new Date(Date.now() + getRandomInt(7, 21) * 86400000),
              instructions: 'Work through the guided step-by-step practice set and verify solutions with your math teacher.',
            });
          }
        }
      }

      recordDocs.push({
        studentId: userId,
        studentNumber,
        gradeLevel: grade,
        section,
        birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
        riskLevel,
        masteryStatus,
        guardian: guardianName,
        contact: `09${String(170000000 + idx * 123457).slice(0, 9)}`,
        address: `Block ${(idx % 25) + 1}, Lot ${(idx % 18) + 1}, Brgy. San Isidro`,
        gstScore,
        gstStatus: gstEval ? gstEval.gstStatus : 'Unassessed',
        recommendedStartingLevel: gstEval ? gstEval.recommendedStartingLevel : null,
        needsIndividualAssessment: gstEval ? gstEval.needsIndividualAssessment : false,
        readingLevel,
        oralReadingAccuracy: oralAccuracy,
        oralReadingWpm: wcpm,
        oralReadingWer: wer,
        oralReadingLevel: readingLevel,
        comprehensionScore: compScore,
        comprehensionLevel: compLevel,
        combinedReadingLevel: readingLevel,
        philIriStatus: isPending ? 'unassessed' : 'approved',
        lastReadingAssessmentId: readingAssessmentId,
        lastReadingAssessmentDate: readingAssessmentDate,
        philIriEnglish: {
          gstScore,
          gstStatus: gstEval ? gstEval.gstStatus : 'Unassessed',
          recommendedStartingLevel: gstEval ? gstEval.recommendedStartingLevel : null,
          readingLevel,
          oralAccuracy,
          wpm: wcpm,
          oralWer: wer,
          oralLevel: readingLevel === 'Not Assessed' ? null : readingLevel,
          comprehensionScore: compScore,
          comprehensionLevel: compLevel === 'Not Assessed' ? null : compLevel,
          combinedLevel: readingLevel,
          status: isPending ? 'unassessed' : 'approved',
          needsIndividualAssessment: gstEval ? gstEval.needsIndividualAssessment : false,
        },
        philIriFilipino: {
          gstScore: gstScore !== null ? Math.max(0, Math.min(40, gstScore + ((idx % 3) - 1))) : null,
          gstStatus: gstEval ? filGstMap[gstEval.gstStatus] : 'Hindi Pa Naitatasa',
          recommendedStartingLevel: gstEval ? gstEval.recommendedStartingLevel : null,
          readingLevel: filReadingMap[readingLevel],
          oralAccuracy: oralAccuracy !== null ? Math.max(60, Math.min(100, oralAccuracy - (idx % 2))) : null,
          wpm: wcpm !== null ? Math.max(35, wcpm - (idx % 6)) : null,
          oralWer: wer !== null ? Math.min(40, wer + (idx % 2)) : null,
          oralLevel: readingLevel === 'Not Assessed' ? null : filReadingMap[readingLevel],
          comprehensionScore: compScore,
          comprehensionLevel: compLevel === 'Not Assessed' ? null : filReadingMap[compLevel],
          combinedLevel: filReadingMap[readingLevel],
          status: isPending ? 'unassessed' : 'approved',
          needsIndividualAssessment: gstEval ? gstEval.needsIndividualAssessment : false,
        },
        assignedTeacherId: primaryTeacher._id,
        assignedTeacherName: primaryTeacher.name,
        assignedTeachers: {
          reading: readingTeacher._id,
          english: readingTeacher._id,
          filipino: readingTeacher._id,
          math: mathTeacher._id,
          science: scienceTeacher._id,
        },
        readingTeacherName: readingTeacher.name,
        englishTeacherName: readingTeacher.name,
        filipinoTeacherName: readingTeacher.name,
        mathTeacherName: mathTeacher.name,
        scienceTeacherName: scienceTeacher.name,
      });
    }

    // 5. Fast bulk insert via insertMany
    console.log('Bulk inserting into MongoDB Atlas...');
    await Promise.all([
      User.insertMany(userDocs, { ordered: false }),
      LearnerRecord.insertMany(recordDocs, { ordered: false }),
    ]);

    if (assessmentDocs.length > 0) {
      await Assessment.insertMany(assessmentDocs, { ordered: false });
    }
    if (interventionDocs.length > 0) {
      await Intervention.insertMany(interventionDocs, { ordered: false });
    }

    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalRecords = await LearnerRecord.countDocuments({});
    console.log('\nClean reset & Student Number seeding complete:');
    console.log(`- Preserved ${staffUsers.length} Staff/Faculty accounts (${teachers.length} teachers)`);
    console.log(`- Created ${userDocs.length} Student Users (${studentNumbers[0]} .. ${studentNumbers[studentNumbers.length - 1]})`);
    console.log(`- Created ${recordDocs.length} LearnerRecords (total active: ${totalRecords})`);
    console.log(`- Created ${assessmentDocs.length} Assessments (OMR Math/Science + GST + Oral Reading + Comprehension)`);
    console.log(`- Created ${interventionDocs.length} Interventions`);
    console.log(`- Total active students in database: ${totalStudents}`);
    console.log(`- Next auto-assigned Student Number on enrollment: ${ACADEMIC_YEAR}${String(STUDENT_COUNT + 1).padStart(4, '0')}`);
    console.log(`- Sample Login: Student No. = "${studentNumbers[0]}" (${userDocs[0].name}) | Password = "${extractSurnamePasswordCjs(userDocs[0].name, studentNumbers[0])}"`);
  } catch (error) {
    console.error('Error seeding 110 students:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

seed110StudentsReset();

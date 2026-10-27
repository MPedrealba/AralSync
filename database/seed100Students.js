const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('./db');
const User = require('../models/User');
const LearnerRecord = require('../models/LearnerRecord');
const Assessment = require('../models/Assessment');
const Intervention = require('../models/Intervention');
const ReadingPassage = require('../models/ReadingPassage');
const Recommendation = require('../models/Recommendation');

const FIRST_NAMES_MALE = [
  'Angelo', 'Christian', 'Daniel', 'Ethan', 'Gabriel', 'Ian', 'Joshua', 'Kevin',
  'Lance', 'Marco', 'Nathan', 'Paolo', 'Rafael', 'Sean', 'Tristan', 'Vince',
  'Adrian', 'Benedict', 'Carlo', 'Diego', 'Emil', 'Francis', 'Gerald', 'Harvey',
  'Jerome', 'Kurt', 'Lorenzo', 'Mark', 'Nico', 'Patrick'
];

const FIRST_NAMES_FEMALE = [
  'Alyssa', 'Beatrice', 'Chloe', 'Danielle', 'Ella', 'Faith', 'Giselle', 'Hannah',
  'Isabella', 'Jasmine', 'Katrina', 'Lianne', 'Maria', 'Nicole', 'Patricia', 'Rhea',
  'Sofia', 'Trina', 'Vanessa', 'Ysabelle', 'Angel', 'Bianca', 'Clarisse', 'Diana',
  'Erika', 'Francesca', 'Grace', 'Hazel', 'Janine', 'Kristine'
];

const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres',
  'Tomas', 'Andrada', 'Castillo', 'Flores', 'Villanueva', 'Ramos', 'Castro', 'Rivera',
  'Aquino', 'Navarro', 'Salazar', 'Mercado', 'Dela Cruz', 'Pascual', 'Soriano', 'Aguilar',
  'Dizon', 'Valenzuela', 'Vergara', 'Cabrera', 'Bernardo', 'De Leon', 'Miranda', 'Espiritu'
];

const SECTIONS_BY_GRADE = {
  7: ['Rosal', 'Sampaguita', 'Camia', 'Daisy'],
  8: ['Jasmine', 'Dahlia', 'Tulip', 'Orchid'],
  9: ['Ilang-Ilang', 'Gumamela', 'Everlasting', 'Sunflower'],
  10: ['Acacia', 'Molave', 'Narra', 'Kamagong'],
};

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed100Students() {
  await connectDB();
  console.log('Connected to MongoDB Atlas.');

  try {
    // 1. Fetch teachers
    const teachers = await User.find({ role: 'teacher' }).lean();
    if (!teachers || teachers.length === 0) {
      console.error('No teachers found! Please run database/seedUsers.js first.');
      process.exit(1);
    }
    const readingTeacher = teachers.find((t) => t.assignedSubject === 'Reading') || teachers[0];
    const mathTeacher = teachers.find((t) => t.assignedSubject === 'Math' || t.assignedSubject === 'All') || teachers[0];

    // 2. Fetch KS3 Reading Passages
    const ks3Passages = await ReadingPassage.find({ keyStage: 'KS3' }).lean();
    console.log(`Found ${ks3Passages.length} KS3 Reading Passages in database.`);

    // 3. Fetch ARAL Recommendations for interventions
    const recs = await Recommendation.find({ keyStage: 'KS3' }).lean();

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    console.log('Generating 100 Key Stage 3 students (student11 through student110)...');

    const createdUsers = [];
    const createdRecords = [];
    const createdAssessments = [];
    const createdInterventions = [];

    // Distribution profile: 40% Low Risk, 35% Moderate Risk, 25% High Risk
    for (let i = 11; i <= 110; i++) {
      const username = `student${i}`;
      const lrn = `136860100${i.toString().padStart(3, '0')}`;

      const isMale = i % 2 === 0;
      const firstName = isMale
        ? FIRST_NAMES_MALE[(i - 11) % FIRST_NAMES_MALE.length]
        : FIRST_NAMES_FEMALE[(i - 11) % FIRST_NAMES_FEMALE.length];
      const lastName = LAST_NAMES[(i * 3) % LAST_NAMES.length];
      const fullName = `${firstName} ${lastName}`;

      // Distribute evenly across KS3: Grades 7, 8, 9, 10
      const grade = 7 + ((i - 11) % 4);
      const possibleSections = SECTIONS_BY_GRADE[grade];
      const section = possibleSections[(i - 11) % possibleSections.length];

      // Assign teacher (alternating)
      const assignedTeacher = (i % 2 === 0) ? readingTeacher : mathTeacher;

      // Determine learner performance profile
      const roll = (i * 17) % 100;
      let riskLevel = 'Low Risk';
      let masteryStatus = 'Proficient';
      let readingLevel = 'Independent';
      let oralAccuracy = getRandomInt(97, 100);
      let wcpm = getRandomInt(125, 160);
      let wer = getRandomInt(0, 3);
      let compScore = getRandomInt(80, 100);
      let compLevel = 'Independent';
      let mathScore = getRandomInt(85, 100);

      if (roll < 25) {
        // High Risk / Frustration
        riskLevel = 'High Risk';
        masteryStatus = 'Beginning';
        readingLevel = 'Frustration';
        oralAccuracy = getRandomInt(80, 89);
        wcpm = getRandomInt(55, 80);
        wer = getRandomInt(11, 20);
        compScore = getRandomInt(35, 55);
        compLevel = 'Frustration';
        mathScore = getRandomInt(40, 58);
      } else if (roll < 60) {
        // Moderate Risk / Instructional
        riskLevel = 'Moderate Risk';
        masteryStatus = 'Developing';
        readingLevel = 'Instructional';
        oralAccuracy = getRandomInt(90, 96);
        wcpm = getRandomInt(85, 120);
        wer = getRandomInt(4, 9);
        compScore = getRandomInt(60, 78);
        compLevel = 'Instructional';
        mathScore = getRandomInt(60, 78);
      }

      // 1. Create or Find User
      let user = await User.findOne({ username });
      if (!user) {
        user = await User.create({
          username,
          password: passwordHash,
          name: fullName,
          role: 'student',
          email: `${username}@student.deped.gov.ph`,
          mustChangePassword: false,
        });
      }
      createdUsers.push(user);

      // 2. Create LearnerRecord if not already existing
      const birthYear = 2012 - (grade - 7);
      const birthMonth = String(getRandomInt(1, 12)).padStart(2, '0');
      const birthDay = String(getRandomInt(1, 28)).padStart(2, '0');
      const guardianName = `${getRandomItem(['Maria', 'Jose', 'Luz', 'Ramon', 'Teresa', 'Eduardo'])} ${lastName}`;

      let learnerRecord = await LearnerRecord.findOne({ studentId: user._id });
      if (!learnerRecord) {
        learnerRecord = await LearnerRecord.create({
          studentId: user._id,
          lrn,
          gradeLevel: grade,
          section,
          birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
          riskLevel,
          masteryStatus,
          guardian: guardianName,
          contact: `09${getRandomInt(100000000, 999999999)}`,
          address: `Block ${getRandomInt(1, 40)}, Lot ${getRandomInt(1, 30)}, Brgy. San Isidro, General Trias`,
          readingLevel,
          oralReadingAccuracy: oralAccuracy,
          oralReadingWpm: wcpm,
          oralReadingWer: wer,
          oralReadingLevel: readingLevel,
          comprehensionScore: compScore,
          comprehensionLevel: compLevel,
          combinedReadingLevel: readingLevel,
          philIriStatus: 'approved',
          assignedTeacherId: assignedTeacher._id,
          assignedTeacherName: assignedTeacher.name,
        });
      }
      createdRecords.push(learnerRecord);

      // 3. Create OMR Math Assessment if not exists
      const existingMath = await Assessment.findOne({ studentId: user._id, type: 'OMR' });
      if (!existingMath) {
        const mathTotalItems = 25;
        const mathCorrectItems = Math.round((mathScore / 100) * mathTotalItems);
        const mathAssessment = await Assessment.create({
          studentId: user._id,
          type: 'OMR',
          subject: 'Math',
          title: `Grade ${grade} Mathematics Diagnostics (Term 1)`,
          score: mathScore,
          totalItems: mathTotalItems,
          scoredItems: mathCorrectItems,
          mcTotal: mathTotalItems,
          gradingStatus: 'complete',
          assessmentCategory: 'quiz',
          competency: grade === 7 ? 'Number Sense & Algebra' : grade === 8 ? 'Linear Equations & Systems' : grade === 9 ? 'Quadratic Equations' : 'Polynomials & Statistics',
          masteryLevel: masteryStatus,
          status: 'approved',
          createdAt: new Date(Date.now() - getRandomInt(2, 30) * 86400000),
        });
        createdAssessments.push(mathAssessment);
      }

      // 4. Create Phil-IRI Oral Reading Assessment linked to KS3 Passage
      const existingReading = await Assessment.findOne({ studentId: user._id, type: 'READING_FLUENCY' });
      if (!existingReading) {
        const matchingPassages = ks3Passages.filter((p) => p.gradeLevel === grade);
        const passage = (matchingPassages.length > 0 ? getRandomItem(matchingPassages) : (ks3Passages[0] || null));
        const passageTitle = passage ? passage.title : `ARAL KS3 Grade ${grade} Reading Benchmark`;
        const passageWordCount = passage && passage.text ? passage.text.split(/\s+/).length : 120;
        const miscues = Math.max(0, Math.round(passageWordCount * (wer / 100)));

        const readingAssessment = await Assessment.create({
          studentId: user._id,
          type: 'READING_FLUENCY',
          subject: 'Reading',
          title: `Phil-IRI Oral Fluency — ${passageTitle}`,
          score: oralAccuracy,
          accuracy: oralAccuracy,
          wpm: wcpm,
          wer: wer,
          durationSec: Math.round((passageWordCount / wcpm) * 60),
          speechDurationSec: Math.round((passageWordCount / wcpm) * 52),
          wordsAttempted: passageWordCount,
          miscueTotal: miscues,
          miscueBreakdown: {
            mispronunciations: Math.round(miscues * 0.4),
            substitutions: Math.round(miscues * 0.3),
            omissions: Math.round(miscues * 0.2),
            insertions: Math.round(miscues * 0.1),
            repetitions: 1,
            reversals: 0,
          },
          hesitations: getRandomInt(1, 5),
          longestPause: getRandomInt(1, 3),
          passageTitle: passageTitle,
          masteryLevel: readingLevel,
          combinedLevel: readingLevel,
          status: 'approved',
          createdAt: new Date(Date.now() - getRandomInt(1, 20) * 86400000),
        });
        createdAssessments.push(readingAssessment);

        // Update learnerRecord with reading assessment link
        if (learnerRecord && !learnerRecord.lastReadingAssessmentId) {
          learnerRecord.lastReadingAssessmentId = readingAssessment._id;
          learnerRecord.lastReadingAssessmentDate = readingAssessment.createdAt;
          await learnerRecord.save();
        }
      }

      // 5. Create ARAL Intervention for High and Moderate Risk learners
      if (riskLevel === 'High Risk' || riskLevel === 'Moderate Risk') {
        const existingIntervention = await Intervention.findOne({ studentId: user._id });
        if (!existingIntervention) {
          const matchingRec = recs.length > 0 ? getRandomItem(recs) : null;
          const intervention = await Intervention.create({
            studentId: user._id,
            title: riskLevel === 'High Risk'
              ? `Intensive ARAL KS3 Reading Recovery: Fluency & Decoding (Grade ${grade})`
              : `Targeted ARAL KS3 Guided Comprehension & Fluency (Grade ${grade})`,
            category: 'Reading Recovery',
            type: 'Module',
            status: getRandomItem(['In Progress', 'Submitted', 'Not Started']),
            weakness: 'Reading Comprehension & Oral Fluency',
            keyStage: 'KS3',
            workbookUrl: matchingRec ? matchingRec.workbookUrl : '/learning-materials/KS3_Reading_Recovery_Module.pdf',
            section,
            subject: 'Reading',
            assignedDate: new Date(Date.now() - getRandomInt(1, 14) * 86400000),
            dueDate: new Date(Date.now() + getRandomInt(7, 21) * 86400000),
            instructions: 'Read the assigned ARAL Key Stage 3 workbook chapter, practice oral reading with proper phrasing, and answer the comprehension exercises.',
          });
          createdInterventions.push(intervention);
        }
      }
    }

    console.log(`Successfully created or verified:`);
    console.log(`- ${createdUsers.length} Users`);
    console.log(`- ${createdRecords.length} LearnerRecords`);
    console.log(`- ${createdAssessments.length} Assessments`);
    console.log(`- ${createdInterventions.length} Interventions`);

    const totalStudents = await User.countDocuments({ role: 'student' });
    console.log(`Total active students now in database: ${totalStudents}`);
  } catch (error) {
    console.error('Error seeding 100 students:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

seed100Students();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const User = require('../models/User');
const LearnerRecord = require('../models/LearnerRecord');
const Assessment = require('../models/Assessment');
const Intervention = require('../models/Intervention');

const seedDB = async () => {
  await connectDB();

  try {
    console.log('Clearing existing collections...');
    await User.deleteMany({});
    await LearnerRecord.deleteMany({});
    await Assessment.deleteMany({});
    await Intervention.deleteMany({});

    console.log('Hashing passwords...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    console.log('Creating users...');
    
    // Create Principal and Teacher
    const principal = await User.create({
      username: 'principal1',
      password: hashedPassword,
      name: 'Principal Santos',
      role: 'principal'
    });

    const teacher = await User.create({
      username: 'teacher1',
      password: hashedPassword,
      name: 'Teacher Miguel',
      role: 'teacher'
    });

    // Create Students
    const studentsData = [
      { username: 'student1', password: hashedPassword, name: 'Juan dela Cruz', role: 'student' },
      { username: 'student2', password: hashedPassword, name: 'Ana Reyes', role: 'student' },
      { username: 'student3', password: hashedPassword, name: 'Carlos Mendoza', role: 'student' }
    ];

    const students = await User.insertMany(studentsData);

    console.log('Creating Learner Records, Assessments, and Interventions...');
    
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      // 1. Learner Record
      await LearnerRecord.create({
        studentId: student._id,
        lrn: `10293${8 + i}`, // e.g., 102938, 102939, 102940
        gradeLevel: 7,
        section: 'Rosal',
        riskLevel: i === 0 ? 'High Risk' : i === 1 ? 'Moderate Risk' : 'Low Risk',
        masteryStatus: i === 0 ? 'Beginning' : i === 1 ? 'Developing' : 'Proficient'
      });

      // 2. Assessments
      await Assessment.create([
        {
          studentId: student._id,
          type: 'OMR',
          score: 85 - (i * 10), // Varies per student
          competency: 'Solving Linear Equations',
          masteryLevel: 'Developing'
        },
        {
          studentId: student._id,
          type: 'READING_FLUENCY',
          score: 80 - (i * 8),
          wpm: 68 - (i * 10),
          competency: 'Oral Reading Fluency',
          masteryLevel: 'Instructional'
        },
        {
          studentId: student._id,
          type: 'COMPREHENSION',
          score: 72 + (i * 5),
          competency: 'Reading Comprehension',
          masteryLevel: 'Approaching'
        }
      ]);

      // 3. Interventions
      await Intervention.create([
        {
          studentId: student._id,
          title: 'Intensive Reading',
          category: 'Reading Intervention',
          type: 'Video',
          status: i === 0 ? 'Not Started' : 'Completed',
          assignedDate: new Date('2026-07-03')
        },
        {
          studentId: student._id,
          title: 'Basic Operation Drills',
          category: 'Numeracy',
          type: 'Activity',
          status: 'In Progress',
          assignedDate: new Date('2026-07-06')
        },
        {
          studentId: student._id,
          title: 'Cell Biology',
          category: 'Science',
          type: 'Module',
          status: 'Not Started',
          assignedDate: new Date('2026-07-08')
        }
      ]);
    }

    console.log('✅ Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
};

seedDB();
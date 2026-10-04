const connectDB = require('./db');
const User = require('../models/User');
const LearnerRecord = require('../models/LearnerRecord');
const bcrypt = require('bcryptjs');

const run = async () => {
  await connectDB();

  // 1. Ensure coordinator1 has Coordinator Sarah & password123
  let coordinator = await User.findOne({ username: 'coordinator1' });
  const coordHashed = await bcrypt.hash('password123', 10);
  if (!coordinator) {
    coordinator = await User.create({
      username: 'coordinator1',
      password: coordHashed,
      name: 'Coordinator Sarah',
      role: 'coordinator',
      active: true,
    });
    console.log('Created coordinator1 with Coordinator Sarah');
  } else {
    coordinator.name = 'Coordinator Sarah';
    coordinator.password = coordHashed;
    coordinator.role = 'coordinator';
    coordinator.active = true;
    await coordinator.save();
    console.log('Updated coordinator1 with Coordinator Sarah & password123');
  }

  // 2. Ensure teacher1 (Teacher Miguel) exists
  let teacher = await User.findOne({ username: 'teacher1' });
  const teacherHashed = await bcrypt.hash('123456', 10);
  if (!teacher) {
    teacher = await User.create({
      username: 'teacher1',
      password: teacherHashed,
      name: 'Teacher Miguel',
      role: 'teacher',
      specialization: 'reading',
      active: true,
    });
    console.log('Created teacher1');
  }

  // 3. Ensure teacher2 (Teacher Elena) exists for testing coordinator re-assignment
  let teacher2 = await User.findOne({ username: 'teacher2' });
  if (!teacher2) {
    teacher2 = await User.create({
      username: 'teacher2',
      password: teacherHashed,
      name: 'Teacher Elena',
      role: 'teacher',
      specialization: 'all-subjects',
      active: true,
    });
    console.log('Created teacher2');
  }

  // 4. Assign all unassigned LearnerRecords to teacher1 by default
  const updated = await LearnerRecord.updateMany(
    { $or: [{ assignedTeacherId: null }, { assignedTeacherId: { $exists: false } }] },
    {
      $set: {
        assignedTeacherId: teacher._id,
        assignedTeacherName: teacher.name,
      },
    }
  );
  console.log(`Assigned ${updated.modifiedCount} learner records to Teacher Miguel (${teacher._id}).`);

  process.exit(0);
};

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});

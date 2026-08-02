require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema Blueprint
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['student', 'teacher', 'principal'], 
    required: true 
  },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

const seedUsers = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error('Missing MONGODB_URI/MONGO_URI in your .env file.');
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas for seeding...\n');

    // Hash default password for all test accounts
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const initialUsers = [
      {
        username: 'student1',
        password: hashedPassword,
        fullName: 'Juan Dela Cruz',
        role: 'student',
      },
      {
        username: 'teacher1',
        password: hashedPassword,
        fullName: 'Teacher Miguel Pedrealba',
        role: 'teacher',
      },
      {
        username: 'principal1',
        password: hashedPassword,
        fullName: 'Principal Maria Santos',
        role: 'principal',
      },
    ];

    for (const userData of initialUsers) {
      await User.findOneAndUpdate(
        { username: userData.username },
        userData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`👤 Seeded Account: ${userData.username} (${userData.role.toUpperCase()})`);
    }

    console.log('\n🎉 Accounts injected successfully!');
    console.log('===================================');
    console.log('🔑 Default Password for all accounts: password123');
    console.log('===================================\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB Atlas.');
    process.exit(0);
  }
};

seedUsers();
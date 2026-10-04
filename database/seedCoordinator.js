// One-off, non-destructive: ensures coordinator1 exists. Leaves all other data untouched.
const connectDB = require('./db');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const run = async () => {
  await connectDB();
  const hashed = await bcrypt.hash('password123', 10);
  const existing = await User.findOne({ username: 'coordinator1' });
  if (existing) {
    existing.name = 'Coordinator Sarah';
    existing.password = hashed;
    existing.role = 'coordinator';
    existing.active = true;
    await existing.save();
    console.log('coordinator1 updated ->', existing.name, '| role:', existing.role);
    process.exit(0);
  }
  const created = await User.create({
    username: 'coordinator1',
    password: hashed,
    name: 'Coordinator Sarah',
    role: 'coordinator',
    active: true,
  });
  console.log('Created coordinator1 ->', created.username, '| role:', created.role);
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
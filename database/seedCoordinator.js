// One-off, non-destructive: ensures coordinator1 exists. Leaves all other data untouched.
const connectDB = require('./db');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const run = async () => {
  await connectDB();
  const existing = await User.findOne({ username: 'coordinator1' });
  if (existing) {
    console.log('coordinator1 already exists ->', existing.name, '| role:', existing.role);
    process.exit(0);
  }
  const hashed = await bcrypt.hash('123456', 10);
  const created = await User.create({
    username: 'coordinator1',
    password: hashed,
    name: 'ARAL Coordinator',
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
// Non-destructive migration: sets default password to 'password123'
// and enforces mustChangePassword: true on faculty/staff accounts (principal, coordinator, teacher).
const connectDB = require('./db');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const run = async () => {
  await connectDB();

  console.log('Migrating faculty and staff credentials to default password123...');
  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash('password123', salt);

  // Update staff accounts (principal, coordinator, teacher)
  const staffFilter = { role: { $in: ['principal', 'coordinator', 'teacher'] } };
  const staffUsers = await User.find(staffFilter);

  console.log(`Found ${staffUsers.length} staff accounts to update.`);

  for (const user of staffUsers) {
    user.password = defaultPassword;
    user.mustChangePassword = true;
    await user.save();
    console.log(`Updated ${user.username} (${user.role}) -> password: password123, mustChangePassword: true`);
  }

  console.log('Migration completed successfully.');
  process.exit(0);
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

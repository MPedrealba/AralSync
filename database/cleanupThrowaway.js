// One-off cleanup: removes the temporary accounts created during coordinator verification.
// Safe to re-run (deletes only the two throwaway usernames; leaves everything else untouched).
const connectDB = require('./db');
const User = require('../models/User');

const run = async () => {
  await connectDB();
  const del = await User.deleteMany({
    username: { $in: ['throwawayteacher', 'thrucoord'] },
  });
  console.log('cleanup deleted', del.deletedCount, 'throwaway user(s)');
  process.exit(0);
};

run().catch((err) => {
  console.error('Cleanup error:', err.message);
  process.exit(1);
});
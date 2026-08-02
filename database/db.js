require('dotenv').config(); // Loads environment variables from your root .env file
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Looks for MONGODB_URI first, then falls back to MONGO_URI
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!uri) {
      throw new Error('No MongoDB URI found in .env file (check MONGODB_URI or MONGO_URI)');
    }

    // Attempt to connect to MongoDB Atlas
    const conn = await mongoose.connect(uri);

    console.log(`✅ MongoDB Atlas Connected Successfully: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ Database Connection Error:', err.message);
    process.exit(1);
  }
};

connectDB();

module.exports = connectDB;
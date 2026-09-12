const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'principal', 'coordinator'], required: true },
  specialization: { type: String, enum: ['reading', 'all-subjects'], default: 'all-subjects' },
  email: { type: String },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

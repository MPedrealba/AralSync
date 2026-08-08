const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['OMR', 'READING_FLUENCY', 'COMPREHENSION'] },
  score: { type: Number },
  wpm: { type: Number }, // Optional, mainly for oral reading
  competency: { type: String },
  masteryLevel: { type: String },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Assessment || mongoose.model('Assessment', AssessmentSchema);

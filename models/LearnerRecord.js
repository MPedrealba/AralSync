const mongoose = require('mongoose');

const LearnerRecordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lrn: { type: String, required: true, unique: true },
  gradeLevel: { type: Number },
  section: { type: String },
  riskLevel: { type: String, enum: ['Low Risk', 'Moderate Risk', 'High Risk'] },
  masteryStatus: { type: String, enum: ['Beginning', 'Developing', 'Approaching', 'Proficient'] },
  guardian: { type: String },
  contact: { type: String },
  address: { type: String }
}, { timestamps: true });

module.exports = mongoose.models.LearnerRecord || mongoose.model('LearnerRecord', LearnerRecordSchema);

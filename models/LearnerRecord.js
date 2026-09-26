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
  address: { type: String },
  // ── Phil-IRI Metrics (Phase B) ──
  readingLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration', 'Non-Reader', 'Not Assessed'],
    default: 'Not Assessed'
  },
  oralReadingAccuracy: { type: Number },
  oralReadingWpm: { type: Number },
  oralReadingWer: { type: Number },
  oralReadingLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration', 'Non-Reader', 'Not Assessed']
  },
  comprehensionScore: { type: Number },
  comprehensionLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration']
  },
  combinedReadingLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration']
  },
  philIriStatus: {
    type: String,
    enum: ['unassessed', 'pending', 'approved', 'flagged'],
    default: 'unassessed'
  },
  lastReadingAssessmentDate: { type: Date },
  lastReadingAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' }
}, { timestamps: true });

module.exports = mongoose.models.LearnerRecord || mongoose.model('LearnerRecord', LearnerRecordSchema);

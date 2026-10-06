const mongoose = require('mongoose');

const InterventionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String },
  category: { type: String },
  type: { type: String, enum: ['Video', 'Activity', 'Module'] },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Submitted', 'Reviewed', 'Completed'],
    default: 'Not Started',
  },
  assignedDate: { type: Date, default: Date.now },
  dueDate: { type: Date, default: null },
  instructions: { type: String, default: '' },
  reviewed: { type: Boolean, default: false },
  // Which weakness/competency this intervention targets (e.g. "Numeracy", "Science",
  // "Reading Comprehension"). Used by auto-assign to avoid duplicate active interventions.
  weakness: { type: String },
  // The library item this was auto-assigned from, when applicable.
  recommendationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation' },
  // ARAL Learning Materials
  workbookUrl: { type: String, default: null },
  tutorGuideUrl: { type: String, default: null },
  keyStage: { type: String, default: null },
  pageStart: { type: Number, default: null },
  pageEnd: { type: Number, default: null },
  sessionInfo: { type: String, default: null },

  // Activity Submission & Grading
  submissionText: { type: String, default: '' },
  submissionFileUrl: { type: String, default: null },
  submittedAt: { type: Date, default: null },
  teacherRemarks: { type: String, default: '' },
  gradeScore: { type: mongoose.Schema.Types.Mixed, default: null },
  gradedAt: { type: Date, default: null },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

if (mongoose.models.Intervention && !mongoose.models.Intervention.schema.paths.submissionText) {
  delete mongoose.models.Intervention;
}

module.exports = mongoose.models.Intervention || mongoose.model('Intervention', InterventionSchema);

const mongoose = require('mongoose');

const InterventionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String },
  category: { type: String },
  type: { type: String, enum: ['Video', 'Activity', 'Module'] },
  status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'] },
  assignedDate: { type: Date, default: Date.now },
  reviewed: { type: Boolean, default: false },
  // Which weakness/competency this intervention targets (e.g. "Numeracy", "Science",
  // "Reading Comprehension"). Used by auto-assign to avoid duplicate active interventions.
  weakness: { type: String },
  // The library item this was auto-assigned from, when applicable.
  recommendationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation' }
}, { timestamps: true });

module.exports = mongoose.models.Intervention || mongoose.model('Intervention', InterventionSchema);

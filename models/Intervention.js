const mongoose = require('mongoose');

const InterventionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String },
  category: { type: String },
  type: { type: String, enum: ['Video', 'Activity', 'Module'] },
  status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'] },
  assignedDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Intervention || mongoose.model('Intervention', InterventionSchema);

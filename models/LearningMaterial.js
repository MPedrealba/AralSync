const mongoose = require('mongoose');

const SessionDirectorySchema = new mongoose.Schema(
  {
    sessionName: { type: String, required: true },
    pageStart: { type: Number, required: true },
    pageEnd: { type: Number, required: true },
    topic: { type: String, default: '' },
  },
  { _id: false }
);

const LearningMaterialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: {
      type: String,
      enum: ['Reading', 'Math', 'Science', 'All', 'General'],
      default: 'General',
    },
    keyStage: {
      type: String,
      enum: ['KS1', 'KS2', 'KS3', 'General'],
      default: 'General',
    },
    gradeLevels: [{ type: Number }], // e.g. [7, 8, 9, 10]
    edition: { type: String, default: 'DepEd ARAL Current' }, // e.g. 'SY 2026-2027'
    type: {
      type: String,
      enum: [
        'Learner Workbook',
        'Tutors Guide',
        'Reading Selection',
        'Supplementary Module',
      ],
      default: 'Learner Workbook',
    },
    fileUrl: { type: String, required: true }, // Static path or uploaded file URL
    isActive: { type: Boolean, default: true }, // If false, archived/hidden from active selection
    sessionDirectory: [SessionDirectorySchema], // Pre-mapped session pages
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LearningMaterialSchema.index({ subject: 1, keyStage: 1, isActive: 1 });
LearningMaterialSchema.index({ edition: 1 });

// Prevent Mongoose model caching issue in Next.js development HMR
if (mongoose.models && mongoose.models.LearningMaterial) {
  delete mongoose.models.LearningMaterial;
}

module.exports = mongoose.model('LearningMaterial', LearningMaterialSchema);

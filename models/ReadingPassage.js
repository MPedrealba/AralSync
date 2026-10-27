const mongoose = require('mongoose');

const ReadingPassageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    text: { type: String },
    gradeLevel: { type: Number },
    keyStage: { type: String, enum: ['KS1', 'KS2', 'KS3'], default: 'KS3' },
    language: { type: String, enum: ['en', 'tl'], default: 'en' },
    questions: [
      {
        question: String,
        options: [String],
        answer: String,
      },
    ],
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningMaterial' },
    sourceMaterial: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ReadingPassage ||
  mongoose.model('ReadingPassage', ReadingPassageSchema);

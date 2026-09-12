const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema(
  {
    subject: { type: String, enum: ['Math', 'Science'] },
    gradeLevel: { type: Number, min: 7, max: 10 },
    competencyCode: { type: String, default: '' }, // e.g. M7NS-Ic-1
    competency: { type: String, default: '' }, // friendly name, e.g. Fractions & Decimals
    topic: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'mid', 'hard'], default: 'mid' },
    mode: { type: String, enum: ['mc', 'written'], default: 'mc' }, // mc = bubble-gradable, written = teacher grades manually
    prompt: { type: String, required: true },
    choices: { type: [String], default: [] }, // exactly 4 for mc; [] for written
    // correctAnswer is stored as the letter ("A".."D") so it maps directly to an AnswerKey
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    source: { type: String, default: 'DepEd Learning Resource' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Question || mongoose.model('Question', QuestionSchema);

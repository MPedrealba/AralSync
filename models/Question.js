const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema(
  {
    subject: { type: String, enum: ['Reading', 'Math', 'Science', 'English', 'Filipino', 'Reading - Filipino', 'Reading - English'] },
    gradeLevel: { type: Number, min: 1, max: 12 },
    keyStage: { type: String, default: '' }, // e.g. KS1, KS2, KS3
    competencyCode: { type: String, default: '' }, // e.g. EN7RC-Ia-1 or M7NS-Ic-1
    competency: { type: String, default: '' }, // friendly name, e.g. Context Clues & Word Meaning
    topic: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'mid', 'hard'], default: 'mid' },
    mode: { type: String, enum: ['mc', 'written'], default: 'mc' }, // mc = bubble-gradable, written = teacher grades manually
    prompt: { type: String, required: true },
    choices: { type: [String], default: [] }, // exactly 4 for mc; [] for written
    // correctAnswer: letter ("A".."D") for mc; optional rubric/model answer for written
    correctAnswer: {
      type: String,
      validate: {
        validator: function (v) {
          if (this.mode === 'written') return true;
          return ['A', 'B', 'C', 'D'].includes(v);
        },
        message: 'Multiple choice questions must have a correct answer of A, B, C, or D.',
      },
      required: function () {
        return this.mode !== 'written';
      },
    },
    source: { type: String, default: 'DepEd ARAL Learning Resource' },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningMaterial', default: null },
    sourceMaterial: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Question || mongoose.model('Question', QuestionSchema);

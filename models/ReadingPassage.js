const mongoose = require('mongoose');

const ReadingPassageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    text: { type: String },
    gradeLevel: { type: Number },
    questions: [
      {
        question: String,
        options: [String],
        answer: String,
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ReadingPassage ||
  mongoose.model('ReadingPassage', ReadingPassageSchema);

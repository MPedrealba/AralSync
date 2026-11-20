const mongoose = require('mongoose');

const CustomExamSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    subject: {
      type: String,
      enum: ['Math', 'Reading', 'Science', 'English', 'Filipino', 'Reading - English', 'Reading - Filipino'],
      required: true,
    },
    gradeLevel: { type: Number, min: 7, max: 10, required: true },
    items: {
      type: [
        {
          index: { type: Number, required: true },
          prompt: { type: String, required: true },
          choices: { type: [String], default: [] },  // exactly 4 for mc; [] for written
          correctAnswer: { type: String },            // letter A-D for mc; null for written
          mode: { type: String, enum: ['mc', 'written'], default: 'mc' },
        },
      ],
      required: true,
    },
    totalItems: { type: Number, required: true },
    writtenCount: { type: Number, default: 0 },
    assessmentType: {
      type: String,
      enum: ['quiz', 'exam', 'pre-test', 'post-test'],
      default: 'quiz',
    },
    topics: { type: [String], default: [] },
    answerKeyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'AnswerKey' },
    answerKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnswerKey' },
    documentUrl: { type: String, default: null },
    documentOriginalFilename: { type: String, default: null },
    answerKeySheetUrl: { type: String, default: null },
  },
  { timestamps: true }
);

// Ensure hot reload in development always picks up updated enums
if (process.env.NODE_ENV !== 'production' && mongoose.models.CustomExam) {
  delete mongoose.models.CustomExam;
}
module.exports =
  mongoose.models.CustomExam || mongoose.model('CustomExam', CustomExamSchema);

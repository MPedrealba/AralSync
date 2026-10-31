const mongoose = require('mongoose');

const AnswerKeySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, enum: ['Math', 'Reading', 'Science'] },
    items: { type: Number },
    totalItems: { type: Number },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomExam', default: null },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assessmentType: { type: String, enum: ['quiz', 'exam', 'pre-test', 'post-test'], default: 'quiz' },
    assessmentCategory: { type: String, enum: ['quiz', 'exam', 'pre-test', 'post-test'], default: 'quiz' },
    topic: { type: String, default: '' },
    topics: { type: [String], default: [] },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningMaterial', default: null },
    sourceMaterial: { type: String, default: '' },
    keyStage: { type: String, default: '' },
    questionnaireId: { type: String, default: null },
    answers: { type: mongoose.Schema.Types.Mixed },
    answerLetters: { type: [String], default: [] },
    // modes[i] parallel to answers[i]: 'mc' (auto-graded) or 'written' (manual)
    modes: { type: [String], default: [] },
    // written item metadata so the teacher can grade them after a scan:
    // { index, prompt, max } — index is the 0-based item position on the sheet.
    writtenItems: { type: [{ index: Number, prompt: String, max: Number }], default: [] },
    questions: { type: mongoose.Schema.Types.Mixed, default: [] },
    sections: { type: mongoose.Schema.Types.Mixed, default: [] },
    passageTitle: { type: String, default: '' },
    passageText: { type: String, default: '' },
    // ── Online CBT Delivery Settings ──
    isOnline: { type: Boolean, default: false },
    timeLimitMinutes: { type: Number, default: 0 }, // 0 = untimed
    dueDate: { type: Date, default: null },
    targetGrade: { type: Number, default: null },
    targetSection: { type: String, default: '' },
    created: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AnswerKey || mongoose.model('AnswerKey', AnswerKeySchema);

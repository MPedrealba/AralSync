const mongoose = require('mongoose');

const AnswerKeySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, enum: ['Math', 'Reading', 'Science'] },
    items: { type: Number },
    answers: { type: [String] },
    // modes[i] parallel to answers[i]: 'mc' (auto-graded) or 'written' (manual)
    modes: { type: [String], default: [] },
    // written item metadata so the teacher can grade them after a scan:
    // { index, prompt, max } — index is the 0-based item position on the sheet.
    writtenItems: { type: [{ index: Number, prompt: String, max: Number }], default: [] },
    created: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AnswerKey || mongoose.model('AnswerKey', AnswerKeySchema);

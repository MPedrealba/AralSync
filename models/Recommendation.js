const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    kind: { type: String, enum: ['Video', 'Quiz', 'Activity', 'Module'] },
    subject: { type: String, enum: ['Math', 'Reading', 'Science'] },
    description: { type: String },
    meta: {
      items: Number,
      lessons: Number,
      duration: String,
      level: String,
    },
    // DepEd curriculum alignment: competency code + which learning resource it maps to
    depedCode: { type: String, default: '' }, // e.g. M7NS-IIc-1
    source: { type: String, default: 'DepEd Learning Resource' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Recommendation ||
  mongoose.model('Recommendation', RecommendationSchema);

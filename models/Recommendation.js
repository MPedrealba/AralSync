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
    // ARAL Learning Materials additions
    workbookUrl: { type: String, default: null },
    tutorGuideUrl: { type: String, default: null },
    keyStage: { type: String, default: null },
    programLevel: { type: String, default: null },
    proficiencyTier: { type: String, default: null }, // 'Beginning' | 'Developing' | 'Proficient' | 'Frustration' | 'Instructional' | 'Independent'
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningMaterial', default: null },
    passageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReadingPassage', default: null },
    isDynamic: { type: Boolean, default: false },
    targetGrades: [{ type: Number }],
    pageStart: { type: Number, default: null },
    pageEnd: { type: Number, default: null },
    sessionInfo: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

if (mongoose.models && mongoose.models.Recommendation) {
  delete mongoose.models.Recommendation;
}

module.exports = mongoose.model('Recommendation', RecommendationSchema);

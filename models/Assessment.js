const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['OMR', 'READING_FLUENCY', 'COMPREHENSION'] },
  subject: { type: String, enum: ['Math', 'Reading', 'Science'] },
  title: { type: String },
  score: { type: Number },
  wpm: { type: Number }, // Optional, mainly for oral reading
  accuracy: { type: Number }, // reading fluency
  pauses: { type: Number }, // reading fluency
  durationSec: { type: Number }, // reading fluency
  wer: { type: Number }, // Word Error Rate vs reference passage (0-100)
  // ── Librosa acoustic features (from Python AI service) ──
  silenceSec: { type: Number }, // total silence duration in seconds
  silenceRatio: { type: Number }, // silence / total duration (0-1)
  pacing: { type: Number }, // inter-onset interval CV (lower = more consistent pacing)
  hesitations: { type: Number }, // count of detected hesitation patterns
  longestPause: { type: Number }, // longest continuous pause in seconds
  status: { type: String, enum: ['pending', 'approved', 'flagged'], default: 'pending' }, // teacher validation
  notes: { type: String }, // reading fluency / teacher notes
  competency: { type: String },
  masteryLevel: { type: String },
  combinedLevel: { type: String }, // Phil-IRI combined level (WR accuracy + comprehension)
  passageTitle: { type: String }, // comprehension passage
  // ── Hybrid scoring (MC auto-graded + manual written items) ──
  totalItems: { type: Number }, // all items (MC + written)
  scoredItems: { type: Number }, // MC items answered correctly (auto-graded)
  mcTotal: { type: Number }, // number of multiple-choice items
  writtenMax: { type: Number, default: 0 }, // max points available on written items
  writtenScore: { type: Number, default: 0 }, // points the teacher awarded on written items
  gradingStatus: { type: String, enum: ['complete', 'partial'], default: 'complete' },
  answerKeyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'AnswerKey' },
  writtenItems: { type: [{ index: Number, prompt: String, max: Number }], default: [] },
  subskills: [
    {
      name: { type: String },
      status: { type: String },
      score: { type: Number },
    },
  ],
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Assessment || mongoose.model('Assessment', AssessmentSchema);

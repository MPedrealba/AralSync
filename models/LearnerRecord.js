const mongoose = require('mongoose');

const PhilIriLanguageMetricsSchema = new mongoose.Schema(
  {
    gstScore: { type: Number, min: 0, max: 40, default: null },
    gstStatus: {
      type: String,
      enum: [
        'Grade-Ready',
        'Needs Individualized Assessment',
        'Unassessed',
        'Handa sa Baitang',
        'Nangangailangan ng Karagdagang Pagtataya',
        'Hindi Pa Naitatasa',
      ],
      default: 'Unassessed',
    },
    recommendedStartingLevel: { type: Number, default: null },
    readingLevel: {
      type: String,
      enum: [
        'Independent',
        'Instructional',
        'Frustration',
        'Non-Reader',
        'Malaya',
        'Pampagkatuto',
        'Pagkabigo',
        'Hindi Makabasa',
        'Not Assessed',
        'Hindi Pa Naitatasa',
      ],
      default: 'Not Assessed',
    },
    oralAccuracy: { type: Number, default: null },
    wpm: { type: Number, default: null },
    oralWer: { type: Number, default: null },
    oralLevel: { type: String, default: null },
    comprehensionScore: { type: Number, default: null },
    comprehensionLevel: { type: String, default: null },
    combinedLevel: {
      type: String,
      enum: [
        'Independent',
        'Instructional',
        'Frustration',
        'Non-Reader',
        'Malaya',
        'Pampagkatuto',
        'Pagkabigo',
        'Hindi Makabasa',
        'Beginning',
        'Developing',
        'Approaching',
        'Proficient',
        'Not Assessed',
        'Hindi Pa Naitatasa',
      ],
      default: 'Not Assessed',
    },
    status: {
      type: String,
      enum: ['unassessed', 'pending', 'approved', 'flagged'],
      default: 'unassessed',
    },
    needsIndividualAssessment: { type: Boolean, default: false },
    lastAssessmentDate: { type: Date, default: null },
    lastAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', default: null },
  },
  { _id: false }
);

const LearnerRecordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lrn: { type: String, required: true, unique: true },
  gradeLevel: { type: Number },
  section: { type: String },
  birthDate: { type: String }, // Format YYYY-MM-DD for student verification
  riskLevel: {
    type: String,
    enum: ['Low Risk', 'Moderate Risk', 'High Risk', 'Pending Assessment'],
    default: 'Pending Assessment'
  },
  masteryStatus: { type: String, enum: ['Beginning', 'Developing', 'Approaching', 'Proficient'] },
  guardian: { type: String },
  contact: { type: String },
  address: { type: String },
  // ── Phil-IRI Stage 1 (Group Screening Test - GST) ──
  gstScore: { type: Number, min: 0, max: 40, default: null },
  gstStatus: {
    type: String,
    enum: ['Grade-Ready', 'Needs Individualized Assessment', 'Unassessed'],
    default: 'Unassessed',
  },
  recommendedStartingLevel: { type: Number, default: null },
  needsIndividualAssessment: { type: Boolean, default: false },
  // ── Phil-IRI Metrics (Phase B) ──
  readingLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration', 'Non-Reader', 'Not Assessed'],
    default: 'Not Assessed'
  },
  oralReadingAccuracy: { type: Number },
  oralReadingWpm: { type: Number },
  oralReadingWer: { type: Number },
  oralReadingLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration', 'Non-Reader', 'Not Assessed']
  },
  comprehensionScore: { type: Number },
  comprehensionLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration', 'Non-Reader', 'Beginning', 'Developing', 'Approaching', 'Proficient', 'Not Assessed']
  },
  combinedReadingLevel: {
    type: String,
    enum: ['Independent', 'Instructional', 'Frustration', 'Non-Reader', 'Beginning', 'Developing', 'Approaching', 'Proficient', 'Not Assessed']
  },
  philIriStatus: {
    type: String,
    enum: ['unassessed', 'pending', 'approved', 'flagged'],
    default: 'unassessed'
  },
  lastReadingAssessmentDate: { type: Date },
  lastReadingAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
  // ── Dual Phil-IRI Language Metrics (English & Filipino) ──
  philIriEnglish: { type: PhilIriLanguageMetricsSchema, default: () => ({}) },
  philIriFilipino: { type: PhilIriLanguageMetricsSchema, default: () => ({}) },
  // ── Subject-Specific Teacher Assignments (Reading, Math, Science, English, Filipino) ──
  assignedTeachers: {
    reading: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    english: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    filipino: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    math: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    science: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  readingTeacherName: { type: String, default: null },
  englishTeacherName: { type: String, default: null },
  filipinoTeacherName: { type: String, default: null },
  mathTeacherName: { type: String, default: null },
  scienceTeacherName: { type: String, default: null },
  // Backwards compatibility primary/adviser teacher
  assignedTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedTeacherName: { type: String, default: null }
}, { timestamps: true, strictPopulate: false });

LearnerRecordSchema.index({ assignedTeacherId: 1 });
LearnerRecordSchema.index({ 'assignedTeachers.reading': 1 });
LearnerRecordSchema.index({ 'assignedTeachers.math': 1 });
LearnerRecordSchema.index({ 'assignedTeachers.science': 1 });

if (
  mongoose.models.LearnerRecord &&
  (!mongoose.models.LearnerRecord.schema.paths.gstScore ||
    !mongoose.models.LearnerRecord.schema.paths['assignedTeachers.reading'] ||
    !mongoose.models.LearnerRecord.schema.paths.assignedTeacherId ||
    !mongoose.models.LearnerRecord.schema.paths.philIriEnglish ||
    !mongoose.models.LearnerRecord.schema.paths.philIriFilipino ||
    !mongoose.models.LearnerRecord.schema.paths.riskLevel?.enumValues?.includes('Pending Assessment'))
) {
  delete mongoose.models.LearnerRecord;
}

module.exports = mongoose.models.LearnerRecord || mongoose.model('LearnerRecord', LearnerRecordSchema);

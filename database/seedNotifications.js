/**
 * Seed sample notifications for the teacher dashboard bell.
 *
 * The bell is fed by the AuditLog, so this inserts realistic sample entries
 * (scored assessments, reading fluency, interventions marked done, ...) tagged
 * meta.seeded = true. Idempotent: only runs when no seeded entries exist yet.
 *
 * Run:  node database/seedNotifications.js
 */
const mongoose = require('mongoose');
const connectDB = require('./db');
const AuditLog = require('../models/AuditLog');
const LearnerRecord = require('../models/LearnerRecord');
const Assessment = require('../models/Assessment');
const Intervention = require('../models/Intervention');

/** n minutes in the past. */
const minsAgo = (n) => new Date(Date.now() - n * 60 * 1000);

const seed = async () => {
  await connectDB();

  const seeded = await AuditLog.countDocuments({ 'meta.seeded': true });
  if (seeded > 0) {
    console.log(`ℹ️  ${seeded} seeded notification(s) already exist — skipping.`);
    await mongoose.connection.close();
    return;
  }

  // Resolve real targets when present so clicks land on actual records.
  // learners/[id] accepts the LearnerRecord _id OR the student's User _id.
  const learner = await LearnerRecord.findOne();
  const assessment = await Assessment.findOne();
  const intervention = await Intervention.findOne();
  const teacherName = 'Analyn Santos';

  const learnerId = String(learner?.studentId || learner?._id || '').trim() || undefined;
  const assessmentId = String(assessment?._id || '').trim() || undefined;
  const interventionId = String(intervention?._id || '').trim() || undefined;

  const entries = [
    {
      actorName: 'Maria Santos',
      role: 'teacher',
      action: 'omr_sheet_uploaded',
      targetType: 'Assessment',
      meta: {
        seeded: true,
        studentId: learnerId,
        subject: 'Math',
        title: 'Diagnostic Test 3 — Numeracy',
        mcCorrect: 14,
        mcTotal: 20,
        writtenItems: 0,
        gradingStatus: 'complete',
        assessmentId,
      },
    },
    {
      actorName: 'Maria Santos',
      role: 'teacher',
      action: 'reading_fluency_analyzed',
      targetType: 'Assessment',
      meta: {
        seeded: true,
        studentId: learnerId,
        passageTitle: 'The Ripple Effect',
        accuracy: 91,
        wer: 9,
        wpm: 122,
        masteryLevel: 'Approaching',
        simulation: false,
      },
    },
    {
      actorName: 'Student',
      role: 'student',
      action: 'intervention_marked_done',
      targetType: 'Intervention',
      targetId: interventionId,
      meta: { seeded: true, title: 'Reading Fluency Practice — Passage B', status: 'Completed' },
    },
    {
      actorName: teacherName,
      role: 'teacher',
      action: 'intervention_updated',
      targetType: 'Intervention',
      targetId: interventionId,
      meta: { seeded: true, title: 'Basic Operations Drills — Decimals', status: 'In Progress' },
    },
    {
      actorName: teacherName,
      role: 'teacher',
      action: 'assessment_written_graded',
      targetType: 'Assessment',
      meta: {
        seeded: true,
        studentId: learnerId,
        writtenScore: 4,
        totalItems: 20,
        score: 88,
        masteryLevel: 'Approaching',
      },
    },
    {
      actorName: teacherName,
      role: 'teacher',
      action: 'learner_import',
      targetType: 'LearnerRecord',
      meta: { seeded: true, created: 34, skippedDuplicates: 2, failed: 0, fileName: 'grade7-rosal.csv' },
    },
    {
      actorName: 'Student',
      role: 'student',
      action: 'reading_self_assessed',
      targetType: 'Assessment',
      meta: { seeded: true, passageTitle: 'The Water Cycle', accuracy: 88, wer: 12, wpm: 95, masteryLevel: 'Developing', simulation: false },
    },
    {
      actorName: 'Maria Santos',
      role: 'teacher',
      action: 'omr_sheet_uploaded',
      targetType: 'Assessment',
      meta: {
        seeded: true,
        studentId: learnerId,
        subject: 'Science',
        title: 'Earthquakes and Faults Quiz',
        mcCorrect: 9,
        mcTotal: 15,
        writtenItems: 0,
        gradingStatus: 'complete',
        assessmentId,
      },
    },
  ].map((e, i) => ({ ...e, createdAt: minsAgo(3 + i * 27) })); // 3m → ~3h spread

  await AuditLog.insertMany(entries);
  console.log(`✅ Seeded ${entries.length} sample notifications.`);
  await mongoose.connection.close();
};

seed().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
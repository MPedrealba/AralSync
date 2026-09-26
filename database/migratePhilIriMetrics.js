/**
 * One-off migration (Phase B):
 * 1. Promotes existing seeded pending assessments to 'approved' status.
 * 2. Computes and synchronizes official Phil-IRI metrics onto every LearnerRecord.
 *
 * Run: node database/migratePhilIriMetrics.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

function readingLevel(accuracy) {
  if (accuracy >= 96) return 'Independent';
  if (accuracy >= 91) return 'Instructional';
  if (accuracy >= 80) return 'Frustration';
  return 'Non-Reader';
}

function comprehensionLevel(score) {
  if (score >= 80) return 'Independent';
  if (score >= 59) return 'Instructional';
  return 'Frustration';
}

function combinedReadingLevel(accuracy, compScore) {
  const wr = accuracy >= 96 ? 3 : accuracy >= 91 ? 2 : 1;
  const comp = compScore >= 80 ? 3 : compScore >= 59 ? 2 : 1;
  const min = Math.min(wr, comp);
  return min === 3 ? 'Independent' : min === 2 ? 'Instructional' : 'Frustration';
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const As = db.collection('assessments');
  const LRs = db.collection('learnerrecords');

  // 1. Approve existing pending assessments that were seeded or completed
  const approvedAssessments = await As.updateMany(
    { status: 'pending' },
    { $set: { status: 'approved' } }
  );
  console.log(`Updated ${approvedAssessments.modifiedCount} pending assessments to 'approved'.`);

  // 2. Sync Phil-IRI metrics for each learner
  const records = await LRs.find({}).toArray();
  let updatedCount = 0;

  for (const r of records) {
    const sid = r.studentId;

    // Latest approved fluency
    const fluency = await As.find({
      studentId: sid,
      type: 'READING_FLUENCY',
      status: 'approved',
    })
      .sort({ date: -1 })
      .limit(1)
      .toArray();

    // Latest approved comprehension
    const comp = await As.find({
      studentId: sid,
      status: 'approved',
      $or: [
        { type: 'COMPREHENSION' },
        { type: 'OMR', subject: 'Reading' },
      ],
    })
      .sort({ date: -1 })
      .limit(1)
      .toArray();

    const fDoc = fluency[0];
    const cDoc = comp[0];

    const oralAccuracy = fDoc ? (fDoc.accuracy ?? fDoc.score) : undefined;
    const oralWpm = fDoc ? fDoc.wpm : undefined;
    const oralWer = fDoc ? fDoc.wer : undefined;
    const oralLevel = fDoc ? (fDoc.masteryLevel || (oralAccuracy != null ? readingLevel(oralAccuracy) : undefined)) : undefined;

    const compScore = cDoc ? cDoc.score : undefined;
    const compLevel = cDoc ? (cDoc.masteryLevel || (compScore != null ? comprehensionLevel(compScore) : undefined)) : undefined;

    let finalReadingLevel = 'Not Assessed';
    let finalCombinedLevel = undefined;

    if (oralAccuracy != null && compScore != null) {
      finalCombinedLevel = combinedReadingLevel(oralAccuracy, compScore);
      finalReadingLevel = finalCombinedLevel;
    } else if (oralLevel) {
      finalReadingLevel = oralLevel;
    } else if (compLevel) {
      finalReadingLevel = compLevel;
    }

    const philIriStatus = (fDoc || cDoc) ? 'approved' : 'unassessed';

    let lastDate = undefined;
    let lastId = undefined;
    if (fDoc && cDoc) {
      if (new Date(fDoc.date).getTime() >= new Date(cDoc.date).getTime()) {
        lastDate = fDoc.date;
        lastId = fDoc._id;
      } else {
        lastDate = cDoc.date;
        lastId = cDoc._id;
      }
    } else if (fDoc) {
      lastDate = fDoc.date;
      lastId = fDoc._id;
    } else if (cDoc) {
      lastDate = cDoc.date;
      lastId = cDoc._id;
    }

    let riskLevel = r.riskLevel;
    if (finalReadingLevel === 'Non-Reader') {
      riskLevel = 'High Risk';
    } else if (finalReadingLevel === 'Frustration' && riskLevel === 'Low Risk') {
      riskLevel = 'Moderate Risk';
    }

    await LRs.updateOne(
      { _id: r._id },
      {
        $set: {
          readingLevel: finalReadingLevel,
          oralReadingAccuracy: oralAccuracy,
          oralReadingWpm: oralWpm,
          oralReadingWer: oralWer,
          oralReadingLevel: oralLevel,
          comprehensionScore: compScore,
          comprehensionLevel: compLevel,
          combinedReadingLevel: finalCombinedLevel,
          philIriStatus,
          lastReadingAssessmentDate: lastDate,
          lastReadingAssessmentId: lastId,
          riskLevel,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`Learner ${r.lrn}: readingLevel = ${finalReadingLevel} (Combined: ${finalCombinedLevel || '—'}, Acc: ${oralAccuracy ?? '—'}%, Comp: ${compScore ?? '—'}%)`);
    updatedCount++;
  }

  console.log(`\nSuccessfully synchronized ${updatedCount} LearnerRecords with Phil-IRI metrics.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});

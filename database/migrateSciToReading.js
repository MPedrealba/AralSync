/**
 * One-off migration: convert Science comprehension assessments into Reading
 * comprehension. Comprehension is the Silent Reading (SRT) component of the
 * reading assessment — it always belongs to subject 'Reading', competency
 * 'Reading Comprehension' (never a science competency).
 *
 * Run:  node database/migrateSciToReading.js
 * Safe to re-run (idempotent — no Science comprehension rows remain).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const PASSAGES = ['The Greedy Dog', 'The Crow and the Pitcher', 'The Ant and the Dove'];

function levelFor(score) {
  return score >= 85 ? 'Independent' : score >= 75 ? 'Instructional' : score >= 60 ? 'Frustration' : 'Non-Reader';
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const As = mongoose.connection.db.collection('assessments');

  const sci = await As.find({ type: 'COMPREHENSION', subject: 'Science' }).toArray();
  let inserted = 0;
  for (const a of sci) {
    await As.deleteOne({ _id: a._id });
    const score = a.score ?? 75;
    await As.insertOne({
      studentId: a.studentId,
      type: 'COMPREHENSION',
      subject: 'Reading',
      title: 'Reading Comprehension',
      passageTitle: PASSAGES[inserted % PASSAGES.length],
      competency: 'Reading Comprehension',
      score,
      masteryLevel: levelFor(score),
      subskills: a.subskills || undefined,
      status: a.status || 'pending',
      date: a.date || new Date(),
      createdAt: a.createdAt || new Date(),
      updatedAt: a.updatedAt || new Date(),
    });
    inserted++;
  }

  const remainSci = await As.countDocuments({ type: 'COMPREHENSION', subject: 'Science' });
  const remainRead = await As.countDocuments({ type: 'COMPREHENSION', subject: 'Reading' });
  console.log(JSON.stringify({ deleted: sci.length, inserted, remainSci, remainRead }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error('MIGRATE_ERR', e.message);
  process.exit(1);
});
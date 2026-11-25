const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

/**
 * Format an 8-digit Student Number for Option A: YYYY + 4-digit zero-padded sequence.
 * E.g. year=2026, seq=1 -> "20260001", seq=110 -> "20260110".
 */
function formatStudentNumber(year, seq) {
  return `${year}${String(seq).padStart(4, '0')}`;
}

/**
 * Extract the integer sequence suffix for a given year's Student Number strings.
 */
function parseSequenceFromStudentNumber(value, year) {
  if (typeof value !== 'string') return 0;
  const prefix = String(year);
  if (!value.startsWith(prefix)) return 0;
  const suffix = value.slice(prefix.length);
  if (!/^\d+$/.test(suffix)) return 0;
  const num = parseInt(suffix, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/**
 * Compute highest existing numeric suffix in LearnerRecord and User collections
 * for a given year so counter initialization never collides with existing records.
 */
async function findMaxExistingSeq(year) {
  const LearnerRecord = mongoose.models.LearnerRecord || require('./LearnerRecord');
  const User = mongoose.models.User || require('./User');
  const regex = new RegExp(`^${year}\\d+$`);

  const [records, users] = await Promise.all([
    LearnerRecord.find({ studentNumber: regex }, { studentNumber: 1 }).lean(),
    User.find({ role: 'student', username: regex }, { username: 1 }).lean(),
  ]);

  let maxSeq = 0;
  for (const r of records) {
    const n = parseSequenceFromStudentNumber(r.studentNumber, year);
    if (n > maxSeq) maxSeq = n;
  }
  for (const u of users) {
    const n = parseSequenceFromStudentNumber(u.username, year);
    if (n > maxSeq) maxSeq = n;
  }
  return maxSeq;
}

/**
 * Ensure the year's Counter document exists and is initialized at least to the
 * maximum existing sequence in the database.
 */
async function ensureCounterInitialized(year = new Date().getFullYear()) {
  const counterId = `studentNumber_${year}`;
  const existing = await Counter.findById(counterId).lean();
  if (existing) return existing;

  const maxExisting = await findMaxExistingSeq(year);
  const doc = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $setOnInsert: { seq: maxExisting } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
  return doc;
}

/**
 * Atomically allocate `count` sequential Student Numbers (e.g., ["20260001", ...]).
 * Safe under concurrent requests and bulk imports.
 */
async function allocateStudentNumbers(count = 1, year = new Date().getFullYear()) {
  if (!count || count <= 0) return [];
  const counterId = `studentNumber_${year}`;
  await ensureCounterInitialized(year);

  const updated = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: count } },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  const endSeq = updated.seq;
  const startSeq = endSeq - count + 1;
  const numbers = [];
  for (let s = startSeq; s <= endSeq; s++) {
    numbers.push(formatStudentNumber(year, s));
  }
  return numbers;
}

/**
 * Preview what the next allocated Student Number will look like without incrementing.
 */
async function peekNextStudentNumber(year = new Date().getFullYear()) {
  const doc = await ensureCounterInitialized(year);
  return formatStudentNumber(year, (doc?.seq || 0) + 1);
}

/**
 * Explicitly reset/set the counter sequence to `seq` (used after clean DB reseeding).
 */
async function setStudentNumberCounter(seq, year = new Date().getFullYear()) {
  const counterId = `studentNumber_${year}`;
  return Counter.findOneAndUpdate(
    { _id: counterId },
    { $set: { seq } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
}

module.exports = Counter;
module.exports.Counter = Counter;
module.exports.formatStudentNumber = formatStudentNumber;
module.exports.allocateStudentNumbers = allocateStudentNumbers;
module.exports.peekNextStudentNumber = peekNextStudentNumber;
module.exports.setStudentNumberCounter = setStudentNumberCounter;

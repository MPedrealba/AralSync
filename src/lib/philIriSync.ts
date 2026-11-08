import mongoose, { Types } from 'mongoose';
import LearnerRecord from '../../models/LearnerRecord';
import Assessment from '../../models/Assessment';
import {
  readingLevel,
  comprehensionLevel,
  combinedReadingLevel,
  evaluateReadingPerformance,
  evaluateGstScore,
  toFilipinoReadingLevel,
  type GstEvaluation,
} from './reading';

export { evaluateGstScore, toFilipinoReadingLevel, type GstEvaluation };

export interface PhilIriSyncResult {
  updated: boolean;
  readingLevel: string;
  combinedReadingLevel?: string;
  oralReadingAccuracy?: number;
  oralReadingWpm?: number;
  oralReadingWer?: number;
  oralReadingLevel?: string;
  comprehensionScore?: number;
  comprehensionLevel?: string;
  philIriStatus: 'unassessed' | 'pending' | 'approved' | 'flagged';
  lastReadingAssessmentDate?: Date;
  lastReadingAssessmentId?: string;
  philIriEnglish?: any;
  philIriFilipino?: any;
}

/**
 * Auto-calculates risk level based on assessment score percentage:
 * - Score < 50%  -> 'High Risk'
 * - Score 50%-74% -> 'Moderate Risk'
 * - Score >= 75%  -> 'Low Risk'
 */
export function calculateRiskLevelFromScore(score: number): 'High Risk' | 'Moderate Risk' | 'Low Risk' {
  if (score < 50) return 'High Risk';
  if (score <= 74) return 'Moderate Risk';
  return 'Low Risk';
}

interface LanguageMetricComputation {
  oralAccuracy?: number;
  oralWpm?: number;
  oralWer?: number;
  oralLevel?: string;
  compScore?: number;
  compLevel?: string;
  combinedLevel?: string;
  readingLevel: string;
  status: 'unassessed' | 'pending' | 'approved' | 'flagged';
  lastDate?: Date;
  lastId?: Types.ObjectId;
}

async function computeMetricsForSubject(
  sid: Types.ObjectId,
  subjectQuery: any
): Promise<LanguageMetricComputation> {
  // 1. Fetch approved oral reading assessments (most recent first)
  const approvedFluency = await Assessment.findOne({
    studentId: sid,
    type: 'READING_FLUENCY',
    status: 'approved',
    ...subjectQuery,
  }).sort({ date: -1, createdAt: -1 });

  // 2. Fetch approved comprehension assessments (from COMPREHENSION or OMR Reading exams)
  const approvedComp = await Assessment.findOne({
    studentId: sid,
    status: 'approved',
    $or: [
      { type: 'COMPREHENSION', ...subjectQuery },
      { type: 'OMR', ...subjectQuery },
    ],
  }).sort({ date: -1, createdAt: -1 });

  // 3. Check for any pending reading assessments
  const pendingCount = await Assessment.countDocuments({
    studentId: sid,
    status: 'pending',
    $or: [
      { type: 'READING_FLUENCY', ...subjectQuery },
      { type: 'COMPREHENSION', ...subjectQuery },
      { type: 'OMR', ...subjectQuery },
    ],
  });

  let oralAccuracy: number | undefined;
  let oralWpm: number | undefined;
  let oralWer: number | undefined;
  let oralLevel: string | undefined;
  let oralDate: Date | undefined;
  let oralId: Types.ObjectId | undefined;

  if (approvedFluency) {
    oralAccuracy = approvedFluency.accuracy ?? approvedFluency.score;
    oralWpm = approvedFluency.wpm;
    oralWer = approvedFluency.wer;
    const isPhilIri =
      approvedFluency.masteryLevel &&
      ['Independent', 'Instructional', 'Frustration', 'Non-Reader'].includes(approvedFluency.masteryLevel);
    oralLevel = isPhilIri
      ? approvedFluency.masteryLevel
      : oralAccuracy != null
      ? evaluateReadingPerformance(
          oralAccuracy,
          null,
          approvedFluency.wordsAttempted || 10,
          oralAccuracy > 0 ? 1 : 0
        ).philIriLevel
      : undefined;
    oralDate = approvedFluency.date || (approvedFluency as any).createdAt;
    oralId = approvedFluency._id as Types.ObjectId;
  }

  let compScore: number | undefined;
  let compLevel: string | undefined;
  let compDate: Date | undefined;
  let compId: Types.ObjectId | undefined;

  if (approvedComp) {
    compScore = approvedComp.score;
    compLevel = compScore != null ? comprehensionLevel(compScore) : undefined;
    compDate = approvedComp.date || (approvedComp as any).createdAt;
    compId = approvedComp._id as Types.ObjectId;
  } else if (
    approvedFluency &&
    (approvedFluency.comprehensionScore != null || (approvedFluency as any).comprehension?.score != null)
  ) {
    const embeddedScore = approvedFluency.comprehensionScore ?? (approvedFluency as any).comprehension?.score;
    if (embeddedScore != null && !Number.isNaN(Number(embeddedScore))) {
      const numScore = Number(embeddedScore);
      compScore = numScore;
      compLevel = comprehensionLevel(numScore);
      compDate = approvedFluency.date || (approvedFluency as any).createdAt;
      compId = approvedFluency._id as Types.ObjectId;
    }
  }

  let finalReadingLevel = 'Not Assessed';
  let finalCombinedLevel: string | undefined;

  if (oralAccuracy != null && compScore != null) {
    finalCombinedLevel = combinedReadingLevel(oralAccuracy, compScore);
    finalReadingLevel = finalCombinedLevel;
  } else if (oralLevel) {
    finalReadingLevel = oralLevel;
  } else if (compLevel) {
    finalReadingLevel = compLevel;
  }

  let status: 'unassessed' | 'pending' | 'approved' | 'flagged' = 'unassessed';
  if (approvedFluency || approvedComp) {
    status = 'approved';
  } else if (pendingCount > 0) {
    status = 'pending';
  }

  let lastDate: Date | undefined;
  let lastId: Types.ObjectId | undefined;
  if (oralDate && compDate) {
    if (new Date(oralDate).getTime() >= new Date(compDate).getTime()) {
      lastDate = oralDate;
      lastId = oralId;
    } else {
      lastDate = compDate;
      lastId = compId;
    }
  } else {
    lastDate = oralDate || compDate;
    lastId = oralId || compId;
  }

  return {
    oralAccuracy,
    oralWpm,
    oralWer,
    oralLevel,
    compScore,
    compLevel,
    combinedLevel: finalCombinedLevel,
    readingLevel: finalReadingLevel,
    status,
    lastDate,
    lastId,
  };
}

/**
 * Recalculates and persists a learner's official Phil-IRI 2024 metrics on their LearnerRecord.
 *
 * Rules (Phil-IRI 2024 DepEd Framework & ARAL Program RA 12028):
 * 1. Only teacher-approved assessments contribute to the official reading metrics.
 * 2. Oral Reading Fluency provides: Accuracy %, WPM, WER %, and Oral Reading Level
 *    (Independent >=97%, Instructional 90-96%, Frustration <=89%, Non-Reader <80% or 0 words decoded).
 * 3. Silent Reading Comprehension (from Reading passage checks or Reading OMR exams)
 *    provides: Comprehension Score % and Comprehension Level
 *    (Independent >=80%, Instructional 59-79%, Frustration <=58%).
 * 4. Combined Reading Level: When both oral reading accuracy and comprehension scores
 *    are present, the 4-Quadrant joint matrix applies (the stricter measure wins).
 * 5. If only oral or only comprehension is available, that single measure establishes
 *    the current reading level.
 * 6. Risk Level correlation: If the reading level is 'Non-Reader' or 'Frustration',
 *    a 'Low Risk' classification is automatically escalated to 'High Risk' or 'Moderate Risk'.
 */
export async function syncLearnerPhilIriMetrics(
  studentId: string | Types.ObjectId
): Promise<PhilIriSyncResult | null> {
  const sid = typeof studentId === 'string' ? new Types.ObjectId(studentId) : studentId;

  const record = await LearnerRecord.findOne({ studentId: sid });
  if (!record) {
    return null;
  }

  // 1. Compute English Reading metrics (default or subject: English / Reading)
  const english = await computeMetricsForSubject(sid, {
    subject: { $nin: ['Filipino', 'Reading - Filipino'] },
  });

  // 2. Compute Filipino Reading metrics (subject: Filipino / Reading - Filipino)
  const filipino = await computeMetricsForSubject(sid, {
    subject: { $in: ['Filipino', 'Reading - Filipino'] },
  });

  // Check for any Filipino GST assessment
  const filipinoGst = await Assessment.findOne({
    studentId: sid,
    subject: { $in: ['Filipino', 'Reading - Filipino'] },
    $or: [
      { assessmentCategory: 'pre-test' },
      { assessmentType: 'pre-test' },
      { type: 'OMR' },
    ],
  }).sort({ date: -1, createdAt: -1 });

  // Update philIriEnglish subdocument
  if (!record.philIriEnglish) record.philIriEnglish = {} as any;
  record.philIriEnglish.gstScore = record.gstScore ?? null;
  record.philIriEnglish.gstStatus = record.gstStatus ?? 'Unassessed';
  record.philIriEnglish.needsIndividualAssessment = record.needsIndividualAssessment ?? false;
  record.philIriEnglish.readingLevel = english.readingLevel;
  record.philIriEnglish.oralAccuracy = english.oralAccuracy ?? null;
  record.philIriEnglish.wpm = english.oralWpm ?? null;
  record.philIriEnglish.oralWer = english.oralWer ?? null;
  record.philIriEnglish.oralLevel = english.oralLevel ?? null;
  record.philIriEnglish.comprehensionScore = english.compScore ?? null;
  record.philIriEnglish.comprehensionLevel = english.compLevel ?? null;
  record.philIriEnglish.combinedLevel = english.combinedLevel ?? null;
  record.philIriEnglish.status = english.status;
  record.philIriEnglish.lastAssessmentDate = english.lastDate ?? null;
  record.philIriEnglish.lastAssessmentId = english.lastId ?? null;

  // Update philIriFilipino subdocument
  if (!record.philIriFilipino) record.philIriFilipino = {} as any;
  if (filipinoGst && typeof filipinoGst.score === 'number') {
    const filScore = filipinoGst.score;
    const isReady = filScore >= 28;
    record.philIriFilipino.gstScore = filScore;
    record.philIriFilipino.gstStatus = isReady
      ? 'Handa sa Baitang'
      : 'Nangangailangan ng Karagdagang Pagtataya';
    record.philIriFilipino.needsIndividualAssessment = !isReady;
  } else {
    record.philIriFilipino.gstScore = record.philIriFilipino?.gstScore ?? null;
    record.philIriFilipino.gstStatus = record.philIriFilipino?.gstStatus ?? 'Hindi Pa Naitatasa';
  }
  record.philIriFilipino.readingLevel = toFilipinoReadingLevel(filipino.readingLevel);
  record.philIriFilipino.oralAccuracy = filipino.oralAccuracy ?? null;
  record.philIriFilipino.wpm = filipino.oralWpm ?? null;
  record.philIriFilipino.oralWer = filipino.oralWer ?? null;
  record.philIriFilipino.oralLevel = toFilipinoReadingLevel(filipino.oralLevel);
  record.philIriFilipino.comprehensionScore = filipino.compScore ?? null;
  record.philIriFilipino.comprehensionLevel = toFilipinoReadingLevel(filipino.compLevel);
  record.philIriFilipino.combinedLevel = toFilipinoReadingLevel(filipino.combinedLevel);
  record.philIriFilipino.status = filipino.status;
  record.philIriFilipino.lastAssessmentDate = filipino.lastDate ?? null;
  record.philIriFilipino.lastAssessmentId = filipino.lastId ?? null;

  // 3. Resolve unified root fields for backwards compatibility
  // Use English metrics as primary, or most recent if Filipino is newer
  let primary = english;
  if (
    (!english.lastDate && filipino.lastDate) ||
    (english.lastDate && filipino.lastDate && new Date(filipino.lastDate).getTime() > new Date(english.lastDate).getTime())
  ) {
    primary = {
      ...filipino,
      // Map Filipino localized level back to English enum for root record schema compatibility
      readingLevel: english.readingLevel !== 'Not Assessed' ? english.readingLevel : filipino.readingLevel,
    };
  }

  const finalReadingLevel = primary.readingLevel || 'Not Assessed';
  const finalCombinedLevel = primary.combinedLevel;
  const oralAccuracy = primary.oralAccuracy;
  const oralWpm = primary.oralWpm;
  const oralWer = primary.oralWer;
  const oralLevel = primary.oralLevel;
  const compScore = primary.compScore;
  const compLevel = primary.compLevel;
  const philIriStatus = primary.status;
  const lastDate = primary.lastDate;
  const lastId = primary.lastId;

  // Apply to record (strictly conforming to LearnerRecord schema enums)
  record.readingLevel = finalReadingLevel;
  record.oralReadingAccuracy = oralAccuracy;
  record.oralReadingWpm = oralWpm;
  record.oralReadingWer = oralWer;
  record.oralReadingLevel = oralLevel;
  record.comprehensionScore = compScore;
  record.comprehensionLevel = compLevel;
  record.combinedReadingLevel = finalCombinedLevel;
  record.philIriStatus = philIriStatus;
  record.lastReadingAssessmentDate = lastDate;
  record.lastReadingAssessmentId = lastId;

  // Safeguard: Ensure masteryStatus never holds an invalid Phil-IRI string
  const validMasteryBands = ['Beginning', 'Developing', 'Approaching', 'Proficient'];
  if (record.masteryStatus && !validMasteryBands.includes(record.masteryStatus)) {
    if (oralAccuracy != null) {
      record.masteryStatus = evaluateReadingPerformance(oralAccuracy).masteryBand;
    } else if (record.masteryStatus === 'Independent') {
      record.masteryStatus = 'Proficient';
    } else if (record.masteryStatus === 'Instructional') {
      record.masteryStatus = 'Approaching';
    } else if (record.masteryStatus === 'Developing') {
      record.masteryStatus = 'Developing';
    } else {
      record.masteryStatus = 'Beginning';
    }
  }

  // Auto-calculate risk level based on assessment score / Phil-IRI level
  if (finalReadingLevel !== 'Not Assessed') {
    if (
      finalReadingLevel === 'Non-Reader' ||
      finalReadingLevel === 'Frustration' ||
      (oralAccuracy != null && oralAccuracy < 50) ||
      (compScore != null && compScore < 50)
    ) {
      record.riskLevel = 'High Risk';
    } else if (
      finalReadingLevel === 'Instructional' ||
      (oralAccuracy != null && oralAccuracy <= 74) ||
      (compScore != null && compScore <= 74)
    ) {
      record.riskLevel = 'Moderate Risk';
    } else if (
      finalReadingLevel === 'Independent' ||
      finalReadingLevel === 'Proficient' ||
      (oralAccuracy != null && oralAccuracy >= 75) ||
      (compScore != null && compScore >= 75)
    ) {
      record.riskLevel = 'Low Risk';
    }
  }

  await record.save();

  return {
    updated: true,
    readingLevel: finalReadingLevel,
    combinedReadingLevel: finalCombinedLevel,
    oralReadingAccuracy: oralAccuracy,
    oralReadingWpm: oralWpm,
    oralReadingWer: oralWer,
    oralReadingLevel: oralLevel,
    comprehensionScore: compScore,
    comprehensionLevel: compLevel,
    philIriStatus,
    lastReadingAssessmentDate: lastDate,
    lastReadingAssessmentId: lastId ? String(lastId) : undefined,
    philIriEnglish: record.philIriEnglish,
    philIriFilipino: record.philIriFilipino,
  };
}

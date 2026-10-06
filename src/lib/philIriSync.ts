import mongoose, { Types } from 'mongoose';
import LearnerRecord from '../../models/LearnerRecord';
import Assessment from '../../models/Assessment';
import { readingLevel, comprehensionLevel, combinedReadingLevel } from './reading';

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

/**
 * Recalculates and persists a learner's official Phil-IRI metrics on their LearnerRecord.
 *
 * Rules (Phil-IRI DepEd Framework & Capstone Spec):
 * 1. Only teacher-approved assessments contribute to the official reading metrics.
 * 2. Oral Reading Fluency provides: Accuracy %, WPM, WER %, and Oral Reading Level
 *    (Independent >=96%, Instructional 91-95%, Frustration 80-90%, Non-Reader <80%).
 * 3. Silent Reading Comprehension (from Reading passage checks or Reading OMR exams)
 *    provides: Comprehension Score % and Comprehension Level
 *    (Independent >=80%, Instructional 59-79%, Frustration <59%).
 * 4. Combined Reading Level: When both oral reading accuracy and comprehension scores
 *    are present, the stricter measure wins (both must clear for promotion).
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

  // 1. Fetch approved oral reading assessments (most recent first)
  const approvedFluency = await Assessment.findOne({
    studentId: sid,
    type: 'READING_FLUENCY',
    status: 'approved',
  }).sort({ date: -1 });

  // 2. Fetch approved comprehension assessments (from COMPREHENSION or OMR Reading exams)
  const approvedComp = await Assessment.findOne({
    studentId: sid,
    status: 'approved',
    $or: [
      { type: 'COMPREHENSION' },
      { type: 'OMR', subject: 'Reading' },
    ],
  }).sort({ date: -1 });

  // 3. Check for any pending reading assessments
  const pendingCount = await Assessment.countDocuments({
    studentId: sid,
    status: 'pending',
    $or: [
      { type: 'READING_FLUENCY' },
      { type: 'COMPREHENSION' },
      { type: 'OMR', subject: 'Reading' },
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
    oralLevel = approvedFluency.masteryLevel || (oralAccuracy != null ? readingLevel(oralAccuracy) : undefined);
    oralDate = approvedFluency.date;
    oralId = approvedFluency._id as Types.ObjectId;
  }

  let compScore: number | undefined;
  let compLevel: string | undefined;
  let compDate: Date | undefined;
  let compId: Types.ObjectId | undefined;

  if (approvedComp) {
    compScore = approvedComp.score;
    compLevel = compScore != null ? comprehensionLevel(compScore) : undefined;
    compDate = approvedComp.date;
    compId = approvedComp._id as Types.ObjectId;
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

  let philIriStatus: 'unassessed' | 'pending' | 'approved' | 'flagged' = 'unassessed';
  if (approvedFluency || approvedComp) {
    philIriStatus = 'approved';
  } else if (pendingCount > 0) {
    philIriStatus = 'pending';
  }

  // Determine latest assessment date & id
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

  // Apply to record
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
  };
}

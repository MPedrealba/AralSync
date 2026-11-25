import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import User from '../../models/User';
import LearnerRecord from '../../models/LearnerRecord';
import { parseWorksheet, type ParseResult } from './learnerImport';
import { extractSurnamePassword } from './nameUtils';
import { allocateStudentNumbers } from './studentNumber';
import { logAudit } from './audit';

export class ImportValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function readUploadWorksheet(file: File | null): Promise<XLSX.WorkSheet> {
  if (!file) {
    throw new ImportValidationError('No file uploaded', 400);
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new ImportValidationError('File too large (max 2MB)', 400);
  }
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
    throw new ImportValidationError('Unsupported file type. Please upload .xlsx, .xls, or .csv.', 400);
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    throw new ImportValidationError('No sheet found in the file.', 400);
  }
  return ws;
}

async function getExistingStudentNumbersSet(): Promise<Set<string>> {
  const existing = await LearnerRecord.find({}, { studentNumber: 1 }).lean();
  return new Set(
    existing.map((r: any) => (r.studentNumber || '').toString().trim().toLowerCase())
  );
}

/**
 * Parse and validate an uploaded import file without mutating the database.
 */
export async function previewLearnerImportFile(
  file: File | null
): Promise<ParseResult & { fileName: string }> {
  const ws = await readUploadWorksheet(file);
  const existingStudentNumbers = await getExistingStudentNumbersSet();
  const result = parseWorksheet(ws, existingStudentNumbers);

  if (result.counts.total === 0) {
    throw new ImportValidationError(
      'No data rows found. The file should have a header row followed by student rows.',
      400
    );
  }

  return { ...result, fileName: file!.name };
}

export interface CreatedImportedLearner {
  studentNumber: string;
  name: string;
  gradeLevel: number | null;
  section: string;
  defaultPassword: string;
}

/**
 * Commit a bulk learner import file, allocating sequential Student Numbers
 * automatically for rows that do not specify an unused one.
 */
export async function commitLearnerImportFile(
  file: File | null,
  options: {
    actorId: string;
    actorName: string;
    role: 'coordinator' | 'teacher';
    assignedTeacherId?: string | null;
  }
) {
  const ws = await readUploadWorksheet(file);
  const existingStudentNumbers = await getExistingStudentNumbersSet();
  const result = parseWorksheet(ws, existingStudentNumbers);

  let teacherDoc: any = null;
  if (options.assignedTeacherId && options.assignedTeacherId !== 'unassigned') {
    teacherDoc = await User.findById(options.assignedTeacherId);
  }

  // Reserve a contiguous block of sequential Student Numbers for all new rows needing one.
  const rowsNeedingNumber = result.rows.filter(
    (r) => r.status === 'new' && r.data && !r.data.studentNumber.trim()
  ).length;
  const allocatedBatch = await allocateStudentNumbers(rowsNeedingNumber);
  let allocIdx = 0;

  const createdStudentNumbers: string[] = [];
  const createdLearners: CreatedImportedLearner[] = [];
  let skippedDuplicates = 0;
  const failed: { row: number; reason: string }[] = [];

  for (const r of result.rows) {
    if (r.status === 'invalid') {
      failed.push({ row: r.row, reason: r.issues.join('; ') });
      continue;
    }
    const data = r.data!;
    if (r.status === 'duplicate') {
      skippedDuplicates++;
      continue;
    }

    const explicitNum = data.studentNumber.trim();
    if (explicitNum && existingStudentNumbers.has(explicitNum.toLowerCase())) {
      skippedDuplicates++;
      continue;
    }

    const assignedNum = explicitNum || allocatedBatch[allocIdx++];
    const numKey = assignedNum.toLowerCase();
    if (existingStudentNumbers.has(numKey)) {
      skippedDuplicates++;
      continue;
    }

    let userDoc: any = null;
    try {
      const defaultPassword = extractSurnamePassword(data.name, assignedNum);
      userDoc = await User.create({
        username: assignedNum,
        password: await bcrypt.hash(defaultPassword, 10),
        name: data.name,
        role: 'student',
        active: true,
        mustChangePassword: true,
      });

      await LearnerRecord.create({
        studentId: userDoc._id,
        studentNumber: assignedNum,
        gradeLevel: data.gradeLevel ?? undefined,
        section: data.section || undefined,
        guardian: data.guardian || undefined,
        contact: data.contact || undefined,
        address: data.address || undefined,
        riskLevel: 'Pending Assessment',
        masteryStatus: 'Beginning',
        assignedTeacherId: teacherDoc ? teacherDoc._id : null,
        assignedTeacherName: teacherDoc ? teacherDoc.name : null,
      });

      existingStudentNumbers.add(numKey);
      createdStudentNumbers.push(assignedNum);
      createdLearners.push({
        studentNumber: assignedNum,
        name: data.name,
        gradeLevel: data.gradeLevel ?? null,
        section: data.section || '',
        defaultPassword,
      });
    } catch (e: any) {
      if (userDoc?._id) {
        await User.findByIdAndDelete(userDoc._id).catch(() => {});
      }
      if (e && e.code === 11000) skippedDuplicates++;
      else failed.push({ row: r.row, reason: 'Database error' });
    }
  }

  await logAudit({
    actorId: options.actorId,
    actorName: options.actorName,
    role: options.role,
    action: 'learner_import',
    targetType: 'LearnerRecord',
    meta: {
      created: createdStudentNumbers.length,
      skippedDuplicates,
      failed: failed.length,
      fileName: file!.name,
      assignedTeacherId: teacherDoc?._id?.toString() || null,
      assignedTeacherName: teacherDoc?.name || null,
    },
  });

  return {
    created: createdStudentNumbers.length,
    skippedDuplicates,
    failed,
    createdStudentNumbers,
    createdLearners,
  };
}

/**
 * Generate the canonical XLSX template for learner imports.
 * Student Numbers are system-generated sequentially, so only student details are required.
 */
export function buildLearnerImportTemplateResponse(): NextResponse {
  const headers = [
    'Name',
    'Grade Level',
    'Section',
    'Guardian Name',
    'Contact Number',
    'Address',
  ];
  const data = [
    headers,
    ['Christian Santos', 'Grade 7', 'Rosal', 'Gloria Santos', '09171234567', 'Brgy. San Isidro'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Learners');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="learner-import-template.xlsx"',
    },
  });
}

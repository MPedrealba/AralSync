import * as XLSX from 'xlsx';

/**
 * Shared parsing/validation logic for the teacher's Excel bulk learner import
 * (FR2). Pure helpers — no DB or request coupling so both the preview and the
 * commit route use exactly the same detection/validation rules.
 */

/** Canonical fields we can import into a LearnerRecord. */
export interface ImportedRow {
  lrn: string;
  name: string;
  gradeLevel: number | null;
  section: string;
  guardian: string;
  contact: string;
  address: string;
}

export type RowStatus = 'new' | 'duplicate' | 'invalid';

export interface RowResult {
  /** 1-indexed Excel row number (for pointing the teacher at problem rows). */
  row: number;
  status: RowStatus;
  issues: string[];
  data: ImportedRow | null;
}

export interface ParseResult {
  /** Detected Excel header -> canonical field mapping. */
  columns: Record<string, string>;
  /** The header cells as they appear in the sheet. */
  headers: string[];
  rows: RowResult[];
  counts: { total: number; created: number; duplicate: number; invalid: number };
  /** First up-to-8 rows for a preview table. */
  sample: RowResult[];
}

/** Aliases accepted for each canonical field (matched case/space-insensitively). */
const ALIASES: Record<string, string[]> = {
  lrn: ['lrn', 'learner reference number', 'lrn no', 'learner reference no', 'student id', 'learner id', 'id'],
  name: ['name', 'full name', 'student name', 'learner name', 'complete name', 'name of learner'],
  gradeLevel: ['grade', 'grade level', 'year', 'year level'],
  section: ['section', 'section name', 'class'],
  guardian: ['guardian', 'guardian name', 'parent', 'parent name'],
  contact: ['contact', 'contact number', 'phone', 'mobile', 'telephone'],
  address: ['address', 'home address', 'address of learner'],
};

const norm = (s: string) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Given a header row (array of cell strings), find which canonical field each
 * column maps to. Returns { canonicalField: actualHeaderText }.
 */
export function detectColumns(headerRow: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const headers = headerRow.map(norm);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const idx = headers.indexOf(norm(alias));
      if (idx !== -1) {
        mapping[field] = headerRow[idx].toString().trim();
        break;
      }
    }
  }
  return mapping;
}

/** How many canonical fields a header row maps to (used to locate the header row). */
function coverage(mapping: Record<string, string>): number {
  return Object.keys(mapping).length;
}

/** Accepts 7, "7", "Grade 7", "GRADE 7", "G7" -> 7. Blank -> null. Garbage -> null + invalid. */
export function parseGrade(v: unknown): { value: number | null; invalid: boolean } {
  if (v === null || v === undefined || v === '') return { value: null, invalid: false };
  const cleaned = norm(v.toString())
    .replace('grade ', '')
    .replace('gr ', '')
    .replace('year ', '')
    .replace('yr ', '')
    .replace('g', '');
  const num = parseInt(cleaned, 10);
  if (!Number.isNaN(num)) return { value: num, invalid: false };
  return { value: null, invalid: true };
}

/** Build a typed ImportedRow from a raw row object keyed by the sheet's headers. */
function normalizeRow(
  rowObj: Record<string, unknown>,
  mapping: Record<string, string>
): ImportedRow {
  const get = (field: string) => {
    const key = mapping[field];
    if (!key) return '';
    const v = rowObj[key];
    return v === null || v === undefined ? '' : v.toString().trim();
  };
  const grade = parseGrade(get('gradeLevel'));
  return {
    lrn: get('lrn'),
    name: get('name'),
    gradeLevel: grade.value,
    section: get('section'),
    guardian: get('guardian'),
    contact: get('contact'),
    address: get('address'),
  };
}

/** Validate a normalized row; returns a list of human-readable issues. */
function validateRow(
  rowObj: Record<string, unknown>,
  mapping: Record<string, string>,
  data: ImportedRow
): string[] {
  const issues: string[] = [];
  if (!data.lrn) issues.push('Missing LRN');
  else if (data.lrn.length > 12) issues.push('LRN looks too long');
  if (!data.name) issues.push('Missing name');
  const grade = parseGrade(
    (() => {
      const key = mapping['gradeLevel'];
      return key ? rowObj[key] : '';
    })()
  );
  if (grade.invalid) issues.push('Invalid grade level');
  return issues;
}

/**
 * Parse a worksheet into normalized + validated rows.
 * `existingLrns` is a normalized set of LRNs already in the DB — used to flag
 * duplicates during preview so the teacher can see them before committing.
 */
export function parseWorksheet(
  worksheet: XLSX.WorkSheet,
  existingLrns: Set<string>
): ParseResult {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  // Locate the header row — the first row whose detected columns cover >= 2
  // canonical fields (handles title/merged rows above the real header).
  let headerIdx = -1;
  let columns: Record<string, string> = {};
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = (raw[i] || []).map((c) => (c == null ? '' : String(c)));
    const map = detectColumns(row);
    if (coverage(map) >= 2) {
      headerIdx = i;
      columns = map;
      break;
    }
  }
  if (headerIdx === -1) {
    headerIdx = 0;
    columns = detectColumns((raw[0] || []).map((c) => (c == null ? '' : String(c))));
  }

  const headerRow = (raw[headerIdx] || []).map((c) => (c == null ? '' : String(c)));

  const rows: RowResult[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const rawRow = raw[i] || [];
    if (rawRow.every((c) => c === '' || c == null)) continue; // skip blank lines

    const rowObj: Record<string, unknown> = {};
    headerRow.forEach((h, idx) => {
      rowObj[h] = rawRow[idx] ?? '';
    });

    const data = normalizeRow(rowObj, columns);
    const issues = validateRow(rowObj, columns, data);

    let status: RowStatus = 'new';
    if (issues.length > 0) status = 'invalid';
    else if (existingLrns.has(norm(data.lrn))) status = 'duplicate';

    rows.push({
      row: i + 1,
      status,
      issues,
      data: status === 'invalid' ? data : data, // keep data for preview display
    });
  }

  const counts = {
    total: rows.length,
    created: rows.filter((r) => r.status === 'new').length,
    duplicate: rows.filter((r) => r.status === 'duplicate').length,
    invalid: rows.filter((r) => r.status === 'invalid').length,
  };

  return {
    columns,
    headers: headerRow,
    rows,
    counts,
    sample: rows.slice(0, 8),
  };
}

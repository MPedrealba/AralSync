import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import CounterModule from '../models/Counter.js';
import { parseWorksheet } from '../src/lib/learnerImport.ts';

const { formatStudentNumber } = CounterModule;

describe('Student Number Format & Import Rules Suite', () => {
  it('formats Option A sequential 8-digit student numbers cleanly', () => {
    assert.equal(formatStudentNumber(2026, 1), '20260001');
    assert.equal(formatStudentNumber(2026, 9), '20260009');
    assert.equal(formatStudentNumber(2026, 42), '20260042');
    assert.equal(formatStudentNumber(2026, 110), '20260110');
    assert.equal(formatStudentNumber(2026, 9999), '20269999');
    assert.equal(formatStudentNumber(2026, 10000), '202610000');
  });

  it('imports worksheets without requiring LRN or Student Number columns', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Grade Level', 'Section', 'Guardian Name'],
      ['Christian Santos', 'Grade 7', 'Rosal', 'Gloria Santos'],
      ['Bea De Leon', '8', 'Sampaguita', 'Liza De Leon'],
      ['', '7', 'Rosal', 'Missing Name'],
    ]);

    const res = parseWorksheet(ws, new Set(['20260001']));
    assert.equal(res.counts.total, 3);
    assert.equal(res.counts.created, 2);
    assert.equal(res.counts.invalid, 1);
    assert.equal(res.counts.duplicate, 0);
    assert.equal(res.rows[0].data?.studentNumber, '');
    assert.equal(res.rows[0].data?.name, 'Christian Santos');
    assert.equal(res.rows[0].data?.gradeLevel, 7);
    assert.equal(res.rows[2].issues.includes('Missing name'), true);
  });

  it('flags duplicate Student Numbers against existing records and within the same upload', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Student Number', 'Name', 'Grade', 'Section'],
      ['20260001', 'Existing Learner', '7', 'Rosal'],
      ['20260050', 'First Copy', '7', 'Rosal'],
      ['20260050', 'Second Copy', '7', 'Rosal'],
    ]);

    const res = parseWorksheet(ws, new Set(['20260001']));
    assert.equal(res.counts.created, 1);
    assert.equal(res.counts.duplicate, 2);
    assert.equal(res.rows[0].status, 'duplicate');
    assert.equal(res.rows[1].status, 'new');
    assert.equal(res.rows[2].status, 'duplicate');
  });
});

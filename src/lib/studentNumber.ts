import CounterModel from '../../models/Counter';

const {
  formatStudentNumber,
  allocateStudentNumbers,
  peekNextStudentNumber,
  setStudentNumberCounter,
} = CounterModel as typeof CounterModel & {
  formatStudentNumber: (year: number, seq: number) => string;
  allocateStudentNumbers: (count?: number, year?: number) => Promise<string[]>;
  peekNextStudentNumber: (year?: number) => Promise<string>;
  setStudentNumberCounter: (seq: number, year?: number) => Promise<unknown>;
};

export {
  formatStudentNumber,
  allocateStudentNumbers,
  peekNextStudentNumber,
  setStudentNumberCounter,
};

/**
 * Allocate a single sequential Student Number for immediate enrollment.
 */
export async function allocateNextStudentNumber(year?: number): Promise<string> {
  const [next] = await allocateStudentNumbers(1, year);
  return next;
}

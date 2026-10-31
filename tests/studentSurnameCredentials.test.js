import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { extractSurnamePassword } from '../src/lib/nameUtils.ts';

// Helper simulating login route's student password check logic
async function verifyLoginPassword(inputPassword, storedHashedPassword, userRole) {
  let isMatch = await bcrypt.compare(inputPassword, storedHashedPassword);
  if (!isMatch && userRole === 'student') {
    const normalizedInput = String(inputPassword).toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (normalizedInput && normalizedInput !== inputPassword) {
      isMatch = await bcrypt.compare(normalizedInput, storedHashedPassword);
    }
    if (!isMatch && normalizedInput) {
      isMatch = await bcrypt.compare(normalizedInput.toUpperCase(), storedHashedPassword);
    }
  }
  return isMatch;
}

describe('Student Surname Password Extraction & Login Verification Suite', () => {
  describe('DepEd SF1 Format Extraction ("Lastname, Firstname Middlename")', () => {
    it('extracts surname from standard DepEd SF1 format with middle initial', () => {
      assert.equal(extractSurnamePassword('Dela Cruz, Juan M.', '102948'), 'delacruz');
      assert.equal(extractSurnamePassword('Delos Santos, Maria Clara', '102948'), 'delossantos');
      assert.equal(extractSurnamePassword('Aquino, Benigno S.', '102948'), 'aquino');
      assert.equal(extractSurnamePassword('Reyes, Jose', '102948'), 'reyes');
    });

    it('handles hyphenated or punctuated surnames in SF1 format', () => {
      assert.equal(extractSurnamePassword('Santos-Cruz, Juan', '102948'), 'santoscruz');
      assert.equal(extractSurnamePassword('De Leon, Roberto Jr.', '102948'), 'deleon');
    });
  });

  describe('Standard Format Extraction ("Firstname Middlename Lastname")', () => {
    it('extracts compound Filipino surnames without comma', () => {
      assert.equal(extractSurnamePassword('Juan Dela Cruz', '102948'), 'delacruz');
      assert.equal(extractSurnamePassword('Maria Delos Santos', '102948'), 'delossantos');
      assert.equal(extractSurnamePassword('Pedro De Leon', '102948'), 'deleon');
      assert.equal(extractSurnamePassword('Ana Del Rosario', '102948'), 'delrosario');
      assert.equal(extractSurnamePassword('Jose San Jose', '102948'), 'sanjose');
      assert.equal(extractSurnamePassword('Clara Santa Maria', '102948'), 'santamaria');
    });

    it('extracts standard single-word surnames without comma', () => {
      assert.equal(extractSurnamePassword('Juan Santos', '102948'), 'santos');
      assert.equal(extractSurnamePassword('Juan M. Santos', '102948'), 'santos');
      assert.equal(extractSurnamePassword('Rhea Jane Reyes', '102948'), 'reyes');
      assert.equal(extractSurnamePassword('John Paul Garcia', '102948'), 'garcia');
    });
  });

  describe('Edge Cases and LRN Fallbacks', () => {
    it('handles single-word name safely', () => {
      assert.equal(extractSurnamePassword('Cher', '102948'), 'cher');
    });

    it('falls back to lowercase LRN when name is blank or missing', () => {
      assert.equal(extractSurnamePassword('', '102948'), '102948');
      assert.equal(extractSurnamePassword('   ', '102948'), '102948');
      assert.equal(extractSurnamePassword(null, 'LRN12345'), 'lrn12345');
      assert.equal(extractSurnamePassword('!@#$%^', '102948'), '102948');
    });
  });

  describe('Student Login Password Verification Resilience', () => {
    it('authenticates when student enters exact lowercase surname', async () => {
      const defaultPassword = extractSurnamePassword('Juan dela Cruz', '102948');
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const isValid = await verifyLoginPassword('delacruz', hashedPassword, 'student');
      assert.equal(isValid, true);
    });

    it('authenticates when student enters spaced/capitalized surname', async () => {
      const defaultPassword = extractSurnamePassword('Dela Cruz, Juan M.', '102948');
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      assert.equal(await verifyLoginPassword('Dela Cruz', hashedPassword, 'student'), true);
      assert.equal(await verifyLoginPassword('DELACRUZ', hashedPassword, 'student'), true);
      assert.equal(await verifyLoginPassword('dela cruz', hashedPassword, 'student'), true);
      assert.equal(await verifyLoginPassword('Dela-Cruz', hashedPassword, 'student'), true);
    });

    it('preserves backward compatibility for older student accounts hashed with uppercase LRN', async () => {
      const oldHashedPassword = await bcrypt.hash('102948ABC', 10);

      // Student enters lowercase or exact
      assert.equal(await verifyLoginPassword('102948abc', oldHashedPassword, 'student'), true);
      assert.equal(await verifyLoginPassword('102948ABC', oldHashedPassword, 'student'), true);
    });

    it('rejects incorrect passwords for students', async () => {
      const defaultPassword = extractSurnamePassword('Juan dela Cruz', '102948');
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      assert.equal(await verifyLoginPassword('wrongpassword', hashedPassword, 'student'), false);
      assert.equal(await verifyLoginPassword('santos', hashedPassword, 'student'), false);
    });

    it('does not apply loose normalization to non-student roles', async () => {
      const facultyPassword = 'Password123!';
      const facultyHashed = await bcrypt.hash(facultyPassword, 10);

      // Matches exact
      assert.equal(await verifyLoginPassword('Password123!', facultyHashed, 'teacher'), true);
      // Fails on normalized lower
      assert.equal(await verifyLoginPassword('password123', facultyHashed, 'teacher'), false);
      assert.equal(await verifyLoginPassword('password123!', facultyHashed, 'coordinator'), false);
    });
  });
});

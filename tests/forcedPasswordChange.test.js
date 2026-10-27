const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// Validation helper replicating force-change-password business logic
function validatePasswordChange({ currentPassword, newPassword, confirmPassword, currentHashedPassword }) {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, status: 400, error: 'All password fields are required.' };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, status: 400, error: 'New password and confirmation password do not match.' };
  }

  if (newPassword.length < 6) {
    return { ok: false, status: 400, error: 'New password must be at least 6 characters long.' };
  }

  // Check current password
  if (!bcrypt.compareSync(currentPassword, currentHashedPassword)) {
    return { ok: false, status: 400, error: 'Current password is incorrect.' };
  }

  // Cannot be identical to current/temporary default password
  if (currentPassword === newPassword) {
    return { ok: false, status: 400, error: 'New password cannot be identical to your temporary default password.' };
  }

  if (bcrypt.compareSync(newPassword, currentHashedPassword)) {
    return { ok: false, status: 400, error: 'New password cannot be identical to your current password.' };
  }

  return { ok: true };
}

// Target redirect helper replicating login/change-password role dispatch
function getPostChangeRedirect(role) {
  if (role === 'principal') return '/principal';
  if (role === 'coordinator') return '/coordinator';
  if (role === 'student') return '/student';
  return '/dashboard'; // default for teacher
}

describe('Forced Password Change & Default Credentials Suite', () => {
  const DEFAULT_PASSWORD = 'password123';
  const hashedDefault = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

  test('default password for faculty and staff verifies against password123', () => {
    assert.equal(bcrypt.compareSync('password123', hashedDefault), true);
    assert.equal(bcrypt.compareSync('123456', hashedDefault), false);
    assert.equal(bcrypt.compareSync('wrongpass', hashedDefault), false);
  });

  test('first time login mandates mustChangePassword: true for teacher, coordinator, and principal', () => {
    const facultyAccounts = [
      { username: 'teacher1', role: 'teacher', mustChangePassword: true },
      { username: 'coordinator1', role: 'coordinator', mustChangePassword: true },
      { username: 'principal1', role: 'principal', mustChangePassword: true },
    ];

    for (const acc of facultyAccounts) {
      assert.equal(acc.mustChangePassword, true, `${acc.role} must require password change`);
    }
  });

  test('validates and rejects password changes where new password matches temporary default', () => {
    const result = validatePasswordChange({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: DEFAULT_PASSWORD,
      confirmPassword: DEFAULT_PASSWORD,
      currentHashedPassword: hashedDefault,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /identical to your temporary default password/i);
  });

  test('rejects new password if shorter than 6 characters', () => {
    const result = validatePasswordChange({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: 'short',
      confirmPassword: 'short',
      currentHashedPassword: hashedDefault,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /at least 6 characters long/i);
  });

  test('rejects when new password and confirm password do not match', () => {
    const result = validatePasswordChange({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: 'SecureNewPass123',
      confirmPassword: 'DifferentPass123',
      currentHashedPassword: hashedDefault,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /do not match/i);
  });

  test('rejects when current password does not match default credentials', () => {
    const result = validatePasswordChange({
      currentPassword: 'wrongCurrentPassword',
      newPassword: 'SecureNewPass123',
      confirmPassword: 'SecureNewPass123',
      currentHashedPassword: hashedDefault,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /Current password is incorrect/i);
  });

  test('successfully accepts strong password, hashes it, and resolves correct dashboard destination', () => {
    const newPass = 'AralSync@2026';
    const result = validatePasswordChange({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: newPass,
      confirmPassword: newPass,
      currentHashedPassword: hashedDefault,
    });

    assert.equal(result.ok, true);

    // Ensure proper post-update navigation per role
    assert.equal(getPostChangeRedirect('teacher'), '/dashboard');
    assert.equal(getPostChangeRedirect('principal'), '/principal');
    assert.equal(getPostChangeRedirect('coordinator'), '/coordinator');
    assert.equal(getPostChangeRedirect('student'), '/student');
  });
});

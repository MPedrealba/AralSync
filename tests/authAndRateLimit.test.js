const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// In-Memory Sliding Window Rate Limiter Logic
class SlidingWindowRateLimiter {
  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.store = new Map();
  }

  check(key) {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + this.windowMs };
      this.store.set(key, record);
      return {
        allowed: true,
        current: 1,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        retryAfter: 0,
      };
    }

    record.count++;
    const allowed = record.count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - record.count);
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);

    return {
      allowed,
      current: record.count,
      limit: this.maxRequests,
      remaining,
      retryAfter: allowed ? 0 : Math.max(1, retryAfter),
    };
  }

  reset() {
    this.store.clear();
  }
}

// Student 3-Point Record Verification Logic
function verifyStudentRecord(studentRecord, input) {
  if (!studentRecord) {
    return { ok: false, error: 'Student record not found by LRN' };
  }

  // 1. Verify Section (case-insensitive)
  if (
    studentRecord.section &&
    studentRecord.section.trim().toLowerCase() !== input.section.trim().toLowerCase()
  ) {
    return { ok: false, error: 'Section does not match school records on file' };
  }

  // 2. Verify Birthdate
  const storedBirth = (studentRecord.birthDate || '').split('T')[0].trim();
  const inputBirth = (input.birthDate || '').split('T')[0].trim();
  if (storedBirth && storedBirth !== inputBirth) {
    return { ok: false, error: 'Birthdate does not match school records on file' };
  }

  return { ok: true, verifiedStudent: studentRecord };
}

describe('Authentication & Rate Limiting Security Suite', () => {
  test('allows requests within specified rate limit threshold', () => {
    const limiter = new SlidingWindowRateLimiter(60000, 5);
    const ip = '192.168.1.100';

    for (let i = 1; i <= 5; i++) {
      const result = limiter.check(ip);
      assert.equal(result.allowed, true);
      assert.equal(result.current, i);
      assert.equal(result.remaining, 5 - i);
      assert.equal(result.retryAfter, 0);
    }
  });

  test('blocks excess requests with HTTP 429 semantics and returns positive retryAfter', () => {
    const limiter = new SlidingWindowRateLimiter(60000, 3);
    const ip = '10.0.0.5';

    limiter.check(ip); // req 1 - allowed
    limiter.check(ip); // req 2 - allowed
    limiter.check(ip); // req 3 - allowed

    const blocked = limiter.check(ip); // req 4 - blocked!
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfter > 0);
  });

  test('isolates rate limits per client IP identifier', () => {
    const limiter = new SlidingWindowRateLimiter(60000, 2);
    const ipA = '192.168.1.1';
    const ipB = '192.168.1.2';

    limiter.check(ipA);
    limiter.check(ipA);
    const blockedA = limiter.check(ipA);
    assert.equal(blockedA.allowed, false);

    // IP B has not made requests yet and must be allowed
    const allowedB = limiter.check(ipB);
    assert.equal(allowedB.allowed, true);
    assert.equal(allowedB.remaining, 1);
  });

  test('validates student identity against 3-point school record criteria', () => {
    const mockStudentRecord = {
      lrn: '102938',
      name: 'Juan dela Cruz',
      section: 'Rosal',
      birthDate: '2012-05-15',
    };

    // Valid credentials (with case variation in section)
    const valid = verifyStudentRecord(mockStudentRecord, {
      lrn: '102938',
      section: 'rosal',
      birthDate: '2012-05-15',
    });
    assert.equal(valid.ok, true);

    // Invalid section
    const wrongSection = verifyStudentRecord(mockStudentRecord, {
      lrn: '102938',
      section: 'Sampaguita',
      birthDate: '2012-05-15',
    });
    assert.equal(wrongSection.ok, false);
    assert.match(wrongSection.error, /Section does not match/);

    // Invalid birthdate
    const wrongBirthdate = verifyStudentRecord(mockStudentRecord, {
      lrn: '102938',
      section: 'Rosal',
      birthDate: '2015-08-20',
    });
    assert.equal(wrongBirthdate.ok, false);
    assert.match(wrongBirthdate.error, /Birthdate does not match/);
  });
});

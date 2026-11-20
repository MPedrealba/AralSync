const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Teacher Profile Specialization Lock & Coordinator Control Suite', () => {
  const profileComponentPath = path.join(__dirname, '..', 'src', 'components', 'Profile.tsx');
  const authMeRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'auth', 'me', 'route.ts');

  const profileSrc = fs.readFileSync(profileComponentPath, 'utf8');
  const authMeSrc = fs.readFileSync(authMeRoutePath, 'utf8');

  test('1. Profile.tsx removes Teaching Specialization radio controls and edit state', () => {
    // Must NOT contain Teaching Specialization label or radio inputs
    assert.ok(
      !profileSrc.includes('Teaching Specialization'),
      'Profile.tsx must NOT contain "Teaching Specialization"'
    );
    assert.ok(
      !profileSrc.includes('name="specialization"'),
      'Profile.tsx must NOT contain radio group name="specialization"'
    );
    assert.ok(
      !profileSrc.includes('setSpecialization'),
      'Profile.tsx must NOT contain setSpecialization state setter'
    );
  });

  test('2. Profile.tsx handleSave never sends specialization payload', () => {
    assert.ok(
      !profileSrc.includes('payload.specialization'),
      'handleSave in Profile.tsx must NOT assign payload.specialization'
    );
  });

  test('3. Profile.tsx view mode displays read-only Assigned Subject with coordinator notice', () => {
    assert.ok(
      profileSrc.includes('Assigned Subject'),
      'Profile.tsx details list must label the field "Assigned Subject"'
    );
    assert.ok(
      !profileSrc.includes('Teaching Focus'),
      'Profile.tsx must no longer label the field "Teaching Focus"'
    );
    assert.ok(
      profileSrc.includes('(Managed by ARAL Coordinator)'),
      'Profile.tsx must display helper text "(Managed by ARAL Coordinator)"'
    );
  });

  test('4. Profile.tsx displays assignedSubject badge in top identity card', () => {
    assert.ok(
      profileSrc.includes('data.assignedSubject && data.assignedSubject !== "All"'),
      'Top card badge must format teacher badge based on assignedSubject'
    );
    assert.ok(
      profileSrc.includes('? `${data.assignedSubject} Teacher`'),
      'Top card badge must display `${data.assignedSubject} Teacher`'
    );
  });

  test('5. PATCH /api/auth/me rejects/locks user.specialization mutation', () => {
    // In PATCH handler, user.specialization must not be modified by request body
    const patchHandlerBody = authMeSrc.slice(authMeSrc.indexOf('export async function PATCH'));
    assert.ok(
      !/user\.specialization\s*=(?!=)/.test(patchHandlerBody),
      'PATCH /api/auth/me must NOT mutate user.specialization'
    );
    assert.ok(
      !patchHandlerBody.includes('const { name, username, email, specialization'),
      'PATCH /api/auth/me body parsing must NOT destructure specialization'
    );
  });
});

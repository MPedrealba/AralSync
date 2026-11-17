import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getTimeOfDayGreeting, getUserInitials } from '../src/lib/greeting.ts';

describe('Personalized Greetings and Dashboard Headers Suite', () => {
  const root = process.cwd();

  test('1. src/lib/greeting.ts correctly computes greetings and user initials', () => {
    assert.ok(typeof getTimeOfDayGreeting() === 'string');
    assert.ok(['Good morning', 'Good afternoon', 'Good evening'].includes(getTimeOfDayGreeting('en')));
    assert.ok(['Magandang umaga', 'Magandang hapon', 'Magandang gabi'].includes(getTimeOfDayGreeting('tl')));

    assert.equal(getUserInitials('Teacher Miguel'), 'TM');
    assert.equal(getUserInitials('Coordinator Sarah'), 'CS');
    assert.equal(getUserInitials('Principal Santos'), 'PS');
    assert.equal(getUserInitials('Santos'), 'SA');
    assert.equal(getUserInitials(''), 'U');
  });

  test('2. Teacher English Dashboard (src/app/dashboard/page.tsx) uses dynamic time greeting and user name', () => {
    const filePath = path.join(root, 'src', 'app', 'dashboard', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('{greeting}, {userName || "Teacher"}! 👋'),
      'Teacher dashboard must display dynamic greeting and userName'
    );
    assert.ok(
      !content.includes('<h1>\n            Welcome back, Teacher!\n          </h1>'),
      'Teacher dashboard must not use static hardcoded Welcome back, Teacher!'
    );
    assert.ok(
      content.includes('Here is your ARAL Program learning recovery overview for Grade 7'),
      'Teacher dashboard must retain the recovery overview subtitle'
    );
  });

  test('3. Teacher Filipino Dashboard (src/app/dashboard/filipino-reading/page.tsx) uses authentic Filipino greeting', () => {
    const filePath = path.join(root, 'src', 'app', 'dashboard', 'filipino-reading', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('Maligayang pagbabalik, {userName || "Guro"}! 👋'),
      'Filipino teacher dashboard must render personalized Filipino greeting'
    );
    assert.ok(
      content.includes('Narito ang iyong buod sa ARAL Program para sa Pangkatang Pagtatasa (GST Stage 1) at Indibidwal na Pagbasa (Stage 2).'),
      'Filipino teacher dashboard must render the specified subtitle'
    );
  });

  test('4. Coordinator Dashboard (src/app/coordinator/page.tsx) fetches user and personalizes greeting', () => {
    const filePath = path.join(root, 'src', 'app', 'coordinator', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('/api/auth/me'),
      'Coordinator dashboard must fetch user details from /api/auth/me'
    );
    assert.ok(
      content.includes('{greeting}, {userName || "Coordinator"}! 👋'),
      'Coordinator dashboard must render personalized greeting'
    );
    assert.ok(
      content.includes('Schoolwide ARAL Program overview — active learners, assigned teachers, and system metrics.'),
      'Coordinator dashboard must render the specified subtitle'
    );
  });

  test('5. Principal Dashboard (src/app/principal/page.tsx) fetches user and personalizes greeting', () => {
    const filePath = path.join(root, 'src', 'app', 'principal', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('/api/auth/me'),
      'Principal dashboard must fetch user details from /api/auth/me'
    );
    assert.ok(
      content.includes('{greeting}, {userName || "Principal"}! 👋'),
      'Principal dashboard must render personalized greeting'
    );
    assert.ok(
      content.includes('Executive schoolwide overview — live enrollment, interventions, and learning recovery indicators.'),
      'Principal dashboard must render the specified executive subtitle'
    );
  });

  test('6. Student Dashboard (src/app/student/page.tsx) uses dynamic time-aware greeting', () => {
    const filePath = path.join(root, 'src', 'app', 'student', 'page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('{timeGreeting}, {user?.name || "Learner"}! 👋'),
      'Student dashboard must use dynamic time-aware greeting with learner name'
    );
    assert.ok(
      content.includes('Here is your latest learning recovery progress and assigned activities.'),
      'Student dashboard must render updated subtitle'
    );
  });

  test('7. Header.tsx, PrincipalHeader.tsx, and StudentShell.tsx include user profile identity chip', () => {
    const headerPath = path.join(root, 'src', 'components', 'Header.tsx');
    const principalHeaderPath = path.join(root, 'src', 'components', 'PrincipalHeader.tsx');
    const studentShellPath = path.join(root, 'src', 'components', 'StudentShell.tsx');

    const headerContent = fs.readFileSync(headerPath, 'utf-8');
    const principalContent = fs.readFileSync(principalHeaderPath, 'utf-8');
    const studentContent = fs.readFileSync(studentShellPath, 'utf-8');

    assert.ok(headerContent.includes('getUserInitials'), 'Header.tsx must render user initials');
    assert.ok(headerContent.includes('roleBadge'), 'Header.tsx must render role badge');

    assert.ok(principalContent.includes('getUserInitials'), 'PrincipalHeader.tsx must render user initials');
    assert.ok(principalContent.includes('roleBadge'), 'PrincipalHeader.tsx must render role badge');

    assert.ok(studentContent.includes('getUserInitials'), 'StudentShell.tsx must render user initials');
  });
});

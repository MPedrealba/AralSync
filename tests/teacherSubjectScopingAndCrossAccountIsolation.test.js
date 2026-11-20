const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Teacher Subject Scoping, Header/Sidebar Isolation & Self-Healing Suite', () => {
  const teacherScopePath = path.join(__dirname, '..', 'src', 'lib', 'teacherScope.ts');
  const sidebarPath = path.join(__dirname, '..', 'src', 'components', 'Sidebar.tsx');
  const headerPath = path.join(__dirname, '..', 'src', 'components', 'Header.tsx');
  const dashboardPath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'page.tsx');
  const userMgmtPath = path.join(__dirname, '..', 'src', 'app', 'api', 'coordinator', 'user-management', 'route.ts');
  const authMePath = path.join(__dirname, '..', 'src', 'app', 'api', 'auth', 'me', 'route.ts');
  const authLoginPath = path.join(__dirname, '..', 'src', 'app', 'api', 'auth', 'login', 'route.ts');

  const teacherScopeSrc = fs.readFileSync(teacherScopePath, 'utf8');
  const sidebarSrc = fs.readFileSync(sidebarPath, 'utf8');
  const headerSrc = fs.readFileSync(headerPath, 'utf8');
  const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');
  const userMgmtSrc = fs.readFileSync(userMgmtPath, 'utf8');
  const authMeSrc = fs.readFileSync(authMePath, 'utf8');
  const authLoginSrc = fs.readFileSync(authLoginPath, 'utf8');

  test('1. teacherScope.ts enforces strict priority to assignedSubject over specialization', () => {
    // Assert assignedSubject checks happen BEFORE specialization checks
    const mathIndex = teacherScopeSrc.indexOf("if (assigned === 'Math') return 'Math'");
    const scienceIndex = teacherScopeSrc.indexOf("if (assigned === 'Science') return 'Science'");
    const filipinoIndex = teacherScopeSrc.indexOf("if (assigned === 'Filipino') return 'Filipino'");
    const englishIndex = teacherScopeSrc.indexOf("if (assigned === 'English') return 'English'");
    const readingIndex = teacherScopeSrc.indexOf("if (assigned === 'Reading') return 'Reading'");
    const allIndex = teacherScopeSrc.indexOf("if (assigned === 'All') return 'All'");

    const specReadingIndex = teacherScopeSrc.indexOf("if (spec === 'reading') return 'Reading'");

    assert.ok(mathIndex !== -1, 'Must check assigned Math');
    assert.ok(scienceIndex !== -1, 'Must check assigned Science');
    assert.ok(filipinoIndex !== -1, 'Must check assigned Filipino');
    assert.ok(englishIndex !== -1, 'Must check assigned English');
    assert.ok(readingIndex !== -1, 'Must check assigned Reading');
    assert.ok(allIndex !== -1, 'Must check assigned All');
    assert.ok(specReadingIndex !== -1, 'Must check fallback spec reading');

    assert.ok(mathIndex < specReadingIndex, 'assigned Math check must precede spec reading check');
    assert.ok(scienceIndex < specReadingIndex, 'assigned Science check must precede spec reading check');
  });

  test('2. Sidebar.tsx strictly isolates dedicated Math and Science teachers from reading features', () => {
    assert.ok(
      sidebarSrc.includes('const isDedicatedNonReading = assignedSubject === "Math" || assignedSubject === "Science"'),
      'Sidebar must define isDedicatedNonReading'
    );
    assert.ok(
      sidebarSrc.includes('!isDedicatedNonReading'),
      'isReading and isFilipino must be guarded by !isDedicatedNonReading'
    );
    assert.ok(
      sidebarSrc.includes('/dashboard/reading-evaluation'),
      'READING_ONLY_HREFS or navSections must include reading-evaluation'
    );
    assert.ok(
      sidebarSrc.includes('/dashboard/gst') && sidebarSrc.includes('/dashboard/reading-fluency'),
      'READING_ONLY_HREFS must include gst and reading-fluency'
    );
  });

  test('3. Cross-user localStorage leakage is prevented on logout and stream resolution', () => {
    // Sidebar logout clears localStorage and sessionStorage
    assert.ok(
      sidebarSrc.includes('localStorage.removeItem("aral_reading_stream")'),
      'Sidebar logout must remove aral_reading_stream from localStorage'
    );
    assert.ok(
      sidebarSrc.includes('sessionStorage.clear()'),
      'Sidebar logout must clear sessionStorage'
    );

    // Header prevents Math and Science teachers from loading Filipino stream from localStorage
    assert.ok(
      headerSrc.includes('assigned === "Math" || assigned === "Science"'),
      'Header must check assigned Math or Science before reading stream from localStorage'
    );
  });

  test('4. Dashboard Stat Card 4 dynamically renders subject-scoped review title', () => {
    assert.ok(
      dashboardSrc.includes('pendingReviewsTitle'),
      'Dashboard must compute dynamic pendingReviewsTitle'
    );
    assert.ok(
      dashboardSrc.includes('Pending Math Reviews'),
      'Dashboard must handle Pending Math Reviews'
    );
    assert.ok(
      dashboardSrc.includes('Pending Science Reviews'),
      'Dashboard must handle Pending Science Reviews'
    );
    assert.ok(
      dashboardSrc.includes('Pending Reading Reviews'),
      'Dashboard must handle Pending Reading Reviews'
    );
    assert.ok(
      dashboardSrc.includes('Pending Item Reviews'),
      'Dashboard must provide default Pending Item Reviews'
    );
    assert.ok(
      dashboardSrc.includes('title={pendingReviewsTitle}'),
      'StatCard 4 must use dynamic pendingReviewsTitle'
    );
  });

  test('5. User Management and Auth endpoints synchronize specialization and provide self-healing', () => {
    // POST user management
    assert.ok(
      userMgmtSrc.includes("finalAssignedSubject === 'Math' || finalAssignedSubject === 'Science'"),
      'POST must set all-subjects specialization for Math/Science'
    );
    // PATCH user management
    assert.ok(
      userMgmtSrc.includes("assignedSubject === 'Math' || assignedSubject === 'Science'"),
      'PATCH must set all-subjects specialization for Math/Science'
    );

    // Auth /me self-healing
    assert.ok(
      authMeSrc.includes("profile.assignedSubject === 'Math' || profile.assignedSubject === 'Science'"),
      'GET /api/auth/me must check Math/Science for self-healing repair'
    );
    assert.ok(
      authMeSrc.includes("specialization: 'all-subjects'"),
      'GET /api/auth/me must repair specialization to all-subjects'
    );

    // Login self-healing
    assert.ok(
      authLoginSrc.includes("user.assignedSubject === 'Math' || user.assignedSubject === 'Science'"),
      'Login must check Math/Science for self-healing repair'
    );
  });
});

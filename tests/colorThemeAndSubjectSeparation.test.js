const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('AralSync Brand Color Theme Alignment & Strict Subject Separation Tests', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('1. models/User.js contains English & Filipino in assignedSubject enum', () => {
    const userModelPath = path.join(rootDir, 'models', 'User.js');
    assert.ok(fs.existsSync(userModelPath), 'User.js model must exist');
    const content = fs.readFileSync(userModelPath, 'utf8');

    assert.ok(
      content.includes("'English & Filipino'") || content.includes('"English & Filipino"'),
      'User.js must include "English & Filipino" in assignedSubject enum'
    );
    assert.ok(
      content.includes("'English'") && content.includes("'Filipino'"),
      'User.js must include English and Filipino in assignedSubject enum'
    );
  });

  test('2. Header.tsx hides stream toggle pills for single-subject English/Filipino teachers and allows Dual-Subject teachers', () => {
    const headerPath = path.join(rootDir, 'src', 'components', 'Header.tsx');
    assert.ok(fs.existsSync(headerPath), 'Header.tsx must exist');
    const content = fs.readFileSync(headerPath, 'utf8');

    // Check canSwitchStream logic
    assert.ok(content.includes('canSwitchStream'), 'Header.tsx must define canSwitchStream');
    assert.ok(
      content.includes('assigned === "English & Filipino"') ||
      content.includes("assigned === 'English & Filipino'") ||
      content.includes("assignedSubject === 'English & Filipino'") ||
      content.includes('assignedSubject === "English & Filipino"'),
      'Header.tsx must allow stream switching when assignedSubject is English & Filipino'
    );
    assert.ok(
      content.includes('{mounted && canSwitchStream &&'),
      'Header.tsx must conditionally render stream switcher pills based on canSwitchStream'
    );
  });

  test('3. Sidebar.tsx directs Filipino teachers to filipinoNavSections and English to allNavSections', () => {
    const sidebarPath = path.join(rootDir, 'src', 'components', 'Sidebar.tsx');
    assert.ok(fs.existsSync(sidebarPath), 'Sidebar.tsx must exist');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    assert.ok(content.includes('isFilipinoTeacher'), 'Sidebar.tsx must define isFilipinoTeacher check');
    assert.ok(content.includes('isEnglishTeacher'), 'Sidebar.tsx must define isEnglishTeacher check');
    assert.ok(
      content.includes('filipinoNavSections'),
      'Sidebar.tsx must use filipinoNavSections for Filipino reading teachers'
    );
    assert.ok(
      content.includes('Mga Ulat'),
      'Sidebar.tsx filipinoNavSections must use "Mga Ulat" for reports'
    );
    assert.ok(
      content.includes('Filipino Reading Teacher') && content.includes('English Reading Teacher'),
      'Sidebar.tsx must show specialized portal roles'
    );
  });

  test('4. Dashboard home pages enforce automatic redirection based on assignedSubject', () => {
    const engDashboardPath = path.join(rootDir, 'src', 'app', 'dashboard', 'page.tsx');
    const filDashboardPath = path.join(rootDir, 'src', 'app', 'dashboard', 'filipino-reading', 'page.tsx');

    assert.ok(fs.existsSync(engDashboardPath), 'dashboard/page.tsx must exist');
    assert.ok(fs.existsSync(filDashboardPath), 'dashboard/filipino-reading/page.tsx must exist');

    const engContent = fs.readFileSync(engDashboardPath, 'utf8');
    const filContent = fs.readFileSync(filDashboardPath, 'utf8');

    // English dashboard redirects Filipino teachers to Filipino portal
    assert.ok(
      engContent.includes('/dashboard/filipino-reading') &&
      (engContent.includes('assignedSubject === "Filipino"') || engContent.includes("assignedSubject === 'Filipino'")),
      'dashboard/page.tsx must redirect Filipino teachers to /dashboard/filipino-reading'
    );

    // Filipino dashboard redirects English teachers to English portal
    assert.ok(
      filContent.includes('/dashboard') &&
      (filContent.includes('assignedSubject === "English"') || filContent.includes("assignedSubject === 'English'")),
      'dashboard/filipino-reading/page.tsx must redirect English teachers to /dashboard'
    );
  });

  test('5. GST page strictly implements AralSync Maroon/Crimson theme and removes redundant inline toggle pills', () => {
    const gstPath = path.join(rootDir, 'src', 'app', 'dashboard', 'gst', 'page.tsx');
    assert.ok(fs.existsSync(gstPath), 'gst/page.tsx must exist');
    const content = fs.readFileSync(gstPath, 'utf8');

    // Maroon/Crimson primary action buttons
    assert.ok(
      content.includes('bg-red-800 hover:bg-red-900 text-white shadow-xs'),
      'GST page must use bg-red-800 hover:bg-red-900 text-white shadow-xs for primary buttons'
    );

    // Active tabs maroon/crimson styling
    assert.ok(
      content.includes('border-red-800 text-red-900 bg-red-50/50 font-bold'),
      'GST page must use border-red-800 text-red-900 bg-red-50/50 font-bold for active tabs'
    );

    // No emerald green primary button styling
    assert.ok(
      !content.includes('bg-emerald-600'),
      'GST page must not use bg-emerald-600 for primary actions'
    );

    // Green is strictly reserved for Grade-Ready / Handa sa Baitang status tags
    assert.ok(
      content.includes('bg-emerald-50 text-emerald-700 border border-emerald-200') ||
      content.includes('bg-emerald-100 text-emerald-800'),
      'GST page must keep emerald styling reserved for Grade-Ready status'
    );

    // No redundant inline stream toggle pill buttons in the page body
    assert.ok(
      !content.includes('English Portal') || !content.includes('setActiveStream("english")'),
      'GST page must not render manual inline language toggle buttons'
    );
  });

  test('6. Reading Fluency workstation filters passages by active stream and displays Filipino levels', () => {
    const workstationPath = path.join(rootDir, 'src', 'app', 'dashboard', 'reading-fluency', 'page.tsx');
    assert.ok(fs.existsSync(workstationPath), 'reading-fluency/page.tsx must exist');
    const content = fs.readFileSync(workstationPath, 'utf8');

    // displayPassages memo filters by isFilipino
    assert.ok(
      content.includes('displayPassages = useMemo'),
      'reading-fluency/page.tsx must filter passages with displayPassages'
    );

    // Passage dropdown renders displayPassages
    assert.ok(
      content.includes('displayPassages.map'),
      'Passage selector dropdown must map over displayPassages'
    );

    // Filipino terminology helper
    assert.ok(
      content.includes('toFilipinoLevel'),
      'reading-fluency/page.tsx must define toFilipinoLevel helper'
    );
    assert.ok(
      content.includes('Malaya') && content.includes('Pampagkatuto') && content.includes('Pagkabigo'),
      'toFilipinoLevel must map to Malaya, Pampagkatuto, Pagkabigo'
    );
    assert.ok(
      content.includes('Phil-IRI Pinagsamang Antas (Talahanayan 3)'),
      'reading-fluency/page.tsx must support Filipino header for Table 3 Joint Profile'
    );
  });

  test('7. Coordinator Teacher Management supports English, Filipino, Dual-Subject, and portal access badges', () => {
    const teachersPagePath = path.join(rootDir, 'src', 'app', 'coordinator', 'teachers', 'page.tsx');
    const teachersApiPath = path.join(rootDir, 'src', 'app', 'api', 'coordinator', 'teachers', 'route.ts');

    assert.ok(fs.existsSync(teachersPagePath), 'coordinator/teachers/page.tsx must exist');
    assert.ok(fs.existsSync(teachersApiPath), 'coordinator/teachers/route.ts must exist');

    const pageContent = fs.readFileSync(teachersPagePath, 'utf8');
    const apiContent = fs.readFileSync(teachersApiPath, 'utf8');

    // Dropdown options
    assert.ok(
      pageContent.includes('value="English">English — English Reading Teacher'),
      'Teacher subject assignment dropdown must have English option'
    );
    assert.ok(
      pageContent.includes('value="Filipino">Filipino — Filipino Reading Teacher'),
      'Teacher subject assignment dropdown must have Filipino option'
    );
    assert.ok(
      pageContent.includes('value="English & Filipino">English &amp; Filipino — Dual Subject Holder'),
      'Teacher subject assignment dropdown must have English & Filipino option'
    );

    // Badges on teacher cards
    assert.ok(
      pageContent.includes('English Only') &&
      pageContent.includes('Filipino Only') &&
      pageContent.includes('Dual Language'),
      'Teacher cards must render portal access type badges (English Only, Filipino Only, Dual Language)'
    );

    // API PATCH handles English & Filipino
    assert.ok(
      apiContent.includes("'English & Filipino'"),
      'API PATCH must accept and support English & Filipino'
    );
  });

  test('8. Coordinator Learner Allocation separates English and Filipino Reading Teachers in Batch and Single Assignment', () => {
    const learnersPagePath = path.join(rootDir, 'src', 'app', 'coordinator', 'learners', 'page.tsx');
    const learnersAssignApiPath = path.join(rootDir, 'src', 'app', 'api', 'coordinator', 'learners', 'assign', 'route.ts');

    assert.ok(fs.existsSync(learnersPagePath), 'coordinator/learners/page.tsx must exist');
    assert.ok(fs.existsSync(learnersAssignApiPath), 'coordinator/learners/assign/route.ts must exist');

    const pageContent = fs.readFileSync(learnersPagePath, 'utf8');
    const apiContent = fs.readFileSync(learnersAssignApiPath, 'utf8');

    // State in learners page
    assert.ok(
      pageContent.includes('batchEnglishTeacherId') && pageContent.includes('batchFilipinoTeacherId'),
      'learners/page.tsx must maintain separate batchEnglishTeacherId and batchFilipinoTeacherId'
    );

    // Cards in Batch Section Assignment
    assert.ok(
      pageContent.includes('English Reading Teacher') && pageContent.includes('Filipino Reading Teacher'),
      'Batch Assignment must feature distinct English Reading Teacher and Filipino Reading Teacher cards'
    );

    // Assign API supports englishTeacherId and filipinoTeacherId
    assert.ok(
      apiContent.includes('englishTeacherId') && apiContent.includes('filipinoTeacherId'),
      'Assign API must accept englishTeacherId and filipinoTeacherId'
    );
    assert.ok(
      apiContent.includes("updateFields['assignedTeachers.english']") &&
      apiContent.includes("updateFields['assignedTeachers.filipino']"),
      'Assign API must update assignedTeachers.english and assignedTeachers.filipino'
    );
    assert.ok(
      apiContent.includes("batchUpdate['assignedTeachers.english']") &&
      apiContent.includes("batchUpdate['assignedTeachers.filipino']"),
      'Batch Assign API must update assignedTeachers.english and assignedTeachers.filipino'
    );
  });
});

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Strict Subject & Assigned-Learner Scoping Suite', () => {
  const teacherScopePath = path.join(__dirname, '..', 'src', 'lib', 'teacherScope.ts');
  const dashboardRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'dashboard', 'route.ts');
  const dashboardPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'page.tsx');
  const skillGapRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'skill-gap', 'route.ts');
  const skillGapPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'skill-gap', 'page.tsx');
  const learningRecoveryRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'learning-recovery', 'route.ts');
  const learningRecoveryPagePath = path.join(__dirname, '..', 'src', 'app', 'dashboard', 'learning-recovery', 'page.tsx');
  const progressMonitoringRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'teacher', 'progress-monitoring', 'route.ts');

  const teacherScopeSrc = fs.readFileSync(teacherScopePath, 'utf8');
  const dashboardRouteSrc = fs.readFileSync(dashboardRoutePath, 'utf8');
  const dashboardPageSrc = fs.readFileSync(dashboardPagePath, 'utf8');
  const skillGapRouteSrc = fs.readFileSync(skillGapRoutePath, 'utf8');
  const skillGapPageSrc = fs.readFileSync(skillGapPagePath, 'utf8');
  const learningRecoveryRouteSrc = fs.readFileSync(learningRecoveryRoutePath, 'utf8');
  const learningRecoveryPageSrc = fs.readFileSync(learningRecoveryPagePath, 'utf8');
  const progressMonitoringRouteSrc = fs.readFileSync(progressMonitoringRoutePath, 'utf8');

  test('1. teacherScope.ts exports getTeacherLearnerFilter with subject-specific assignment scoping', () => {
    assert.ok(
      teacherScopeSrc.includes('export function getTeacherLearnerFilter('),
      'teacherScope.ts must export getTeacherLearnerFilter'
    );
    assert.ok(
      teacherScopeSrc.includes("'assignedTeachers.reading'") &&
      teacherScopeSrc.includes("'assignedTeachers.math'") &&
      teacherScopeSrc.includes("'assignedTeachers.science'"),
      'getTeacherLearnerFilter must handle reading, math, and science teacher fields'
    );
  });

  test('2. dashboard/route.ts scopes buildChartData, recentScans, and pendingReviews to assigned learners', () => {
    // buildChartData signature and studentId scoping
    assert.ok(
      dashboardRouteSrc.includes('buildChartData(teacherSubject: TeacherSubject, assignedStudentIds: any[])') ||
      dashboardRouteSrc.includes('buildChartData(teacherSubject, assignedStudentIds)'),
      'buildChartData must accept assignedStudentIds'
    );
    assert.ok(
      dashboardRouteSrc.includes('studentId: { $in: assignedStudentIds }'),
      'dashboard queries must scope by studentId: { $in: assignedStudentIds }'
    );

    // activeKey exclusion of 0 keys for other subjects
    assert.ok(
      dashboardRouteSrc.includes('[activeKey]:') &&
      dashboardRouteSrc.includes("teacherSubject !== 'All'"),
      'buildChartData must return ONLY the active subject key when teacherSubject is not All'
    );

    // pendingReviews scoping
    assert.ok(
      dashboardRouteSrc.includes("type: 'READING_FLUENCY'") &&
      dashboardRouteSrc.includes("status: 'pending'") &&
      dashboardRouteSrc.includes("studentId: { $in: assignedStudentIds }"),
      'pendingReviews for Reading must scope by type, status, and assignedStudentIds'
    );
    assert.ok(
      dashboardRouteSrc.includes("subject: teacherSubject") &&
      dashboardRouteSrc.includes("studentId: { $in: assignedStudentIds }"),
      'pendingReviews for Math/Science must scope by subject and assignedStudentIds'
    );
  });

  test('3. dashboard/page.tsx enforces dynamic title, single-subject bars, and custom tooltip filtering', () => {
    // Dynamic titles
    assert.ok(
      dashboardPageSrc.includes('"Weekly Reading Mastery Progress"') &&
      dashboardPageSrc.includes('"Weekly Numeracy Mastery Progress"') &&
      dashboardPageSrc.includes('"Weekly Science Mastery Progress"') &&
      dashboardPageSrc.includes('"Mastery Progress by Subject"'),
      'Dashboard page must dynamically title chart according to teacher subject'
    );

    // Conditional bars
    assert.ok(
      dashboardPageSrc.includes('(isMathTeacher || isAllSubjects) &&') ||
      dashboardPageSrc.includes('teacherSubject === "Math"'),
      'Dashboard page must conditionally render Numeracy bar'
    );
    assert.ok(
      dashboardPageSrc.includes('(isReadingTeacher || isAllSubjects) &&') ||
      dashboardPageSrc.includes('teacherSubject === "Reading"'),
      'Dashboard page must conditionally render Reading bar'
    );
    assert.ok(
      dashboardPageSrc.includes('(isScienceTeacher || isAllSubjects) &&') ||
      dashboardPageSrc.includes('teacherSubject === "Science"'),
      'Dashboard page must conditionally render Science bar'
    );

    // CustomTooltip and Legend
    assert.ok(
      dashboardPageSrc.includes('CustomTooltip teacherSubject={teacherSubject}') ||
      dashboardPageSrc.includes('teacherSubject?: string'),
      'CustomTooltip must receive and filter by teacherSubject'
    );
    assert.ok(
      dashboardPageSrc.includes('{isAllSubjects && (') &&
      dashboardPageSrc.includes('<Legend'),
      'Legend must be hidden when scoped to a single subject'
    );
  });

  test('4. skill-gap/route.ts defaults to assignedStudentIds and returns only teacher competencies', () => {
    assert.ok(
      skillGapRouteSrc.includes('getTeacherLearnerFilter'),
      'skill-gap route must import and use getTeacherLearnerFilter'
    );
    assert.ok(
      skillGapRouteSrc.includes('assignedStudentIds'),
      'skill-gap route must gather assignedStudentIds'
    );
    assert.ok(
      skillGapRouteSrc.includes('studentIds: mongoose.Types.ObjectId[] = assignedStudentIds') ||
      skillGapRouteSrc.includes('match.studentId = { $in: studentIds }') ||
      skillGapRouteSrc.includes('match.studentId = { $in: assignedStudentIds }'),
      'match.studentId must default to assignedStudentIds when no filters are present'
    );
    assert.ok(
      skillGapRouteSrc.includes("teacherSubject === 'Math' ? 'Numeracy'"),
      'relevantOrder must isolate to the teacher assigned subject'
    );
  });

  test('5. learning-recovery/route.ts scopes records to assigned learners and isolates subject deficiencies', () => {
    assert.ok(
      learningRecoveryRouteSrc.includes('getTeacherLearnerFilter'),
      'learning-recovery route must import and use getTeacherLearnerFilter'
    );
    assert.ok(
      learningRecoveryRouteSrc.includes('isReadingScope') &&
      learningRecoveryRouteSrc.includes('isMathScope') &&
      learningRecoveryRouteSrc.includes('isScienceScope'),
      'learning-recovery route must isolate evaluation per subject scope'
    );
    assert.ok(
      learningRecoveryRouteSrc.includes("'Suggested: ARAL Numeracy Recovery (Key Stage 3)'") ||
      learningRecoveryRouteSrc.includes('ARAL Numeracy Recovery'),
      'Math recovery must suggest numeracy/math interventions'
    );
    assert.ok(
      learningRecoveryRouteSrc.includes("'Suggested: ARAL Science Mastery Module (Key Stage 3)'") ||
      learningRecoveryRouteSrc.includes('ARAL Science Mastery Module'),
      'Science recovery must suggest science interventions'
    );
    assert.ok(
      learningRecoveryRouteSrc.includes('readingFrustration: teacherSubject === \'Math\' || teacherSubject === \'Science\' ? 0 : readingFrustration') ||
      learningRecoveryRouteSrc.includes('readingFrustration = 0') ||
      learningRecoveryRouteSrc.includes('isReadingScope || teacherSubject === \'All\''),
      'Math and Science teachers must not evaluate readingFrustration'
    );
  });

  test('6. learning-recovery/page.tsx adapts cards and subtitles dynamically to teacherSubject', () => {
    assert.ok(
      learningRecoveryPageSrc.includes('{card2Title}') &&
      learningRecoveryPageSrc.includes('{card2Subtext}') &&
      learningRecoveryPageSrc.includes('{card2Value}'),
      'Card 2 must dynamically adapt to teacherSubject (Critical Numeracy / Critical Science / Reading Frustration)'
    );
    assert.ok(
      learningRecoveryPageSrc.includes('{card3Title}') &&
      learningRecoveryPageSrc.includes('{card3Subtext}'),
      'Card 3 must dynamically adapt to teacherSubject'
    );
    assert.ok(
      learningRecoveryPageSrc.includes('{subtitle}'),
      'Roster subtitle must adapt dynamically to teacherSubject'
    );
  });

  test('7. progress-monitoring/route.ts scopes records and interventions strictly to assigned learners', () => {
    assert.ok(
      progressMonitoringRouteSrc.includes('getTeacherLearnerFilter'),
      'progress-monitoring route must import and use getTeacherLearnerFilter'
    );
    assert.ok(
      progressMonitoringRouteSrc.includes('LearnerRecord.find(learnerScopeQuery)'),
      'progress-monitoring overall view must scope records to learnerScopeQuery'
    );
    assert.ok(
      progressMonitoringRouteSrc.includes('...learnerScopeQuery'),
      'progress-monitoring single learner view must scope to learnerScopeQuery'
    );
    assert.ok(
      progressMonitoringRouteSrc.includes('studentId: { $in: studentIds }') &&
      progressMonitoringRouteSrc.includes('getInterventionSubjectFilter(teacherSubject)'),
      'progress-monitoring must scope interventions to assigned studentIds and teacherSubject'
    );
  });
});

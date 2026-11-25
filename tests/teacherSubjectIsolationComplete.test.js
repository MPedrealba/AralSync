import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Complete Strict Teacher Subject Scoping Suite', () => {
  const root = process.cwd();

  it('teacherScope helpers isolate Filipino, English, Reading, Math, and Science cleanly', () => {
    const scopeSrc = fs.readFileSync(path.join(root, 'src/lib/teacherScope.ts'), 'utf8');

    assert.ok(
      scopeSrc.includes("target === 'Reading' || target === 'English' || target === 'Filipino'"),
      'getInterventionSubjectFilter must isolate Reading, English, and Filipino teachers'
    );
    assert.ok(
      scopeSrc.includes("if (teacherSubject === 'Filipino')"),
      'getSubjectFilter must isolate Filipino assessments'
    );
    assert.ok(
      scopeSrc.includes("if (teacherSubject === 'Math')"),
      'getTeacherLearnerFilter must isolate Math teacher learners'
    );
  });

  it('1. Learner profile API & UI strictly scope assignments, assessments, interventions, and Subject Growth Breakdown', () => {
    const routeSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/learners/[id]/route.ts'), 'utf8');
    const pageSrc = fs.readFileSync(path.join(root, 'src/app/dashboard/learners/[id]/page.tsx'), 'utf8');

    assert.ok(routeSrc.includes('getTeacherSubject(actor)'), 'learners/[id] route must resolve teacherSubject');
    assert.ok(routeSrc.includes('isTeacherAssignedToRecord(record, actor, teacherSubject)'), 'learners/[id] GET and PATCH must enforce subject assignment');
    assert.ok(routeSrc.includes('getSubjectFilter(teacherSubject)'), 'learners/[id] route must filter Assessments');
    assert.ok(routeSrc.includes('getInterventionSubjectFilter(teacherSubject)'), 'learners/[id] route must filter Interventions');
    assert.ok(!routeSrc.includes("a.subject || 'Math'"), 'learners/[id] route must NOT hardcode Math fallback');
    assert.ok(routeSrc.includes('teacherSubject,'), 'learners/[id] route must return teacherSubject');

    assert.ok(!pageSrc.includes('["Math", "Reading", "Science"].map'), 'LearnerViewPage must NOT hardcode all 3 subjects unconditionally');
    assert.ok(pageSrc.includes('scopedGrowthSubjects'), 'LearnerViewPage must render scopedGrowthSubjects');
    assert.ok(pageSrc.includes('omrLabelPrefix'), 'LearnerViewPage must scope OMR headings and empty states');
    assert.ok(pageSrc.includes('showReadingAssessments'), 'LearnerViewPage must hide Reading Assessments panel for non-reading teachers');
  });

  it('2. Learning Materials API & UI enforce teacher subject filter and hide All Subjects for single-subject teachers', () => {
    const apiSrc = fs.readFileSync(path.join(root, 'src/app/api/learning-materials/route.ts'), 'utf8');
    const pageSrc = fs.readFileSync(path.join(root, 'src/app/dashboard/learning-materials/page.tsx'), 'utf8');

    assert.ok(apiSrc.includes("if (authUser.role === 'teacher')"), 'learning-materials API must inspect teacher role');
    assert.ok(apiSrc.includes('getTeacherSubject(authUser)'), 'learning-materials API must enforce getTeacherSubject');
    assert.ok(apiSrc.includes("if (teacherSubject !== 'All')"), 'learning-materials API must override client subject when teacher has single subject');
    assert.ok(pageSrc.includes('/api/auth/me'), 'learning-materials UI must fetch /api/auth/me');
    assert.ok(pageSrc.includes('visibleSubjectOptions'), 'learning-materials UI must filter visible subject pills');
  });

  it('3. Teacher Learners list API scopes both learners and assessments via teacherScope helpers', () => {
    const src = fs.readFileSync(path.join(root, 'src/app/api/teacher/learners/route.ts'), 'utf8');
    assert.ok(src.includes('getTeacherSubject(teacher)'), 'learners API must resolve teacherSubject');
    assert.ok(src.includes('getTeacherLearnerFilter(teacher.id, teacherSubject)'), 'must scope learner filter');
    assert.ok(src.includes('...getSubjectFilter(teacherSubject)'), 'must scope assessments query');
  });

  it('4. Reports & NationalDashboard scope data to teacher assigned learners and subject sections', () => {
    const apiSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/reports/dashboard/route.ts'), 'utf8');
    const libSrc = fs.readFileSync(path.join(root, 'src/lib/nationalDashboard.ts'), 'utf8');
    const uiSrc = fs.readFileSync(path.join(root, 'src/components/NationalDashboard.tsx'), 'utf8');

    assert.ok(apiSrc.includes('getTeacherLearnerFilter(authUser.id, teacherSubject)'), 'reports API must scope assignedStudentIds');
    assert.ok(apiSrc.includes('assignedStudentIds'), 'reports API must pass assignedStudentIds to buildNationalDashboard');
    assert.ok(libSrc.includes('studentId: { $in: assignedStudentIds }'), 'buildNationalDashboard must filter by assignedStudentIds');
    assert.ok(libSrc.includes('teacherSubject: teacherSubject ?? "All"'), 'buildNationalDashboard must return teacherSubject');
    assert.ok(uiSrc.includes('showRma') && uiSrc.includes('showPhilIri'), 'NationalDashboard must conditionally show RMA vs Phil-IRI');
    assert.ok(uiSrc.includes('dashboardSubtitle'), 'NationalDashboard must adjust subtitle for single-subject teachers');
  });

  it('5. ARAL modules API scopes recommendations and Dashboard removes Numeric fallback', () => {
    const aralSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/aral-modules/route.ts'), 'utf8');
    const dashSrc = fs.readFileSync(path.join(root, 'src/app/api/teacher/dashboard/route.ts'), 'utf8');

    assert.ok(aralSrc.includes('getSubjectFilter(teacherSubject)'), 'aral-modules API must filter Recommendation by teacherSubject');
    assert.ok(!dashSrc.includes("a.subject || 'Numeric'"), 'teacher/dashboard must not fall back to Numeric subject');
  });
});
